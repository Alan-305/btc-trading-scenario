import structlog
from fastapi import APIRouter, Depends, Query

from app.config import Settings, get_settings
from app.dependencies import (
    get_market_aggregator,
    get_redis_cache,
    get_scenario_builder,
)
from app.services.market_aggregator import MarketAggregator
from app.services.morning_digest_service import MorningDigestService
from app.services.scenario_builder import ScenarioBuilder
from app.storage.redis_cache import AppCache

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.post("/morning-digest")
async def trigger_morning_digest(
    dry_run: bool = Query(default=False),
    builder: ScenarioBuilder = Depends(get_scenario_builder),
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    cache: AppCache = Depends(get_redis_cache),
    settings: Settings = Depends(get_settings),
):
    """Scheduled job: build scenario + send morning digest to opted-in users."""
    service = MorningDigestService(
        settings=settings,
        builder=builder,
        aggregator=aggregator,
        cache=cache,
    )
    return await service.run(dry_run=dry_run)
