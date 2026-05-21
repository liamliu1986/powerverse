from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .api.auth import router as auth_router
from .api.servers import router as servers_router
from .api.gpus import router as gpus_router
from .api.reservations import router as reservations_router
from .api.dashboard import router as dashboard_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
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

@app.get("/")
async def root():
    return {"message": "PowerVerse API"}