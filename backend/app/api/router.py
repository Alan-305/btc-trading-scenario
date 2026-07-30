from fastapi import APIRouter, Depends

from app.api.v1.health import router as health_router
from app.api.v1.market import router as market_router
from app.api.v1.scenario import router as scenario_router
from app.api.v1.indicators import router as indicators_router
from app.api.v1.research import router as research_router
from app.api.v1.invites import router as invites_router
from app.api.v1.paper_trades import router as paper_trades_router
from app.api.v1.support import router as support_router
from app.api.v1.notifications import protected_router as notifications_protected_router
from app.api.v1.notifications import public_router as notifications_public_router
from app.api.v1.internal.collect import router as collect_router
from app.api.v1.internal.morning_digest import router as morning_digest_router
from app.dependencies import require_invited_user, verify_internal_token

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(notifications_public_router, prefix="/v1/notifications", tags=["notifications"])

protected_router = APIRouter(dependencies=[Depends(require_invited_user)])
protected_router.include_router(market_router, prefix="/v1/market", tags=["market"])
protected_router.include_router(indicators_router, prefix="/v1/indicators", tags=["indicators"])
protected_router.include_router(scenario_router, prefix="/v1", tags=["scenario"])
protected_router.include_router(research_router, prefix="/v1", tags=["research"])
protected_router.include_router(invites_router, prefix="/v1", tags=["invites"])
protected_router.include_router(paper_trades_router, prefix="/v1", tags=["paper-trades"])
protected_router.include_router(support_router, prefix="/v1", tags=["support"])
protected_router.include_router(
    notifications_protected_router,
    prefix="/v1/notifications",
    tags=["notifications"],
)
api_router.include_router(protected_router)
api_router.include_router(collect_router, prefix="/v1/internal", tags=["internal"])
api_router.include_router(
    morning_digest_router,
    prefix="/v1/internal",
    tags=["internal"],
    dependencies=[Depends(verify_internal_token)],
)
