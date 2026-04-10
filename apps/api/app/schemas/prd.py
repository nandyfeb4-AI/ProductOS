from pydantic import BaseModel

from app.schemas.feature import Feature


class PRDDocument(BaseModel):
    overview: str
    problem: str
    solution: str
    scope: list[str]
    assumptions: list[str]


class PRDGenerateRequest(BaseModel):
    feature: Feature


class PRDGenerateResponse(BaseModel):
    prd: PRDDocument

