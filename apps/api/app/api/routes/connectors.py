from functools import lru_cache
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.api.deps import get_pipeline_service
from app.schemas.connector_hub import ConnectorListResponse
from app.schemas.connectors import ConnectorAuthorizationResponse, MuralConnectionStatus, MuralImportResponse
from app.schemas.jira_connector import JiraConnectRequest, JiraConnectResponse, JiraProjectsResponse
from app.services.mural_service import MuralService
from app.services.pipeline_service import PipelineService

router = APIRouter()


@lru_cache
def get_mural_service() -> MuralService:
    return MuralService()


@router.get("/mural/connect", response_model=ConnectorAuthorizationResponse)
async def connect_mural() -> ConnectorAuthorizationResponse:
    authorization_url, state = get_mural_service().get_authorization_url()
    return ConnectorAuthorizationResponse(provider="mural", authorization_url=authorization_url, state=state)


@router.get("", response_model=ConnectorListResponse)
async def list_connectors(
    service: PipelineService = Depends(get_pipeline_service),
) -> ConnectorListResponse:
    return service.list_connectors()


@router.get("/mural/callback")
async def mural_callback(code: str = Query(...), state: str = Query(...)) -> RedirectResponse:
    session = await get_mural_service().exchange_code(code=code, state=state)
    query = urlencode(
        {
            "provider": "mural",
            "state": state,
            "connected": "true",
            "username": session.username or "",
            "full_name": session.full_name or "",
        }
    )
    return RedirectResponse(url=f"{settings.frontend_app_url}/oauth/mural/callback?{query}", status_code=302)


@router.get("/mural/status", response_model=MuralConnectionStatus)
async def mural_status(state: str = Query(...)) -> MuralConnectionStatus:
    session = get_mural_service().get_session(state)
    return MuralConnectionStatus(
        connected=True,
        state=state,
        user_id=session.user_id,
        username=session.username,
        full_name=session.full_name,
        scopes=session.scopes or [],
    )


@router.get("/mural/workspaces")
async def mural_workspaces(state: str = Query(...)) -> dict[str, object]:
    workspaces = await get_mural_service().list_workspaces(state)
    return {"provider": "mural", "workspaces": workspaces}


@router.get("/mural/workspaces/{workspace_id}/rooms")
async def mural_rooms(workspace_id: str, state: str = Query(...)) -> dict[str, object]:
    rooms = await get_mural_service().list_rooms(state, workspace_id)
    return {"provider": "mural", "rooms": rooms}


@router.get("/mural/workspaces/{workspace_id}/murals")
async def mural_boards(workspace_id: str, state: str = Query(...)) -> dict[str, object]:
    murals = await get_mural_service().list_murals(state, workspace_id)
    return {"provider": "mural", "murals": murals}


@router.get("/mural/murals/{mural_id}/widgets")
async def mural_widgets(mural_id: str, state: str = Query(...)) -> dict[str, object]:
    widgets = await get_mural_service().get_widgets(state, mural_id)
    return {"provider": "mural", "widgets": widgets}


@router.post("/mural/murals/{mural_id}/import", response_model=MuralImportResponse)
async def import_mural(mural_id: str, state: str = Query(...)) -> MuralImportResponse:
    response = await get_mural_service().import_mural(state, mural_id)
    get_mural_service().persist_import(state, response)
    return response


@router.post("/mural/disconnect")
async def disconnect_mural() -> dict[str, bool]:
    return get_mural_service().disconnect()


@router.post("/jira/connect", response_model=JiraConnectResponse)
async def connect_jira(
    payload: JiraConnectRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraConnectResponse:
    return service.connect_jira(payload)


@router.get("/jira/connect", response_model=ConnectorAuthorizationResponse)
async def connect_jira_oauth(
    service: PipelineService = Depends(get_pipeline_service),
) -> ConnectorAuthorizationResponse:
    authorization_url, state = service.get_jira_authorization_url()
    return ConnectorAuthorizationResponse(provider="jira", authorization_url=authorization_url, state=state)


@router.get("/jira/callback")
async def jira_callback(
    code: str = Query(...),
    state: str = Query(...),
    service: PipelineService = Depends(get_pipeline_service),
) -> RedirectResponse:
    session = service.exchange_jira_code(code=code, state=state)
    query = urlencode(
        {
            "provider": "jira",
            "connected": "true",
            "base_url": session.base_url,
            "display_name": session.display_name or "",
        }
    )
    return RedirectResponse(url=f"{settings.frontend_app_url}/oauth/jira/callback?{query}", status_code=302)


@router.get("/jira/status", response_model=JiraConnectResponse)
async def jira_status(
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraConnectResponse:
    return service.get_jira_status()


@router.get("/jira/projects", response_model=JiraProjectsResponse)
async def jira_projects(
    service: PipelineService = Depends(get_pipeline_service),
) -> JiraProjectsResponse:
    return service.get_jira_projects()


@router.post("/jira/disconnect")
async def jira_disconnect(
    service: PipelineService = Depends(get_pipeline_service),
) -> dict[str, bool]:
    return service.disconnect_jira()
