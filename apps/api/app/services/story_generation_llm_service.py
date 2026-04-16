from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import StoryGeneratorRequest
from app.schemas.artifacts import StoryDraft
from app.schemas.project_features import ProjectFeatureResponse
from app.services.story_spec_skill import (
    build_story_spec_instructions,
    normalize_story_body,
    story_spec_response_schema,
)


class StoryGenerationLLMService:
    """LLM-backed generation of implementation-ready stories from a persisted feature."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def generate(
        self,
        payload: StoryGeneratorRequest,
        feature: ProjectFeatureResponse,
        skill: dict[str, Any] | None = None,
    ) -> list[StoryDraft]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "source_feature_id": str(payload.source_feature_id),
            "story_count_hint": payload.story_count_hint,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
            "feature": {
                "id": str(feature.id),
                "title": feature.title,
                "summary": feature.summary,
                "body": feature.body,
            },
        }

        count_instruction = (
            f"Generate approximately {payload.story_count_hint} stories. "
            if payload.story_count_hint and payload.story_count_hint > 0
            else "Generate 3 to 5 meaningful stories for a normal feature. "
        )

        request_body = {
            "model": self.model,
            "instructions": build_story_spec_instructions(skill),
            "input": (
                "Create implementation-ready stories from the following persisted feature.\n\n"
                f"{count_instruction}"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 3200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "story_generation_result",
                    "strict": True,
                    "schema": story_spec_response_schema(),
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
                    "Repair this malformed story generation JSON into valid JSON with top-level key `stories` "
                    "and story objects containing: title, user_story, as_a, i_want, so_that, description, "
                    "acceptance_criteria, edge_cases, dependencies, priority.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 3200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "story_generation_result",
                        "strict": True,
                        "schema": story_spec_response_schema(),
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

        return self._coerce_stories(parsed, str(feature.id))

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

    def _coerce_stories(self, parsed: dict[str, Any], source_feature_id: str) -> list[StoryDraft]:
        stories: list[StoryDraft] = []
        for index, item in enumerate(parsed.get("stories", []), start=1):
            normalized = normalize_story_body(item if isinstance(item, dict) else {})
            stories.append(
                StoryDraft(
                    story_id=f"story_generated_{index}",
                    derived_from_artifact_id=source_feature_id,
                    status="draft",
                    title=normalized["title"],
                    user_story=normalized["user_story"],
                    as_a=normalized["as_a"],
                    i_want=normalized["i_want"],
                    so_that=normalized["so_that"],
                    description=normalized["description"],
                    acceptance_criteria=normalized["acceptance_criteria"],
                    edge_cases=normalized["edge_cases"],
                    dependencies=normalized["dependencies"],
                    priority=normalized["priority"],
                )
            )
        return stories
