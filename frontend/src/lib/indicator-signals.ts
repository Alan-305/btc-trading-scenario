import type { RiskZonesResponse, TechnicalAnalysis } from "../types/market";
import type { MarketSessionsResponse } from "../types/sessions";
import type {
  CoinglassSnapshot,
  HeatmapCell,
  MacroStance,
  UsdtDominanceSnapshot,
} from "../types/scenario";

export interface IndicatorSignal {
  stance: MacroStance;
  signalJa: string;
  summaryJa: string;
}

const TREND_SIGNAL: Record<string, IndicatorSignal> = {
  bullish: {
    stance: "bullish",
    signalJa: "上昇支援",
    summaryJa: "テクニカル総合が上昇寄りです。押し目とブレイクの両方を意識しましょう。",
  },
  bearish: {
    stance: "bearish",
    signalJa: "下落の症候",
    summaryJa: "テクニカル総合が下降寄りです。戻り売り圧力に注意してください。",
  },
  range: {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: "レンジ内で方向感が弱い状態です。ブレイク待ちが中心です。",
  },
  neutral: {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: "指標が拮抗しており、単独では方向を決めにくいです。",
  },
};

export function technicalSignal(data: TechnicalAnalysis | null): IndicatorSignal {
  if (!data) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "テクニカルデータがありません。" };
  }
  const base = TREND_SIGNAL[data.trend] ?? TREND_SIGNAL.neutral;
  const stochNote =
    data.stoch_summary_ja && data.stoch_summary_ja !== base.summaryJa
      ? ` ${data.stoch_summary_ja}`
      : "";
  return {
    stance: data.stoch_stance && data.stoch_stance !== "neutral" ? data.stoch_stance : base.stance,
    signalJa: data.stoch_signal_ja || base.signalJa,
    summaryJa: (data.summary_ja || base.summaryJa) + stochNote,
  };
}

export function stochasticSignal(data: TechnicalAnalysis | null): IndicatorSignal {
  if (!data || data.stoch_k == null || data.stoch_d == null) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "ストキャスデータがありません。" };
  }
  const stance: MacroStance =
    data.stoch_stance && data.stoch_stance !== "caution" ? data.stoch_stance : "neutral";
  return {
    stance,
    signalJa: data.stoch_signal_ja || "様子見",
    summaryJa: data.stoch_summary_ja || `%K ${data.stoch_k.toFixed(0)}・%D ${data.stoch_d.toFixed(0)}`,
  };
}

export function usdtDominanceSignal(data: UsdtDominanceSnapshot | null): IndicatorSignal {
  if (!data) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "USDTドミナンスデータがありません。" };
  }
  if (data.summary_ja) {
    return {
      stance: data.stance ?? "neutral",
      signalJa: data.signal_ja ?? "様子見",
      summaryJa: data.summary_ja,
    };
  }
  const trend = data.trend;
  if (trend === "rising") {
    return {
      stance: "bearish",
      signalJa: "下落の症候",
      summaryJa: `USDT.D ${data.dominance_pct.toFixed(2)}% と上昇中。リスクオフでBTCに逆風です。`,
    };
  }
  if (trend === "falling") {
    return {
      stance: "bullish",
      signalJa: "上昇支援",
      summaryJa: `USDT.D ${data.dominance_pct.toFixed(2)}% と低下中。リスクオンでBTCに追い風です。`,
    };
  }
  return {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: `USDT.D ${data.dominance_pct.toFixed(2)}% は横ばいです。`,
  };
}

export function fearGreedSignal(value: number | null, classification?: string): IndicatorSignal {
  if (value == null) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "Fear & Greed データがありません。" };
  }
  if (value <= 25) {
    return {
      stance: "reversal",
      signalJa: "トレンド転換の兆候",
      summaryJa: `指数 ${value}（${classification ?? "Extreme Fear"}）と極端な恐怖圏です。逆張りの兆候が出やすい局面です。`,
    };
  }
  if (value >= 75) {
    return {
      stance: "caution",
      signalJa: "不安拡大",
      summaryJa: `指数 ${value}（${classification ?? "Greed"}）と強欲圏です。過熱・利確売りに注意してください。`,
    };
  }
  if (value >= 55) {
    return {
      stance: "bullish",
      signalJa: "上昇支援",
      summaryJa: `指数 ${value} とやや強気寄りです。リスクオン環境が続いています。`,
    };
  }
  if (value <= 45) {
    return {
      stance: "caution",
      signalJa: "様子見",
      summaryJa: `指数 ${value} とやや弱気寄りです。新規ロングは慎重に。`,
    };
  }
  return {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: `指数 ${value} は中立圏です。単独では方向を決めにくいです。`,
  };
}

