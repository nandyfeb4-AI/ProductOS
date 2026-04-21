from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectFeatureBase(BaseModel):
    project_id: UUID
    source_type: str = "prompt"
    source_title: str
    source_summary: str
    source_details: str = ""
    desired_outcome: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)
    status: str = "draft"
    generator_type: str = "feature_generator"
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: str
    summary: str = ""
    body: dict[str, Any] = Field(default_factory=dict)
    prioritization: dict[str, Any] = Field(default_factory=dict)
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None


class ProjectFeatureCreateRequest(ProjectFeatureBase):
    pass


class ProjectFeatureUpdateRequest(BaseModel):
    source_type: Optional[str] = None
    source_title: Optional[str] = None
    source_summary: Optional[str] = None
    source_details: Optional[str] = None
    desired_outcome: Optional[str] = None
    constraints: Optional[list[str]] = None
    supporting_context: Optional[list[str]] = None
    status: Optional[str] = None
    generator_type: Optional[str] = None
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[dict[str, Any]] = None
    prioritization: Optional[dict[str, Any]] = None
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None


class ProjectFeatureSummary(BaseModel):
    id: UUID
    project_id: UUID
    source_type: str
    source_title: str
    source_summary: str
    status: str
    generator_type: str
    skill_id: Optional[UUID] = None
    skill_name: Optional[str] = None
    title: str
    summary: str = ""
    prioritization: dict[str, Any] = Field(default_factory=dict)
    jira_issue_key: Optional[str] = None
    jira_issue_url: Optional[str] = None
    jira_issue_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProjectFeatureResponse(ProjectFeatureSummary):
    source_details: str = ""
    desired_outcome: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)
    body: dict[str, Any] = Field(default_factory=dict)
    prioritization: dict[str, Any] = Field(default_factory=dict)


class ProjectFeatureListResponse(BaseModel):
    features: list[ProjectFeatureSummary] = Field(default_factory=list)
