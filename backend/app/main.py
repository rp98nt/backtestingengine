from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.backtest import router as backtest_router
from app.api.routes.benchmark import router as benchmark_router
from app.api.routes.data import router as data_router
from app.api.routes.live import router as live_router
from app.config import settings
from app.database import get_session, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AlphaTest API", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router, prefix="/api")
app.include_router(backtest_router, prefix="/api")
app.include_router(benchmark_router, prefix="/api")
app.include_router(live_router, prefix="/api")


@app.get("/api/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
