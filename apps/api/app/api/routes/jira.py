from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.jira import JiraPushRequest, JiraPushResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/push", response_model=JiraPushResponse)
async def push_to_jira(
    payload: JiraPushRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraPushResponse:
    return service.push_to_jira(payload)

