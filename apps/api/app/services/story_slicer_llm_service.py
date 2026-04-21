from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.backlog_refinement import BacklogStoryDraft, BacklogStorySlicingResult, JiraBacklogStorySource
from app.schemas.agents import StorySlicerRequest
from app.schemas.project_stories import ProjectStoryResponse
from app.services.story_slicing_skill import (
    build_story_slicing_instructions,
    normalize_story_body,
    story_slicing_response_schema,
)


class StorySlicerLLMService:
    """LLM-backed slicing of one persisted story into smaller persisted stories."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def slice(
        self,
        payload: StorySlicerRequest,
        source_story: ProjectStoryResponse,
        skill: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "source_story_id": str(payload.source_story_id),
            "target_story_count_hint": payload.target_story_count_hint,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
            "source_story": source_story.model_dump(mode="json"),
        }

        count_instruction = (
            f"Target approximately {payload.target_story_count_hint} child stories. "
            if payload.target_story_count_hint and payload.target_story_count_hint > 0
            else "Default to 2 to 4 child stories unless the source story is genuinely tiny or unusually large. "
        )

        request_body = {
            "model": self.model,
            "instructions": build_story_slicing_instructions(skill),
            "input": (
                "Slice the following persisted project story into smaller implementation-ready child stories.\n\n"
                f"{count_instruction}"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 3600,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "story_slicing_result",
                    "strict": True,
                    "schema": story_slicing_response_schema(),
                }
            },
        }

        try:
            body = self._post_request(request_body, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            body = self._post_request(request_body, verify=False)

        raw_output = self._extract_output_text(body)
        try:
            parsed = self._parse_json(raw_output)
        except json.JSONDecodeError:
            repair_body = {
                "model": self.model,
                "instructions": (
                    "Repair malformed JSON so that it becomes valid JSON matching the requested schema. "
                    "Do not add markdown. Do not explain anything. Return only JSON."
                ),
                "input": (
                    "Repair this malformed story slicing JSON into valid JSON with top-level keys "
                    "`slicing_summary` and `stories`.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 3600,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "story_slicing_result",
                        "strict": True,
                        "schema": story_slicing_response_schema(),
                    }
                },
                "reasoning": {"effort": "low"},
            }
            try:
                repair_response = self._post_request(repair_body, verify=certifi.where())
            except httpx.ConnectError:
                if not settings.is_development:
                    raise
                repair_response = self._post_request(repair_body, verify=False)
            parsed = self._parse_json(self._extract_output_text(repair_response))

        return self._coerce_result(parsed)

    def slice_external(
        self,
        *,
        project_id: str,
        jira_project_key: str,
        source_story: JiraBacklogStorySource,
        target_story_count_hint: int | None = None,
        constraints: list[str] | None = None,
        supporting_context: list[str] | None = None,
        skill: dict[str, Any] | None = None,
    ) -> BacklogStorySlicingResult:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        constraints = constraints or []
        supporting_context = supporting_context or []
        input_payload = {
            "project_id": project_id,
            "source_type": "jira_story",
            "jira_project_key": jira_project_key,
            "source_story_issue_key": source_story.issue_key,
            "target_story_count_hint": target_story_count_hint,
            "constraints": constraints,
            "supporting_context": supporting_context,
            "source_story": source_story.model_dump(mode="json"),
        }

        count_instruction = (
            f"Target approximately {target_story_count_hint} child stories. "
            if target_story_count_hint and target_story_count_hint > 0
            else "Default to 2 to 4 child stories unless the source story is genuinely tiny or unusually large. "
        )

        request_body = {
            "model": self.model,
            "instructions": (
                build_story_slicing_instructions(skill)
                + " Also estimate story points for each child story using 1, 2, 3, 5, 8, or 13."
            ),
            "input": (
                "Slice the following Jira backlog story into smaller implementation-ready Jira stories.\n\n"
                f"{count_instruction}"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4000,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "backlog_story_slicing_result",
                    "strict": True,
                    "schema": self._external_slicing_schema(),
                }
            },
        }

        try:
            body = self._post_request(request_body, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            body = self._post_request(request_body, verify=False)

        raw_output = self._extract_output_text(body)
        try:
            parsed = self._parse_json(raw_output)
        except json.JSONDecodeError:
            repair_body = {
                "model": self.model,
                "instructions": (
                    "Repair malformed JSON so that it becomes valid JSON matching the requested schema. "
                    "Do not add markdown. Do not explain anything. Return only JSON."
                ),
                "input": (
                    "Repair this malformed backlog story slicing JSON into valid JSON with top-level keys "
                    "`slicing_summary` and `stories`, and each story containing `story_points`.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4000,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "backlog_story_slicing_result",
                        "strict": True,
                        "schema": self._external_slicing_schema(),
                    }
                },
                "reasoning": {"effort": "low"},
            }
            try:
                repair_response = self._post_request(repair_body, verify=certifi.where())
            except httpx.ConnectError:
                if not settings.is_development:
                    raise
                repair_response = self._post_request(repair_body, verify=False)
            parsed = self._parse_json(self._extract_output_text(repair_response))

        stories = []
        for item in parsed.get("stories", []):
            normalized = normalize_story_body(item if isinstance(item, dict) else {})
            stories.append(
                BacklogStoryDraft(
                    **normalized,
                    story_points=self._coerce_story_points((item or {}).get("story_points")),
                )
            )
        return BacklogStorySlicingResult(
            source_story=source_story,
            stories=stories,
            slicing_summary=str(parsed.get("slicing_summary", "")).strip(),
        )

    def _post_request(self, request_body: dict[str, Any], verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=90.0, verify=verify) as client:
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

    def _coerce_result(self, parsed: dict[str, Any]) -> dict[str, Any]:
        stories = []
        for item in parsed.get("stories", []):
            normalized = normalize_story_body(item if isinstance(item, dict) else {})
            stories.append(normalized)
        return {
            "slicing_summary": str(parsed.get("slicing_summary", "")).strip(),
            "stories": stories,
        }

    def _external_slicing_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "slicing_summary": {"type": "string"},
                "stories": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "title": {"type": "string"},
                            "user_story": {"type": "string"},
                            "as_a": {"type": "string"},
                            "i_want": {"type": "string"},
                            "so_that": {"type": "string"},
                            "description": {"type": "string"},
                            "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
                            "edge_cases": {"type": "array", "items": {"type": "string"}},
                            "dependencies": {"type": "array", "items": {"type": "string"}},
                            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                            "story_points": {"type": "integer", "enum": [1, 2, 3, 5, 8, 13]},
                        },
                        "required": [
                            "title",
                            "user_story",
                            "as_a",
                            "i_want",
                            "so_that",
                            "description",
                            "acceptance_criteria",
                            "edge_cases",
                            "dependencies",
                            "priority",
                            "story_points",
                        ],
                    },
                },
            },
            "required": ["slicing_summary", "stories"],
        }

    def _coerce_story_points(self, value: Any) -> int:
        try:
            points = int(value)
        except (TypeError, ValueError):
            return 3
        return points if points in {1, 2, 3, 5, 8, 13} else 3
