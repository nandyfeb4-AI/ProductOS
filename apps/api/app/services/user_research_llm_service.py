from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.agents import UserResearchInsight, UserResearchRequest, UserResearchResponse
from app.services.user_research_skill import (
    build_user_research_instructions,
    normalize_user_research_insight,
    user_research_response_schema,
)


class UserResearchLLMService:
    """LLM-backed synthesis of provided user research inputs."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def analyze(
        self,
        payload: UserResearchRequest,
        skill: dict[str, Any] | None = None,
    ) -> UserResearchResponse:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "product_name": payload.product_name,
            "product_summary": payload.product_summary,
            "target_user": payload.target_user,
            "research_inputs": payload.research_inputs,
            "research_goal": payload.research_goal,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
        }

        request_body = {
            "model": self.model,
            "instructions": build_user_research_instructions(skill),
            "input": (
                "Synthesize the following user research inputs into actionable product insights.\n\n"
                "Return a short research summary, structured insight cards, user segments, pain points, unmet needs, jobs to be done, recommended actions, and risks/unknowns.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "user_research_result",
                    "strict": True,
                    "schema": user_research_response_schema(),
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
                    "Repair this malformed user research JSON into valid JSON with top-level keys "
                    "`research_summary`, `user_segments`, `key_pain_points`, `unmet_needs`, `jobs_to_be_done`, "
                    "`recommended_actions`, `risks_and_unknowns`, and `results`.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "user_research_result",
                        "strict": True,
                        "schema": user_research_response_schema(),
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

        return self._coerce_results(parsed)

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

    def _coerce_results(self, parsed: dict[str, Any]) -> UserResearchResponse:
        raw_results = parsed.get("results", [])
        if not isinstance(raw_results, list) or not raw_results:
            raise RuntimeError("AI user research analysis did not return any insight results.")

        insights = [UserResearchInsight(**normalize_user_research_insight(item)) for item in raw_results if isinstance(item, dict)]
        if not insights:
            raise RuntimeError("AI user research analysis did not return any valid insight results.")

        return UserResearchResponse(
            research_summary=str(parsed.get("research_summary", "")).strip(),
            user_segments=self._string_list(parsed.get("user_segments")),
            key_pain_points=self._string_list(parsed.get("key_pain_points")),
            unmet_needs=self._string_list(parsed.get("unmet_needs")),
            jobs_to_be_done=self._string_list(parsed.get("jobs_to_be_done")),
            recommended_actions=self._string_list(parsed.get("recommended_actions")),
            risks_and_unknowns=self._string_list(parsed.get("risks_and_unknowns")),
            results=insights,
        )

    def _string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]
