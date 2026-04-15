from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.opportunity import OpportunityCandidate


class ShapedSolution(BaseModel):
    id: Optional[str] = None
    derived_from_opportunity_id: str
    recommended_type: str
    title: str
    problem_statement: str
    rationale: str = ""
    scope: Optional[str] = None
    chosen_type: Optional[str] = None


class SolutionShapingSynthesizeRequest(BaseModel):
    opportunities: list[OpportunityCandidate]


class SolutionShapingSynthesizeResponse(BaseModel):
    shaped: list[ShapedSolution] = []


class SolutionShapingConfirmRequest(BaseModel):
    shaped: list[ShapedSolution]


class SolutionShapingConfirmResponse(BaseModel):
    shaped: list[ShapedSolution] = []
    actionable_count: int
    deferred_count: int
