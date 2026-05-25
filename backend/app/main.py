from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from contextlib import asynccontextmanager
from sqlalchemy import select
from .config import get_settings
from .database import engine, Base, async_session
from .models.user import User
from .core.security import get_password_hash
from .api.auth import router as auth_router
from .api.servers import router as servers_router
from .api.gpus import router as gpus_router
from .api.reservations import router as reservations_router
from .api.dashboard import router as dashboard_router
from .api.messages import router as messages_router
from .services.prometheus_fetcher import metrics_sync_loop
from .api.gpu_discovery import router as gpu_discovery_router

settings = get_settings()

async def init_db():
    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                email="admin@powerverse.com",
                password_hash=get_password_hash("admin123"),
                role="admin",
                subsidiary="总部"
            )
            session.add(admin)
            await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await init_db()
    task = asyncio.create_task(metrics_sync_loop(30))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(auth_router)
app.include_router(servers_router)
app.include_router(gpus_router)
app.include_router(reservations_router)
app.include_router(dashboard_router)
app.include_router(messages_router)
app.include_router(gpu_discovery_router)

@app.get("/")
async def root():
    return {"message": "PowerVerse API"}