import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, setApiAuthTokenProvider } from "../api/client";
import { AuthButton } from "../components/auth/AuthButton";
import { InvitePanel } from "../components/auth/InvitePanel";
import { JournalAnalyticsPanel } from "../components/journal/JournalAnalyticsPanel";
import { JournalPanel } from "../components/journal/JournalPanel";
import { LoginForm } from "../components/auth/LoginForm";
import { LoginSetupHelp } from "../components/auth/LoginSetupHelp";
import { CandlestickChart } from "../components/chart/CandlestickChart";
import { ScenarioPriceChart } from "../components/chart/ScenarioPriceChart";
import { AccuracyPanel } from "../components/dashboard/AccuracyPanel";
import { CoinglassPanel } from "../components/dashboard/CoinglassPanel";
import { ExchangeDivergence } from "../components/dashboard/ExchangeDivergence";
import { FearGreedMeter } from "../components/dashboard/FearGreedMeter";
import { IndicatorSignalHeader } from "../components/dashboard/IndicatorSignalHeader";
import { MacroContextPanel } from "../components/dashboard/MacroContextPanel";
import { MarketSessionsPanel } from "../components/dashboard/MarketSessionsPanel";
import { OverviewSignalStrip, type SignalStripItem } from "../components/dashboard/OverviewSignalStrip";
import { RiskZonesPanel } from "../components/dashboard/RiskZonesPanel";
import { TechnicalAnalysisPanel } from "../components/dashboard/TechnicalAnalysisPanel";
import { VolumeHeatmap } from "../components/dashboard/VolumeHeatmap";
import { DashboardShell } from "../components/layout/DashboardShell";
import { ResearchPanel } from "../components/research/ResearchPanel";
import { SavedSnapshotsPanel } from "../components/scenario/SavedSnapshotsPanel";
import { ScenarioCard, useScenarioHorizon } from "../components/scenario/ScenarioCard";
import { ExternalLink } from "../components/ui/ExternalLink";
import { useAuth } from "../hooks/useAuth";
import {
  type DashboardSection,
  loadDashboardSection,
} from "../lib/dashboard-nav";
import { EXTERNAL_LINKS } from "../lib/external-links";
import {
  type CandleInterval,
  CANDLE_INTERVAL_OPTIONS,
  candleIntervalLabel,
  pastTimeLabel,
} from "../lib/candle-interval";
import { getMissingFirebaseEnvKeys, isFirebaseConfigured } from "../lib/firebase";
import {
  saveScenarioSnapshot,
  subscribeRecentSnapshots,
  type SavedSnapshotRecord,
} from "../lib/firestore-snapshots";
import { buildResearchContext } from "../lib/scenario-context";
import { createJournalFromScenario } from "../lib/journal-from-scenario";
import { subscribeJournalEntries } from "../lib/firestore-journal";
import { subscribeResearchItems } from "../lib/firestore-research";
import {
  coinglassSignal,
  exchangeSignal,
  fearGreedSignal,
  heatmapSignal,
  riskZonesSignal,
  sessionsSignal,
  technicalSignal,
} from "../lib/indicator-signals";
import type { JournalEntry } from "../types/journal";
import type { ResearchItem } from "../types/research";
import type {
  AccuracySummary,
  CandlesResponse,
  RiskZonesResponse,
  SavedPredictionInput,
  TechnicalAnalysis,
} from "../types/market";
import type {
  HeatmapCell,
  HeatmapExchange,
  MacroContextSnapshot,
  MarketSnapshot,
  ScenarioResponse,
  SentimentIndicators,
} from "../types/scenario";
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
  const [activeSection, setActiveSection] = useState<DashboardSection>(loadDashboardSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveAlsoJournal, setSaveAlsoJournal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [sentiment, setSentiment] = useState<SentimentIndicators | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [heatmapExchange, setHeatmapExchange] = useState<HeatmapExchange>("all");
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [macroContext, setMacroContext] = useState<MacroContextSnapshot | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MarketSessionsResponse | null>(null);
  const [candles, setCandles] = useState<CandlesResponse | null>(null);
  const [technical, setTechnical] = useState<TechnicalAnalysis | null>(null);
  const [riskZones, setRiskZones] = useState<RiskZonesResponse | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracySummary | null>(null);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [savedRecords, setSavedRecords] = useState<SavedSnapshotRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [candleInterval, setCandleInterval] = useState<CandleInterval>("4h");
  const [chartLoading, setChartLoading] = useState(false);
  const { activeHorizonId, setActiveHorizonId, activeHorizon } = useScenarioHorizon(scenario);

  const loadChart = useCallback(async (interval: CandleInterval) => {
    setChartLoading(true);
    try {
      const [candleData, ta] = await Promise.all([
        api.getCandles(interval, 80).catch(() => null),
        api.getTechnical(interval).catch(() => null),
      ]);
      setCandles(candleData);
      setTechnical(ta);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const skipIntervalChartLoad = useRef(true);

  const loadHeatmap = useCallback(async (exchange: HeatmapExchange) => {
    setHeatmapLoading(true);
    try {
      const hm = await api.getHeatmap(exchange);
      setHeatmap(hm.cells);
    } catch {
      setHeatmap([]);
    } finally {
      setHeatmapLoading(false);
    }
  }, []);

  const loadMacro = useCallback(async () => {
    setMacroLoading(true);
    setMacroError(null);
    try {
      const macro = await api.getMacroContext();
      setMacroContext(macro);
    } catch (e) {
      setMacroContext(null);
      setMacroError(e instanceof Error ? e.message : "マクロデータの取得に失敗しました");
    } finally {
      setMacroLoading(false);
    }
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const researchContext = buildResearchContext(researchItems);
      const [snap, scen, sent, sess, zones] = await Promise.all([
        api.getMarketSnapshot(refresh),
        api.buildScenario(researchContext),
        api.getSentiment(),
        api.getMarketSessions(),
        api.getRiskZones().catch(() => null),
      ]);
      setSnapshot(snap);
      setScenario(scen);
      setSentiment(sent);
      setSessions(sess);
      setRiskZones(zones);
      setOpenedAt((prev) => (refresh || !prev ? new Date() : prev));
      void loadMacro();
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [researchItems, loadMacro]);

  const handleRefresh = useCallback(() => {
    void load(true);
    void loadChart(candleInterval);
    void loadHeatmap(heatmapExchange);
    void loadMacro();
  }, [load, loadChart, candleInterval, loadHeatmap, heatmapExchange, loadMacro]);

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
      setChartLoading(false);
      setScenario(null);
      setSnapshot(null);
      setSentiment(null);
      setCandles(null);
      setTechnical(null);
      setRiskZones(null);
      setError(null);
      skipIntervalChartLoad.current = true;
      return;
    }
    skipIntervalChartLoad.current = true;
    void Promise.all([load(), loadChart(candleInterval)]);
    const id = setInterval(() => load(), 60_000);
    const clockId = setInterval(() => {
      api.getMarketSessions().then(setSessions).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(id);
      clearInterval(clockId);
    };
  }, [canAccessApp, load, loadChart]);

  useEffect(() => {
    if (!canAccessApp) return;
    if (skipIntervalChartLoad.current) {
      skipIntervalChartLoad.current = false;
      return;
    }
    void loadChart(candleInterval);
  }, [canAccessApp, candleInterval, loadChart]);

  useEffect(() => {
    if (!canAccessApp) return;
    void loadHeatmap(heatmapExchange);
  }, [canAccessApp, heatmapExchange, loadHeatmap]);

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
    if (!user) {
      setJournalEntries([]);
      return;
    }
    setJournalLoading(true);
    const unsub = subscribeJournalEntries(
      user.uid,
      (records) => {
        setJournalEntries(records);
        setJournalLoading(false);
      },
      () => setJournalLoading(false),
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setResearchItems([]);
      return;
    }
    setResearchLoading(true);
    const unsub = subscribeResearchItems(
      user.uid,
      (records) => {
        setResearchItems(records);
        setResearchLoading(false);
      },
      () => setResearchLoading(false),
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
      const snapshotId = await saveScenarioSnapshot({ uid: user.uid, scenario, snapshot });
      if (saveAlsoJournal) {
        await createJournalFromScenario(user.uid, snapshotId, scenario);
      }
      setSaveMessage(saveAlsoJournal ? "シナリオと日誌に保存しました" : "保存しました");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const baselinePrice =
    snapshot?.tickers.find((t) => t.exchange === "whitebit") ?? snapshot?.tickers[0];
  const price = baselinePrice ? parseFloat(baselinePrice.last_price) : 0;

  const history = candles?.candles.length
    ? candles.candles.slice(-5).map((c, i, arr) => ({
        ts: pastTimeLabel(arr.length - i, candleInterval),
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

  const fgValue = sentiment?.fear_greed?.value ?? scenario?.indicators.fear_greed ?? null;

  const signalStripItems = useMemo((): SignalStripItem[] => {
    const items: SignalStripItem[] = [
      {
        id: "technical",
        label: "テクニカル",
        section: "market",
        signal: technicalSignal(technical),
      },
      {
        id: "macro",
        label: "マクロ環境",
        section: "context",
        signal: macroContext?.overall_summary_ja
          ? {
              stance: macroContext.overall_stance ?? "neutral",
              signalJa: macroContext.overall_signal_ja ?? "様子見",
              summaryJa: macroContext.overall_summary_ja,
            }
          : { stance: "neutral", signalJa: "様子見", summaryJa: "マクロデータを読み込み中です。" },
      },
      {
        id: "fear-greed",
        label: "Fear & Greed",
        section: "market",
        signal: fearGreedSignal(fgValue, sentiment?.fear_greed?.classification),
      },
      {
        id: "derivatives",
        label: "先物",
        section: "market",
        signal: coinglassSignal(sentiment?.coinglass ?? null),
      },
      {
        id: "heatmap",
        label: "板厚み",
        section: "market",
        signal: heatmapSignal(heatmap),
      },
      {
        id: "risk",
        label: "清算・スクイズ",
        section: "market",
        signal: riskZonesSignal(riskZones),
      },
      {
        id: "sessions",
        label: "世界時間",
        section: "context",
        signal: sessionsSignal(sessions),
      },
    ];
    if (snapshot) {
      items.push({
        id: "exchange",
        label: "取引所乖離",
        section: "market",
        signal: exchangeSignal(snapshot.divergence_pct),
      });
    }
    return items;
  }, [technical, macroContext, fgValue, sentiment, heatmap, riskZones, sessions, snapshot]);

  const headerActions = (
    <>
      {firebaseReady && !user ? (
        <AuthButton
          user={user}
          loading={authLoading}
          signingIn={signingIn}
          onSignIn={signInWithGoogle}
          onSignOut={logout}
          placement="header"
        />
      ) : null}
      {firebaseReady && user && scenario && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-content-secondary">
            <input
              type="checkbox"
              checked={saveAlsoJournal}
              onChange={(e) => setSaveAlsoJournal(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border"
            />
            日誌にも記録
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="min-h-[44px] rounded-lg border border-accent-green/50 bg-accent-green/10 px-3 py-2 text-sm font-medium text-accent-green transition hover:bg-accent-green/20 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading || !canAccessApp}
        className="min-h-[44px] rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "分析中…" : "再分析"}
      </button>
    </>
  );

  const candleSection = (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium text-content-secondary">
            {candleIntervalLabel(candleInterval)}ローソク足
          </h2>
          <label className="flex items-center gap-2 text-xs text-content-muted">
            <span>足</span>
            <select
              value={candleInterval}
              onChange={(e) => setCandleInterval(e.target.value as CandleInterval)}
              disabled={chartLoading}
              className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 py-1 text-sm text-slate-200"
            >
              {CANDLE_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {chartLoading && <span className="text-xs text-content-muted">読み込み中…</span>}
        </div>
        <ExternalLink href={EXTERNAL_LINKS.tradingView}>TradingViewで開く</ExternalLink>
      </div>
      {chartLoading && !candles?.candles?.length ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-surface-border/60 text-sm text-content-muted">
          チャート読み込み中…
        </div>
      ) : (
        <CandlestickChart
          candles={candles?.candles ?? []}
          interval={candleInterval}
          overlays={technical?.overlay_series ?? []}
          support={technical?.support}
          resistance={technical?.resistance}
          longLiqLow={riskZones?.long_liquidation?.zone_low}
          longLiqHigh={riskZones?.long_liquidation?.zone_high}
          shortSqLow={riskZones?.short_squeeze?.zone_low}
          shortSqHigh={riskZones?.short_squeeze?.zone_high}
        />
      )}
    </section>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            {scenario ? (
              <ScenarioCard
                scenario={scenario}
                activeHorizonId={activeHorizonId}
                onHorizonChange={setActiveHorizonId}
              />
            ) : null}
            {openedAt && price > 0 && activeHorizon && scenario && (
              <ScenarioPriceChart
                history={history}
                currentPrice={price}
                openedAt={openedAt}
                forecast={activeHorizon.forecast}
                entry={activeHorizon.entry}
                exit={activeHorizon.exit}
                horizonId={activeHorizon.id}
                periodHint={activeHorizon.period_hint}
                indicators={scenario.indicators}
              />
            )}
            <OverviewSignalStrip items={signalStripItems} onNavigate={setActiveSection} />
          </div>
        );

      case "chart":
        return candleSection;

      case "market":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <IndicatorSignalHeader signal={technicalSignal(technical)} />
                <TechnicalAnalysisPanel data={technical} interval={candleInterval} />
              </div>
              <div>
                <IndicatorSignalHeader signal={riskZonesSignal(riskZones)} />
                <RiskZonesPanel data={riskZones} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <IndicatorSignalHeader
                  signal={fearGreedSignal(fgValue, sentiment?.fear_greed?.classification)}
                />
                <FearGreedMeter
                  value={fgValue}
                  classification={sentiment?.fear_greed?.classification}
                  updatedAt={sentiment?.fear_greed?.timestamp}
                  history={sentiment?.fear_greed_history}
                />
              </div>
              <div>
                <IndicatorSignalHeader signal={heatmapSignal(heatmap)} />
                <VolumeHeatmap
                  cells={heatmap}
                  referencePrice={price > 0 ? price : undefined}
                  exchange={heatmapExchange}
                  onExchangeChange={setHeatmapExchange}
                  loading={heatmapLoading}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {snapshot && (
                <div>
                  <IndicatorSignalHeader signal={exchangeSignal(snapshot.divergence_pct)} />
                  <ExchangeDivergence
                    tickers={snapshot.tickers}
                    divergence={snapshot.divergence_pct}
                  />
                </div>
              )}
              <div>
                <IndicatorSignalHeader signal={coinglassSignal(sentiment?.coinglass ?? null)} />
                <CoinglassPanel data={sentiment?.coinglass ?? null} />
              </div>
            </div>
          </div>
        );

      case "context":
        return (
          <div className="space-y-6">
            <MacroContextPanel data={macroContext} loading={macroLoading} error={macroError} />
            {sessions && (
              <div>
                <IndicatorSignalHeader signal={sessionsSignal(sessions)} />
                <MarketSessionsPanel data={sessions} />
              </div>
            )}
            {user && (
              <ResearchPanel userId={user.uid} items={researchItems} loading={researchLoading} />
            )}
          </div>
        );

      case "journal":
        return (
          <div className="space-y-4">
            {user && (
              <AccuracyPanel
                data={accuracy}
                loading={accuracyLoading}
                savedRecords={savedRecords}
              />
            )}
            {user && (
              <JournalAnalyticsPanel
                aiAccuracy={accuracy}
                journalEntries={journalEntries}
                savedRecords={savedRecords}
                loading={accuracyLoading || journalLoading}
              />
            )}
            {user && <SavedSnapshotsPanel records={savedRecords} loading={historyLoading} />}
            {user && (
              <JournalPanel userId={user.uid} entries={journalEntries} loading={journalLoading} />
            )}
            <InvitePanel userEmail={user?.email} />
          </div>
        );

      default:
        return null;
    }
  };

  const showLoginGate = firebaseReady && inviteOnly && !canAccessApp;

  if (showLoginGate) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="font-english text-2xl font-semibold tracking-tight text-white">
            BTC Trading Scenario
          </h1>
          <p className="mt-2 text-sm text-content-secondary">
            Google アカウントまたは招待メールのリンクでログインしてください
          </p>
        </div>
        {authLoading ? (
          <p className="text-sm text-content-secondary">確認中…</p>
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
    <DashboardShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      mobileMenuOpen={mobileMenuOpen}
      onMobileMenuOpenChange={setMobileMenuOpen}
      headerActions={headerActions}
      userEmail={user?.email ?? null}
      sidebarFooter={
        firebaseReady ? (
          <AuthButton
            user={user}
            loading={authLoading}
            signingIn={signingIn}
            onSignIn={signInWithGoogle}
            onSignOut={logout}
            placement="sidebar"
          />
        ) : null
      }
    >
      {!firebaseReady && (
        <div className="mb-4 rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-3 text-sm text-amber-100">
          Firebase 未設定のためログイン・保存は使えません。
          <code className="mx-1 text-xs">frontend/.env.local</code>
          を用意してください（不足: {getMissingFirebaseEnvKeys().join(", ")}）。
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
            saveMessage.includes("保存")
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
        <div className="mb-6 rounded-xl border border-surface-border bg-surface-card px-5 py-4 text-sm text-content-secondary">
          シナリオを分析中…
        </div>
      )}

      {canAccessApp && renderSection()}

      <p className="mt-8 text-center font-japanese text-xs text-content-muted">
        本アプリは参考情報であり、投資助言ではありません。
      </p>
    </DashboardShell>
  );
}
