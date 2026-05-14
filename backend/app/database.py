from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


def _require_database_url() -> str:
    url = (settings.database_url or "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy the repo root .env.example to backend/.env "
            "and set DATABASE_URL to your Neon connection string "
            "(use postgresql+asyncpg://… — see .env.example)."
        )
    return url


def _connect_args(url: str) -> dict:
    """Neon and most cloud Postgres require TLS; local Docker-less dev often uses Neon only."""
    lower = url.lower()
    if "neon.tech" in lower or "sslmode=require" in lower or "ssl=require" in lower:
        return {"ssl": True}
    if "localhost" in lower or "127.0.0.1" in lower:
        return {}
    # Non-local hosts: prefer TLS (e.g. RDS, Supabase)
    return {"ssl": True}


_url = _require_database_url()
engine = create_async_engine(
    _url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args(_url),
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
