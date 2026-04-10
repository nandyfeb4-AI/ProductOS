from pydantic import BaseModel, Field

from app.schemas.common import InsightBundle


class WorkshopAnalyzeRequest(BaseModel):
    title: str = Field(..., examples=["April onboarding workshop"])
    transcript: str = Field(..., min_length=10)
    notes: str | None = None


class WorkshopAnalyzeResponse(BaseModel):
    workshop_id: str
    insights: InsightBundle

