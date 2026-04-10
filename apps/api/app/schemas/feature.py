from pydantic import BaseModel

from app.schemas.initiative import Initiative


class Feature(BaseModel):
    title: str
    description: str
    business_value: str
    initiative_title: str


class FeatureGenerateRequest(BaseModel):
    initiatives: list[Initiative]


class FeatureGenerateResponse(BaseModel):
    features: list[Feature]

