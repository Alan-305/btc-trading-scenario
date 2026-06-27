from fastapi import APIRouter, Depends

from app.dependencies import (
    get_market_aggregator,
    get_prediction_evaluator,
    get_redis_cache,
    get_scenario_builder,
)
from app.schemas.candles import AccuracySummary
from app.schemas.scenario import ScenarioResponse
from app.services.market_aggregator import MarketAggregator
from app.services.prediction_evaluator import PredictionEvaluator, SavedPredictionInput
from app.services.scenario_builder import ScenarioBuilder
from app.services.scenario_context import reference_price_from_snapshot
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


@router.post("/scenario/evaluate", response_model=AccuracySummary)
async def evaluate_predictions(
    predictions: list[SavedPredictionInput],
    aggregator: MarketAggregator = Depends(get_market_aggregator),
    evaluator: PredictionEvaluator = Depends(get_prediction_evaluator),
):
    snapshot = await aggregator.collect_all()
    current_price = reference_price_from_snapshot(snapshot)
    return evaluator.evaluate_batch(predictions, current_price)
