from __future__ import annotations

import json
from typing import Any

import certifi
import httpx

from app.core.config import settings
from app.schemas.artifacts import GeneratedArtifact, StoryDraft, StorySliceWorkflowRequest


class StorySlicingLLMService:
    """LLM-backed slicing from approved artifacts into implementation-ready stories."""

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.base_url = settings.openai_base_url.rstrip("/")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def slice(self, payload: StorySliceWorkflowRequest) -> list[StoryDraft]:
        if not self.enabled:
            raise RuntimeError("OpenAI API key is not configured.")

        compact = [
            {
                "artifact_id": item.artifact_id,
                "artifact_type": item.artifact_type,
                "title": item.title,
                "summary": item.summary,
                "body": item.body,
            }
            for item in payload.artifacts[:10]
        ]

        request_body = {
            "model": self.model,
            "instructions": (
                "You are ProductOS, an AI product manager and delivery planner. "
                "Slice approved artifacts into implementation-ready stories. "
                "Return valid JSON only. Do not include markdown. "
                "Each story must include: derived_from_artifact_id, title, user_story, as_a, i_want, so_that, description, acceptance_criteria, edge_cases, dependencies, priority. "
                "Generate 3 to 4 well-scoped stories per artifact unless the artifact is truly tiny. "
                "Use the classic user-story template: As a <persona>, I want <goal>, so that <benefit>. "
                "Keep each story independently actionable and avoid combining frontend, backend, and analytics work if they are naturally separable. "
                "Be domain-agnostic: do not assume a specific product type, but do infer the likely implementation shape from the artifact itself. "
                "A strong story set should cover the meaningful delivery slices needed for the artifact, such as user-facing workflow, business logic or service implementation, integration or data contract work, measurement or operational readiness, and release safeguards when relevant. "
                "Do not always force all of those categories, but do include the ones that are genuinely needed for implementation. "
                "Do not return only UX-definition stories or only instrumentation stories unless the artifact itself is solely about UX research or observability. "
                "Acceptance criteria must be concrete and testable, not generic statements like 'works correctly' or 'is implemented'. "
                "Descriptions should explain the implementation slice clearly enough that engineering could estimate it. "
                "Keep each description to 1 to 2 concise sentences. "
                "Return 2 to 4 acceptance criteria, 0 to 2 edge cases, and 0 to 3 dependencies per story. "
                "Avoid generic personas like 'target user', 'end user', or 'user' unless the artifact truly provides no role context. "
                "Avoid generic goals like 'clear and usable'. The user-facing story should name the real task the user is trying to complete and the concrete value they get from it. "
                "The title, user story, description, and acceptance criteria should describe observable behavior, not planning intent."
            ),
            "input": (
                "Slice these approved artifacts into implementation-ready stories.\n\n"
                f"Artifacts: {json.dumps(compact, ensure_ascii=True)}\n\n"
                "Quality bar:\n"
                "- Prefer concrete delivery slices over vague planning stories.\n"
                "- Include technical implementation stories when the artifact implies backend logic, services, integrations, ranking, personalization, data, APIs, orchestration, or operational behavior.\n"
                "- Include user-facing stories when the artifact changes visible experience.\n"
                "- Include measurement/release stories only when they are genuinely needed.\n"
                "- Keep each story small enough to implement independently but meaningful enough to ship value.\n\n"
                "Anti-patterns to avoid:\n"
                "- 'As a target user' unless no better role can be inferred\n"
                "- 'I want the flow to be clear and usable'\n"
                "- acceptance criteria like 'feature is implemented'\n"
                "- descriptions that only say 'design and implement' without naming the slice being built\n\n"
                "Return exactly this JSON shape and nothing else:\n"
                '{"stories":[{"derived_from_artifact_id":"artifact_1","title":"string","user_story":"As a commuter, I want ... so that ...","as_a":"commuter","i_want":"...","so_that":"...","description":"string","acceptance_criteria":["string"],"edge_cases":["string"],"dependencies":["string"],"priority":"high"}]}'
            ),
            "max_output_tokens": 3600,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "story_slicing_result",
                    "strict": True,
                    "schema": self._response_schema(),
                }
            },
            "reasoning": {"effort": "medium"},
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
            repaired_body = {
                "model": self.model,
                "instructions": (
                    "Repair malformed JSON so that it becomes valid JSON matching the requested schema. "
                    "Do not add markdown. Do not explain anything. Return only JSON."
                ),
                "input": (
                    "Repair this malformed story slicing JSON into valid JSON with top-level key "
                    "`stories` and story objects containing: derived_from_artifact_id, title, user_story, "
                    "as_a, i_want, so_that, description, acceptance_criteria, edge_cases, dependencies, priority.\n\n"
                    f"Malformed JSON:\n{raw_output}"
                ),
                "max_output_tokens": 3600,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "story_slicing_result",
                        "strict": True,
                        "schema": self._response_schema(),
                    }
                },
                "reasoning": {"effort": "low"},
            }
            try:
                repair_response = self._post_request(repaired_body, verify=certifi.where())
            except httpx.ConnectError:
                if not settings.is_development:
                    raise
                repair_response = self._post_request(repaired_body, verify=False)
            parsed = self._parse_json(self._extract_output_text(repair_response))
        stories = self._coerce_stories(parsed, payload.artifacts)
        stories = self._strengthen_story_set(stories, payload.artifacts)
        return self._de_genericize_stories(stories, payload.artifacts)

    def _post_request(self, request_body: dict[str, Any], verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=120.0, verify=verify) as client:
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

    def _response_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "stories": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "derived_from_artifact_id": {"type": "string"},
                            "title": {"type": "string"},
                            "user_story": {"type": "string"},
                            "as_a": {"type": "string"},
                            "i_want": {"type": "string"},
                            "so_that": {"type": "string"},
                            "description": {"type": "string"},
                            "acceptance_criteria": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "edge_cases": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "dependencies": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "priority": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "derived_from_artifact_id",
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
                        ],
                    },
                }
            },
            "required": ["stories"],
        }

    def _coerce_stories(
        self,
        parsed: dict[str, Any],
        artifacts: list[GeneratedArtifact],
    ) -> list[StoryDraft]:
        artifact_ids = {item.artifact_id for item in artifacts}
        stories: list[StoryDraft] = []
        for index, item in enumerate(parsed.get("stories", []), start=1):
            derived_from_artifact_id = str(item.get("derived_from_artifact_id") or "").strip()
            if derived_from_artifact_id not in artifact_ids and artifacts:
                derived_from_artifact_id = artifacts[min(index - 1, len(artifacts) - 1)].artifact_id
            priority = str(item.get("priority", "medium")).strip().lower()
            if priority not in {"high", "medium", "low"}:
                priority = "medium"
            stories.append(
                StoryDraft(
                    story_id=f"story_{index}",
                    derived_from_artifact_id=derived_from_artifact_id or None,
                    status="draft",
                    title=str(item.get("title", "Untitled story")).strip() or "Untitled story",
                    user_story=str(item.get("user_story", "")).strip(),
                    as_a=str(item.get("as_a", "")).strip(),
                    i_want=str(item.get("i_want", "")).strip(),
                    so_that=str(item.get("so_that", "")).strip(),
                    description=str(item.get("description", "")).strip(),
                    acceptance_criteria=[str(v).strip() for v in item.get("acceptance_criteria", []) if str(v).strip()],
                    edge_cases=[str(v).strip() for v in item.get("edge_cases", []) if str(v).strip()],
                    dependencies=[str(v).strip() for v in item.get("dependencies", []) if str(v).strip()],
                    priority=priority,
                )
            )
        return stories

    def _strengthen_story_set(
        self,
        stories: list[StoryDraft],
        artifacts: list[GeneratedArtifact],
    ) -> list[StoryDraft]:
        stories_by_artifact: dict[str, list[StoryDraft]] = {}
        for story in stories:
            key = story.derived_from_artifact_id or ""
            stories_by_artifact.setdefault(key, []).append(story)

        strengthened: list[StoryDraft] = []
        for artifact in artifacts:
            artifact_stories = list(stories_by_artifact.get(artifact.artifact_id, []))
            if not artifact_stories:
                artifact_stories = self._fallback_balanced_stories(artifact)
            else:
                artifact_stories = self._top_up_if_shallow(artifact_stories, artifact)
            strengthened.extend(artifact_stories)
        return strengthened

    def _top_up_if_shallow(
        self,
        stories: list[StoryDraft],
        artifact: GeneratedArtifact,
    ) -> list[StoryDraft]:
        lowered = " ".join(
            [
                artifact.title.lower(),
                artifact.summary.lower(),
                json.dumps(artifact.body, ensure_ascii=True).lower(),
            ]
        )
        has_user_facing = any(self._story_matches(story, ["ui", "experience", "flow", "screen", "user", "journey"]) for story in stories)
        has_backend = any(self._story_matches(story, ["api", "service", "logic", "ranking", "engine", "backend", "data", "integration"]) for story in stories)
        has_ops = any(self._story_matches(story, ["analytics", "monitor", "instrument", "rollout", "observability", "experiment"]) for story in stories)

        needs_backend = any(token in lowered for token in ["api", "service", "logic", "ranking", "suggest", "personal", "integration", "workflow", "engine", "data"])
        needs_user_facing = any(token in lowered for token in ["ui", "screen", "experience", "flow", "user", "journey", "prompt", "notification", "form"])
        needs_ops = any(token in lowered for token in ["measure", "metric", "analytics", "rollout", "monitor", "release", "experiment"])

        next_index = len(stories) + 1
        if needs_user_facing and not has_user_facing:
            stories.append(self._build_user_facing_story(artifact, next_index))
            next_index += 1
        if needs_backend and not has_backend:
            stories.append(self._build_backend_story(artifact, next_index))
            next_index += 1
        if needs_ops and not has_ops:
            stories.append(self._build_ops_story(artifact, next_index))
        return stories

    def _fallback_balanced_stories(self, artifact: GeneratedArtifact) -> list[StoryDraft]:
        stories = [self._build_user_facing_story(artifact, 1), self._build_backend_story(artifact, 2)]
        if any(
            token in " ".join([artifact.title.lower(), artifact.summary.lower(), json.dumps(artifact.body, ensure_ascii=True).lower()])
            for token in ["measure", "metric", "analytics", "rollout", "monitor", "release", "experiment"]
        ):
            stories.append(self._build_ops_story(artifact, 3))
        return stories

    def _build_user_facing_story(self, artifact: GeneratedArtifact, index: int) -> StoryDraft:
        feature_title = artifact.title.lower()
        role = self._infer_user_role(artifact)
        task = self._infer_user_task(artifact)
        outcome = self._infer_user_outcome(artifact)
        return StoryDraft(
            story_id=f"{artifact.artifact_id}_story_{index}",
            derived_from_artifact_id=artifact.artifact_id,
            status="draft",
            title=f"Deliver the user-facing flow for {artifact.title}",
            user_story=f"As a {role}, I want to {task}, so that {outcome}.",
            as_a=role,
            i_want=f"to {task}",
            so_that=outcome,
            description=f"Implement the user-facing workflow for {feature_title}, including the steps, visible states, and feedback needed for a {role} to {task}.",
            acceptance_criteria=[
                f"Users can {task} through the intended surface without leaving the primary workflow",
                "Success, empty, and failure states are clearly presented at the point of interaction",
                "The visible interface supports the intended decision or action with concrete prompts or choices",
            ],
            edge_cases=["User abandons or retries the flow mid-journey"],
            dependencies=["Design alignment"],
            priority="high",
        )

    def _build_backend_story(self, artifact: GeneratedArtifact, index: int) -> StoryDraft:
        feature_title = artifact.title.lower()
        return StoryDraft(
            story_id=f"{artifact.artifact_id}_story_{index}",
            derived_from_artifact_id=artifact.artifact_id,
            status="draft",
            title=f"Implement supporting service and decision logic for {artifact.title}",
            user_story=f"As a platform stakeholder, I want the underlying {feature_title} logic to be implemented reliably, so that the experience behaves consistently in production.",
            as_a="platform stakeholder",
            i_want=f"the underlying {feature_title} logic to be implemented reliably",
            so_that="the experience behaves consistently in production",
            description=f"Implement the core service, API, orchestration, or decision logic needed to support {feature_title}, including any data contracts, ranking rules, or integration points implied by the artifact.",
            acceptance_criteria=[
                "Core business logic is implemented behind a stable interface or API",
                "Input and output contracts are defined and validated",
                "Failure handling and fallback behavior are implemented for dependent systems or low-confidence cases",
            ],
            edge_cases=[
                "Required upstream data is missing or delayed",
                "Input conditions are ambiguous and need deterministic fallback behavior",
            ],
            dependencies=["Engineering design", "Interface contract review"],
            priority="high",
        )

    def _build_ops_story(self, artifact: GeneratedArtifact, index: int) -> StoryDraft:
        feature_title = artifact.title.lower()
        return StoryDraft(
            story_id=f"{artifact.artifact_id}_story_{index}",
            derived_from_artifact_id=artifact.artifact_id,
            status="draft",
            title=f"Instrument and operationalize {artifact.title}",
            user_story=f"As a product and engineering team member, I want measurement and operational readiness for {feature_title}, so that we can release safely and learn from usage.",
            as_a="product and engineering team member",
            i_want=f"measurement and operational readiness for {feature_title}",
            so_that="we can release safely and learn from usage",
            description=f"Add the analytics, monitoring, rollout, and support checks needed to operate {feature_title} confidently after release.",
            acceptance_criteria=[
                "Key adoption and outcome events are tracked",
                "Operational health signals are available for the release",
                "Rollout or release safeguards are defined when relevant",
            ],
            edge_cases=["Telemetry or monitoring coverage is missing for a subset of flows"],
            dependencies=["Analytics schema", "QA validation"],
            priority="medium",
        )

    def _story_matches(self, story: StoryDraft, keywords: list[str]) -> bool:
        haystack = " ".join(
            [
                story.title.lower(),
                story.user_story.lower(),
                story.description.lower(),
                " ".join(story.acceptance_criteria).lower(),
            ]
        )
        return any(keyword in haystack for keyword in keywords)

    def _de_genericize_stories(
        self,
        stories: list[StoryDraft],
        artifacts: list[GeneratedArtifact],
    ) -> list[StoryDraft]:
        artifact_by_id = {artifact.artifact_id: artifact for artifact in artifacts}
        rewritten: list[StoryDraft] = []
        for story in stories:
            artifact = artifact_by_id.get(story.derived_from_artifact_id or "")
            if artifact and self._is_generic_user_story(story):
                role = self._infer_user_role(artifact)
                task = self._infer_user_task(artifact)
                outcome = self._infer_user_outcome(artifact)
                rewritten.append(
                    story.model_copy(
                        update={
                            "user_story": f"As a {role}, I want to {task}, so that {outcome}.",
                            "as_a": role,
                            "i_want": f"to {task}",
                            "so_that": outcome,
                            "description": self._strengthen_description(story.description, artifact, role, task),
                            "acceptance_criteria": self._strengthen_acceptance_criteria(story.acceptance_criteria, task),
                        }
                    )
                )
            else:
                rewritten.append(story)
        return rewritten

    def _is_generic_user_story(self, story: StoryDraft) -> bool:
        text = " ".join([story.as_a, story.i_want, story.so_that, story.user_story, story.description]).lower()
        generic_markers = [
            "target user",
            "end user",
            "clear and usable",
            "primary flow",
            "complete the journey with less effort",
        ]
        return any(marker in text for marker in generic_markers)

    def _infer_user_role(self, artifact: GeneratedArtifact) -> str:
        lowered = " ".join([artifact.title.lower(), artifact.summary.lower(), json.dumps(artifact.body, ensure_ascii=True).lower()])
        if any(token in lowered for token in ["admin", "operator", "agent", "support"]):
            return "operator"
        if any(token in lowered for token in ["manager", "pm", "review", "approval"]):
            return "product manager"
        if any(token in lowered for token in ["developer", "engineer", "api", "integration", "platform"]):
            return "developer"
        if any(token in lowered for token in ["buyer", "customer", "shopper", "rider", "commuter", "traveler"]):
            for token in ["buyer", "customer", "shopper", "rider", "commuter", "traveler"]:
                if token in lowered:
                    return token
        return "user"

    def _infer_user_task(self, artifact: GeneratedArtifact) -> str:
        body = artifact.body or {}
        candidate = (
            body.get("proposed_solution")
            or body.get("solution_overview")
            or body.get("problem_statement")
            or artifact.summary
            or artifact.title
        )
        text = str(candidate).strip().rstrip(".")
        if text:
            normalized = text[0].lower() + text[1:] if len(text) > 1 else text.lower()
            if normalized.startswith("to "):
                return normalized[3:]
            return normalized
        return f"use {artifact.title.lower()}"

    def _infer_user_outcome(self, artifact: GeneratedArtifact) -> str:
        body = artifact.body or {}
        candidates = body.get("user_value") or body.get("business_value") or artifact.summary or ""
        text = str(candidates).strip().rstrip(".")
        if text:
            normalized = text[0].lower() + text[1:] if len(text) > 1 else text.lower()
            return normalized
        return "the task becomes faster and easier to complete"

    def _strengthen_description(self, description: str, artifact: GeneratedArtifact, role: str, task: str) -> str:
        text = description.strip()
        if not text or "design and implement" in text.lower() or "primary flow" in text.lower():
            return (
                f"Implement the concrete workflow, interface states, and feedback needed for a {role} "
                f"to {task}, including the main success path and visible failure handling."
            )
        return text

    def _strengthen_acceptance_criteria(self, criteria: list[str], task: str) -> list[str]:
        strengthened: list[str] = []
        generic_markers = {"implemented", "works correctly", "defined and implemented", "clear and usable"}
        for item in criteria:
            lowered = item.lower()
            if any(marker in lowered for marker in generic_markers):
                continue
            strengthened.append(item)
        if not strengthened:
            strengthened = [
                f"Users can {task} through the intended workflow",
                "Success, empty, and failure states are visibly handled",
                "The interface provides concrete choices, prompts, or results needed to complete the task",
            ]
        return strengthened
