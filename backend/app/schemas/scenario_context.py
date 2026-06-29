from __future__ import annotations

from pydantic import BaseModel, Field


class ResearchContextItem(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary_line: str = Field(min_length=1, max_length=1200)
    source_type: str = "text"
    tags: list[str] = Field(default_factory=list)
    market_context: str | None = None


class ScenarioBuildRequest(BaseModel):
    research: list[ResearchContextItem] = Field(default_factory=list)


class ScenarioDataSources(BaseModel):
    research_items_used: int = 0
    includes_technical: bool = False
    includes_risk_zones: bool = False
    includes_sessions: bool = False
    includes_heatmap: bool = False
    includes_derivatives: bool = False
    includes_options: bool = False
    includes_etf_flows: bool = False
    includes_onchain: bool = False
    includes_usdt_dominance: bool = False
    includes_equity_markets: bool = False
    includes_mtf: bool = False
    personalized: bool = False
