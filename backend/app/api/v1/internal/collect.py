import structlog
from fastapi import APIRouter, Depends

from app.dependencies import (
    get_divergence_service,
    get_market_aggregator,
    get_redis_cache,
    verify_internal_token,
)
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.paper_trade_monitor import PaperTradeMonitor
from app.services.scenario_context import reference_price_from_snapshot
from app.storage.redis_cache import AppCache

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.post("/collect")
async def trigger_collect(
    _: None = Depends(verify_internal_token),
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    divergence: DivergenceService = Depends(get_divergence_service),
    cache: AppCache = Depends(get_redis_cache),
):
    """Lightweight scheduled job: refresh tickers + monitor paper trades (no Gemini)."""
    snapshot = await aggregator.collect_all(include_orderbooks=False)
    snapshot = divergence.apply(snapshot)
    await cache.set_market_snapshot(snapshot)

    reference_price = reference_price_from_snapshot(snapshot)
    paper_trade_stats = {"scanned": 0, "closed": 0, "notified": 0, "errors": 0}
    try:
        paper_trade_stats = PaperTradeMonitor().process(reference_price)
    except Exception as exc:
        logger.warning("paper_trade_monitor_failed", error=str(exc))

    return {
        "status": "collected",
        "mode": "paper_trade_watch",
        "reference_price": reference_price,
        "tickers": len(snapshot.tickers),
        "paper_trades": paper_trade_stats,
    }
