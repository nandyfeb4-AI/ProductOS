from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.agents import FeatureDraft, FeatureRefinementEvaluation


class JiraFeatureSource(BaseModel):
    issue_key: str
    issue_url: str
    project_key: str
    issue_type: str = "Epic"
    status_name: Optional[str] = None
    priority_name: Optional[str] = None
    title: str
    description_text: str = ""


class JiraFeatureSourceListResponse(BaseModel):
    features: list[JiraFeatureSource] = Field(default_factory=list)


class FeatureHardeningRunRequest(BaseModel):
    project_id: UUID
    workflow_id: Optional[UUID] = None
    source_type: Literal["jira_project"] = "jira_project"
    jira_project_key: str
    issue_keys: list[str] = Field(default_factory=list, min_length=1, max_length=8)
    refinement_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class FeatureHardeningResult(BaseModel):
    issue_key: str
    issue_url: str
    source_feature: JiraFeatureSource
    evaluation: FeatureRefinementEvaluation
    refined_feature: FeatureDraft
    refinement_summary: str = ""


class FeatureHardeningRunResponse(BaseModel):
    workflow_id: Optional[UUID] = None
    jira_project_key: str
    results: list[FeatureHardeningResult] = Field(default_factory=list)
    hardening_summary: str = ""


class FeatureHardeningPublishItem(BaseModel):
    issue_key: str
    refined_feature: FeatureDraft


class FeatureHardeningPublishRequest(BaseModel):
    project_id: UUID
    workflow_id: Optional[UUID] = None
    jira_project_key: str
    results: list[FeatureHardeningPublishItem] = Field(default_factory=list, min_length=1, max_length=8)


class FeatureHardeningPublishResult(BaseModel):
    issue_key: str
    issue_url: str
    issue_type: str
    updated: bool = True


class FeatureHardeningPublishResponse(BaseModel):
    workflow_id: Optional[UUID] = None
    results: list[FeatureHardeningPublishResult] = Field(default_factory=list)
