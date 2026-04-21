from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import (
    CompetitorAnalysisAssessment,
    CompetitorAnalysisRequest,
    CompetitorAnalysisResponse,
    CompetitorAnalysisResult,
)
from app.services.competitor_analysis_skill import (
    build_competitor_analysis_instructions,
    competitor_analysis_response_schema,
    normalize_competitor_analysis,
)


class CompetitorAnalysisLLMService:
    """LLM-backed competitor analysis using provided product and market context."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def analyze(
        self,
        payload: CompetitorAnalysisRequest,
        skill: dict[str, Any] | None = None,
    ) -> CompetitorAnalysisResponse:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "product_name": payload.product_name,
            "product_summary": payload.product_summary,
            "target_market": payload.target_market,
            "known_competitors": payload.known_competitors,
            "analysis_goal": payload.analysis_goal,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
        }

        request_body = {
            "model": self.model,
            "instructions": build_competitor_analysis_instructions(skill),
            "input": (
                "Analyze the following named competitors for the user's product context.\n\n"
                "Return one result per named competitor, plus a short market summary and strategic recommendations.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "competitor_analysis_result",
                    "strict": True,
                    "schema": competitor_analysis_response_schema(),
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
                    "Repair this malformed competitor analysis JSON into valid JSON with top-level keys "
                    "`market_summary`, `strategic_recommendations`, `differentiation_opportunities`, `blind_spots`, and `results`.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "competitor_analysis_result",
                        "strict": True,
                        "schema": competitor_analysis_response_schema(),
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

        return self._coerce_results(parsed, payload.known_competitors)

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
        expected_competitors: list[str],
    ) -> CompetitorAnalysisResponse:
        by_name = {self._normalize_name(name): name for name in expected_competitors}
        results: list[CompetitorAnalysisResult] = []
        seen: set[str] = set()

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            competitor_name = str(item.get("competitor_name", "")).strip()
            normalized_name = self._normalize_name(competitor_name)
            original_name = by_name.get(normalized_name)
            if not original_name:
                continue
            seen.add(normalized_name)
            results.append(
                CompetitorAnalysisResult(
                    competitor_name=original_name,
                    competitor_summary=str(item.get("competitor_summary", "")).strip(),
                    analysis=CompetitorAnalysisAssessment(
                        **normalize_competitor_analysis(item.get("analysis"))
                    ),
                )
            )

        missing = [name for name in expected_competitors if self._normalize_name(name) not in seen]
        if missing:
            raise RuntimeError(
                "AI competitor analysis did not return results for: " + ", ".join(missing) + "."
            )

        return CompetitorAnalysisResponse(
            market_summary=str(parsed.get("market_summary", "")).strip(),
            strategic_recommendations=self._string_list(parsed.get("strategic_recommendations")),
            differentiation_opportunities=self._string_list(parsed.get("differentiation_opportunities")),
            blind_spots=self._string_list(parsed.get("blind_spots")),
            results=results,
        )

    def _normalize_name(self, value: str) -> str:
        return " ".join(value.lower().strip().split())

    def _string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

