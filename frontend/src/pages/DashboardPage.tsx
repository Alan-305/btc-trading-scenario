import { useCallback, useEffect, useState } from "react";
import { api, setApiAuthTokenProvider } from "../api/client";
import { AuthButton } from "../components/auth/AuthButton";
import { InvitePanel } from "../components/auth/InvitePanel";
import { LoginForm } from "../components/auth/LoginForm";
import { LoginSetupHelp } from "../components/auth/LoginSetupHelp";
import { CandlestickChart } from "../components/chart/CandlestickChart";
import { ScenarioPriceChart } from "../components/chart/ScenarioPriceChart";
import { AccuracyPanel } from "../components/dashboard/AccuracyPanel";
import { CoinglassPanel } from "../components/dashboard/CoinglassPanel";
import { ExchangeDivergence } from "../components/dashboard/ExchangeDivergence";
import { FearGreedMeter } from "../components/dashboard/FearGreedMeter";
import { MarketSessionsPanel } from "../components/dashboard/MarketSessionsPanel";
import { RiskZonesPanel } from "../components/dashboard/RiskZonesPanel";
import { TechnicalAnalysisPanel } from "../components/dashboard/TechnicalAnalysisPanel";
import { VolumeHeatmap } from "../components/dashboard/VolumeHeatmap";
import { SavedSnapshotsPanel } from "../components/scenario/SavedSnapshotsPanel";
import { ScenarioCard } from "../components/scenario/ScenarioCard";
import { ExternalLink } from "../components/ui/ExternalLink";
import { useAuth } from "../hooks/useAuth";
import { EXTERNAL_LINKS } from "../lib/external-links";
import { getMissingFirebaseEnvKeys, isFirebaseConfigured } from "../lib/firebase";
import {
  saveScenarioSnapshot,
  subscribeRecentSnapshots,
  type SavedSnapshotRecord,
} from "../lib/firestore-snapshots";
import type {
  AccuracySummary,
  CandlesResponse,
  RiskZonesResponse,
  SavedPredictionInput,
  TechnicalAnalysis,
} from "../types/market";
import type { HeatmapCell, MarketSnapshot, ScenarioResponse, SentimentIndicators } from "../types/scenario";
import type { MarketSessionsResponse } from "../types/sessions";

