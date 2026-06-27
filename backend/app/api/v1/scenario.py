from fastapi import APIRouter, Depends

from app.dependencies import get_redis_cache, get_scenario_builder
from app.schemas.scenario import ScenarioResponse
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
