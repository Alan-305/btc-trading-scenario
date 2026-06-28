from __future__ import annotations

import json

import structlog

from app.config import Settings, get_settings
from app.llm.gemini_client import GeminiClient, GeminiClientError
from app.schemas.scenario import MacroTrend, TradeSide
from app.services.scenario_market_context import ScenarioMarketContext

logger = structlog.get_logger()

TREND_JA = {
    "bullish": "上昇",
    "bearish": "下降",
    "range": "レンジ（横ばい）",
}

SIDE_JA = {
    "long": "ロング",
    "short": "ショート",
    "neutral": "様子見",
}


class ScenarioWriter:
    """Generate compact Japanese scenario text. Gemini when configured, else template."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def generate(
        self,
        *,
        macro_trend: MacroTrend,
        confidence: float,
        side: TradeSide,
        reference_price: float,
        entry_low: float,
        entry_high: float,
        take_profit: list[float],
        stop_loss: float,
        market_context: ScenarioMarketContext,
    ) -> str:
        facts = market_context.to_writer_facts(
            macro_trend=macro_trend,
            confidence=confidence,
            side=side,
            entry_low=entry_low,
            entry_high=entry_high,
            take_profit=take_profit,
            stop_loss=stop_loss,
        )
        template = self._template(
            macro_trend=macro_trend,
            entry_low=entry_low,
            entry_high=entry_high,
            take_profit=take_profit,
            stop_loss=stop_loss,
            fear_greed=market_context.fear_greed.value if market_context.fear_greed else None,
            funding_rate=market_context.derivatives.funding_rate if market_context.derivatives else None,
            research_count=len(market_context.research),
            session_summary=(
                market_context.sessions.entry_hint.summary_ja
                if market_context.sessions and market_context.sessions.entry_hint
                else None
            ),
            ta_summary=market_context.technical.summary_ja if market_context.technical else None,
        )

        if self.settings.llm_provider != "gemini" or not self.settings.gemini_api_key.strip():
            return template

        try:
            client = GeminiClient(self.settings.gemini_api_key, self._model_candidates())
            prompt = self._build_prompt(facts)
            result = await client.generate_text(prompt)
            cleaned = _clean_scenario_text(result.text)
            if not cleaned or result.truncated or _is_incomplete_scenario(cleaned, facts):
                logger.warning(
                    "scenario_writer_gemini_incomplete",
                    finish_reason=result.finish_reason,
                    length=len(cleaned),
                )
                return template
            return cleaned
        except GeminiClientError as exc:
            logger.warning("scenario_writer_gemini_failed", error=str(exc))
            return template

    def _model_candidates(self) -> tuple[str, ...]:
        primary = (self.settings.gemini_model or "gemini-2.5-flash").strip()
        fallbacks = tuple(
            m.strip()
            for m in self.settings.gemini_model_fallbacks.split(",")
            if m.strip()
        )
        ordered = (primary, *fallbacks, "gemini-2.0-flash", "gemini-2.5-flash-lite")
        return tuple(dict.fromkeys(ordered))

    def _build_prompt(self, facts: dict) -> str:
        facts_json = json.dumps(facts, ensure_ascii=False, indent=2)
        return f"""あなたはBTCスイングトレード向けのシナリオ解説者です。
以下のJSON（市場データ・テクニカル・リスクゾーン・セッション・板・ユーザー調査メモ）を根拠に、
日本語で3〜5文の短いシナリオを書いてください。

【厳守】
- JSONにない価格・数値・方向を作らない（entry/take_profit/stop_loss は必ずJSONの値を使う）
- user_research_summaries があれば要点に触れる（箇条書きの捏造禁止）
- 投資助言ではなく参考情報として書く
- 高校生にもわかるやさしい日本語
- 箇条書き・見出し・Markdownは使わない
- 「不合格」などの否定的な評価語は使わない
- 必ずエントリー帯・利確・損切りの数値を文中に含める
- 3〜5文で完結させ、途中で切らない

【入力データ】
{facts_json}

【出力】
シナリオ本文のみ（3〜5文）。"""

    def _template(
        self,
        *,
        macro_trend: MacroTrend,
        entry_low: float,
        entry_high: float,
        take_profit: list[float],
        stop_loss: float,
        fear_greed: int | None,
        funding_rate: float | None,
        research_count: int = 0,
        session_summary: str | None = None,
        ta_summary: str | None = None,
    ) -> str:
        trend_ja = TREND_JA.get(macro_trend, "レンジ")
        fg_text = f"恐怖・強欲指数は {fear_greed} です。" if fear_greed is not None else ""
        fr_text = ""
        if funding_rate is not None:
            fr_text = f"ファンディングレートは {funding_rate:.4f} です。"

        tp_text = "、".join(f"{p:,.0f}" for p in take_profit)
        research_text = (
            f"登録した調査メモ {research_count} 件も方向判断に反映しています。"
            if research_count
            else ""
        )
        session_text = f"{session_summary}" if session_summary else ""
        ta_text = f"テクニカル: {ta_summary}。" if ta_summary else ""

        return (
            f"本日のBTCは、マクロでは{trend_ja}寄りの環境です。{fg_text}{fr_text}{ta_text}"
            f"{research_text}"
            f"エントリーは {entry_low:,.0f}〜{entry_high:,.0f} 付近を目安にしてください。"
            f"利確は {tp_text}、損切りは {stop_loss:,.0f} を想定しています。"
            f"{session_text}"
            f"急な値動きには注意し、必ず自分のルールで判断してください。"
        )


def _clean_scenario_text(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r", "").split("\n") if line.strip()]
    cleaned = " ".join(lines)
    for prefix in ("シナリオ:", "シナリオ：", "出力:", "出力："):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
    return cleaned.strip()


def _is_incomplete_scenario(text: str, facts: dict) -> bool:
    if len(text) < 60:
        return True
    if not text.endswith(("。", "！", "？")):
        return True

    normalized = text.replace(",", "").replace("，", "")
    required_numbers = [
        facts["entry_zone_low_usd"],
        facts["entry_zone_high_usd"],
        facts["stop_loss_usd"],
        *facts["take_profit_usd"],
    ]
    hits = 0
    for value in required_numbers:
        whole = f"{float(value):.0f}"
        precise = f"{float(value):.2f}".rstrip("0").rstrip(".")
        if whole in normalized or precise in normalized:
            hits += 1
    return hits < 2