export function DashboardPage() {
  const firebaseReady = isFirebaseConfigured();
  const {
    user,
    loading: authLoading,
    signingIn,
    authError,
    localDev,
    inviteOnly,
    canAccessApp,
    signInWithGoogle,
    logout,
  } = useAuth(firebaseReady);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [sentiment, setSentiment] = useState<SentimentIndicators | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [sessions, setSessions] = useState<MarketSessionsResponse | null>(null);
  const [candles, setCandles] = useState<CandlesResponse | null>(null);
  const [technical, setTechnical] = useState<TechnicalAnalysis | null>(null);
  const [riskZones, setRiskZones] = useState<RiskZonesResponse | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracySummary | null>(null);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [savedRecords, setSavedRecords] = useState<SavedSnapshotRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [snap, scen, sent, hm, sess, candleData, ta, zones] = await Promise.all([
        api.getMarketSnapshot(refresh),
        api.getScenario(refresh),
        api.getSentiment(),
        api.getHeatmap().catch(() => ({ cells: [] as HeatmapCell[] })),
        api.getMarketSessions(),
        api.getCandles("4h", 250).catch(() => null),
        api.getTechnical("4h").catch(() => null),
        api.getRiskZones().catch(() => null),
      ]);
      setSnapshot(snap);
      setScenario(scen);
      setSentiment(sent);
      setHeatmap(hm.cells);
      setSessions(sess);
      setCandles(candleData);
      setTechnical(ta);
      setRiskZones(zones);
      setOpenedAt((prev) => (refresh || !prev ? new Date() : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseReady || !canAccessApp) {
      setApiAuthTokenProvider(null);
      return;
    }

    setApiAuthTokenProvider(async () => {
      if (!user) return null;
      return user.getIdToken();
    });

    return () => setApiAuthTokenProvider(null);
  }, [firebaseReady, canAccessApp, user]);

  useEffect(() => {
    if (!canAccessApp) {
      setLoading(false);
      setScenario(null);
      setSnapshot(null);
      setSentiment(null);
      setCandles(null);
      setTechnical(null);
      setRiskZones(null);
      setError(null);
      return;
    }
    load();
    const id = setInterval(() => load(), 60_000);
    const clockId = setInterval(() => {
      api.getMarketSessions().then(setSessions).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(id);
      clearInterval(clockId);
    };
  }, [canAccessApp, load]);

  useEffect(() => {
    if (!user) {
      setSavedRecords([]);
      setHistoryLoading(false);
      setHistoryError(null);
      setAccuracy(null);
      return;
    }
    setHistoryLoading(true);
    const unsub = subscribeRecentSnapshots(
      user.uid,
      (records) => {
        setSavedRecords(records);
        setHistoryLoading(false);
        setHistoryError(null);
      },
      (message) => {
        setHistoryError(message);
        setHistoryLoading(false);
      },
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || savedRecords.length === 0) {
      setAccuracy(null);
      return;
    }
    setAccuracyLoading(true);
    const inputs: SavedPredictionInput[] = savedRecords.map((row) => ({
      saved_at: row.saved_at?.toISOString() ?? null,
      macro_trend: row.scenario.macro_trend,
      reference_price: row.market_summary.whitebit_price
        ? parseFloat(row.market_summary.whitebit_price)
        : row.scenario.entry.zone_low,
      entry_zone_low: row.scenario.entry.zone_low,
      entry_zone_high: row.scenario.entry.zone_high,
      take_profit: row.scenario.exit.take_profit,
      stop_loss: row.scenario.exit.stop_loss,
      side: row.scenario.entry.side,
    }));
    api
      .evaluatePredictions(inputs)
      .then(setAccuracy)
      .catch(() => setAccuracy(null))
      .finally(() => setAccuracyLoading(false));
  }, [user, savedRecords]);

  const handleSave = async () => {
    if (!user || !scenario) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await saveScenarioSnapshot({
        uid: user.uid,
        scenario,
        snapshot,
      });
      setSaveMessage("保存しました");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const baselinePrice = snapshot?.tickers.find((t) => t.exchange === "whitebit")
    ?? snapshot?.tickers[0];
  const price = baselinePrice ? parseFloat(baselinePrice.last_price) : 0;

  const history = candles?.candles.length
    ? candles.candles.slice(-5).map((c, i, arr) => ({
        ts: `-${(arr.length - i) * 4}時間前`,
        price: c.close,
        type: "history" as const,
      }))
    : baselinePrice
      ? Array.from({ length: 11 }, (_, i) => ({
          ts: `-${(11 - i) * 4}時間前`,
          price: price * (1 + Math.sin(i) * 0.005),
          type: "history" as const,
        }))
      : [];

  const showLoginGate = firebaseReady && inviteOnly && !canAccessApp;

  if (showLoginGate) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="font-english text-2xl font-semibold tracking-tight text-white">
            BTC Trading Scenario
          </h1>
          <p className="mt-2 text-sm text-slate-400">招待されたアカウントでログインしてください</p>
        </div>

        {authLoading ? (
          <p className="text-sm text-slate-400">確認中…</p>
        ) : (
          <>
            {localDev ? <LoginSetupHelp localDev={localDev} /> : null}
            <LoginForm signingIn={signingIn} onGoogleSignIn={signInWithGoogle} />
          </>
        )}

        {authError && (
          <div className="mt-4 max-w-md rounded-lg border border-accent-red/50 bg-accent-red/10 p-3 text-sm text-red-200">
            {authError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-english text-2xl font-semibold tracking-tight text-white">
            BTC Trading Scenario
          </h1>
          <p className="mt-1 text-sm text-slate-400">価格予測・トレーディングシナリオ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {firebaseReady ? (
            <AuthButton
              user={user}
              loading={authLoading}
              signingIn={signingIn}
              onSignIn={signInWithGoogle}
              onSignOut={logout}
            />
          ) : null}
          {firebaseReady && user && scenario && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="min-h-[44px] rounded-lg border border-accent-green/50 bg-accent-green/10 px-4 py-2 text-sm font-medium text-accent-green transition hover:bg-accent-green/20 disabled:opacity-50"
            >
              {saving ? "保存中…" : "シナリオを保存"}
            </button>
          )}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading || !canAccessApp}
            className="min-h-[44px] rounded-lg bg-accent-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "分析中…" : "再分析"}
          </button>
        </div>
      </header>

      {!firebaseReady && (
        <div className="mb-4 rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-3 text-sm text-amber-100">
          Firebase 未設定のためログイン・保存は使えません。
          <code className="mx-1 text-xs">frontend/.env.local</code>
          を用意して Vite を再起動してください（不足: {getMissingFirebaseEnvKeys().join(", ")}）。
        </div>
      )}

      {(authError || historyError) && (
        <div className="mb-4 rounded-lg border border-accent-red/50 bg-accent-red/10 p-3 text-sm text-red-200">
          {authError ?? historyError}
        </div>
      )}

      {saveMessage && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            saveMessage === "保存しました"
              ? "border-accent-green/50 bg-accent-green/10 text-green-200"
              : "border-accent-red/50 bg-accent-red/10 text-red-200"
          }`}
        >
          {saveMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-accent-red/50 bg-accent-red/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !scenario && canAccessApp && (
        <div className="flex items-center justify-center py-24 text-slate-400">分析中…</div>
      )}

      {scenario && canAccessApp && (
        <div className="space-y-6">
          <InvitePanel userEmail={user?.email} />
          <ScenarioCard scenario={scenario} />

          {openedAt && price > 0 && (
            <ScenarioPriceChart
              history={history}
              currentPrice={price}
              openedAt={openedAt}
              forecast={scenario.forecast}
              entry={scenario.entry}
              exit={scenario.exit}
            />
          )}

          {user && (
            <>
              <SavedSnapshotsPanel records={savedRecords} loading={historyLoading} />
              <AccuracyPanel data={accuracy} loading={accuracyLoading} />
            </>
          )}

          {sessions && <MarketSessionsPanel data={sessions} />}

          <section className="rounded-xl border border-surface-border bg-surface-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-400">4時間足ローソク足</h2>
              <ExternalLink href={EXTERNAL_LINKS.tradingView}>TradingViewで開く</ExternalLink>
            </div>
            <CandlestickChart
              candles={candles?.candles ?? []}
              overlays={technical?.overlay_series ?? []}
              support={technical?.support}
              resistance={technical?.resistance}
              longLiqLow={riskZones?.long_liquidation?.zone_low}
              longLiqHigh={riskZones?.long_liquidation?.zone_high}
              shortSqLow={riskZones?.short_squeeze?.zone_low}
              shortSqHigh={riskZones?.short_squeeze?.zone_high}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TechnicalAnalysisPanel data={technical} />
            <RiskZonesPanel data={riskZones} />
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
