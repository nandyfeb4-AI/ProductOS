from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import FeatureDraft, FeatureGeneratorRequest
from app.services.feature_spec_skill import build_feature_spec_instructions, feature_spec_body_schema, normalize_feature_spec_body


class FeatureGenerationLLMService:
    """LLM-backed generation of a single reusable feature draft."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def generate(self, payload: FeatureGeneratorRequest, skill: dict[str, Any] | None = None) -> FeatureDraft:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "source_title": payload.source_title,
            "source_summary": payload.source_summary,
            "source_details": payload.source_details,
            "desired_outcome": payload.desired_outcome,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
        }

        request_body = {
            "model": self.model,
            "instructions": build_feature_spec_instructions(skill),
            "input": (
                "Create one feature draft from the following input.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 1800,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "feature_draft",
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "title": {"type": "string"},
                            "summary": {"type": "string"},
                            "body": feature_spec_body_schema(),
                        },
                        "required": ["title", "summary", "body"],
                    },
                }
            },
        }

        try:
            body = self._post_request(request_body, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            body = self._post_request(request_body, verify=False)

        parsed = self._parse_json(self._extract_output_text(body))
        return self._coerce_feature(parsed)

    def _post_request(self, request_body: dict[str, Any], verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=60.0, verify=verify) as client:
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
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(text[start : end + 1])
            raise

    def _coerce_feature(self, parsed: dict[str, Any]) -> FeatureDraft:
        body = parsed.get("body", {})
        if not isinstance(body, dict):
            body = {}

        normalize_feature_spec_body(body)

        return FeatureDraft(
            feature_id="feature_agent_1",
            status="draft",
            title=str(parsed.get("title", "Untitled feature")).strip() or "Untitled feature",
            summary=str(parsed.get("summary", "")).strip(),
            body=body,
        )

