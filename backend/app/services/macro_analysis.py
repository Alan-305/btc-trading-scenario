from __future__ import annotations

from typing import Literal

from app.schemas.extended_market import (
    BtcEtfFlowSnapshot,
    BtcOptionsSnapshot,
    MacroContextSnapshot,
    MacroSeriesPoint,
    OnChainSnapshot,
    UsdtDominanceSnapshot,
)

MacroStance = Literal["bullish", "bearish", "neutral", "reversal", "caution"]

STANCE_LABEL: dict[MacroStance, str] = {
    "bullish": "上昇支援",
    "bearish": "下落の症候",
    "neutral": "様子見",
    "reversal": "トレンド転換の兆候",
    "caution": "不安拡大",
}


def enrich_macro_context(snapshot: MacroContextSnapshot) -> MacroContextSnapshot:
    if snapshot.etf_flows:
        stance, label, summary = _analyze_etf(snapshot.etf_flows)
        snapshot.etf_flows.stance = stance
        snapshot.etf_flows.signal_ja = label
        snapshot.etf_flows.summary_ja = summary
    if snapshot.options:
        stance, label, summary = _analyze_options(snapshot.options)
        snapshot.options.stance = stance
        snapshot.options.signal_ja = label
        snapshot.options.summary_ja = summary
    if snapshot.onchain:
        stance, label, summary = _analyze_onchain(snapshot.onchain)
        snapshot.onchain.stance = stance
        snapshot.onchain.signal_ja = label
        snapshot.onchain.summary_ja = summary
    if snapshot.usdt_dominance:
        stance, label, summary = _analyze_usdt_dominance(snapshot.usdt_dominance)
        snapshot.usdt_dominance.stance = stance
        snapshot.usdt_dominance.signal_ja = label
        snapshot.usdt_dominance.summary_ja = summary

    overall_stance, overall_label, overall_summary = _analyze_overall(snapshot)
    snapshot.overall_stance = overall_stance
    snapshot.overall_signal_ja = overall_label
    snapshot.overall_summary_ja = overall_summary
    return snapshot


def _analyze_etf(etf: BtcEtfFlowSnapshot) -> tuple[MacroStance, str, str]:
    flows = [p.value for p in etf.daily_flows]
    parts: list[str] = []
    bearish = 0
    bullish = 0

    if etf.trend == "outflow":
        bearish += 2
        parts.append("直近3日でETFからの資金流出が続いています")
    elif etf.trend == "inflow":
        bullish += 2
        parts.append("直近3日でETFへの資金流入が続いています")
    else:
        parts.append("ETFフローは大きな方向性がありません")

    if len(flows) >= 3:
        last3 = flows[-3:]
        if all(f < 0 for f in last3):
            bearish += 1
            parts.append("3日連続の流出で機関売り圧力が意識されます")
        elif all(f > 0 for f in last3):
            bullish += 1
            parts.append("3日連続の流入で買い支えが続いています")
        elif last3[-2] < 0 <= last3[-1]:
            bullish += 1
            parts.append("流出から流入へ切り替わった日があり、下げ一服の兆候です")
        elif last3[-2] > 0 >= last3[-1]:
            bearish += 1
            parts.append("流入から流出へ転じており、上値の重さが出やすい局面です")

    if etf.net_flow_3d_usd is not None and abs(etf.net_flow_3d_usd) < 50_000_000:
        parts.append("フロー規模は小さく、単独では方向性を決めにくいです")

    stance, label = _resolve_stance(bullish, bearish, reversal_hint=_has_reversal(flows))
    summary = "。".join(parts) + "。"
    return stance, label, summary


