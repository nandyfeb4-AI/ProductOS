from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.artifacts import ArtifactGenerateRequest, GeneratedArtifact
from app.services.feature_spec_skill import build_feature_spec_instructions, normalize_feature_spec_body


class ArtifactGenerationLLMService:
    """LLM-backed artifact generation from shaped solutions."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def generate(self, payload: ArtifactGenerateRequest, feature_spec_skill: dict[str, Any] | None = None) -> list[GeneratedArtifact]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        actionable = [
            {
                "id": item.id,
                "derived_from_opportunity_id": item.derived_from_opportunity_id,
                "recommended_type": item.recommended_type,
                "chosen_type": item.chosen_type,
                "title": item.title,
                "problem_statement": item.problem_statement,
                "rationale": item.rationale,
                "scope": item.scope,
            }
            for item in payload.shaped
            if (item.chosen_type or item.recommended_type) != "No action"
        ][:12]

        request_body = {
            "model": self.model,
            "instructions": (
                "You are ProductOS, an AI product manager. "
                "Generate structured PM artifacts from shaped solutions. "
                "Use the chosen_type when present, otherwise recommended_type. "
                "Return JSON only. Do not include markdown. "
                "For initiative artifacts include body keys: desired_outcome, success_metrics, scope, assumptions, risks, priority. "
                f"For feature artifacts, follow this feature spec skill: {build_feature_spec_instructions(feature_spec_skill)} "
                "For enhancement artifacts include body keys: current_capability, current_issue, proposed_improvement, expected_impact, affected_surfaces, priority. "
                "Keep fields concise, PM-ready, and directly grounded in the supplied shaped solutions."
            ),
            "input": (
                "Generate one artifact per actionable shaped solution.\n\n"
                f"Shaped solutions: {json.dumps(actionable, ensure_ascii=True)}\n\n"
                "Return exactly this JSON shape:\n"
                '{"artifacts":[{"artifact_type":"feature","derived_from_solution_id":"shaped-1","title":"string","summary":"string","body":{"problem_statement":"string","user_segment":"string","proposed_solution":"string","user_value":"string","business_value":"string","functional_requirements":["string"],"non_functional_requirements":["string"],"dependencies":["string"],"success_metrics":["string"],"priority":"medium"}}]}'
            ),
            "max_output_tokens": 3200,
            "text": {"format": {"type": "text"}},
            "reasoning": {"effort": "medium"},
        }

        try:
            body = self._post_request(request_body, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            body = self._post_request(request_body, verify=False)

        parsed = self._parse_json(self._extract_output_text(body))
        return self._coerce_artifacts(parsed)

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

    def _coerce_artifacts(self, parsed: dict[str, Any]) -> list[GeneratedArtifact]:
        artifacts: list[GeneratedArtifact] = []
        for index, item in enumerate(parsed.get("artifacts", []), start=1):
            artifact_type = str(item.get("artifact_type", "feature")).strip().lower()
            if artifact_type not in {"initiative", "feature", "enhancement"}:
                artifact_type = "feature"
            body = item.get("body", {})
            if not isinstance(body, dict):
                body = {}
            if artifact_type == "feature":
                normalize_feature_spec_body(body)
            artifacts.append(
                GeneratedArtifact(
                    artifact_id=f"artifact_{index}",
                    artifact_type=artifact_type,
                    derived_from_solution_id=str(item.get("derived_from_solution_id") or f"shaped-{index}"),
                    status="draft",
                    title=str(item.get("title", "Untitled artifact")).strip() or "Untitled artifact",
                    summary=str(item.get("summary", "")).strip(),
                    body=body,
                )
            )
        return artifacts
