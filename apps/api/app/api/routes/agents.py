from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_pipeline_service
from app.schemas.agents import FeatureGeneratorRequest, FeatureGeneratorResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/feature-generator", response_model=FeatureGeneratorResponse)
async def run_feature_generator(
    payload: FeatureGeneratorRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> FeatureGeneratorResponse:
    try:
        return service.run_feature_generator(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

