from fastapi import APIRouter, Depends

from app.dependencies import (
    get_divergence_service,
    get_heatmap_service,
    get_market_aggregator,
    get_redis_cache,
    get_volume_profile_service,
)
from app.schemas.market import MarketSnapshot
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.volume_profile import OrderbookHeatmapService, VolumeProfileService
from app.storage.redis_cache import RedisCache

router = APIRouter()


@router.get("/snapshot", response_model=MarketSnapshot)
async def market_snapshot(
    refresh: bool = False,
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    divergence: DivergenceService = Depends(get_divergence_service),
    cache: RedisCache = Depends(get_redis_cache),
):
    if not refresh:
        cached = await cache.get_market_snapshot()
        if cached is not None:
            return cached

    snapshot = await aggregator.collect_all()
    snapshot = divergence.apply(snapshot)
    await cache.set_market_snapshot(snapshot)
    return snapshot


@router.get("/volume-profile")
async def volume_profile(
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    service: VolumeProfileService = Depends(get_volume_profile_service),
):
    snapshot = await aggregator.collect_all(include_orderbooks=True)
    bins = service.compute(snapshot.orderbooks)
    return {"bins": bins}


@router.get("/orderbook-heatmap")
async def orderbook_heatmap(
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    service: OrderbookHeatmapService = Depends(get_heatmap_service),
):
    snapshot = await aggregator.collect_all(include_orderbooks=True)
    cells = service.compute(snapshot.orderbooks)
    return {"cells": cells}
