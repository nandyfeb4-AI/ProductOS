from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.common import StoryArtifact


class JiraPushRequest(BaseModel):
    project_key: Optional[str] = None
    stories: list[StoryArtifact]


class JiraPushResult(BaseModel):
    story_title: str
    issue_key: str
    issue_url: str


class JiraPushResponse(BaseModel):
    issues: list[JiraPushResult]
