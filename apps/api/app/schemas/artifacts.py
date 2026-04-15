from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.solution_shaping import ShapedSolution


class GeneratedArtifact(BaseModel):
    artifact_id: str
    artifact_type: str
    derived_from_solution_id: str
    status: str = "draft"
    title: str
    summary: str = ""
    body: dict[str, Any] = {}


class ArtifactGenerateRequest(BaseModel):
    shaped: list[ShapedSolution]


class ArtifactGenerateResponse(BaseModel):
    artifacts: list[GeneratedArtifact] = []


class ArtifactApproveRequest(BaseModel):
    artifacts: list[GeneratedArtifact]
    approved_ids: list[str] = []
    rejected_ids: list[str] = []


class ArtifactApproveResponse(BaseModel):
    artifacts: list[GeneratedArtifact] = []
    approved_count: int
    rejected_count: int
    total_candidates: int


class StoryDraft(BaseModel):
    story_id: str
    derived_from_artifact_id: Optional[str] = None
    status: str = "draft"
    title: str
    user_story: str = ""
    as_a: str = ""
    i_want: str = ""
    so_that: str = ""
    description: str = ""
    acceptance_criteria: list[str] = []
    edge_cases: list[str] = []
    dependencies: list[str] = []
    priority: str = "medium"


class StorySliceWorkflowRequest(BaseModel):
    artifacts: list[GeneratedArtifact]


class StorySliceWorkflowResponse(BaseModel):
    stories: list[StoryDraft] = []


class StoryApproveRequest(BaseModel):
    stories: list[StoryDraft]
    approved_ids: list[str] = []
    rejected_ids: list[str] = []


class StoryApproveResponse(BaseModel):
    stories: list[StoryDraft] = []
    approved_count: int
    rejected_count: int
    total_candidates: int
