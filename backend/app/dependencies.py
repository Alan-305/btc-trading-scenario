from functools import lru_cache

import structlog
from fastapi import Depends, Header, HTTPException

from app.auth.firebase_auth import verify_firebase_id_token

from app.collectors.http_client import CollectorHttpClient
from app.collectors.registry import build_collectors
from app.config import Settings, get_settings
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.binance_klines import BinanceKlinesClient
from app.integrations.btc_etf_flows import BtcEtfFlowClient
from app.integrations.coingecko_usdt_dominance import CoingeckoUsdtDominanceClient
from app.integrations.deribit_options import DeribitOptionsClient
from app.integrations.equity_indices import EquityIndicesClient
from app.integrations.derivatives_provider import DerivativesProvider
from app.integrations.onchain_metrics import OnChainMetricsClient
from app.llm.scenario_writer import ScenarioWriter
from app.ml.inference import ScenarioInference
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.scenario_builder import ScenarioBuilder
from app.services.prediction_evaluator import PredictionEvaluator
from app.integrations.okx_liquidations import OkxLiquidationClient
from app.services.liquidation_feed import LiquidationFeed
from app.services.risk_zones import RiskZoneEstimator
from app.services.technical_analysis import TechnicalAnalysisService
from app.services.volume_profile import OrderbookHeatmapService, VolumeProfileService
from app.services.market_sessions import MarketSessionsService
from app.storage.redis_cache import AppCache

logger = structlog.get_logger()


@lru_cache
def get_http_client() -> CollectorHttpClient:
    return CollectorHttpClient()


def get_redis_cache() -> AppCache:
    return AppCache()


def get_market_aggregator(http: CollectorHttpClient = Depends(get_http_client)) -> MarketAggregator:
    return MarketAggregator(build_collectors(http))


def get_divergence_service() -> DivergenceService:
    return DivergenceService()


def get_alternative_me(http: CollectorHttpClient = Depends(get_http_client)) -> AlternativeMeClient:
    return AlternativeMeClient(http)


def get_coinglass(http: CollectorHttpClient = Depends(get_http_client)) -> DerivativesProvider:
    return DerivativesProvider(http)


def get_scenario_builder(
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    divergence: DivergenceService = Depends(get_divergence_service),
    fear_greed: AlternativeMeClient = Depends(get_alternative_me),
    coinglass: DerivativesProvider = Depends(get_coinglass),
    http: CollectorHttpClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings),
) -> ScenarioBuilder:
    return ScenarioBuilder(
        aggregator=aggregator,
        divergence=divergence,
        inference=ScenarioInference(),
        writer=ScenarioWriter(settings),
        fear_greed=fear_greed,
        coinglass=coinglass,
        klines=BinanceKlinesClient(http),
        heatmap=OrderbookHeatmapService(),
        risk_zones=RiskZoneEstimator(),
        sessions=MarketSessionsService(),
        deribit_options=DeribitOptionsClient(http),
        etf_flows=BtcEtfFlowClient(http),
        onchain=OnChainMetricsClient(http),
        usdt_dominance=CoingeckoUsdtDominanceClient(http),
        equity_indices=EquityIndicesClient(http),
        liquidation_feed=LiquidationFeed(OkxLiquidationClient(http)),
    )


def get_volume_profile_service() -> VolumeProfileService:
    return VolumeProfileService()


def get_heatmap_service() -> OrderbookHeatmapService:
    return OrderbookHeatmapService()


def get_klines_client(http: CollectorHttpClient = Depends(get_http_client)) -> BinanceKlinesClient:
    return BinanceKlinesClient(http)


def get_technical_analysis_service() -> TechnicalAnalysisService:
    return TechnicalAnalysisService()


def get_risk_zone_estimator() -> RiskZoneEstimator:
    return RiskZoneEstimator()


def get_liquidation_feed(http: CollectorHttpClient = Depends(get_http_client)) -> LiquidationFeed:
    return LiquidationFeed(OkxLiquidationClient(http))


def get_prediction_evaluator() -> PredictionEvaluator:
    return PredictionEvaluator()


async def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.internal_collect_token:
        return
    if x_internal_token != settings.internal_collect_token:
        raise HTTPException(status_code=401, detail="Invalid internal token")


from app.services.invite_service import is_email_invited


async def require_invited_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> str | None:
    if not settings.invite_only:
        return None

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        decoded = verify_firebase_id_token(token)
    except Exception as exc:
        logger.warning("firebase_token_invalid", error=str(exc))
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

    email = (decoded.get("email") or "").strip().lower()
    if not email or not is_email_invited(email, settings):
        raise HTTPException(status_code=403, detail="Not invited")

    return email
