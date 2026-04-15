from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.jira import JiraPushRequest, JiraPushResponse
from app.schemas.jira_connector import JiraExportRequest, JiraExportResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/push", response_model=JiraPushResponse)
async def push_to_jira(
    payload: JiraPushRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraPushResponse:
    return service.push_to_jira(payload)


@router.post("/export", response_model=JiraExportResponse)
async def export_to_jira(
    payload: JiraExportRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraExportResponse:
    return service.export_to_jira(payload)
