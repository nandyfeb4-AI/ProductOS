from fastapi import APIRouter

from app.api.routes import feature, initiative, jira, prd, story, workshop

api_router = APIRouter()
api_router.include_router(workshop.router, prefix="/workshop", tags=["workshop"])
api_router.include_router(initiative.router, prefix="/initiative", tags=["initiative"])
api_router.include_router(feature.router, prefix="/feature", tags=["feature"])
api_router.include_router(prd.router, prefix="/prd", tags=["prd"])
api_router.include_router(story.router, prefix="/story", tags=["story"])
api_router.include_router(jira.router, prefix="/jira", tags=["jira"])

