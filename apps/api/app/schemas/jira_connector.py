from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.artifacts import GeneratedArtifact, StoryDraft


class JiraConnectRequest(BaseModel):
    base_url: str
    email: str
    api_token: str


class JiraConnectResponse(BaseModel):
    connected: bool
    base_url: str
    email: str
    display_name: Optional[str] = None
    account_id: Optional[str] = None


class JiraProject(BaseModel):
    id: str
    key: str
    name: str
    project_type_key: Optional[str] = None


class JiraProjectsResponse(BaseModel):
    projects: list[JiraProject] = []


class JiraExportRequest(BaseModel):
    project_key: str
    stories: list[StoryDraft]
    parent_strategy: str = "feature-as-epic"
    artifacts: list[GeneratedArtifact] = []


class JiraExportIssue(BaseModel):
    story_id: str
    issue_key: str
    issue_url: str
    parent_issue_key: Optional[str] = None


class JiraExportResponse(BaseModel):
    issues: list[JiraExportIssue] = []
