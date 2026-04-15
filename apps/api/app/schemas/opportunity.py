from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.common import InsightBundle
from app.schemas.connectors import JourneyExtraction


class OpportunityEvidence(BaseModel):
    text: str
    category: str
    stage: Optional[str] = None


class OpportunityCandidate(BaseModel):
    id: Optional[str] = None
    title: str
    problem_statement: str
    why_it_matters: str = ""
    confidence: int = 75
    impact: str = "medium"
    evidence: list[OpportunityEvidence] = []


class OpportunitySynthesizeRequest(BaseModel):
    title: str = "Workshop"
    insights: Optional[InsightBundle] = None
    journey: Optional[JourneyExtraction] = None


class OpportunitySynthesizeResponse(BaseModel):
    opportunities: list[OpportunityCandidate] = []


class OpportunityValidateRequest(BaseModel):
    title: Optional[str] = None
    opportunities: list[OpportunityCandidate]
    approved_ids: list[str] = []
    discarded_ids: list[str] = []


class OpportunityValidateResponse(BaseModel):
    approved: list[OpportunityCandidate] = []
    discarded_ids: list[str] = []
    total_candidates: int
    total_approved: int
