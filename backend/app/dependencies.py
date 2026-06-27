from fastapi import Depends, Header, HTTPException, Request
from functools import lru_cache

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.collectors.registry import build_collectors
from app.config import Settings, get_settings
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.coinglass import CoinglassClient
from app.llm.scenario_writer import ScenarioWriter
from app.ml.inference import ScenarioInference
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.scenario_builder import ScenarioBuilder
from app.services.volume_profile import OrderbookHeatmapService, VolumeProfileService
from app.storage.redis_cache import RedisCache

logger = structlog.get_logger()


@lru_cache
def get_http_client() -> CollectorHttpClient:
    return CollectorHttpClient()


def get_redis_cache() -> RedisCache:
    return RedisCache()


def get_market_aggregator(http: CollectorHttpClient = Depends(get_http_client)) -> MarketAggregator:
    return MarketAggregator(build_collectors(http))


def get_divergence_service() -> DivergenceService:
    return DivergenceService()


def get_alternative_me(http: CollectorHttpClient = Depends(get_http_client)) -> AlternativeMeClient:
    return AlternativeMeClient(http)


def get_coinglass(http: CollectorHttpClient = Depends(get_http_client)) -> CoinglassClient:
    return CoinglassClient(http)


def get_scenario_builder(
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    divergence: DivergenceService = Depends(get_divergence_service),
    fear_greed: AlternativeMeClient = Depends(get_alternative_me),
    coinglass: CoinglassClient = Depends(get_coinglass),
) -> ScenarioBuilder:
    return ScenarioBuilder(
        aggregator=aggregator,
        divergence=divergence,
        inference=ScenarioInference(),
        writer=ScenarioWriter(),
        fear_greed=fear_greed,
        coinglass=coinglass,
    )


def get_volume_profile_service() -> VolumeProfileService:
    return VolumeProfileService()


def get_heatmap_service() -> OrderbookHeatmapService:
    return OrderbookHeatmapService()


async def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.internal_collect_token:
        return
    if x_internal_token != settings.internal_collect_token:
        raise HTTPException(status_code=401, detail="Invalid internal token")
