from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import InsightBundle


class WorkshopAnalyzeRequest(BaseModel):
    title: str = Field(..., examples=["April onboarding workshop"])
    transcript: str = Field(..., min_length=10)
    notes: Optional[str] = None


class WorkshopAnalyzeResponse(BaseModel):
    workshop_id: str
    insights: InsightBundle


class WorkshopBase(BaseModel):
    project_id: UUID
    title: str
    status: str = "active"
    source_provider: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_name: Optional[str] = None
    source_url: Optional[str] = None
    transcript: Optional[str] = None
    notes: Optional[str] = None
    source_payload: dict[str, Any] = Field(default_factory=dict)
    insights_payload: dict[str, Any] = Field(default_factory=dict)
    journey_payload: dict[str, Any] = Field(default_factory=dict)
    import_meta: dict[str, Any] = Field(default_factory=dict)


class WorkshopCreateRequest(WorkshopBase):
    pass


class WorkshopUpdateRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    source_provider: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_name: Optional[str] = None
    source_url: Optional[str] = None
    transcript: Optional[str] = None
    notes: Optional[str] = None
    source_payload: Optional[dict[str, Any]] = None
    insights_payload: Optional[dict[str, Any]] = None
    journey_payload: Optional[dict[str, Any]] = None
    import_meta: Optional[dict[str, Any]] = None
    current_workflow_id: Optional[UUID] = None
    latest_workflow_step: Optional[str] = None
    latest_workflow_status: Optional[str] = None


class WorkshopSummary(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    status: str
    source_provider: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_name: Optional[str] = None
    source_url: Optional[str] = None
    import_meta: dict[str, Any] = Field(default_factory=dict)
    current_workflow_id: Optional[UUID] = None
    latest_workflow_step: Optional[str] = None
    latest_workflow_status: Optional[str] = None
    workflow_count: int = 0
    created_at: datetime
    updated_at: datetime


class WorkshopResponse(WorkshopSummary):
    transcript: Optional[str] = None
    notes: Optional[str] = None
    source_payload: dict[str, Any] = Field(default_factory=dict)
    insights_payload: dict[str, Any] = Field(default_factory=dict)
    journey_payload: dict[str, Any] = Field(default_factory=dict)


class WorkshopListResponse(BaseModel):
    workshops: list[WorkshopSummary] = Field(default_factory=list)
