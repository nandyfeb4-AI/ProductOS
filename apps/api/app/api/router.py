from fastapi import APIRouter

from app.api.routes import agents, artifacts, connectors, dashboard, feature, initiative, jira, jobs, opportunity, prd, projects, skills, solution_shaping, stories, story, workflows, workshop, workshops

api_router = APIRouter()
api_router.include_router(workshop.router, prefix="/workshop", tags=["workshop"])
api_router.include_router(initiative.router, prefix="/initiative", tags=["initiative"])
api_router.include_router(feature.router, prefix="/feature", tags=["feature"])
api_router.include_router(prd.router, prefix="/prd", tags=["prd"])
api_router.include_router(story.router, prefix="/story", tags=["story"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(jira.router, prefix="/jira", tags=["jira"])
api_router.include_router(connectors.router, prefix="/connectors", tags=["connectors"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(workshops.router, prefix="/workshops", tags=["workshops"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(opportunity.router, prefix="/opportunity", tags=["opportunity"])
api_router.include_router(solution_shaping.router, prefix="/solution-shaping", tags=["solution-shaping"])
api_router.include_router(artifacts.router, prefix="/artifacts", tags=["artifacts"])
api_router.include_router(stories.router, prefix="/stories", tags=["stories"])
