import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import get_settings

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)

settings = get_settings()

_cors_origins = (
    ["*"]
    if settings.app_env == "development"
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)

app = FastAPI(title="BTC Trading Scenario API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def root_health():
    return {"status": "ok"}
