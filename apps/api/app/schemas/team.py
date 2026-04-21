from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectTeamMember(BaseModel):
    id: UUID
    project_id: UUID
    full_name: str
    role_key: str
    role_label: str
    discipline: str
    seniority: str = "mid"
    allocation_pct: int = 100
    created_at: datetime
    updated_at: datetime


class ProjectTeamResponse(BaseModel):
    project_id: UUID
    average_velocity_per_sprint: int = 24
    minimum_ready_backlog_target: int = 48
    team_members: list[ProjectTeamMember] = Field(default_factory=list)
