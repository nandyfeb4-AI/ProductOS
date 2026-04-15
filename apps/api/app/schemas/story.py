from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.common import StoryArtifact
from app.schemas.feature import Feature
from app.schemas.prd import PRDDocument


class StoryGenerateRequest(BaseModel):
    feature: Feature
    prd: Optional[PRDDocument] = None


class StoryGenerateResponse(BaseModel):
    stories: list[StoryArtifact]


class StoryRefineRequest(BaseModel):
    stories: list[StoryArtifact]


class StoryRefineResponse(BaseModel):
    stories: list[StoryArtifact]


class StorySliceRequest(BaseModel):
    stories: list[StoryArtifact]


class StorySliceResponse(BaseModel):
    stories: list[StoryArtifact]
