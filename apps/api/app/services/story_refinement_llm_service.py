from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.backlog_refinement import BacklogStoryDraft, BacklogStoryRefinementResult, JiraBacklogStorySource
from app.schemas.agents import (
    StoryRefinementEvaluation,
    StoryRefinementResult,
    StoryRefinerRequest,
)
from app.schemas.project_stories import ProjectStoryResponse
from app.services.story_refinement_skill import (
    build_story_refinement_instructions,
    normalize_story_body,
    normalize_story_refinement_evaluation,
    story_refinement_response_schema,
)


class StoryRefinementLLMService:
    """LLM-backed evaluation and refinement of persisted project stories."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def refine(
        self,
        payload: StoryRefinerRequest,
        stories: list[ProjectStoryResponse],
        skill: dict[str, Any] | None = None,
    ) -> list[StoryRefinementResult]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        input_payload = {
            "project_id": str(payload.project_id),
            "source_type": payload.source_type,
            "story_ids": [str(story_id) for story_id in payload.story_ids],
            "refinement_goal": payload.refinement_goal,
            "constraints": payload.constraints,
            "supporting_context": payload.supporting_context,
            "stories": [story.model_dump(mode="json") for story in stories],
        }

        request_body = {
            "model": self.model,
            "instructions": build_story_refinement_instructions(skill),
            "input": (
                "Evaluate and refine the following persisted project stories.\n\n"
                "Return a result for every input story. Preserve story identity and intent.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "story_refinement_result",
                    "strict": True,
                    "schema": story_refinement_response_schema(),
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
                    "Repair this malformed story refinement JSON into valid JSON with top-level key `results` "
                    "and result objects containing: story_id, refinement_summary, evaluation, story.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "story_refinement_result",
                        "strict": True,
                        "schema": story_refinement_response_schema(),
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

        return self._coerce_results(parsed, stories)

    def refine_external(
        self,
        *,
        project_id: str,
        jira_project_key: str,
        stories: list[JiraBacklogStorySource],
        refinement_goal: str = "",
        constraints: list[str] | None = None,
        supporting_context: list[str] | None = None,
        skill: dict[str, Any] | None = None,
    ) -> list[BacklogStoryRefinementResult]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        constraints = constraints or []
        supporting_context = supporting_context or []
        input_payload = {
            "project_id": project_id,
            "source_type": "jira_story",
            "jira_project_key": jira_project_key,
            "story_issue_keys": [story.issue_key for story in stories],
            "refinement_goal": refinement_goal,
            "constraints": constraints,
            "supporting_context": supporting_context,
            "stories": [story.model_dump(mode="json") for story in stories],
        }

        request_body = {
            "model": self.model,
            "instructions": (
                build_story_refinement_instructions(skill)
                + " Also return a Fibonacci-like story point estimate for the refined story using 1, 2, 3, 5, 8, or 13."
            ),
            "input": (
                "Evaluate and refine the following existing Jira backlog stories.\n\n"
                "Return a result for every input story. Preserve issue identity and intent.\n\n"
                f"Source material: {json.dumps(input_payload, ensure_ascii=True)}"
            ),
            "max_output_tokens": 4200,
            "reasoning": {"effort": "medium"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "backlog_story_refinement_result",
                    "strict": True,
                    "schema": self._external_refinement_schema(),
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
                    "Repair this malformed backlog story refinement JSON into valid JSON with top-level key `results` "
                    "and result objects containing: story_id, refinement_summary, evaluation, story.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 4200,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "backlog_story_refinement_result",
                        "strict": True,
                        "schema": self._external_refinement_schema(),
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

        return self._coerce_external_results(parsed, stories)

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
        stories: list[ProjectStoryResponse],
    ) -> list[StoryRefinementResult]:
        by_id = {str(story.id): story for story in stories}
        results: list[StoryRefinementResult] = []

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            story_id = str(item.get("story_id", "")).strip()
            original = by_id.get(story_id)
            if original is None:
                continue

            normalized_story = normalize_story_body(item.get("story") if isinstance(item.get("story"), dict) else {})
            refined_story = original.model_copy(
                update={
                    "title": normalized_story["title"],
                    "user_story": normalized_story["user_story"],
                    "as_a": normalized_story["as_a"],
                    "i_want": normalized_story["i_want"],
                    "so_that": normalized_story["so_that"],
                    "description": normalized_story["description"],
                    "acceptance_criteria": normalized_story["acceptance_criteria"],
                    "edge_cases": normalized_story["edge_cases"],
                    "dependencies": normalized_story["dependencies"],
                    "priority": normalized_story["priority"],
                }
            )
            evaluation = StoryRefinementEvaluation(**normalize_story_refinement_evaluation(item.get("evaluation")))
            results.append(
                StoryRefinementResult(
                    story=refined_story,
                    evaluation=evaluation,
                    refinement_summary=str(item.get("refinement_summary", "")).strip(),
                )
            )

        self._ensure_all_story_results_present(
            expected_ids={str(story.id) for story in stories},
            received_ids={str(result.story.id) for result in results},
            context="project story refinement",
        )

        return results

    def _coerce_external_results(
        self,
        parsed: dict[str, Any],
        stories: list[JiraBacklogStorySource],
    ) -> list[BacklogStoryRefinementResult]:
        by_id = {story.issue_key: story for story in stories}
        results: list[BacklogStoryRefinementResult] = []

        for item in parsed.get("results", []):
            if not isinstance(item, dict):
                continue
            story_id = str(item.get("story_id", "")).strip()
            original = by_id.get(story_id)
            if original is None:
                continue
            normalized_story = normalize_story_body(item.get("story") if isinstance(item.get("story"), dict) else {})
            evaluation = StoryRefinementEvaluation(**normalize_story_refinement_evaluation(item.get("evaluation")))
            refined_story = BacklogStoryDraft(
                **normalized_story,
                story_points=self._coerce_story_points(
                    (item.get("story") if isinstance(item.get("story"), dict) else {}).get("story_points"),
                    context=f"backlog story {original.issue_key}",
                ),
            )
            results.append(
                BacklogStoryRefinementResult(
                    issue_key=original.issue_key,
                    issue_url=original.issue_url,
                    source_story=original,
                    evaluation=evaluation,
                    refined_story=refined_story,
                    refinement_summary=str(item.get("refinement_summary", "")).strip(),
                )
            )

        self._ensure_all_story_results_present(
            expected_ids={story.issue_key for story in stories},
            received_ids={result.issue_key for result in results},
            context="backlog story refinement",
        )
        return results

    def _external_refinement_schema(self) -> dict[str, Any]:
        score_property = {"type": "integer", "minimum": 1, "maximum": 5}
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "results": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "story_id": {"type": "string"},
                            "refinement_summary": {"type": "string"},
                            "evaluation": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "clarity_score": score_property,
                                    "acceptance_criteria_score": score_property,
                                    "completeness_score": score_property,
                                    "edge_case_score": score_property,
                                    "dependency_score": score_property,
                                    "implementation_readiness_score": score_property,
                                    "overall_score": score_property,
                                    "needs_refinement": {"type": "boolean"},
                                    "strengths": {"type": "array", "items": {"type": "string"}},
                                    "gaps": {"type": "array", "items": {"type": "string"}},
                                    "refinement_reasons": {"type": "array", "items": {"type": "string"}},
                                },
                                "required": [
                                    "clarity_score",
                                    "acceptance_criteria_score",
                                    "completeness_score",
                                    "edge_case_score",
                                    "dependency_score",
                                    "implementation_readiness_score",
                                    "overall_score",
                                    "needs_refinement",
                                    "strengths",
                                    "gaps",
                                    "refinement_reasons",
                                ],
                            },
                            "story": {
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
                        "required": ["story_id", "refinement_summary", "evaluation", "story"],
                    },
                }
            },
            "required": ["results"],
        }

    def _coerce_story_points(self, value: Any, *, context: str) -> int:
        try:
            points = int(value)
        except (TypeError, ValueError):
            raise RuntimeError(
                f"AI {context} refinement returned an invalid or missing story point estimate."
            ) from None
        if points not in {1, 2, 3, 5, 8, 13}:
            raise RuntimeError(
                f"AI {context} refinement returned unsupported story points `{points}`."
            )
        return points

    def _ensure_all_story_results_present(
        self,
        *,
        expected_ids: set[str],
        received_ids: set[str],
        context: str,
    ) -> None:
        missing_ids = sorted(expected_ids - received_ids)
        if missing_ids:
            raise RuntimeError(
                f"AI {context} did not return results for: {', '.join(missing_ids)}."
            )
