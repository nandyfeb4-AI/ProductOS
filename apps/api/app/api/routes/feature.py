from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.feature import FeatureGenerateRequest, FeatureGenerateResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/generate", response_model=FeatureGenerateResponse)
async def generate_features(
    payload: FeatureGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureGenerateResponse:
    return service.generate_features(payload)

