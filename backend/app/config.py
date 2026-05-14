from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/alphatest"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()
