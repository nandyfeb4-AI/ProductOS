from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectStoryBase(BaseModel):
    project_id: UUID
    source_type: str = "feature"
    source_feature_id: Optional[UUID] = None
    source_story_id: Optional[UUID] = None
    status: str = "draft"
    generator_type: str = "story_generator"
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: str
    user_story: str = ""
    as_a: str = ""
    i_want: str = ""
    so_that: str = ""
    description: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    edge_cases: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    priority: str = "medium"
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None


class ProjectStoryCreateRequest(ProjectStoryBase):
    pass


class ProjectStoryUpdateRequest(BaseModel):
    source_type: Optional[str] = None
    source_feature_id: Optional[UUID] = None
    source_story_id: Optional[UUID] = None
    status: Optional[str] = None
    generator_type: Optional[str] = None
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: Optional[str] = None
    user_story: Optional[str] = None
    as_a: Optional[str] = None
    i_want: Optional[str] = None
    so_that: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[list[str]] = None
    edge_cases: Optional[list[str]] = None
    dependencies: Optional[list[str]] = None
    priority: Optional[str] = None
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None


class ProjectStorySummary(BaseModel):
    id: UUID
    project_id: UUID
    source_type: str
    source_feature_id: Optional[UUID] = None
    source_story_id: Optional[UUID] = None
    status: str
    generator_type: str
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: str
    description: str = ""
    priority: str = "medium"
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProjectStoryResponse(ProjectStorySummary):
    user_story: str = ""
    as_a: str = ""
    i_want: str = ""
    so_that: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    edge_cases: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)


class ProjectStoryListResponse(BaseModel):
    stories: list[ProjectStorySummary] = Field(default_factory=list)
