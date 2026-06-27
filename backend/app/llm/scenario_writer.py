from __future__ import annotations

from app.schemas.scenario import MacroTrend

TREND_JA = {
    "bullish": "上昇",
    "bearish": "下降",
    "range": "レンジ（横ばい）",
}


class ScenarioWriter:
    """Generate compact Japanese scenario text. Uses template fallback when no LLM key."""

    async def generate(
        self,
        *,
        macro_trend: MacroTrend,
        entry_low: float,
        entry_high: float,
        take_profit: list[float],
        stop_loss: float,
        fear_greed: int | None,
        funding_rate: float | None,
    ) -> str:
        trend_ja = TREND_JA.get(macro_trend, "レンジ")
        fg_text = f"恐怖・強欲指数は {fear_greed} です。" if fear_greed is not None else ""
        fr_text = ""
        if funding_rate is not None:
            fr_text = f"ファンディングレートは {funding_rate:.4f} です。"

        tp_text = "、".join(f"{p:,.0f}" for p in take_profit)

        return (
            f"本日のBTCは、マクロでは{trend_ja}寄りの環境です。{fg_text}{fr_text}"
            f"エントリーは {entry_low:,.0f}〜{entry_high:,.0f} 付近を目安にしてください。"
            f"利確は {tp_text}、損切りは {stop_loss:,.0f} を想定しています。"
            f"急な値動きには注意し、必ず自分のルールで判断してください。"
        )
