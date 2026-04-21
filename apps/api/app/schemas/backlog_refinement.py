from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.agents import StoryRefinementEvaluation
from app.schemas.feature_hardening import JiraFeatureSource


class JiraBacklogStorySource(BaseModel):
    issue_key: str
    issue_url: str
    project_key: str
    issue_type: str = "Story"
    status_name: Optional[str] = None
    priority_name: Optional[str] = None
    title: str
    description_text: str = ""
    parent_issue_key: Optional[str] = None
    parent_title: Optional[str] = None
    story_points: Optional[float] = None


class BacklogFeatureSummary(JiraFeatureSource):
    story_count: int = 0
    total_story_points: float = 0


class BacklogRefinementSourceResponse(BaseModel):
    jira_project_key: str
    features: list[BacklogFeatureSummary] = Field(default_factory=list)
    stories: list[JiraBacklogStorySource] = Field(default_factory=list)
    total_story_points: float = 0


class BacklogRoutingItem(BaseModel):
    issue_key: str
    issue_url: str
    item_type: Literal["feature", "story"] = "story"
    parent_issue_key: Optional[str] = None
    title: str
    reason: str
    story_points: Optional[float] = None


class BacklogStoryDraft(BaseModel):
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
    story_points: int = 3


class BacklogStoryRefinementResult(BaseModel):
    issue_key: str
    issue_url: str
    source_story: JiraBacklogStorySource
    evaluation: StoryRefinementEvaluation
    refined_story: BacklogStoryDraft
    refinement_summary: str = ""


class BacklogStorySlicingResult(BaseModel):
    source_story: JiraBacklogStorySource
    stories: list[BacklogStoryDraft] = Field(default_factory=list)
    slicing_summary: str = ""


class BacklogHealthSummary(BaseModel):
    average_velocity_per_sprint: int
    minimum_ready_backlog_target: int
    total_backlog_story_points: float = 0
    total_ready_story_points: float = 0
    backlog_point_shortfall: float = 0
    feature_count: int = 0
    story_count: int = 0


class BacklogRefinementAnalyzeRequest(BaseModel):
    project_id: UUID
    workflow_id: Optional[UUID] = None
    source_type: Literal["jira_project"] = "jira_project"
    jira_project_key: str
    feature_issue_keys: list[str] = Field(default_factory=list)


class BacklogRefinementAnalyzeResponse(BaseModel):
    workflow_id: Optional[UUID] = None
    jira_project_key: str
    health: BacklogHealthSummary
    generate: list[BacklogRoutingItem] = Field(default_factory=list)
    refine: list[BacklogRoutingItem] = Field(default_factory=list)
    slice: list[BacklogRoutingItem] = Field(default_factory=list)
    ready: list[BacklogRoutingItem] = Field(default_factory=list)
    summary: str = ""


class BacklogRefinementExecuteRequest(BaseModel):
    project_id: UUID
    workflow_id: Optional[UUID] = None
    jira_project_key: str
    generate_issue_keys: list[str] = Field(default_factory=list)
    refine_issue_keys: list[str] = Field(default_factory=list)
    slice_issue_keys: list[str] = Field(default_factory=list)


class BacklogRefinementExecutionSummary(BaseModel):
    generate_count: int = 0
    refine_count: int = 0
    slice_count: int = 0
    approved_total: int = 0
    created_story_count: int = 0
    updated_story_count: int = 0
    sliced_story_count: int = 0


class BacklogRefinementExecutionResult(BaseModel):
    bucket: Literal["generate", "refine", "slice"]
    source_issue_key: str
    source_issue_url: str = ""
    status: Literal["completed", "skipped", "failed"] = "completed"
    message: str = ""
    created_issues: list[JiraBacklogStorySource] = Field(default_factory=list)
    updated_issue: Optional[JiraBacklogStorySource] = None
    sliced_source_issue: Optional[JiraBacklogStorySource] = None


class BacklogRefinementExecuteResponse(BaseModel):
    workflow_id: Optional[UUID] = None
    jira_project_key: str
    execution: BacklogRefinementExecutionSummary
    results: list[BacklogRefinementExecutionResult] = Field(default_factory=list)
    summary: str = ""
