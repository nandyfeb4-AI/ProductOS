from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from html import unescape
import re
from secrets import token_urlsafe
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.repositories.connector_repository import ConnectorRepository
from app.schemas.common import InsightBundle
from app.schemas.connectors import (
    JourneyCategoryItems,
    JourneyExtraction,
    JourneyStageData,
    MuralBoard,
    MuralImportResponse,
    MuralRoom,
    MuralWidget,
    MuralWorkspace,
)


MURAL_BASE_URL = "https://app.mural.co/api/public/v1"
MURAL_AUTHORIZE_URL = f"{MURAL_BASE_URL}/authorization/oauth2/"
MURAL_TOKEN_URL = f"{MURAL_BASE_URL}/authorization/oauth2/token"

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

NOISE_TEXT_PATTERNS = [
    "experience steps",
    "interactions",
    "areas of opportunity",
    "positive moments",
    "negative moments",
    "goals & motivations",
    "enter",
    "engage",
    "exit",
    "rank items by priority or importance",
    "persona name",
    "short description of the persona",
    "what is the typical context of the real people represented by this archetype",
    "what does the person do to accomplish their goals",
    "beyond our product and service, what motivates this person",
    "what keeps them up at night",
    "what does the persona do to accomplish their goals",
    "quote from the persona's perspective",
    "quote from the persona perspective",
    "what interactions do they have at each step along the way",
    "where do they see or talk to",
    "where are they",
    "what digital touchpoints or physical objects do they use",
    "how might we make each step better",
    "what ideas do we have",
    "what have others suggested",
    "what steps does a typical person find enjoyable",
    "what steps does a typical person find frustrating",
    "how does someone become aware of this service",
    "what do people experience as they begin the process",
    "in the core moments in the process, what happens",
    "what happens as the process finishes",
    "what happens after the experience is over",
    "situation and context",
    "goals and motivations",
    "fears and frustrations",
    "tasks and tactics",
    "sample text",
    "see an example",
]

CONTENTFUL_WIDGET_TYPES = {
    "sticky-note",
    "sticky note",
    "text",
    "shape",
    "card",
    "note",
}

JOURNEY_ROW_CATEGORY_MAP = {
    "experience steps": "experience_steps",
    "goals & motivations": "goals_and_motivations",
    "positive moments": "positive_moments",
    "negative moments": "pain_points",
    "areas of opportunity": "opportunities",
    "interactions": "action_items",
}

JOURNEY_ROW_TO_STAGE_FIELD_MAP = {
    "experience steps": "experience_steps",
    "interactions": "interactions",
    "goals & motivations": "goals_and_motivations",
    "positive moments": "positive_moments",
    "negative moments": "negative_moments",
    "areas of opportunity": "areas_of_opportunity",
}

STAGE_ORDER = {
    "entice": 0,
    "enter": 1,
    "engage": 2,
    "exit": 3,
    "extend": 4,
}


@dataclass
class OAuthSession:
    state: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scopes: Optional[list[str]] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None