def _analyze_options(opt: BtcOptionsSnapshot) -> tuple[MacroStance, str, str]:
    parts: list[str] = []
    bearish = 0
    bullish = 0
    reversal = False

    pc = opt.put_call_ratio
    if pc >= 1.15:
        bearish += 2
        parts.append(f"Put/Call OI比 {pc:.2f} とPut優勢で、下落ヘッジ需要が強い状態です")
    elif pc <= 0.75:
        bullish += 2
        parts.append(f"Put/Call OI比 {pc:.2f} とCall優勢で、上昇期待のポジションが多いです")
    else:
        parts.append(f"Put/Call OI比 {pc:.2f} は中立圏で、極端な偏りはありません")

    dvol = opt.dvol_index
    dvol_hist = [p.value for p in opt.dvol_history]
    if dvol is not None:
        if dvol >= 55:
            bearish += 1
            parts.append(f"DVOL {dvol:.1f} と高水準で、市場の不安・ボラティリティが高いです")
        elif dvol <= 40:
            bullish += 1
            parts.append(f"DVOL {dvol:.1f} と低めで、パニック的な売りは落ち着いています")

    if len(dvol_hist) >= 4:
        recent = dvol_hist[-2:]
        prior = dvol_hist[-4:-2]
        if prior and recent and max(prior) >= 52 and recent[-1] < prior[-1] - 3:
            reversal = True
            parts.append("DVOLが高値圏から低下し始めており、ボラ収束＝転換の兆候が出ています")
        elif recent[-1] > prior[-1] + 3:
            bearish += 1
            parts.append("DVOLが上昇中で、急変動リスクが高まっています")

    stance, label = _resolve_stance(bullish, bearish, reversal_hint=reversal)
    summary = "。".join(parts) + "。"
    return stance, label, summary


def enrich_usdt_dominance(snapshot: UsdtDominanceSnapshot) -> UsdtDominanceSnapshot:
    stance, label, summary = _analyze_usdt_dominance(snapshot)
    snapshot.stance = stance
    snapshot.signal_ja = label
    snapshot.summary_ja = summary
    return snapshot


def _analyze_usdt_dominance(usdt: UsdtDominanceSnapshot) -> tuple[MacroStance, str, str]:
    """BTC視点: USDT.D上昇=リスクオフで逆風、低下=追い風。"""
    parts: list[str] = []
    bearish = 0
    bullish = 0

    dom = usdt.dominance_pct
    parts.append(f"USDTドミナンス {dom:.2f}%")

    if usdt.trend == "rising":
        bearish += 2
        parts.append("7日で上昇しており、資金がステーブルコインへ逃避するリスクオフ傾向です")
    elif usdt.trend == "falling":
        bullish += 2
        parts.append("7日で低下しており、リスクオンでBTCへ資金が戻りやすい環境です")
    else:
        parts.append("7日変化は小さく、単独では方向を決めにくいです")

    change = usdt.change_7d_pct
    if change is not None:
        if change >= 0.5:
            bearish += 1
            parts.append(f"7日で+{change:.2f}pt と明確な上昇です")
        elif change <= -0.5:
            bullish += 1
            parts.append(f"7日で{change:.2f}pt と明確な低下です")

    if dom >= 6.0:
        bearish += 1
        parts.append("水準が高めで、BTCにとって逆風材料になりやすいです")
    elif dom <= 4.5:
        bullish += 1
        parts.append("水準が低めで、追い風材料になりやすいです")

    stance, label = _resolve_stance(bullish, bearish, reversal_hint=False)
    summary = "。".join(parts) + "。"
    return stance, label, summary


def _analyze_onchain(oc: OnChainSnapshot) -> tuple[MacroStance, str, str]:
    parts: list[str] = []
    bearish = 0
    bullish = 0
    reversal = False

    if oc.activity_trend == "rising":
        bullish += 1
        parts.append("オンチェーン取引・利用が活発化しており、ネットワーク需要は底堅いです")
    elif oc.activity_trend == "falling":
        bearish += 1
        parts.append("オンチェーン活動が減速しており、実需の弱さが意識されます")
    else:
        parts.append("オンチェーン活動は横ばいで、明確な加速・減速はありません")

    hr_chg = oc.hash_rate_change_7d_pct
    if hr_chg is not None:
        if hr_chg > 3:
            bullish += 1
            parts.append(f"ハッシュレートは7日で{hr_chg:+.1f}%と上昇し、マイナーの長期信頼は維持されています")
        elif hr_chg < -3:
            bearish += 1
            parts.append(f"ハッシュレートは7日で{hr_chg:+.1f}%と低下し、マイニング参加の後退が見えます")

    tx_hist = [p.value for p in oc.tx_count_history]
    if _has_reversal(tx_hist):
        reversal = True
        parts.append("トランザクション数が減少後に回復しており、活動の底打ち・転換の兆候があります")
    elif len(tx_hist) >= 3 and tx_hist[-1] < tx_hist[-3] * 0.95:
        bearish += 1
        parts.append("トランザクション数は直近で減少傾向です")

    if oc.mempool_fast_fee_sat is not None and oc.mempool_fast_fee_sat >= 30:
        parts.append("メモリプール手数料が高く、オンチェーン需要の集中が一時的に起きています")

    stance, label = _resolve_stance(bullish, bearish, reversal_hint=reversal)
    summary = "。".join(parts) + "。"
    return stance, label, summary


