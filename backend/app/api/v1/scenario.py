from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.dependencies import (
    get_klines_client,
    get_prediction_evaluator,
    get_redis_cache,
    get_scenario_builder,
)
from app.integrations.binance_klines import BinanceKlinesClient
from app.schemas.candles import AccuracySummary
from app.schemas.scenario import ScenarioResponse
from app.schemas.scenario_context import ScenarioBuildRequest
from app.services.prediction_evaluator import PredictionEvaluator, SavedPredictionInput
from app.services.scenario_builder import ScenarioBuilder
from app.storage.redis_cache import AppCache

router = APIRouter()


@router.get("/scenario", response_model=ScenarioResponse)
async def get_scenario(
    builder: ScenarioBuilder = Depends(get_scenario_builder),
    cache: AppCache = Depends(get_redis_cache),
    refresh: bool = False,
):
    if not refresh:
        cached = await cache.get_json(AppCache.SCENARIO_KEY)
        if cached:
            return ScenarioResponse.model_validate(cached)

    scenario = await builder.build()
    await cache.set_json(AppCache.SCENARIO_KEY, scenario.model_dump(mode="json"), ttl=120)
    return scenario


@router.post("/scenario", response_model=ScenarioResponse)
async def build_scenario(
    body: ScenarioBuildRequest,
    builder: ScenarioBuilder = Depends(get_scenario_builder),
):
    """Build a personalized scenario using dashboard market data + user research."""
    return await builder.build(research=body.research)


@router.post("/scenario/evaluate", response_model=AccuracySummary)
async def evaluate_predictions(
    predictions: list[SavedPredictionInput],
    klines: BinanceKlinesClient = Depends(get_klines_client),
    evaluator: PredictionEvaluator = Depends(get_prediction_evaluator),
):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    candles = await klines.fetch_range(start, now, interval="1h")
    return evaluator.evaluate_batch(predictions, candles, now=now)