class MuralService:
    """Read-only MVP connector for Mural OAuth, discovery, and import."""

    def __init__(self) -> None:
        self._sessions: dict[str, OAuthSession] = {}
        self._repository = ConnectorRepository()

    def get_authorization_url(self) -> tuple[str, str]:
        self._ensure_configured()
        state = token_urlsafe(24)
        self._sessions[state] = OAuthSession(state=state)
        query = urlencode(
            {
                "client_id": settings.mural_client_id,
                "redirect_uri": settings.mural_redirect_uri,
                "scope": settings.mural_scopes,
                "state": state,
                "response_type": "code",
            }
        )
        return f"{MURAL_AUTHORIZE_URL}?{query}", state

    async def exchange_code(self, code: str, state: str) -> OAuthSession:
        session = self._sessions.get(state)
        if not session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Mural OAuth state.")

        response = await self._post_token(
            {
                "client_id": settings.mural_client_id,
                "client_secret": settings.mural_client_secret,
                "redirect_uri": settings.mural_redirect_uri,
                "code": code,
                "grant_type": "authorization_code",
            }
        )

        session.access_token = response["access_token"]
        session.refresh_token = response.get("refresh_token")
        session.expires_at = datetime.now(UTC) + timedelta(seconds=response.get("expires_in", 900))
        session.scopes = settings.mural_scopes.split()

        profile = await self._request("GET", "/users/me", session)
        profile_value = profile.get("value", profile)
        first_name = (profile_value.get("firstName") or "").strip()
        last_name = (profile_value.get("lastName") or "").strip()
        full_name = " ".join(part for part in (first_name, last_name) if part).strip()

        session.user_id = profile_value.get("id")
        session.username = profile_value.get("email") or profile_value.get("username")
        session.full_name = full_name or profile_value.get("name")
        self._persist_session(session)
        return session

    def get_session(self, state: str) -> OAuthSession:
        session = self._sessions.get(state)
        if not session:
            session = self._load_persisted_session(state)
            if session:
                self._sessions[state] = session
        if not session or not session.access_token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Mural connection found for the provided state.",
            )
        return session

    async def list_workspaces(self, state: str) -> list[MuralWorkspace]:
        payload = await self._request("GET", "/workspaces", self.get_session(state))
        return [
            MuralWorkspace(
                id=item["id"],
                name=item.get("name", "Untitled Workspace"),
                member_count=item.get("memberCount"),
            )
            for item in payload.get("value", [])
        ]

    async def list_rooms(self, state: str, workspace_id: str) -> list[MuralRoom]:
        payload = await self._request("GET", f"/workspaces/{workspace_id}/rooms", self.get_session(state))
        return [
            MuralRoom(
                id=item["id"],
                name=item.get("name", "Untitled Room"),
                workspace_id=workspace_id,
            )
            for item in payload.get("value", [])
        ]

    async def list_murals(self, state: str, workspace_id: str) -> list[MuralBoard]:
        payload = await self._request(
            "GET",
            f"/workspaces/{workspace_id}/murals",
            self.get_session(state),
            params={"status": "active", "sortBy": "lastModified"},
        )
        return [
            MuralBoard(
                id=item["id"],
                name=item.get("title") or item.get("name") or "Untitled Mural",
                workspace_id=workspace_id,
                room_id=str(item["roomId"]) if item.get("roomId") is not None else None,
                last_modified=(
                    str(item["updatedOn"])
                    if item.get("updatedOn") is not None
                    else str(item["lastModified"])
                    if item.get("lastModified") is not None
                    else None
                ),
            )
            for item in payload.get("value", [])
        ]

    async def get_widgets(self, state: str, mural_id: str) -> list[MuralWidget]:
        payload = await self._request(
            "GET",
            f"/murals/{mural_id}/widgets",
            self.get_session(state),
            params={"limit": 100},
        )
        widgets: list[MuralWidget] = []
        for item in payload.get("value", []):
            widgets.append(
                MuralWidget(
                    id=item["id"],
                    type=item.get("type", "unknown"),
                    text=self._extract_widget_text(item),
                    title=item.get("title"),
                    parent_id=item.get("parentId"),
                    raw=item,
                )
            )
        return widgets

    async def import_mural(self, state: str, mural_id: str) -> MuralImportResponse:
        widgets = await self.get_widgets(state, mural_id)
        text_snippets = self._extract_meaningful_text(widgets)
        journey = self._extract_journey_structure(widgets)
        insights = self._extract_structured_insights(widgets, text_snippets, journey)
        mural_name = next((widget.title for widget in widgets if widget.title), None)
        return MuralImportResponse(
            mural_id=mural_id,
            mural_name=mural_name,
            imported_widget_count=len(widgets),
            extracted_text_count=len(text_snippets),
            extracted_text=text_snippets,
            insights=insights,
            journey=journey,
        )

    def _ensure_configured(self) -> None:
        if not settings.mural_client_id or not settings.mural_client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Mural connector is not configured. Set MURAL_CLIENT_ID and MURAL_CLIENT_SECRET.",
            )

    async def _post_token(self, data: dict[str, str]) -> dict[str, Any]:
        self._ensure_configured()
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                MURAL_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if response.is_error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Mural token exchange failed: {response.text}",
            )
        return response.json()

    async def _request(
        self,
        method: str,
        path: str,
        session: OAuthSession,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        if not session.access_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mural access token missing.")
        headers = {"Authorization": f"Bearer {session.access_token}"}
        async with httpx.AsyncClient(base_url=MURAL_BASE_URL, timeout=20.0) as client:
            response = await client.request(method, path, headers=headers, params=params)
        if response.status_code == status.HTTP_401_UNAUTHORIZED and session.refresh_token:
            refreshed = await self._post_token(
                {
                    "client_id": settings.mural_client_id,
                    "client_secret": settings.mural_client_secret,
                    "refresh_token": session.refresh_token,
                    "grant_type": "refresh_token",
                }
            )
            session.access_token = refreshed["access_token"]
            session.expires_at = datetime.now(UTC) + timedelta(seconds=refreshed.get("expires_in", 900))
            headers["Authorization"] = f"Bearer {session.access_token}"
            self._persist_session(session)
            async with httpx.AsyncClient(base_url=MURAL_BASE_URL, timeout=20.0) as client:
                response = await client.request(method, path, headers=headers, params=params)
        if response.is_error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Mural API request failed: {response.text}",
            )
        return response.json()

    def _extract_widget_text(self, item: dict[str, Any]) -> Optional[str]:
        for key in ("htmlText", "text", "title", "description"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return self._clean_text(value)

        for nested in ("data", "content", "metadata"):
            value = item.get(nested)
            if isinstance(value, dict):
                for key in ("htmlText", "text", "title", "description"):
                    nested_value = value.get(key)
                    if isinstance(nested_value, str) and nested_value.strip():
                        return self._clean_text(nested_value)
        return None

    def _clean_text(self, value: str) -> str:
        cleaned = unescape(value)
        cleaned = HTML_TAG_RE.sub(" ", cleaned)
        cleaned = cleaned.replace("\xa0", " ")
        cleaned = WHITESPACE_RE.sub(" ", cleaned).strip()
        return cleaned

    def _extract_meaningful_text(self, widgets: list[MuralWidget]) -> list[str]:
        snippets: list[str] = []
        contentful_sticky_count = 0

        for widget in widgets:
            widget_type = widget.type.lower().strip()
            text = (widget.text or "").strip()
            if widget_type == "sticky note" and text and not self._is_noise_text(text):
                contentful_sticky_count += 1

        for widget in widgets:
            text = (widget.text or "").strip()
            if not text:
                continue
            if self._is_noise_text(text):
                continue

            widget_type = widget.type.lower().strip()
            # Journey/persona templates often contain many helper labels and empty sticky placeholders.
            # If there are no filled sticky notes, returning no insights is more honest than promoting scaffolding text.
            if contentful_sticky_count == 0 and widget_type != "sticky note":
                continue
            # Favor content-bearing widgets but still allow unknowns if the text looks real.
            if widget_type not in CONTENTFUL_WIDGET_TYPES and self._looks_like_layout_text(text):
                continue

            snippets.append(text)

        # Preserve order while removing duplicates.
        deduped: list[str] = []
        seen: set[str] = set()
        for snippet in snippets:
            key = snippet.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(snippet)
        return deduped

    def _is_noise_text(self, text: str) -> bool:
        normalized = text.lower().strip(" .:;-")
        if len(normalized) < 3:
            return True
        if "example" in normalized:
            return True
        return any(pattern in normalized for pattern in NOISE_TEXT_PATTERNS)

    def _looks_like_layout_text(self, text: str) -> bool:
        normalized = text.lower()
        if normalized.endswith("?"):
            return True
        if len(normalized.split()) <= 6 and any(pattern in normalized for pattern in NOISE_TEXT_PATTERNS):
            return True
        return False

    def _extract_insights(self, text_snippets: list[str]) -> InsightBundle:
        action_items: list[str] = []
        decisions: list[str] = []
        pain_points: list[str] = []
        opportunities: list[str] = []

        for text in text_snippets:
            normalized = text.lower()
            if any(term in normalized for term in ("action", "todo", "follow up", "owner", "next step")):
                action_items.append(text)
            elif any(term in normalized for term in ("decision", "decided", "agreed")):
                decisions.append(text)
            elif any(term in normalized for term in ("pain", "problem", "issue", "blocked", "friction")):
                pain_points.append(text)
            elif any(term in normalized for term in ("opportunity", "idea", "improve", "could", "should")):
                opportunities.append(text)

        if not any((action_items, decisions, pain_points, opportunities)):
            opportunities = text_snippets[:5]

        return InsightBundle(
            action_items=action_items[:20],
            decisions=decisions[:20],
            pain_points=pain_points[:20],
            opportunities=opportunities[:20],
        )

    def _extract_structured_insights(
        self,
        widgets: list[MuralWidget],
        text_snippets: list[str],
        journey: JourneyExtraction,
    ) -> InsightBundle:
        journey_insights = self._extract_journey_map_insights(widgets, journey)
        if any(
            (
                journey_insights.action_items,
                journey_insights.decisions,
                journey_insights.pain_points,
                journey_insights.opportunities,
            )
        ):
            return journey_insights
        return self._extract_insights(text_snippets)

    def _extract_journey_map_insights(
        self,
        widgets: list[MuralWidget],
        journey: JourneyExtraction,
    ) -> InsightBundle:
        action_items: list[str] = []
        pain_points: list[str] = []
        opportunities: list[str] = []

        for stage in journey.stages:
            action_items.extend(stage.categories.interactions)
            pain_points.extend(stage.categories.negative_moments)
            opportunities.extend(stage.categories.areas_of_opportunity)

        if any((action_items, pain_points, opportunities)):
            return InsightBundle(
                action_items=self._dedupe_preserve_order(action_items)[:20],
                decisions=[],
                pain_points=self._dedupe_preserve_order(pain_points)[:20],
                opportunities=self._dedupe_preserve_order(opportunities)[:20],
            )

        row_headers: list[dict[str, Any]] = []
        sticky_notes: list[dict[str, Any]] = []

        for widget in widgets:
            widget_type = widget.type.lower().strip()
            raw = widget.raw
            text = (widget.text or "").strip()
            x = raw.get("x")
            y = raw.get("y")
            parent_id = raw.get("parentId")

            if x is None or y is None or parent_id is None:
                continue

            normalized = text.lower().strip(" .:;-")
            if widget_type == "text" and normalized in JOURNEY_ROW_CATEGORY_MAP:
                row_headers.append(
                    {
                        "label": normalized,
                        "x": float(x),
                        "y": float(y),
                        "parent_num": self._extract_parent_num(parent_id),
                    }
                )

            if widget_type in {"sticky note", "sticky-note"} and text and not self._is_noise_text(text):
                sticky_notes.append(
                    {
                        "text": text,
                        "x": float(x),
                        "y": float(y),
                        "parent_num": self._extract_parent_num(parent_id),
                    }
                )

        if not row_headers or not sticky_notes:
            return InsightBundle(action_items=[], decisions=[], pain_points=[], opportunities=[])

        row_headers = [header for header in row_headers if header["parent_num"] is not None]
        sticky_notes = [sticky for sticky in sticky_notes if sticky["parent_num"] is not None]
        if not row_headers or not sticky_notes:
            return InsightBundle(action_items=[], decisions=[], pain_points=[], opportunities=[])

        row_headers.sort(key=lambda header: header["parent_num"])

        action_items: list[str] = []
        pain_points: list[str] = []
        opportunities: list[str] = []

        for sticky in sticky_notes:
            header = self._match_journey_header(row_headers, sticky["parent_num"])
            if not header:
                continue
            category = JOURNEY_ROW_CATEGORY_MAP.get(header["label"])
            if category == "action_items":
                action_items.append(sticky["text"])
            elif category == "pain_points":
                pain_points.append(sticky["text"])
            elif category == "opportunities":
                opportunities.append(sticky["text"])

        return InsightBundle(
            action_items=self._dedupe_preserve_order(action_items)[:20],
            decisions=[],
            pain_points=self._dedupe_preserve_order(pain_points)[:20],
            opportunities=self._dedupe_preserve_order(opportunities)[:20],
        )

    def _extract_journey_structure(self, widgets: list[MuralWidget]) -> JourneyExtraction:
        column_headers: list[dict[str, Any]] = []
        row_headers: list[dict[str, Any]] = []
        sticky_notes: list[dict[str, Any]] = []

        for widget in widgets:
            widget_type = widget.type.lower().strip()
            raw = widget.raw
            text = (widget.text or "").strip()
            x = raw.get("x")
            y = raw.get("y")
            parent_id = raw.get("parentId")

            if x is None or y is None or parent_id is None:
                continue

            normalized = text.lower().strip(" .:;-")
            parent_num = self._extract_parent_num(parent_id)
            if parent_num is None:
                continue

            if widget_type == "text" and normalized in JOURNEY_ROW_TO_STAGE_FIELD_MAP:
                row_headers.append(
                    {
                        "label": normalized,
                        "x": float(x),
                        "y": float(y),
                        "parent_num": parent_num,
                    }
                )
                continue

            if widget_type == "text" and self._looks_like_stage_header(text):
                column_headers.append(
                    {
                        "label": text,
                        "x": float(x),
                        "y": float(y),
                        "parent_num": parent_num,
                    }
                )
                continue

            if widget_type in {"sticky note", "sticky-note"} and text and not self._is_noise_text(text):
                sticky_notes.append(
                    {
                        "text": text,
                        "x": float(x),
                        "y": float(y),
                        "parent_num": parent_num,
                    }
                )

        if not sticky_notes or not row_headers or not column_headers:
            return JourneyExtraction(stages=[], uncategorized=[])

        row_headers.sort(key=lambda item: item["parent_num"])
        column_headers = self._normalize_stage_headers(column_headers)
        stage_positions_reliable = self._stage_positions_reliable(column_headers)

        stages_map: dict[str, JourneyCategoryItems] = {}
        uncategorized: list[str] = []

        for sticky in sticky_notes:
            row_header = self._match_journey_header(row_headers, sticky["parent_num"])
            stage_header = None
            if stage_positions_reliable:
                stage_header = self._match_stage_header_by_x(
                    column_headers, sticky["x"]
                ) or self._match_header_by_parent(column_headers, sticky["parent_num"])
            elif column_headers:
                stage_header = column_headers[0]

            if not row_header or not stage_header:
                uncategorized.append(sticky["text"])
                continue

            stage_name = stage_header["label"]
            category_field = JOURNEY_ROW_TO_STAGE_FIELD_MAP.get(row_header["label"])
            if not category_field:
                uncategorized.append(sticky["text"])
                continue

            bucket = stages_map.setdefault(stage_name, JourneyCategoryItems())
            getattr(bucket, category_field).append(sticky["text"])

        ordered_stages = [
            JourneyStageData(stage=header["label"], categories=stages_map.get(header["label"], JourneyCategoryItems()))
            for header in column_headers
            if header["label"] in stages_map
        ]

        return JourneyExtraction(
            stages=ordered_stages,
            uncategorized=self._dedupe_preserve_order(uncategorized),
        )

    def _normalize_stage_headers(self, headers: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: dict[str, dict[str, Any]] = {}
        for header in headers:
            label = header["label"].strip()
            key = label.lower()
            if key not in deduped:
                deduped[key] = header
        return sorted(
            deduped.values(),
            key=lambda item: (STAGE_ORDER.get(item["label"].strip().lower(), 999), item["parent_num"]),
        )

    def _stage_positions_reliable(self, headers: list[dict[str, Any]]) -> bool:
        if len(headers) < 2:
            return False
        xs = [header["x"] for header in headers]
        return (max(xs) - min(xs)) > 100

    def _dedupe_preserve_order(self, values: list[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for value in values:
            key = value.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(value)
        return deduped

    def _extract_parent_num(self, parent_id: str) -> Optional[int]:
        try:
            return int(str(parent_id).split("-", 1)[0])
        except (TypeError, ValueError):
            return None

    def _match_journey_header(
        self,
        row_headers: list[dict[str, Any]],
        sticky_parent_num: int,
    ) -> Optional[dict[str, Any]]:
        candidate: Optional[dict[str, Any]] = None
        for index, header in enumerate(row_headers):
            current_num = header["parent_num"]
            next_num = row_headers[index + 1]["parent_num"] if index + 1 < len(row_headers) else None
            if sticky_parent_num > current_num and (next_num is None or sticky_parent_num < next_num):
                return header
            if sticky_parent_num == current_num:
                candidate = header
        return candidate

    def _match_header_by_parent(
        self,
        headers: list[dict[str, Any]],
        sticky_parent_num: int,
    ) -> Optional[dict[str, Any]]:
        candidate: Optional[dict[str, Any]] = None
        for index, header in enumerate(headers):
            current_num = header["parent_num"]
            next_num = headers[index + 1]["parent_num"] if index + 1 < len(headers) else None
            if sticky_parent_num > current_num and (next_num is None or sticky_parent_num < next_num):
                return header
            if sticky_parent_num == current_num:
                candidate = header
        return candidate

    def _match_row_header_by_y(
        self,
        headers: list[dict[str, Any]],
        sticky_y: float,
    ) -> Optional[dict[str, Any]]:
        candidate: Optional[dict[str, Any]] = None
        for index, header in enumerate(headers):
            current_y = header["y"]
            next_y = headers[index + 1]["y"] if index + 1 < len(headers) else None
            if sticky_y >= current_y and (next_y is None or sticky_y < next_y):
                return header
            if sticky_y == current_y:
                candidate = header
        return candidate

    def _match_stage_header_by_x(
        self,
        headers: list[dict[str, Any]],
        sticky_x: float,
    ) -> Optional[dict[str, Any]]:
        candidate: Optional[dict[str, Any]] = None
        for index, header in enumerate(headers):
            current_x = header["x"]
            next_x = headers[index + 1]["x"] if index + 1 < len(headers) else None
            if sticky_x >= current_x and (next_x is None or sticky_x < next_x):
                return header
            if sticky_x == current_x:
                candidate = header
        return candidate

    def _looks_like_stage_header(self, text: str) -> bool:
        normalized = text.strip().lower()
        return normalized in {"entice", "enter", "engage", "exit", "extend"}

    def _persist_session(self, session: OAuthSession) -> None:
        try:
            self._repository.save_connection(
                provider="mural",
                state=session.state,
                external_user_id=session.user_id,
                username=session.username,
                full_name=session.full_name,
                access_token=session.access_token,
                refresh_token=session.refresh_token,
                scopes=session.scopes or [],
                token_expires_at=session.expires_at,
            )
        except HTTPException:
            # Keep MVP resilient even if database persistence is temporarily unavailable.
            return

    def _load_persisted_session(self, state: str) -> Optional[OAuthSession]:
        try:
            record = self._repository.get_connection_by_state(state)
        except HTTPException:
            return None
        if not record:
            return None

        return OAuthSession(
            state=record["state"],
            access_token=record.get("access_token"),
            refresh_token=record.get("refresh_token"),
            expires_at=record.get("token_expires_at"),
            scopes=record.get("scopes") or [],
            user_id=record.get("external_user_id"),
            username=record.get("username"),
            full_name=record.get("full_name"),
        )

    def persist_import(self, state: str, response: MuralImportResponse) -> None:
        try:
            self._repository.save_sync_run(
                provider="mural",
                connection_state=state,
                external_resource_id=response.mural_id,
                external_resource_name=response.mural_name,
                imported_widget_count=response.imported_widget_count,
                extracted_text=response.extracted_text,
                insights=response.insights.model_dump(),
            )
        except HTTPException:
            return

    def disconnect(self) -> dict[str, bool]:
        self._sessions.clear()
        try:
            self._repository.delete_connections_by_provider("mural")
        except HTTPException:
            pass
        return {"connected": False}
