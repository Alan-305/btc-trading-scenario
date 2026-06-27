from fastapi import APIRouter, Depends

from app.api.v1.health import router as health_router
from app.api.v1.market import router as market_router
from app.api.v1.scenario import router as scenario_router
from app.api.v1.indicators import router as indicators_router
from app.api.v1.internal.collect import router as collect_router
from app.dependencies import require_invited_user

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])

protected_router = APIRouter(dependencies=[Depends(require_invited_user)])
protected_router.include_router(market_router, prefix="/v1/market", tags=["market"])
protected_router.include_router(indicators_router, prefix="/v1/indicators", tags=["indicators"])
protected_router.include_router(scenario_router, prefix="/v1", tags=["scenario"])
api_router.include_router(protected_router)
api_router.include_router(collect_router, prefix="/v1/internal", tags=["internal"])