def _analyze_overall(snapshot: MacroContextSnapshot) -> tuple[MacroStance, str, str]:
    stances: list[MacroStance] = []
    labels: list[str] = []
    summaries: list[str] = []

    for block, name in (
        (snapshot.etf_flows, "ETF"),
        (snapshot.options, "オプション"),
        (snapshot.onchain, "オンチェーン"),
        (snapshot.usdt_dominance, "USDT.D"),
    ):
        if block and block.summary_ja:
            stances.append(block.stance)  # type: ignore[arg-type]
            labels.append(f"{name}は{block.signal_ja}")
            summaries.append(block.summary_ja)

    if not stances:
        return "neutral", STANCE_LABEL["neutral"], "マクロデータが不足しているため、価格・テクニカルを優先して判断してください。"

    bearish = stances.count("bearish") + stances.count("caution")
    bullish = stances.count("bullish")
    reversal = stances.count("reversal")

    if reversal >= 1 and bearish <= bullish:
        overall = "reversal"
    elif bearish >= 2:
        overall = "bearish"
    elif bullish >= 2:
        overall = "bullish"
    elif reversal >= 1:
        overall = "reversal"
    elif bearish > bullish:
        overall = "caution"
    elif bullish > bearish:
        overall = "bullish"
    else:
        overall = "neutral"

    label = STANCE_LABEL[overall]
    headline = "・".join(labels)
    summary = f"総合は{label}です（{headline}）。"
    if overall == "neutral":
        summary += "マクロ各指標が拮抗しており、エントリーは価格帯とテクニカルの合意を待つのが無難です。"
    elif overall == "reversal":
        summary += "一部指標に転換の兆候がありますが、価格が追随するかはローソク足で確認してください。"
    elif overall == "bearish":
        summary += "マクロ面では下押し要因が優勢です。ロングは戻り売り圧力に注意してください。"
    elif overall == "bullish":
        summary += "マクロ面では下支え要因が揃いやすいです。押し目でのロングを検討しやすい環境です。"
    else:
        summary += "ボラティリティ・ヘッジ需要が高く、方向感が出にくいので様子見が中心です。"

    return overall, label, summary


def _resolve_stance(
    bullish: int,
    bearish: int,
    *,
    reversal_hint: bool,
) -> tuple[MacroStance, str]:
    if reversal_hint and bearish <= bullish + 1:
        return "reversal", STANCE_LABEL["reversal"]
    if bearish >= 2 and bullish == 0:
        return "bearish", STANCE_LABEL["bearish"]
    if bullish >= 2 and bearish == 0:
        return "bullish", STANCE_LABEL["bullish"]
    if bearish > bullish + 1:
        return "bearish", STANCE_LABEL["bearish"]
    if bullish > bearish + 1:
        return "bullish", STANCE_LABEL["bullish"]
    if bearish > bullish:
        return "caution", STANCE_LABEL["caution"]
    return "neutral", STANCE_LABEL["neutral"]


def _has_reversal(values: list[float]) -> bool:
    if len(values) < 5:
        return False
    mid = values[-5:-2]
    tail = values[-2:]
    if not mid or not tail:
        return False
    mid_avg = sum(mid) / len(mid)
    if mid_avg == 0:
        return False
    # fell then recovered
    return mid_avg < values[-5] * 0.97 and tail[-1] > mid_avg * 1.03
