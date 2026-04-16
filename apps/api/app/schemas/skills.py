from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SkillBase(BaseModel):
    name: str
    slug: str
    skill_type: str
    description: Optional[str] = None
    is_active: bool = True
    instructions: str = ""
    required_sections: list[str] = Field(default_factory=list)
    quality_bar: list[str] = Field(default_factory=list)
    integration_notes: list[str] = Field(default_factory=list)


class SkillCreateRequest(SkillBase):
    pass


class SkillUpdateRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    skill_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    instructions: Optional[str] = None
    required_sections: Optional[list[str]] = None
    quality_bar: Optional[list[str]] = None
    integration_notes: Optional[list[str]] = None


class SkillSummary(SkillBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class SkillResponse(SkillSummary):
    pass


class SkillListResponse(BaseModel):
    skills: list[SkillSummary] = Field(default_factory=list)
