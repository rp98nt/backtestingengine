from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Read from env DATABASE_URL (Neon). Empty → database.py raises at import with instructions.
    database_url: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # When true, POST /api/benchmark/run attaches C++ microbench if `engine_native` is installed.
    use_native_engine: bool = True


settings = Settings()