export function coinglassSignal(data: CoinglassSnapshot | null): IndicatorSignal {
  if (!data) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "先物データがありません。" };
  }
  const fr = data.funding_rate;
  const parts: string[] = [];
  let bearish = 0;
  let bullish = 0;

  if (fr != null) {
    if (fr > 0.0003) {
      bearish += 2;
      parts.push(`Funding ${(fr * 100).toFixed(4)}% とロング優勢で、調整圧力が意識されます`);
    } else if (fr < -0.0001) {
      bullish += 2;
      parts.push(`Funding ${(fr * 100).toFixed(4)}% とショート優勢で、ショートカバーが起きやすいです`);
    } else {
      parts.push(`Funding ${(fr * 100).toFixed(4)}% は中立圏です`);
    }
  }
  if (data.long_short_ratio != null) {
    if (data.long_short_ratio > 1.2) {
      bearish += 1;
      parts.push(`L/S比 ${data.long_short_ratio.toFixed(2)} とロング偏り`);
    } else if (data.long_short_ratio < 0.85) {
      bullish += 1;
      parts.push(`L/S比 ${data.long_short_ratio.toFixed(2)} とショート偏り`);
    }
  }

  const stance =
    bearish >= 2 ? "bearish" : bullish >= 2 ? "bullish" : bearish > bullish ? "caution" : bullish > bearish ? "bullish" : "neutral";
  const signalJa =
    stance === "bearish"
      ? "下落の症候"
      : stance === "bullish"
        ? "上昇支援"
        : stance === "caution"
          ? "不安拡大"
          : "様子見";

  return {
    stance,
    signalJa,
    summaryJa: parts.length ? `${parts.join("。")}。` : "先物ポジションに大きな偏りはありません。",
  };
}

export function riskZonesSignal(data: RiskZonesResponse | null): IndicatorSignal {
  const longLiq = data?.long_liquidation;
  const shortSq = data?.short_squeeze;
  if (!longLiq && !shortSq) {
    return {
      stance: "neutral",
      signalJa: "様子見",
      summaryJa: "リキッド帯の推定は目立ちません。",
    };
  }
  const parts: string[] = [];
  if (longLiq) {
    parts.push(`ロング清算帯 $${longLiq.zone_low.toLocaleString()}〜付近`);
  }
  if (shortSq) {
    parts.push(`ショートスクイズ帯 $${shortSq.zone_low.toLocaleString()}〜付近`);
  }
  return {
    stance: "caution",
    signalJa: "不安拡大",
    summaryJa: `${parts.join("、")}に到達すると急変動リスクが高まります。`,
  };
}

export function heatmapSignal(cells: HeatmapCell[]): IndicatorSignal {
  if (!cells.length) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "板データがありません。" };
  }
  const bid = cells.reduce((s, c) => s + c.bid_depth, 0);
  const ask = cells.reduce((s, c) => s + c.ask_depth, 0);
  const total = bid + ask || 1;
  const bidPct = Math.round((bid / total) * 100);

  if (bidPct >= 58) {
    return {
      stance: "bullish",
      signalJa: "上昇支援",
      summaryJa: `買い板 ${bidPct}% と厚みが優勢です。下値に買い支えが見えます。`,
    };
  }
  if (bidPct <= 42) {
    return {
      stance: "bearish",
      signalJa: "下落の症候",
      summaryJa: `売り板 ${100 - bidPct}% と厚みが優勢です。上値に売り圧力が重なりやすいです。`,
    };
  }
  return {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: `買い ${bidPct}% / 売り ${100 - bidPct}% で板は均衡に近いです。`,
  };
}

export function exchangeSignal(divergence: Record<string, number>): IndicatorSignal {
  const values = Object.values(divergence);
  if (!values.length) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "取引所乖離データがありません。" };
  }
  const maxAbs = Math.max(...values.map(Math.abs));
  const maxKey = Object.entries(divergence).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

  if (maxAbs >= 0.3) {
    return {
      stance: "caution",
      signalJa: "不安拡大",
      summaryJa: `${maxKey?.[0] ?? "取引所"}で ${maxAbs.toFixed(2)}% の乖離があり、アービトラージや急な収束に注意です。`,
    };
  }
  if (maxAbs >= 0.15) {
    return {
      stance: "neutral",
      signalJa: "様子見",
      summaryJa: `最大乖離 ${maxAbs.toFixed(2)}% で、やや分散していますが許容範囲です。`,
    };
  }
  return {
    stance: "bullish",
    signalJa: "上昇支援",
    summaryJa: "取引所間の価格は概ね一致しており、参照価格の信頼性は高いです。",
  };
}

export function sessionsSignal(data: MarketSessionsResponse | null): IndicatorSignal {
  if (!data) {
    return { stance: "neutral", signalJa: "様子見", summaryJa: "セッション情報がありません。" };
  }
  const hint = data.entry_hint.summary_ja;
  const peak = data.timeline_jst.some((h) => h.is_now && h.activity_level === "peak");
  const low = data.timeline_jst.some((h) => h.is_now && h.activity_level === "low");

  if (peak) {
    return {
      stance: "bullish",
      signalJa: "上昇支援",
      summaryJa: hint || "主要セッションが重なり、流動性・値動きが活発な時間帯です。",
    };
  }
  if (low) {
    return {
      stance: "neutral",
      signalJa: "様子見",
      summaryJa: hint || "流動性が低い時間帯です。急なスプレッド拡大に注意してください。",
    };
  }
  return {
    stance: "neutral",
    signalJa: "様子見",
    summaryJa: hint || "セッションは通常範囲です。",
  };
}
