from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.solution_shaping import ShapedSolution, SolutionShapingSynthesizeRequest


class SolutionShapingLLMService:
    """LLM-backed recommendation of initiative vs feature vs enhancement vs no action."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def synthesize(self, payload: SolutionShapingSynthesizeRequest) -> list[ShapedSolution]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        compact = [
            {
                "id": item.id,
                "title": item.title,
                "problem_statement": item.problem_statement,
                "why_it_matters": item.why_it_matters,
                "confidence": item.confidence,
                "impact": item.impact,
                "evidence": [e.model_dump() for e in item.evidence[:4]],
            }
            for item in payload.opportunities[:12]
        ]

        request_body = {
            "model": self.model,
            "instructions": (
                "You are ProductOS, an AI product strategist. "
                "For each approved opportunity, recommend whether it should become an Initiative, Feature, Enhancement, or No action. "
                "Return JSON only. Do not include markdown. "
                "Use Initiative for broad, strategic, multi-feature efforts. "
                "Use Feature for a bounded user-facing capability. "
                "Use Enhancement for an incremental improvement to an existing capability. "
                "Use No action when the opportunity should be deferred or is not sufficiently actionable. "
                "For each item include: derived_from_opportunity_id, recommended_type, title, problem_statement, rationale, scope."
            ),
            "input": (
                "Recommend the best solution type for each approved opportunity.\n\n"
                f"Approved opportunities: {json.dumps(compact, ensure_ascii=True)}\n\n"
                "Return exactly this JSON shape:\n"
                '{"shaped":[{"derived_from_opportunity_id":"opp_1","recommended_type":"Feature","title":"string","problem_statement":"string","rationale":"string","scope":"Medium - 2-4 sprints"}]}'
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

        parsed = self._parse_json(self._extract_output_text(body))
        return self._coerce_shaped(parsed)

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

    def _coerce_shaped(self, parsed: dict[str, Any]) -> list[ShapedSolution]:
        shaped: list[ShapedSolution] = []
        allowed = {"Initiative", "Feature", "Enhancement", "No action"}
        for index, item in enumerate(parsed.get("shaped", []), start=1):
            recommended_type = str(item.get("recommended_type", "Feature")).strip()
            if recommended_type not in allowed:
                recommended_type = "Feature"
            shaped.append(
                ShapedSolution(
                    id=str(item.get("id") or f"shaped-{index}"),
                    derived_from_opportunity_id=str(item.get("derived_from_opportunity_id") or f"opp_{index}"),
                    recommended_type=recommended_type,
                    title=str(item.get("title", "Untitled solution")).strip() or "Untitled solution",
                    problem_statement=str(item.get("problem_statement", "")).strip(),
                    rationale=str(item.get("rationale", "")).strip(),
                    scope=str(item.get("scope")).strip() if item.get("scope") else None,
                )
            )
        return shaped
