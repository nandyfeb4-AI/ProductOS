from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


JobType = Literal[
    "feature_generation",
    "opportunity_synthesis",
    "solution_shaping",
    "artifact_generation",
    "story_slicing",
]
JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class GenerationJob(BaseModel):
    id: str
    job_type: JobType
    status: JobStatus
    progress_stage: Optional[str] = None
    progress_message: Optional[str] = None
    input_payload: dict[str, Any] = Field(default_factory=dict)
    result_payload: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, value: Any) -> str:
        return str(value)


class GenerationJobAcceptedResponse(BaseModel):
    job: GenerationJob


class GenerationJobEvent(BaseModel):
    event: Literal["job.updated"] = "job.updated"
    job: GenerationJob
