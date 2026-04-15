from __future__ import annotations

from functools import cached_property
from pathlib import Path
from typing import Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    api_v1_prefix: str = "/api"
    backend_cors_origins: Union[list[str], str] = ["http://localhost:5173", "http://localhost:3000"]
    frontend_app_url: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_db_url: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    jira_base_url: str = ""
    jira_email: str = ""
    jira_api_token: str = ""
    jira_project_key: str = ""
    jira_client_id: str = ""
    jira_client_secret: str = ""
    jira_redirect_uri: str = "http://localhost:8001/api/connectors/jira/callback"
    jira_scopes: str = "offline_access read:me read:jira-user read:jira-work write:jira-work"

    mural_client_id: str = ""
    mural_client_secret: str = ""
    mural_redirect_uri: str = "http://localhost:8000/api/connectors/mural/callback"
    mural_scopes: str = "identity:read workspaces:read rooms:read murals:read"

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[list[str], str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @cached_property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"


settings = Settings()
