import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { PriceChart } from "../components/chart/PriceChart";
import { TradeZones } from "../components/chart/TradeZones";
import { CoinglassPanel } from "../components/dashboard/CoinglassPanel";
import { ExchangeDivergence } from "../components/dashboard/ExchangeDivergence";
import { FearGreedMeter } from "../components/dashboard/FearGreedMeter";
import { VolumeHeatmap } from "../components/dashboard/VolumeHeatmap";
import { ScenarioCard } from "../components/scenario/ScenarioCard";
import type { HeatmapCell, MarketSnapshot, ScenarioResponse, SentimentIndicators } from "../types/scenario";

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [sentiment, setSentiment] = useState<SentimentIndicators | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [snap, scen, sent, hm] = await Promise.all([
        api.getMarketSnapshot(refresh),
        api.getScenario(refresh),
        api.getSentiment(),
        api.getHeatmap().catch(() => ({ cells: [] as HeatmapCell[] })),
      ]);
      setSnapshot(snap);
      setScenario(scen);
      setSentiment(sent);
      setHeatmap(hm.cells);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const baselinePrice = snapshot?.tickers.find((t) => t.exchange === "whitebit")
    ?? snapshot?.tickers[0];
  const price = baselinePrice ? parseFloat(baselinePrice.last_price) : 0;

  const history = baselinePrice
    ? Array.from({ length: 12 }, (_, i) => ({
        ts: `${12 - i}h`,
        price: price * (1 + (Math.sin(i) * 0.005)),
        type: "history" as const,
      }))
    : [];

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-english text-2xl font-semibold tracking-tight text-white">
            BTC Trading Scenario
          </h1>
          <p className="mt-1 text-sm text-slate-400">価格予測・トレーディングシナリオ</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-accent-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "分析中…" : "再分析"}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-accent-red/50 bg-accent-red/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !scenario && (
        <div className="flex items-center justify-center py-24 text-slate-400">分析中…</div>
      )}

      {scenario && (
        <div className="space-y-6">
          <ScenarioCard scenario={scenario} />

          <section className="rounded-xl border border-surface-border bg-surface-card p-5">
            <h2 className="mb-4 text-sm font-medium text-slate-400">価格チャート</h2>
            <PriceChart
              history={history}
              forecast={scenario.forecast}
              entryLow={scenario.entry.zone_low}
              entryHigh={scenario.entry.zone_high}
              takeProfit={scenario.exit.take_profit}
              stopLoss={scenario.exit.stop_loss}
            />
            <div className="mt-4">
              <TradeZones entry={scenario.entry} exit={scenario.exit} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FearGreedMeter
              value={sentiment?.fear_greed?.value ?? scenario.indicators.fear_greed}
              classification={sentiment?.fear_greed?.classification}
            />
            {snapshot && (
              <ExchangeDivergence
                tickers={snapshot.tickers}
                divergence={snapshot.divergence_pct}
              />
            )}
            <CoinglassPanel data={sentiment?.coinglass ?? null} />
            <VolumeHeatmap cells={heatmap} />
          </section>

          <p className="text-center text-xs text-slate-600">
            本アプリは参考情報であり、投資助言ではありません。
          </p>
        </div>
      )}
    </div>
  );
}
