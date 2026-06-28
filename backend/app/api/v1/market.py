from fastapi import APIRouter, Depends, Query

from app.dependencies import (
    get_coinglass,
    get_divergence_service,
    get_heatmap_service,
    get_klines_client,
    get_market_aggregator,
    get_redis_cache,
    get_risk_zone_estimator,
    get_technical_analysis_service,
    get_volume_profile_service,
)
from app.integrations.binance_klines import BinanceKlinesClient
from app.integrations.derivatives_provider import DerivativesProvider
from app.schemas.candles import (
    CandleInterval,
    CandlesResponse,
    RiskZonesResponse,
    TechnicalAnalysisResponse,
)
from app.schemas.market import MarketSnapshot
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.risk_zones import RiskZoneEstimator
from app.services.scenario_context import reference_price_from_snapshot
from app.services.technical_analysis import TechnicalAnalysisService
from app.services.volume_profile import OrderbookHeatmapService, VolumeProfileService
from app.storage.redis_cache import AppCache
from app.schemas.sessions import MarketSessionsResponse
from app.services.market_sessions import MarketSessionsService

router = APIRouter()


@router.get("/sessions", response_model=MarketSessionsResponse)
async def market_sessions():
    return MarketSessionsService().build()


@router.get("/snapshot", response_model=MarketSnapshot)
async def market_snapshot(
    refresh: bool = False,
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    divergence: DivergenceService = Depends(get_divergence_service),
    cache: AppCache = Depends(get_redis_cache),
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
    price = reference_price_from_snapshot(snapshot)
    cells = service.compute(snapshot.orderbooks, reference_price=price)
    return {"cells": cells}


@router.get("/candles", response_model=CandlesResponse)
async def market_candles(
    interval: CandleInterval = Query(default="4h"),
    limit: int = Query(default=100, ge=10, le=500),
    klines: BinanceKlinesClient = Depends(get_klines_client),
    cache: AppCache = Depends(get_redis_cache),
    refresh: bool = False,
):
    cache_key = f"market:candles:{interval}:{limit}"
    if not refresh:
        cached = await cache.get_json(cache_key)
        if cached:
            return CandlesResponse.model_validate(cached)

    candles = await klines.fetch(interval=interval, limit=limit)
    response = CandlesResponse(
        symbol="BTCUSDT",
        interval=interval,
        candles=candles,
    )
    await cache.set_json(cache_key, response.model_dump(mode="json"), ttl=300)
    return response


@router.get("/technical", response_model=TechnicalAnalysisResponse)
async def market_technical(
    interval: CandleInterval = Query(default="4h"),
    klines: BinanceKlinesClient = Depends(get_klines_client),
    ta: TechnicalAnalysisService = Depends(get_technical_analysis_service),
    cache: AppCache = Depends(get_redis_cache),
    refresh: bool = False,
):
    cache_key = f"market:technical:{interval}"
    if not refresh:
        cached = await cache.get_json(cache_key)
        if cached:
            return TechnicalAnalysisResponse.model_validate(cached)

    candles = await klines.fetch(interval=interval, limit=250)
    response = ta.analyze(candles, interval=interval)
    await cache.set_json(cache_key, response.model_dump(mode="json"), ttl=300)
    return response


@router.get("/risk-zones", response_model=RiskZonesResponse)
async def market_risk_zones(
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    coinglass: DerivativesProvider = Depends(get_coinglass),
    heatmap_service: OrderbookHeatmapService = Depends(get_heatmap_service),
    estimator: RiskZoneEstimator = Depends(get_risk_zone_estimator),
):
    snapshot = await aggregator.collect_all(include_orderbooks=True)
    cg = await coinglass.fetch_snapshot()
    price = reference_price_from_snapshot(snapshot)
    cells = heatmap_service.compute(snapshot.orderbooks, reference_price=price)
    return estimator.estimate(price, cg, cells)
