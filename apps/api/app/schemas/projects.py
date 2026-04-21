from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    status: str = "active"
    average_velocity_per_sprint: int = 24


class ProjectCreateRequest(ProjectBase):
    pass


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    average_velocity_per_sprint: Optional[int] = None


class ProjectSummary(ProjectBase):
    id: UUID
    workshop_count: int = 0
    workflow_count: int = 0
    active_workflow_count: int = 0
    feature_count: int = 0
    initiative_count: int = 0
    story_count: int = 0
    team_member_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectResponse(ProjectSummary):
    pass


class ProjectListResponse(BaseModel):
    projects: list[ProjectSummary] = Field(default_factory=list)
