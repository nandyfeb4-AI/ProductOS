from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.opportunity import OpportunityCandidate, OpportunityEvidence, OpportunitySynthesizeRequest


class OpportunityLLMService:
    """LLM-backed opportunity synthesis using OpenAI Responses API."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def synthesize(
        self,
        payload: OpportunitySynthesizeRequest,
        evidence_by_category: dict[str, list[OpportunityEvidence]],
    ) -> list[OpportunityCandidate]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        compact_evidence = [
            {"text": item.text, "category": item.category, "stage": item.stage}
            for category_items in evidence_by_category.values()
            for item in category_items
        ]
        compact_evidence = compact_evidence[:48]

        request_body = {
            "model": self.model,
            "instructions": (
                "You are ProductOS, an AI product strategist. "
                "Transform workshop and customer journey evidence into PM-ready opportunity candidates. "
                "Return JSON only. Do not include markdown. "
                "Each opportunity must include: title, problem_statement, why_it_matters, confidence, impact, evidence. "
                "Use only supplied evidence. Confidence must reflect evidence quality, consistency, and breadth; do not default to a constant value. "
                "Impact must be one of: high, medium, low. "
                "Evidence must be an array of objects with text, category, and optional stage."
            ),
            "input": (
                "Synthesize the strongest 2 to 5 opportunities from this evidence.\n\n"
                f"Workshop title: {payload.title}\n"
                f"Flattened insights: {json.dumps(payload.insights.model_dump() if payload.insights else {}, ensure_ascii=True)}\n"
                f"Journey evidence: {json.dumps(compact_evidence, ensure_ascii=True)}\n\n"
                "Return exactly this JSON shape:\n"
                '{"opportunities":[{"title":"string","problem_statement":"string","why_it_matters":"string","confidence":82,"impact":"high","evidence":[{"text":"string","category":"negative_moments","stage":"Entice"}]}]}'
            ),
            "max_output_tokens": 2200,
            "text": {"format": {"type": "text"}},
            "reasoning": {"effort": "low"},
        }

        try:
            body = self._post_request(request_body, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            body = self._post_request(request_body, verify=False)

        raw_output = self._extract_output_text(body)
        parsed = self._parse_json(raw_output)
        return self._coerce_candidates(parsed)

    def _post_request(self, request_body: dict[str, Any], verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=45.0, verify=verify) as client:
            response = client.post(
                f"{self.base_url}/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            return response.json()

    def _parse_json(self, raw_output: str) -> dict[str, Any]:
        text = raw_output.strip()
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) >= 2:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(text[start : end + 1])
            raise

    def _extract_output_text(self, body: dict[str, Any]) -> str:
        if body.get("output_text"):
            return str(body["output_text"])

        parts: list[str] = []
        for item in body.get("output", []):
            if item.get("type") != "message":
                continue
            for content in item.get("content", []):
                if content.get("type") == "output_text" and content.get("text"):
                    parts.append(str(content["text"]))
        return "\n".join(parts)

    def _coerce_candidates(self, parsed: dict[str, Any]) -> list[OpportunityCandidate]:
        candidates: list[OpportunityCandidate] = []
        for index, item in enumerate(parsed.get("opportunities", []), start=1):
            evidence = [
                OpportunityEvidence(
                    text=str(ev.get("text", "")).strip(),
                    category=str(ev.get("category", "interactions")).strip() or "interactions",
                    stage=(str(ev.get("stage")).strip() if ev.get("stage") else None),
                )
                for ev in item.get("evidence", [])
                if str(ev.get("text", "")).strip()
            ]
            confidence = item.get("confidence", 75)
            try:
                confidence = max(0, min(int(confidence), 100))
            except (TypeError, ValueError):
                confidence = 75
            impact = str(item.get("impact", "medium")).lower()
            if impact not in {"high", "medium", "low"}:
                impact = "medium"
            candidates.append(
                OpportunityCandidate(
                    id=f"opp_{index}",
                    title=str(item.get("title", "Untitled opportunity")).strip() or "Untitled opportunity",
                    problem_statement=str(item.get("problem_statement", "")).strip() or "Problem statement unavailable.",
                    why_it_matters=str(item.get("why_it_matters", "")).strip(),
                    confidence=confidence,
                    impact=impact,
                    evidence=evidence,
                )
            )
        return candidates
