from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import (
    FeatureDraft,
    FeatureRefinementEvaluation,
    FeatureRefinementResult,
    FeatureRefinerRequest,
)
from app.schemas.feature_hardening import FeatureHardeningResult, JiraFeatureSource
from app.schemas.project_features import ProjectFeatureResponse
from app.services.feature_refinement_skill import (
    build_feature_refinement_instructions,
    feature_refinement_response_schema,
    normalize_feature_refinement_evaluation,
    normalize_feature_spec_body,
)


class FeatureRefinementLLMService:
    """LLM-backed evaluation and refinement of persisted project features."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def refine(
        self,
        payload: FeatureRefinerRequest,
        features: list[ProjectFeatureResponse],
        skill: dict[str, Any] | None = None,
    ) -> list[FeatureRefinementResult]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "feature_ids": [str(feature_id) for feature_id in payload.feature_ids],
            "refinement_goal": payload.refinement_goal,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
            "features": [feature.model_dump(mode="json") for feature in features],
        }

        request_body = {
            "model": self.model,
            "instructions": build_feature_refinement_instructions(skill),
            "input": (
                "Evaluate and refine the following persisted project features.\n\n"
                "Return a result for every input feature. Preserve feature identity and intent.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "feature_refinement_result",
                    "strict": True,
                    "schema": feature_refinement_response_schema(),
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
                    "Repair this malformed feature refinement JSON into valid JSON with top-level key `results` "
                    "and result objects containing: feature_id, refinement_summary, evaluation, feature.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "feature_refinement_result",
                        "strict": True,
                        "schema": feature_refinement_response_schema(),
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

        return self._coerce_results(parsed, features)

    def refine_external(
        self,
        *,
        project_id: str,
        jira_project_key: str,
        features: list[JiraFeatureSource],
        refinement_goal: str = "",
        constraints: list[str] | None = None,
        supporting_context: list[str] | None = None,
        skill: dict[str, Any] | None = None,
    ) -> list[FeatureHardeningResult]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        constraints = constraints or []
        supporting_context = supporting_context or []
        input_payload = {
            "project_id": project_id,
            "source_type": "jira_project",
            "jira_project_key": jira_project_key,
            "issue_keys": [feature.issue_key for feature in features],
            "refinement_goal": refinement_goal,
            "constraints": constraints,
            "supporting_context": supporting_context,
            "features": [feature.model_dump(mode="json") for feature in features],
        }

        request_body = {
            "model": self.model,
            "instructions": build_feature_refinement_instructions(skill),
            "input": (
                "Evaluate and harden the following Jira epics. "
                "They are existing features from Jira, not net-new features.\n\n"
                "Return a result for every input epic. Preserve issue identity and intent.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "feature_refinement_result",
                    "strict": True,
                    "schema": feature_refinement_response_schema(),
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
                    "Repair this malformed feature hardening JSON into valid JSON with top-level key `results` "
                    "and result objects containing: feature_id, refinement_summary, evaluation, feature.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "feature_refinement_result",
                        "strict": True,
                        "schema": feature_refinement_response_schema(),
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

        return self._coerce_external_results(parsed, features)

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
    ) -> list[FeatureRefinementResult]:
        by_id = {str(feature.id): feature for feature in features}
        results: list[FeatureRefinementResult] = []

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            feature_id = str(item.get("feature_id", "")).strip()
            original = by_id.get(feature_id)
            if original is None:
                continue

            feature_data = item.get("feature") if isinstance(item.get("feature"), dict) else {}
            body = feature_data.get("body", {}) if isinstance(feature_data.get("body"), dict) else {}
            normalize_feature_spec_body(body)
            refined_feature = original.model_copy(
                update={
                    "title": str(feature_data.get("title", original.title)).strip() or original.title,
                    "summary": str(feature_data.get("summary", original.summary)).strip(),
                    "body": body,
                }
            )
            evaluation = FeatureRefinementEvaluation(**normalize_feature_refinement_evaluation(item.get("evaluation")))
            results.append(
                FeatureRefinementResult(
                    feature=refined_feature,
                    evaluation=evaluation,
                    refinement_summary=str(item.get("refinement_summary", "")).strip(),
                )
            )

        seen_ids = {str(result.feature.id) for result in results}
        for original in features:
            feature_id = str(original.id)
            if feature_id in seen_ids:
                continue
            results.append(
                FeatureRefinementResult(
                    feature=original,
                    evaluation=FeatureRefinementEvaluation(
                        problem_clarity_score=3,
                        solution_clarity_score=3,
                        requirement_completeness_score=3,
                        dependency_score=3,
                        success_metrics_score=3,
                        implementation_readiness_score=3,
                        overall_score=3,
                        needs_refinement=False,
                        strengths=[],
                        gaps=[],
                        refinement_reasons=[],
                    ),
                    refinement_summary="No refinement result was returned for this feature.",
                )
            )

        return results

    def _coerce_external_results(
        self,
        parsed: dict[str, Any],
        features: list[JiraFeatureSource],
    ) -> list[FeatureHardeningResult]:
        by_id = {feature.issue_key: feature for feature in features}
        results: list[FeatureHardeningResult] = []

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            feature_id = str(item.get("feature_id", "")).strip()
            original = by_id.get(feature_id)
            if original is None:
                continue

            feature_data = item.get("feature") if isinstance(item.get("feature"), dict) else {}
            body = feature_data.get("body", {}) if isinstance(feature_data.get("body"), dict) else {}
            normalize_feature_spec_body(body)
            refined_feature = FeatureDraft(
                feature_id=original.issue_key,
                status="draft",
                title=str(feature_data.get("title", original.title)).strip() or original.title,
                summary=str(feature_data.get("summary", "")).strip(),
                body=body,
            )
            evaluation = FeatureRefinementEvaluation(**normalize_feature_refinement_evaluation(item.get("evaluation")))
            results.append(
                FeatureHardeningResult(
                    issue_key=original.issue_key,
                    issue_url=original.issue_url,
                    source_feature=original,
                    evaluation=evaluation,
                    refined_feature=refined_feature,
                    refinement_summary=str(item.get("refinement_summary", "")).strip(),
                )
            )

        seen_ids = {result.issue_key for result in results}
        for original in features:
            if original.issue_key in seen_ids:
                continue
            results.append(
                FeatureHardeningResult(
                    issue_key=original.issue_key,
                    issue_url=original.issue_url,
                    source_feature=original,
                    evaluation=FeatureRefinementEvaluation(
                        problem_clarity_score=3,
                        solution_clarity_score=3,
                        requirement_completeness_score=3,
                        dependency_score=3,
                        success_metrics_score=3,
                        implementation_readiness_score=3,
                        overall_score=3,
                        needs_refinement=False,
                        strengths=[],
                        gaps=[],
                        refinement_reasons=[],
                    ),
                    refined_feature=FeatureDraft(
                        feature_id=original.issue_key,
                        status="draft",
                        title=original.title,
                        summary="",
                        body={},
                    ),
                    refinement_summary="No hardening result was returned for this feature.",
                )
            )

        return results
