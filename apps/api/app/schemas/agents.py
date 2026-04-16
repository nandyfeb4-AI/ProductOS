from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


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

