from __future__ import annotations

from dataclasses import dataclass
from secrets import token_urlsafe
from typing import Any, Optional
from urllib.parse import urlencode

import certifi
import httpx

from app.core.config import settings
from app.repositories.connector_repository import ConnectorRepository
from app.schemas.agents import FeatureDraft
from app.schemas.artifacts import GeneratedArtifact
from app.schemas.backlog_refinement import BacklogStoryDraft, JiraBacklogStorySource
from app.schemas.feature_hardening import JiraFeatureSource
from app.schemas.jira_connector import (
    JiraConnectRequest,
    JiraConnectResponse,
    JiraExportIssue,
    JiraExportRequest,
    JiraExportResponse,
    JiraFeatureExportRequest,
    JiraFeatureExportResponse,
    JiraProject,
    JiraProjectsResponse,
)


ATLASSIAN_AUTHORIZE_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
ATLASSIAN_ME_URL = "https://api.atlassian.com/me"


@dataclass
class JiraSession:
    access_token: str
    refresh_token: Optional[str]
    cloud_id: str
    base_url: str
    display_name: Optional[str] = None
    account_id: Optional[str] = None
    email: Optional[str] = None


class JiraService:
    """Jira connector supporting OAuth 2.0 (preferred) with API-token fallback for MVP."""

    def __init__(self) -> None:
        self._session: Optional[JiraSession] = None
        self._oauth_states: set[str] = set()
        self._repository = ConnectorRepository()

    @property
    def oauth_enabled(self) -> bool:
        return bool(settings.jira_client_id and settings.jira_client_secret)

    def get_authorization_url(self) -> tuple[str, str]:
        if not self.oauth_enabled:
            raise RuntimeError("Jira OAuth is not configured.")

        state = token_urlsafe(24)
        self._oauth_states.add(state)
        query = urlencode(
            {
                "audience": "api.atlassian.com",
                "client_id": settings.jira_client_id,
                "scope": settings.jira_scopes,
                "redirect_uri": settings.jira_redirect_uri,
                "state": state,
                "response_type": "code",
                "prompt": "consent",
            }
        )
        return f"{ATLASSIAN_AUTHORIZE_URL}?{query}", state

    def exchange_code(self, code: str, state: str) -> JiraConnectResponse:
        if state not in self._oauth_states:
            raise RuntimeError("Invalid Jira OAuth state.")
        self._oauth_states.discard(state)

        try:
            token_body = self._oauth_token_exchange(code=code, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            token_body = self._oauth_token_exchange(code=code, verify=False)
        access_token = str(token_body.get("access_token", ""))
        refresh_token = token_body.get("refresh_token")
        if not access_token:
            raise RuntimeError("Jira OAuth token exchange failed.")

        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        try:
            resources = self._oauth_metadata_get(ATLASSIAN_RESOURCES_URL, headers=headers, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            resources = self._oauth_metadata_get(ATLASSIAN_RESOURCES_URL, headers=headers, verify=False)
        if not resources:
            raise RuntimeError("No accessible Jira resources were found for this Atlassian account.")
        resource = resources[0]

        display_name = None
        account_id = None
        email = None
        try:
            me = self._oauth_metadata_get(ATLASSIAN_ME_URL, headers=headers, verify=certifi.where(), allow_failure=True)
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            me = self._oauth_metadata_get(ATLASSIAN_ME_URL, headers=headers, verify=False, allow_failure=True)
        if me:
            display_name = me.get("name") or me.get("nickname")
            account_id = me.get("account_id")
            email = me.get("email")

        self._session = JiraSession(
            access_token=access_token,
            refresh_token=str(refresh_token) if refresh_token else None,
            cloud_id=str(resource.get("id", "")),
            base_url=str(resource.get("url", "")).rstrip("/"),
            display_name=display_name or resource.get("name"),
            account_id=account_id,
            email=email,
        )
        self._persist_session(self._session, state=state)
        return JiraConnectResponse(
            connected=True,
            base_url=self._session.base_url,
            email=self._session.email or "",
            display_name=self._session.display_name,
            account_id=self._session.account_id,
        )

    def _oauth_token_exchange(self, code: str, verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=30.0, verify=verify) as client:
            token_response = client.post(
                ATLASSIAN_TOKEN_URL,
                json={
                    "grant_type": "authorization_code",
                    "client_id": settings.jira_client_id,
                    "client_secret": settings.jira_client_secret,
                    "code": code,
                    "redirect_uri": settings.jira_redirect_uri,
                },
            )
            token_response.raise_for_status()
            return token_response.json()

    def _oauth_refresh_exchange(self, refresh_token: str, verify: str | bool) -> dict[str, Any]:
        with httpx.Client(timeout=30.0, verify=verify) as client:
            token_response = client.post(
                ATLASSIAN_TOKEN_URL,
                json={
                    "grant_type": "refresh_token",
                    "client_id": settings.jira_client_id,
                    "client_secret": settings.jira_client_secret,
                    "refresh_token": refresh_token,
                },
            )
            token_response.raise_for_status()
            return token_response.json()

    def _oauth_metadata_get(
        self,
        url: str,
        headers: dict[str, str],
        verify: str | bool,
        allow_failure: bool = False,
    ) -> Any:
        with httpx.Client(timeout=30.0, verify=verify) as client:
            response = client.get(url, headers=headers)
            if allow_failure and not response.is_success:
                return None
            response.raise_for_status()
            return response.json()

    def status(self) -> JiraConnectResponse:
        try:
            session = self._require_session()
        except RuntimeError:
            return JiraConnectResponse(connected=False, base_url="", email="")
        return JiraConnectResponse(
            connected=True,
            base_url=session.base_url,
            email=session.email or "",
            display_name=session.display_name,
            account_id=session.account_id,
        )

    def disconnect(self) -> dict[str, bool]:
        self._session = None
        self._repository.delete_connections_by_provider("jira")
        return {"connected": False}

    def connect(self, payload: JiraConnectRequest) -> JiraConnectResponse:
        me = self._token_get(payload.base_url.rstrip("/"), payload.email, payload.api_token, "/rest/api/3/myself")
        self._session = JiraSession(
            access_token=payload.api_token,
            refresh_token=None,
            cloud_id="",
            base_url=payload.base_url.rstrip("/"),
            display_name=me.get("displayName"),
            account_id=me.get("accountId"),
            email=payload.email,
        )
        self._persist_session(self._session)
        return JiraConnectResponse(
            connected=True,
            base_url=self._session.base_url,
            email=self._session.email or "",
            display_name=self._session.display_name,
            account_id=self._session.account_id,
        )

    def list_projects(self) -> JiraProjectsResponse:
        session = self._require_session()
        body = self._get(session, "/rest/api/3/project/search")
        values = body.get("values", [])
        return JiraProjectsResponse(
            projects=[
                JiraProject(
                    id=str(item.get("id", "")),
                    key=str(item.get("key", "")),
                    name=str(item.get("name", "")),
                    project_type_key=item.get("projectTypeKey"),
                )
                for item in values
                if item.get("key")
            ]
        )

    def list_project_features(self, project_key: str) -> list[JiraFeatureSource]:
        session = self._require_session()
        body = self._post(
            session,
            "/rest/api/3/search/jql",
            {
                "jql": f"project = {project_key} AND issuetype = Epic ORDER BY priority DESC, updated DESC",
                "fields": ["summary", "description", "status", "issuetype", "priority"],
                "maxResults": 100,
            },
        )
        issues = body.get("issues", []) if isinstance(body, dict) else []
        return [self._issue_to_source_feature(session, project_key, issue) for issue in issues if isinstance(issue, dict)]

    def list_project_backlog_stories(self, project_key: str) -> list[JiraBacklogStorySource]:
        session = self._require_session()
        story_points_field = self._discover_story_points_field(session)
        fields = ["summary", "description", "status", "issuetype", "priority", "parent"]
        if story_points_field:
            fields.append(story_points_field)
        body = self._post(
            session,
            "/rest/api/3/search/jql",
            {
                "jql": f"project = {project_key} AND issuetype in (Story, Task) ORDER BY priority DESC, updated DESC",
                "fields": fields,
                "maxResults": 200,
            },
        )
        issues = body.get("issues", []) if isinstance(body, dict) else []
        return [
            self._issue_to_backlog_story(session, project_key, issue, story_points_field)
            for issue in issues
            if isinstance(issue, dict)
        ]

    def export(self, payload: JiraExportRequest) -> JiraExportResponse:
        session = self._require_session()
        issue_types = self._get_issue_type_map(session, payload.project_key)
        parent_by_artifact: dict[str, str] = {}
        artifacts_by_id = {artifact.artifact_id: artifact for artifact in payload.artifacts}
        issues: list[JiraExportIssue] = []

        if payload.parent_strategy != "none" and artifacts_by_id:
            parent_by_artifact = self._ensure_parent_issues(
                session=session,
                project_key=payload.project_key,
                parent_strategy=payload.parent_strategy,
                artifacts=artifacts_by_id,
                issue_types=issue_types,
            )

        child_issue_type = issue_types.get("Story") or issue_types.get("Task")
        if child_issue_type is None:
            raise RuntimeError("No Jira Story or Task issue type is available in this workspace.")

        for story in payload.stories:
            fields: dict[str, Any] = {
                "project": {"key": payload.project_key},
                "summary": story.title,
                "description": self._to_adf(story),
                "issuetype": {"id": child_issue_type["id"]},
            }
            self._apply_reporter(fields, session)
            parent_key = parent_by_artifact.get(story.derived_from_artifact_id or "")
            if parent_key:
                fields["parent"] = {"key": parent_key}

            response = self._post(session, "/rest/api/3/issue", {"fields": fields})
            issue_key = str(response.get("key", ""))
            issues.append(
                JiraExportIssue(
                    story_id=story.story_id,
                    issue_key=issue_key,
                    issue_url=f"{session.base_url}/browse/{issue_key}",
                    parent_issue_key=parent_key or None,
                )
            )

        return JiraExportResponse(issues=issues)

    def export_feature(self, payload: JiraFeatureExportRequest) -> JiraFeatureExportResponse:
        session = self._require_session()
        issue_types = self._get_issue_type_map(session, payload.project_key)
        issue_type = issue_types.get("Epic") or issue_types.get("Task")
        if issue_type is None:
            raise RuntimeError("No Jira Epic or Task issue type is available in this workspace.")

        feature_artifact = self._feature_to_generated_artifact(payload.feature)
        fields: dict[str, Any] = {
            "project": {"key": payload.project_key},
            "summary": feature_artifact.title,
            "description": self._artifact_to_adf(feature_artifact),
            "issuetype": {"id": issue_type["id"]},
        }
        self._apply_reporter(fields, session)

        epic_name_field = self._discover_epic_name_field(session) if issue_type["name"].lower() == "epic" else None
        if epic_name_field:
            fields[epic_name_field] = feature_artifact.title

        try:
            response = self._post(session, "/rest/api/3/issue", {"fields": fields})
        except RuntimeError as exc:
            if epic_name_field and epic_name_field in fields:
                fallback_fields = dict(fields)
                fallback_fields.pop(epic_name_field, None)
                response = self._post(session, "/rest/api/3/issue", {"fields": fallback_fields})
            else:
                raise exc

        issue_key = str(response.get("key", ""))
        return JiraFeatureExportResponse(
            issue_key=issue_key,
            issue_url=f"{session.base_url}/browse/{issue_key}",
            issue_type=str(issue_type["name"]),
        )

    def update_feature_issue(self, project_key: str, issue_key: str, feature: FeatureDraft) -> dict[str, str | bool]:
        session = self._require_session()
        issue_types = self._get_issue_type_map(session, project_key)
        issue_type = issue_types.get("Epic") or issue_types.get("Task")
        feature_artifact = self._feature_to_generated_artifact(feature)
        fields: dict[str, Any] = {
            "summary": feature_artifact.title,
            "description": self._artifact_to_adf(feature_artifact),
        }
        epic_name_field = self._discover_epic_name_field(session) if issue_type and issue_type["name"].lower() == "epic" else None
        if epic_name_field:
            fields[epic_name_field] = feature_artifact.title

        try:
            self._put(session, f"/rest/api/3/issue/{issue_key}", {"fields": fields})
        except RuntimeError as exc:
            if epic_name_field and epic_name_field in fields:
                fallback_fields = dict(fields)
                fallback_fields.pop(epic_name_field, None)
                self._put(session, f"/rest/api/3/issue/{issue_key}", {"fields": fallback_fields})
            else:
                raise exc
        return {
            "issue_key": issue_key,
            "issue_url": f"{session.base_url}/browse/{issue_key}",
            "issue_type": str(issue_type["name"]) if issue_type else "Epic",
            "updated": True,
        }

    def create_story_issue(
        self,
        project_key: str,
        *,
        parent_issue_key: str | None,
        story: BacklogStoryDraft,
    ) -> JiraBacklogStorySource:
        session = self._require_session()
        issue_types = self._get_issue_type_map(session, project_key)
        child_issue_type = issue_types.get("Story") or issue_types.get("Task")
        if child_issue_type is None:
            raise RuntimeError("No Jira Story or Task issue type is available in this workspace.")

        story_points_field = self._discover_story_points_field(session)
        epic_link_field = self._discover_epic_link_field(session)
        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "summary": story.title,
            "description": self._to_adf(story),
            "issuetype": {"id": child_issue_type["id"]},
        }
        self._apply_reporter(fields, session)
        if story_points_field:
            fields[story_points_field] = int(story.story_points)
        if parent_issue_key:
            fields["parent"] = {"key": parent_issue_key}

        try:
            response = self._post(session, "/rest/api/3/issue", {"fields": fields})
        except RuntimeError as exc:
            if parent_issue_key and epic_link_field:
                fallback_fields = dict(fields)
                fallback_fields.pop("parent", None)
                fallback_fields[epic_link_field] = parent_issue_key
                response = self._post(session, "/rest/api/3/issue", {"fields": fallback_fields})
            else:
                raise exc

        issue_key = str(response.get("key", ""))
        issue = self._get(session, f"/rest/api/3/issue/{issue_key}?fields=summary,description,status,issuetype,priority,parent")
        return self._issue_to_backlog_story(session, project_key, issue, story_points_field)

    def update_story_issue(
        self,
        project_key: str,
        issue_key: str,
        story: BacklogStoryDraft,
    ) -> JiraBacklogStorySource:
        session = self._require_session()
        story_points_field = self._discover_story_points_field(session)
        fields: dict[str, Any] = {
            "summary": story.title,
            "description": self._to_adf(story),
        }
        if story_points_field:
            fields[story_points_field] = int(story.story_points)
        self._put(session, f"/rest/api/3/issue/{issue_key}", {"fields": fields})
        issue = self._get(session, f"/rest/api/3/issue/{issue_key}?fields=summary,description,status,issuetype,priority,parent")
        return self._issue_to_backlog_story(session, project_key, issue, story_points_field)

    def mark_story_sliced(
        self,
        project_key: str,
        source_story: JiraBacklogStorySource,
        replacement_issue_keys: list[str],
    ) -> JiraBacklogStorySource:
        session = self._require_session()
        story_points_field = self._discover_story_points_field(session)
        summary = source_story.title if source_story.title.startswith("[Sliced]") else f"[Sliced] {source_story.title}"
        note = (
            f"Superseded by sliced stories: {', '.join(replacement_issue_keys)}."
            if replacement_issue_keys
            else "Superseded by sliced stories."
        )
        description_lines: list[str] = []
        if source_story.description_text:
            description_lines.append(source_story.description_text)
        description_lines.append(note)
        fields: dict[str, Any] = {
            "summary": summary,
            "description": self._paragraph_adf(description_lines),
        }
        self._put(session, f"/rest/api/3/issue/{source_story.issue_key}", {"fields": fields})
        issue = self._get(
            session,
            f"/rest/api/3/issue/{source_story.issue_key}?fields=summary,description,status,issuetype,priority,parent",
        )
        return self._issue_to_backlog_story(session, project_key, issue, story_points_field)

    def _ensure_parent_issues(
        self,
        session: JiraSession,
        project_key: str,
        parent_strategy: str,
        artifacts: dict[str, GeneratedArtifact],
        issue_types: dict[str, dict[str, Any]],
    ) -> dict[str, str]:
        parent_issue_type = issue_types.get("Epic") or issue_types.get("Task")
        if parent_issue_type is None:
            return {}

        relevant_types = {"feature"} if parent_strategy == "feature-as-epic" else {"initiative"}
        epic_name_field = self._discover_epic_name_field(session)
        parent_keys: dict[str, str] = {}

        for artifact in artifacts.values():
            if artifact.artifact_type not in relevant_types:
                continue
            fields: dict[str, Any] = {
                "project": {"key": project_key},
                "summary": artifact.title,
                "description": self._artifact_to_adf(artifact),
                "issuetype": {"id": parent_issue_type["id"]},
            }
            self._apply_reporter(fields, session)
            if parent_issue_type["name"].lower() == "epic" and epic_name_field:
                fields[epic_name_field] = artifact.title
            try:
                response = self._post(session, "/rest/api/3/issue", {"fields": fields})
            except RuntimeError as exc:
                # Team-managed Jira projects often reject the global Epic Name field
                # even when a field with that name exists in the site schema.
                if parent_issue_type["name"].lower() == "epic" and epic_name_field and epic_name_field in fields:
                    fallback_fields = dict(fields)
                    fallback_fields.pop(epic_name_field, None)
                    response = self._post(session, "/rest/api/3/issue", {"fields": fallback_fields})
                else:
                    raise exc
            parent_keys[artifact.artifact_id] = str(response.get("key", ""))
        return parent_keys

    def _discover_epic_name_field(self, session: JiraSession) -> Optional[str]:
        fields = self._get(session, "/rest/api/3/field")
        for field in fields:
            if str(field.get("name", "")).lower() == "epic name":
                return str(field.get("id"))
        return None

    def _discover_epic_link_field(self, session: JiraSession) -> Optional[str]:
        fields = self._get(session, "/rest/api/3/field")
        for field in fields:
            if str(field.get("name", "")).lower() == "epic link":
                return str(field.get("id"))
        return None

    def _discover_story_points_field(self, session: JiraSession) -> Optional[str]:
        fields = self._get(session, "/rest/api/3/field")
        candidates = {"story points", "story point estimate"}
        for field in fields:
            if str(field.get("name", "")).strip().lower() in candidates:
                return str(field.get("id"))
        return None

    def _apply_reporter(self, fields: dict[str, Any], session: JiraSession) -> None:
        if session.account_id:
            fields["reporter"] = {"id": session.account_id}

    def _get_issue_type_map(self, session: JiraSession, project_key: str | None = None) -> dict[str, dict[str, Any]]:
        issue_types: list[dict[str, Any]] = []
        if project_key:
            try:
                project = self._get(session, f"/rest/api/3/project/{project_key}")
                raw_issue_types = project.get("issueTypes", [])
                if isinstance(raw_issue_types, list):
                    issue_types = [item for item in raw_issue_types if isinstance(item, dict)]
            except Exception:
                issue_types = []

        if not issue_types:
            issue_types = self._get(session, "/rest/api/3/issuetype")
        return {str(item.get("name")): item for item in issue_types if item.get("name")}

    def _to_adf(self, story: Any) -> dict[str, Any]:
        sections: list[dict[str, Any]] = []

        user_story_lines = []
        if getattr(story, "user_story", ""):
            user_story_lines.append(story.user_story)
        else:
            if getattr(story, "as_a", ""):
                user_story_lines.append(f"As a {story.as_a}")
            if getattr(story, "i_want", ""):
                user_story_lines.append(f"I want {story.i_want}")
            if getattr(story, "so_that", ""):
                user_story_lines.append(f"So that {story.so_that}")
        self._append_text_section(sections, "User Story", user_story_lines)
        self._append_text_section(sections, "Description", [story.description] if story.description else [])
        self._append_bullet_section(sections, "Acceptance Criteria", getattr(story, "acceptance_criteria", []))
        self._append_bullet_section(sections, "Edge Cases", getattr(story, "edge_cases", []))
        self._append_bullet_section(sections, "Dependencies", getattr(story, "dependencies", []))
        self._append_text_section(sections, "Priority", [getattr(story, "priority", "")])

        return self._doc_from_blocks(sections)

    def _artifact_to_adf(self, artifact: GeneratedArtifact) -> dict[str, Any]:
        sections: list[dict[str, Any]] = []
        body = artifact.body or {}

        if artifact.summary:
            self._append_text_section(sections, "Summary", [artifact.summary])

        if artifact.artifact_type == "feature":
            self._append_text_section(
                sections,
                "Problem Statement",
                [body.get("problem_statement") or body.get("user_problem") or ""],
            )
            self._append_text_section(sections, "User Segment", [body.get("user_segment", "")])
            self._append_text_section(
                sections,
                "Proposed Solution",
                [body.get("proposed_solution") or body.get("solution_overview") or ""],
            )
            self._append_text_section(sections, "User Value", [body.get("user_value", "")])
            self._append_text_section(sections, "Business Value", [body.get("business_value", "")])
            self._append_bullet_section(sections, "Functional Requirements", body.get("functional_requirements", []))
            self._append_bullet_section(
                sections,
                "Non-functional Requirements",
                body.get("non_functional_requirements", []),
            )
            self._append_bullet_section(sections, "Dependencies", body.get("dependencies", []))
            self._append_bullet_section(sections, "Success Metrics", body.get("success_metrics", []))
            self._append_text_section(sections, "Priority", [body.get("priority", "")])
            return self._doc_from_blocks(sections)

        if artifact.artifact_type == "initiative":
            self._append_text_section(sections, "Problem Statement", [body.get("problem_statement", "")])
            self._append_text_section(sections, "Desired Outcome", [body.get("desired_outcome", "")])
            self._append_text_section(sections, "Scope", [body.get("scope", "")])
            self._append_bullet_section(sections, "Assumptions", body.get("assumptions", []))
            self._append_bullet_section(sections, "Success Metrics", body.get("success_metrics", []))
            self._append_text_section(sections, "Priority", [body.get("priority", "")])
            return self._doc_from_blocks(sections)

        if artifact.artifact_type == "enhancement":
            self._append_text_section(sections, "Current Issue", [body.get("current_issue", "")])
            self._append_text_section(sections, "Proposed Improvement", [body.get("proposed_improvement", "")])
            self._append_text_section(sections, "Expected Impact", [body.get("expected_impact", "")])
            self._append_bullet_section(sections, "Dependencies", body.get("dependencies", []))
            self._append_text_section(sections, "Priority", [body.get("priority", "")])
            return self._doc_from_blocks(sections)

        for key, value in body.items():
            label = key.replace("_", " ").title()
            if isinstance(value, list):
                self._append_bullet_section(sections, label, value)
            elif isinstance(value, dict):
                nested_lines = []
                for sub_key, sub_value in value.items():
                    if isinstance(sub_value, list):
                        nested_lines.append(f"{sub_key.replace('_', ' ').title()}:")
                        nested_lines.extend([f"- {item}" for item in sub_value if item])
                    elif sub_value:
                        nested_lines.append(f"{sub_key.replace('_', ' ').title()}: {sub_value}")
                self._append_text_section(sections, label, nested_lines)
            elif value:
                self._append_text_section(sections, label, [str(value)])
        return self._doc_from_blocks(sections)

    def _feature_to_generated_artifact(self, feature: FeatureDraft) -> GeneratedArtifact:
        return GeneratedArtifact(
            artifact_id=feature.feature_id,
            artifact_type="feature",
            derived_from_solution_id="feature-generator",
            status=feature.status,
            title=feature.title,
            summary=feature.summary,
            body=feature.body,
        )

    def _issue_to_source_feature(self, session: JiraSession, project_key: str, issue: dict[str, Any]) -> JiraFeatureSource:
        fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
        description_text = self._adf_to_text(fields.get("description"))
        return JiraFeatureSource(
            issue_key=str(issue.get("key", "")),
            issue_url=f"{session.base_url}/browse/{issue.get('key', '')}",
            project_key=project_key,
            issue_type=str((fields.get("issuetype") or {}).get("name", "Epic")),
            status_name=str((fields.get("status") or {}).get("name", "")).strip() or None,
            priority_name=str((fields.get("priority") or {}).get("name", "")).strip() or None,
            title=str(fields.get("summary", "")).strip(),
            description_text=description_text,
        )

    def _issue_to_backlog_story(
        self,
        session: JiraSession,
        project_key: str,
        issue: dict[str, Any],
        story_points_field: str | None,
    ) -> JiraBacklogStorySource:
        fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
        description_text = self._adf_to_text(fields.get("description"))
        parent = fields.get("parent") if isinstance(fields.get("parent"), dict) else {}
        raw_points = fields.get(story_points_field) if story_points_field else None
        try:
            story_points = float(raw_points) if raw_points is not None else None
        except (TypeError, ValueError):
            story_points = None
        return JiraBacklogStorySource(
            issue_key=str(issue.get("key", "")),
            issue_url=f"{session.base_url}/browse/{issue.get('key', '')}",
            project_key=project_key,
            issue_type=str((fields.get("issuetype") or {}).get("name", "Story")),
            status_name=str((fields.get("status") or {}).get("name", "")).strip() or None,
            priority_name=str((fields.get("priority") or {}).get("name", "")).strip() or None,
            title=str(fields.get("summary", "")).strip(),
            description_text=description_text,
            parent_issue_key=str(parent.get("key", "")).strip() or None,
            parent_title=str((parent.get("fields") or {}).get("summary", "")).strip() or None,
            story_points=story_points,
        )

    def _adf_to_text(self, value: Any) -> str:
        parts: list[str] = []

        def walk(node: Any) -> None:
            if isinstance(node, dict):
                if node.get("type") == "text" and node.get("text"):
                    parts.append(str(node["text"]))
                for item in node.get("content", []) if isinstance(node.get("content"), list) else []:
                    walk(item)
                if node.get("type") in {"paragraph", "heading", "listItem"}:
                    parts.append("\n")
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(value)
        text = "".join(parts)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)

    def _paragraph_adf(self, lines: list[str]) -> dict[str, Any]:
        content = []
        for line in [item for item in lines if item]:
            content.append(
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": str(line)}],
                }
            )
        if not content:
            content = [{"type": "paragraph", "content": [{"type": "text", "text": ""}]}]
        return {"type": "doc", "version": 1, "content": content}

    def _doc_from_blocks(self, blocks: list[dict[str, Any]]) -> dict[str, Any]:
        if not blocks:
            return self._paragraph_adf([])
        return {"type": "doc", "version": 1, "content": blocks}

    def _append_text_section(self, blocks: list[dict[str, Any]], heading: str, lines: list[str]) -> None:
        filtered = [str(line).strip() for line in lines if str(line).strip()]
        if not filtered:
            return
        blocks.append(self._heading_block(heading))
        blocks.extend(self._paragraph_blocks(filtered))

    def _append_bullet_section(self, blocks: list[dict[str, Any]], heading: str, items: list[Any]) -> None:
        filtered = [str(item).strip() for item in items if str(item).strip()]
        if not filtered:
            return
        blocks.append(self._heading_block(heading))
        blocks.append(self._bullet_list_block(filtered))

    def _heading_block(self, text: str) -> dict[str, Any]:
        return {
            "type": "heading",
            "attrs": {"level": 3},
            "content": [{"type": "text", "text": text}],
        }

    def _paragraph_blocks(self, lines: list[str]) -> list[dict[str, Any]]:
        return [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": line}],
            }
            for line in lines
        ]

    def _bullet_list_block(self, items: list[str]) -> dict[str, Any]:
        return {
            "type": "bulletList",
            "content": [
                {
                    "type": "listItem",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": item}],
                        }
                    ],
                }
                for item in items
            ],
        }

    def _require_session(self) -> JiraSession:
        if self._session is not None:
            return self._session
        persisted = self._load_persisted_session()
        if persisted is not None:
            self._session = persisted
            return self._session
        if settings.jira_base_url and settings.jira_email and settings.jira_api_token:
            me = self._token_get(settings.jira_base_url.rstrip("/"), settings.jira_email, settings.jira_api_token, "/rest/api/3/myself")
            self._session = JiraSession(
                access_token=settings.jira_api_token,
                refresh_token=None,
                cloud_id="",
                base_url=settings.jira_base_url.rstrip("/"),
                display_name=me.get("displayName"),
                account_id=me.get("accountId"),
                email=settings.jira_email,
            )
            return self._session
        raise RuntimeError("Jira is not connected.")

    def _persist_session(self, session: JiraSession, state: str | None = None) -> None:
        self._repository.save_connection(
            provider="jira",
            state=state or f"jira-{token_urlsafe(12)}",
            external_user_id=session.account_id,
            username=session.email,
            full_name=session.display_name,
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            scopes=settings.jira_scopes.split(),
            token_expires_at=None,
            metadata={
                "base_url": session.base_url,
                "account_id": session.account_id,
                "email": session.email,
                "display_name": session.display_name,
                "cloud_id": session.cloud_id,
            },
        )

    def _load_persisted_session(self) -> Optional[JiraSession]:
        record = self._repository.get_latest_connection("jira")
        if not record:
            return None
        metadata = record.get("metadata") or {}
        access_token = record.get("access_token")
        if not access_token:
            return None
        return JiraSession(
            access_token=access_token,
            refresh_token=record.get("refresh_token"),
            cloud_id=metadata.get("cloud_id", ""),
            base_url=(metadata.get("base_url") or "").rstrip("/"),
            display_name=metadata.get("display_name") or record.get("full_name"),
            account_id=metadata.get("account_id") or record.get("external_user_id"),
            email=metadata.get("email") or record.get("username"),
        )

    def _get(self, session: JiraSession, path: str) -> Any:
        if session.cloud_id:
            return self._oauth_get(session, path)
        return self._token_get(session.base_url, session.email or "", session.access_token, path)

    def _post(self, session: JiraSession, path: str, body: dict[str, Any]) -> Any:
        if session.cloud_id:
            return self._oauth_post(session, path, body)
        return self._token_post(session.base_url, session.email or "", session.access_token, path, body)

    def _put(self, session: JiraSession, path: str, body: dict[str, Any]) -> Any:
        if session.cloud_id:
            return self._oauth_put(session, path, body)
        return self._token_put(session.base_url, session.email or "", session.access_token, path, body)

    def _oauth_get(self, session: JiraSession, path: str) -> Any:
        url = f"https://api.atlassian.com/ex/jira/{session.cloud_id}{path}"
        try:
            return self._http_get(
                url,
                headers={
                    "Authorization": f"Bearer {session.access_token}",
                    "Accept": "application/json",
                },
            )
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            try:
                return self._http_get(
                    url,
                    headers={
                        "Authorization": f"Bearer {session.access_token}",
                        "Accept": "application/json",
                    },
                    verify=False,
                )
            except RuntimeError as exc:
                if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                    return self._http_get(
                        url,
                        headers={
                            "Authorization": f"Bearer {session.access_token}",
                            "Accept": "application/json",
                        },
                        verify=False,
                    )
                raise
        except RuntimeError as exc:
            if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                return self._http_get(
                    url,
                    headers={
                        "Authorization": f"Bearer {session.access_token}",
                        "Accept": "application/json",
                    },
                )
            raise

    def _oauth_post(self, session: JiraSession, path: str, body: dict[str, Any]) -> Any:
        url = f"https://api.atlassian.com/ex/jira/{session.cloud_id}{path}"
        headers = {
            "Authorization": f"Bearer {session.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        try:
            return self._http_post(url, headers=headers, json=body)
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            try:
                return self._http_post(url, headers=headers, json=body, verify=False)
            except RuntimeError as exc:
                if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                    return self._http_post(
                        url,
                        headers={
                            "Authorization": f"Bearer {session.access_token}",
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json=body,
                        verify=False,
                    )
                raise
        except RuntimeError as exc:
            if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                return self._http_post(
                    url,
                    headers={
                        "Authorization": f"Bearer {session.access_token}",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
            raise

    def _oauth_put(self, session: JiraSession, path: str, body: dict[str, Any]) -> Any:
        url = f"https://api.atlassian.com/ex/jira/{session.cloud_id}{path}"
        headers = {
            "Authorization": f"Bearer {session.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        try:
            return self._http_put(url, headers=headers, json=body)
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            try:
                return self._http_put(url, headers=headers, json=body, verify=False)
            except RuntimeError as exc:
                if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                    return self._http_put(
                        url,
                        headers={
                            "Authorization": f"Bearer {session.access_token}",
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json=body,
                        verify=False,
                    )
                raise
        except RuntimeError as exc:
            if self._is_unauthorized(exc) and self._maybe_refresh_oauth_session(session):
                return self._http_put(
                    url,
                    headers={
                        "Authorization": f"Bearer {session.access_token}",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
            raise

    def _is_unauthorized(self, exc: RuntimeError) -> bool:
        return "Jira API error 401" in str(exc)

    def _maybe_refresh_oauth_session(self, session: JiraSession) -> bool:
        if not session.refresh_token or not self.oauth_enabled:
            return False
        try:
            token_body = self._oauth_refresh_exchange(session.refresh_token, verify=certifi.where())
        except httpx.ConnectError:
            if not settings.is_development:
                return False
            try:
                token_body = self._oauth_refresh_exchange(session.refresh_token, verify=False)
            except Exception:
                return False
        except Exception:
            return False

        access_token = str(token_body.get("access_token", "")).strip()
        if not access_token:
            return False

        refreshed_token = token_body.get("refresh_token")
        session.access_token = access_token
        session.refresh_token = str(refreshed_token) if refreshed_token else session.refresh_token
        self._session = session
        self._persist_session(session)
        return True

    def _token_get(self, base_url: str, email: str, api_token: str, path: str) -> Any:
        url = f"{base_url}{path}"
        try:
            return self._http_get(
                url,
                auth=(email, api_token),
                headers={"Accept": "application/json"},
            )
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            return self._http_get(
                url,
                auth=(email, api_token),
                headers={"Accept": "application/json"},
                verify=False,
            )

    def _token_post(self, base_url: str, email: str, api_token: str, path: str, body: dict[str, Any]) -> Any:
        url = f"{base_url}{path}"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        try:
            return self._http_post(url, auth=(email, api_token), headers=headers, json=body)
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            return self._http_post(url, auth=(email, api_token), headers=headers, json=body, verify=False)

    def _token_put(self, base_url: str, email: str, api_token: str, path: str, body: dict[str, Any]) -> Any:
        url = f"{base_url}{path}"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        try:
            return self._http_put(url, auth=(email, api_token), headers=headers, json=body)
        except httpx.ConnectError:
            if not settings.is_development:
                raise
            return self._http_put(url, auth=(email, api_token), headers=headers, json=body, verify=False)

    def _http_get(
        self,
        url: str,
        *,
        headers: dict[str, str],
        auth: tuple[str, str] | None = None,
        verify: str | bool | None = None,
    ) -> Any:
        client_verify = certifi.where() if verify is None else verify
        with httpx.Client(timeout=30.0, verify=client_verify) as client:
            response = client.get(url, headers=headers, auth=auth)
            self._raise_for_status_with_details(response)
            return response.json()

    def _http_post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any],
        auth: tuple[str, str] | None = None,
        verify: str | bool | None = None,
    ) -> Any:
        client_verify = certifi.where() if verify is None else verify
        with httpx.Client(timeout=30.0, verify=client_verify) as client:
            response = client.post(url, headers=headers, auth=auth, json=json)
            self._raise_for_status_with_details(response)
            return response.json()

    def _http_put(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any],
        auth: tuple[str, str] | None = None,
        verify: str | bool | None = None,
    ) -> Any:
        client_verify = certifi.where() if verify is None else verify
        with httpx.Client(timeout=30.0, verify=client_verify) as client:
            response = client.put(url, headers=headers, auth=auth, json=json)
            self._raise_for_status_with_details(response)
            if not response.content:
                return {}
            return response.json()

    def _raise_for_status_with_details(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = self._extract_error_detail(response)
            if detail:
                raise RuntimeError(f"Jira API error {response.status_code}: {detail}") from exc
            raise

    def _extract_error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except Exception:
            text = response.text.strip()
            return text[:500]

        messages: list[str] = []
        error_messages = payload.get("errorMessages")
        if isinstance(error_messages, list):
            messages.extend([str(item).strip() for item in error_messages if str(item).strip()])
        errors = payload.get("errors")
        if isinstance(errors, dict):
            for key, value in errors.items():
                value_text = str(value).strip()
                if value_text:
                    messages.append(f"{key}: {value_text}")
        if not messages:
            message = payload.get("message")
            if message:
                messages.append(str(message).strip())
        return " | ".join(messages)[:1000]
