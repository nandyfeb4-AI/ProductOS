from pydantic import BaseModel

from app.schemas.common import ArtifactBase, InsightBundle


class Initiative(ArtifactBase):
    problem_statement: str
    priority: str = "medium"


class InitiativeGenerateRequest(BaseModel):
    workshop_id: str
    insights: InsightBundle


class InitiativeGenerateResponse(BaseModel):
    initiatives: list[Initiative]

