from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import (
    FeaturePrioritizationAssessment,
    FeaturePrioritizationResult,
    FeaturePrioritizerRequest,
)
from app.schemas.project_features import ProjectFeatureResponse
from app.services.feature_prioritization_skill import (
    build_feature_prioritization_instructions,
    feature_prioritization_response_schema,
    normalize_feature_prioritization,
)


class FeaturePrioritizationLLMService:
    """LLM-backed prioritization of persisted project features."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def prioritize(
        self,
        payload: FeaturePrioritizerRequest,
        features: list[ProjectFeatureResponse],
        skill: dict[str, Any] | None = None,
    ) -> tuple[str, list[FeaturePrioritizationResult]]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "feature_ids": [str(feature_id) for feature_id in payload.feature_ids],
            "prioritization_goal": payload.prioritization_goal,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
            "features": [feature.model_dump(mode="json") for feature in features],
        }

        request_body = {
            "model": self.model,
            "instructions": build_feature_prioritization_instructions(skill),
            "input": (
                "Prioritize the following persisted project features.\n\n"
                "Return a ranked prioritization result for every input feature and a short overall summary.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "feature_prioritization_result",
                    "strict": True,
                    "schema": feature_prioritization_response_schema(),
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
                    "Repair this malformed feature prioritization JSON into valid JSON with top-level keys "
                    "`prioritization_summary` and `results`.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "feature_prioritization_result",
                        "strict": True,
                        "schema": feature_prioritization_response_schema(),
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

        summary, results = self._coerce_results(parsed, features)
        return summary, results

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

    def _coerce_results(
        self,
        parsed: dict[str, Any],
        features: list[ProjectFeatureResponse],
    ) -> tuple[str, list[FeaturePrioritizationResult]]:
        by_id = {str(feature.id): feature for feature in features}
        results: list[FeaturePrioritizationResult] = []

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            feature_id = str(item.get("feature_id", "")).strip()
            original = by_id.get(feature_id)
            if original is None:
                continue
            prioritization = FeaturePrioritizationAssessment(
                **normalize_feature_prioritization(item.get("prioritization"))
            )
            results.append(
                FeaturePrioritizationResult(
                    feature=original,
                    prioritization=prioritization,
                    prioritization_summary=str(item.get("prioritization_summary", "")).strip(),
                )
            )

        if not results:
            results = [
                FeaturePrioritizationResult(
                    feature=feature,
                    prioritization=FeaturePrioritizationAssessment(
                        framework="impact_vs_effort",
                        impact_score=3,
                        effort_score=3,
                        strategic_alignment_score=3,
                        urgency_score=3,
                        confidence_score=3,
                        overall_priority_score=3,
                        recommended_rank=index + 1,
                        priority_bucket="medium",
                        rationale=[],
                        tradeoffs=[],
                        recommendation="Unable to determine a stronger prioritization recommendation from the model output.",
                    ),
                    prioritization_summary="No prioritization result was returned for this feature.",
                )
                for index, feature in enumerate(features)
            ]

        results.sort(key=lambda item: item.prioritization.recommended_rank)
        return str(parsed.get("prioritization_summary", "")).strip(), results
