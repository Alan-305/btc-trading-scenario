import structlog
from fastapi import APIRouter, Depends

from app.dependencies import (
    get_divergence_service,
    get_market_aggregator,
    get_redis_cache,
    get_scenario_builder,
    verify_internal_token,
)
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.paper_trade_monitor import PaperTradeMonitor
from app.services.scenario_builder import ScenarioBuilder
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
    builder: ScenarioBuilder = Depends(get_scenario_builder),
):
    snapshot = await aggregator.collect_all()
    snapshot = divergence.apply(snapshot)
    await cache.set_market_snapshot(snapshot)

    scenario = await builder.build_from_snapshot(snapshot)
    await cache.set_json(AppCache.SCENARIO_KEY, scenario.model_dump(mode="json"), ttl=120)

    paper_trade_stats = {"scanned": 0, "closed": 0, "notified": 0, "errors": 0}
    try:
        paper_trade_stats = PaperTradeMonitor().process(reference_price_from_snapshot(snapshot))
    except Exception as exc:
        logger.warning("paper_trade_monitor_failed", error=str(exc))

    return {
        "status": "collected",
        "tickers": len(snapshot.tickers),
        "orderbooks": len(snapshot.orderbooks),
        "paper_trades": paper_trade_stats,
    }
