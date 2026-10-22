from functools import lru_cache

from pydantic import HttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: HttpUrl
    supabase_publishable_key: str = Field(repr=False)
    supabase_service_role_key: str = Field(default="", repr=False)  # backend only
    supabase_secret_key: str = Field(default="", repr=False)  # backend only

    @property
    def storage_server_key(self) -> str:
        """Single server-side credential accessor used by the Storage service."""
        return self.supabase_secret_key or self.supabase_service_role_key
    database_url: str = Field(repr=False)
    frontend_origins: str = ''
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')


@lru_cache
def get_settings() -> Settings:
    return Settings()
