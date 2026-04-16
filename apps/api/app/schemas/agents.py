from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.artifacts import StoryDraft


class FeatureDraft(BaseModel):
    feature_id: str
    status: str = "draft"
    title: str
    summary: str = ""
    body: dict = Field(default_factory=dict)


class FeatureGeneratorRequest(BaseModel):
    project_id: UUID
    source_type: Literal["prompt", "opportunity", "requirement"] = "prompt"
    source_title: str
    source_summary: str
    source_details: str = ""
    desired_outcome: str = ""
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class FeatureGeneratorResponse(BaseModel):
    feature: FeatureDraft


class StoryGeneratorRequest(BaseModel):
    project_id: UUID
    source_type: Literal["feature"] = "feature"
    source_feature_id: UUID
    story_count_hint: int | None = None
    constraints: list[str] = Field(default_factory=list)
    supporting_context: list[str] = Field(default_factory=list)


class StoryGeneratorResponse(BaseModel):
    stories: list[StoryDraft] = Field(default_factory=list)
