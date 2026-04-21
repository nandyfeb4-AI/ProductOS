from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WorkflowRunBase(BaseModel):
    workflow_type: str = "workshop"
    workflow_definition_key: Optional[str] = None
    workflow_definition_label: Optional[str] = None
    project_id: Optional[UUID] = None
    workshop_id: Optional[UUID] = None
    title: Optional[str] = None
    source_provider: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_name: Optional[str] = None
    current_step: str = "workshop"
    status: str = "active"
    state_payload: dict[str, Any] = Field(default_factory=dict)


class WorkflowRunCreateRequest(WorkflowRunBase):
    pass


class WorkflowRunUpdateRequest(BaseModel):
    workflow_definition_key: Optional[str] = None
    workflow_definition_label: Optional[str] = None
    project_id: Optional[UUID] = None
    workshop_id: Optional[UUID] = None
    title: Optional[str] = None
    source_provider: Optional[str] = None
    source_resource_id: Optional[str] = None
    source_resource_name: Optional[str] = None
    current_step: Optional[str] = None
    status: Optional[str] = None
    state_payload: Optional[dict[str, Any]] = None


class WorkflowRunResponse(WorkflowRunBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowRunListResponse(BaseModel):
    workflows: list[WorkflowRunResponse] = Field(default_factory=list)
