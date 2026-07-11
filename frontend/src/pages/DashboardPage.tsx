import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, setApiAuthTokenProvider } from "../api/client";
import { AuthButton } from "../components/auth/AuthButton";
import { InvitePanel } from "../components/auth/InvitePanel";
import { JournalAnalyticsPanel } from "../components/journal/JournalAnalyticsPanel";
import { JournalPanel } from "../components/journal/JournalPanel";
import { LoginForm } from "../components/auth/LoginForm";
import { LoginSetupHelp } from "../components/auth/LoginSetupHelp";
import { TechnicalLinkedChart } from "../components/chart/TechnicalLinkedChart";
import { ScenarioPriceChart } from "../components/chart/ScenarioPriceChart";
import { AccuracyPanel } from "../components/dashboard/AccuracyPanel";
import { CoinglassPanel } from "../components/dashboard/CoinglassPanel";
import { LongShortRatioPanel } from "../components/dashboard/LongShortRatioPanel";
import { ExchangeDivergence } from "../components/dashboard/ExchangeDivergence";
import { FearGreedMeter } from "../components/dashboard/FearGreedMeter";
import { IndicatorSignalHeader } from "../components/dashboard/IndicatorSignalHeader";
import { MacroContextPanel } from "../components/dashboard/MacroContextPanel";
import { EconomicCalendarPanel } from "../components/dashboard/EconomicCalendarPanel";
import { EquityMarketsPanel } from "../components/dashboard/macro/EquityMarketsPanel";
import { UsdtDominancePanel } from "../components/dashboard/macro/UsdtDominancePanel";
import { MarketSessionsPanel } from "../components/dashboard/MarketSessionsPanel";
import { OverviewSignalStrip, type SignalStripItem } from "../components/dashboard/OverviewSignalStrip";
import { RiskZonesPanel } from "../components/dashboard/RiskZonesPanel";
import { IchimokuPanel } from "../components/dashboard/IchimokuPanel";
import { TechnicalAnalysisPanel } from "../components/dashboard/TechnicalAnalysisPanel";
import { VolumeHeatmap } from "../components/dashboard/VolumeHeatmap";
import { SupportPanel } from "../components/support/SupportPanel";
import { DashboardShell } from "../components/layout/DashboardShell";
import { ResearchPanel } from "../components/research/ResearchPanel";
import { PaperTradePanel } from "../components/paper-trade/PaperTradePanel";
import { SavedSnapshotsPanel } from "../components/scenario/SavedSnapshotsPanel";
import { ScenarioRecommendationHero } from "../components/scenario/ScenarioRecommendationHero";
import { ScenarioCard } from "../components/scenario/ScenarioCard";
import { TradeLevelsCard } from "../components/scenario/TradeLevelsCard";
import { WatchScenarioCard } from "../components/scenario/WatchScenarioCard";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import { DataPanelMeta } from "../components/ui/DataPanelMeta";
import { useAuth } from "../hooks/useAuth";
import {
  type DashboardSection,
  INDICATOR_NAV_TARGETS,
  type IndicatorNavTarget,
  loadDashboardSection,
  saveDashboardSection,
  scrollToIndicatorAnchor,
} from "../lib/dashboard-nav";
import { normalizeHorizonId, isHodlHorizon } from "../lib/scenario-horizons";
import { EXTERNAL_LINKS } from "../lib/external-links";
import {
  type CandleInterval,
  CANDLE_INTERVAL_OPTIONS,
  ENTRY_CHART_BAR_COUNT,
  ENTRY_CHART_INTERVAL,
  entryChartPeriodHint,
  formatEntryChartCompact,
} from "../lib/candle-interval";
import { getMissingFirebaseEnvKeys, isFirebaseConfigured } from "../lib/firebase";
import { isEmailAllowedByEnv } from "../lib/invite-access";
import {
  saveScenarioSnapshot,
  subscribeRecentSnapshots,
  type SavedSnapshotRecord,
} from "../lib/firestore-snapshots";
import {
  isWatchRecommended,
  primaryRecommendation,
  recommendedBranch,
  resolveActiveHorizon,
  resolveDirectionalScenario,
} from "../lib/scenario-branches";
import { buildResearchContext } from "../lib/scenario-context";
import { createJournalFromScenario } from "../lib/journal-from-scenario";
import { subscribeJournalEntries } from "../lib/firestore-journal";
import { subscribePaperTrades, createPaperTrade } from "../lib/firestore-paper-trades";
import { subscribeResearchItems } from "../lib/firestore-research";
import {
  coinglassSignal,
  longShortRatioSignal,
  equityMarketsSignal,
  exchangeSignal,
  fearGreedSignal,
  heatmapSignal,
  riskZonesSignal,
  sessionsSignal,
  ichimokuSignal,
  stochasticSignal,
  technicalSignal,
  resolveUsdtDominance,
  usdtDominanceSignal,
} from "../lib/indicator-signals";
import type { MacroEventsResponse } from "../types/macro-events";
import type { JournalEntry } from "../types/journal";
import type { PaperTrade, PaperTradeDraft } from "../types/paper-trade";
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
  ScenarioHorizonId,
  ScenarioResponse,
  SentimentIndicators,
  TradeBranch,
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
  const pendingScrollRef = useRef<IndicatorNavTarget | null>(null);
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
  const [heatmapCollectedAt, setHeatmapCollectedAt] = useState<string | null>(null);
  const [heatmapExchange, setHeatmapExchange] = useState<HeatmapExchange>("all");
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [macroContext, setMacroContext] = useState<MacroContextSnapshot | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [macroEvents, setMacroEvents] = useState<MacroEventsResponse | null>(null);
  const [macroEventsLoading, setMacroEventsLoading] = useState(false);
  const [sessions, setSessions] = useState<MarketSessionsResponse | null>(null);
  const [candles, setCandles] = useState<CandlesResponse | null>(null);
  const [entryChartCandles, setEntryChartCandles] = useState<CandlesResponse | null>(null);
  const [entryTechnical, setEntryTechnical] = useState<TechnicalAnalysis | null>(null);
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
  const [ichimokuInterval, setIchimokuInterval] = useState<CandleInterval>("1d");
  const [ichimokuTechnical, setIchimokuTechnical] = useState<TechnicalAnalysis | null>(null);
  const [ichimokuLoading, setIchimokuLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [activeHorizonId, setActiveHorizonId] = useState<ScenarioHorizonId>("today");
  const [activeBranch, setActiveBranch] = useState<TradeBranch>("bullish");
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);
  const [panelRefreshing, setPanelRefreshing] = useState<Record<string, boolean>>({});
  const hasInitializedScenarioSelection = useRef(false);

  const setRefreshing = useCallback((key: string, value: boolean) => {
    setPanelRefreshing((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isRefreshing = useCallback(
    (key: string) => panelRefreshing[key] ?? false,
    [panelRefreshing],
  );

  const activeDirectional = scenario
    ? resolveDirectionalScenario(scenario, activeBranch)
    : null;
  const activeHorizon = resolveActiveHorizon(
    activeDirectional,
    normalizeHorizonId(activeHorizonId),
  );
  const isActiveHodl = activeHorizon
    ? isHodlHorizon(activeHorizon.id, activeHorizon.horizon_mode)
    : false;

  const handlePaperEntry = useCallback(
    async (draft: PaperTradeDraft) => {
      if (!user) return;
      await createPaperTrade(user.uid, {
        ...draft,
        scenarioBranch: activeBranch,
        horizonId: activeHorizon?.id ?? null,
      });
    },
    [user, activeBranch, activeHorizon?.id],
  );

  useEffect(() => {
    if (!scenario) {
      hasInitializedScenarioSelection.current = false;
      return;
    }
    // Always align the detail tab with the server primary when a new scenario arrives.
    setActiveBranch(recommendedBranch(scenario));
    if (!hasInitializedScenarioSelection.current) {
      hasInitializedScenarioSelection.current = true;
      setActiveHorizonId("today");
    }
  }, [scenario?.generated_at]);

  const loadChart = useCallback(
    async (interval: CandleInterval, refresh = false) => {
      setChartLoading(true);
      setRefreshing("chart", true);
      try {
        const [candleData, ta] = await Promise.all([
          api.getCandles(interval, 80, refresh),
          api.getTechnical(interval, refresh),
        ]);
        setCandles(candleData);
        setTechnical(ta);
      } finally {
        setChartLoading(false);
        setRefreshing("chart", false);
      }
    },
    [setRefreshing],
  );

  const loadEntryChart = useCallback(
    async (refresh = false) => {
      setRefreshing("entryChart", true);
      try {
        const [candleData, ta, snap] = await Promise.all([
          api.getCandles(ENTRY_CHART_INTERVAL, ENTRY_CHART_BAR_COUNT, refresh),
          api.getTechnical(ENTRY_CHART_INTERVAL, refresh).catch(() => null),
          refresh ? api.getMarketSnapshot(true).catch(() => null) : Promise.resolve(null),
        ]);
        setEntryChartCandles(candleData);
        setEntryTechnical(ta);
        if (snap) setSnapshot(snap);
      } catch {
        setEntryChartCandles(null);
        setEntryTechnical(null);
      } finally {
        setRefreshing("entryChart", false);
      }
    },
    [setRefreshing],
  );

  const skipIntervalChartLoad = useRef(true);

  const loadHeatmap = useCallback(
    async (exchange: HeatmapExchange) => {
      setHeatmapLoading(true);
      setRefreshing("heatmap", true);
      try {
        const hm = await api.getHeatmap(exchange);
        setHeatmap(hm.cells);
        setHeatmapCollectedAt(hm.collected_at ?? null);
      } catch {
        setHeatmap([]);
        setHeatmapCollectedAt(null);
      } finally {
        setHeatmapLoading(false);
        setRefreshing("heatmap", false);
      }
    },
    [setRefreshing],
  );

  const loadIchimoku = useCallback(
    async (interval: CandleInterval, refresh = false) => {
      setIchimokuLoading(true);
      setRefreshing("ichimoku", true);
      try {
        setIchimokuTechnical(await api.getTechnical(interval, refresh));
      } catch {
        setIchimokuTechnical(null);
      } finally {
        setIchimokuLoading(false);
        setRefreshing("ichimoku", false);
      }
    },
    [setRefreshing],
  );

  const loadMacro = useCallback(async (refresh = false) => {
    setMacroLoading(true);
    setMacroEventsLoading(true);
    setMacroError(null);
    try {
      const [macro, events] = await Promise.all([
        api.getMacroContext(refresh),
        api.getMacroEvents(7, refresh).catch((eventError) => {
          console.warn("macro-events fetch failed", eventError);
          return null;
        }),
      ]);
      setMacroContext(macro);
      setMacroEvents(events);
    } catch (e) {
      setMacroContext(null);
      setMacroError(e instanceof Error ? e.message : "マクロデータの取得に失敗しました");
    } finally {
      setMacroLoading(false);
      setMacroEventsLoading(false);
    }
  }, []);

  const refreshScenarioOnly = useCallback(async () => {
    setRefreshing("scenario", true);
    try {
      const scen = await api.buildScenario(buildResearchContext(researchItems));
      setScenario(scen);
      setOpenedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "シナリオの更新に失敗しました");
    } finally {
      setRefreshing("scenario", false);
    }
  }, [researchItems, setRefreshing]);

  const refreshSnapshotOnly = useCallback(async () => {
    setRefreshing("snapshot", true);
    try {
      setSnapshot(await api.getMarketSnapshot(true));
    } finally {
      setRefreshing("snapshot", false);
    }
  }, [setRefreshing]);

  const refreshSentimentOnly = useCallback(async () => {
    setRefreshing("sentiment", true);
    try {
      setSentiment(await api.getSentiment());
    } finally {
      setRefreshing("sentiment", false);
    }
  }, [setRefreshing]);

  const refreshSessionsOnly = useCallback(async () => {
    setRefreshing("sessions", true);
    try {
      setSessions(await api.getMarketSessions());
    } finally {
      setRefreshing("sessions", false);
    }
  }, [setRefreshing]);

  const refreshRiskZonesOnly = useCallback(async () => {
    setRefreshing("riskZones", true);
    try {
      setRiskZones(await api.getRiskZones().catch(() => null));
    } finally {
      setRefreshing("riskZones", false);
    }
  }, [setRefreshing]);

  const refreshMacroContextOnly = useCallback(async () => {
    setRefreshing("macro", true);
    setMacroError(null);
    try {
      setMacroContext(await api.getMacroContext(true));
    } catch (e) {
      setMacroContext(null);
      setMacroError(e instanceof Error ? e.message : "マクロデータの取得に失敗しました");
    } finally {
      setRefreshing("macro", false);
    }
  }, [setRefreshing]);

  const refreshMacroEventsOnly = useCallback(async () => {
    setRefreshing("macroEvents", true);
    setMacroEventsLoading(true);
    try {
      setMacroEvents(await api.getMacroEvents(7, true));
    } catch (eventError) {
      console.warn("macro-events refresh failed", eventError);
    } finally {
      setRefreshing("macroEvents", false);
      setMacroEventsLoading(false);
    }
  }, [setRefreshing]);

  const refreshAccuracyOnly = useCallback(async () => {
    if (!user || savedRecords.length === 0) return;
    setRefreshing("accuracy", true);
    setAccuracyLoading(true);
    try {
      const snap = await api.getMarketSnapshot(true);
      setSnapshot(snap);
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
      setAccuracy(await api.evaluatePredictions(inputs));
    } catch {
      setAccuracy(null);
    } finally {
      setRefreshing("accuracy", false);
      setAccuracyLoading(false);
    }
  }, [user, savedRecords, setRefreshing]);

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
      if (refresh) {
        setActiveBranch(recommendedBranch(scen));
        setActiveHorizonId("today");
        hasInitializedScenarioSelection.current = true;
      }
      setSentiment(sent);
      setSessions(sess);
      setRiskZones(zones);
      setOpenedAt((prev) => (refresh || !prev ? new Date() : prev));
      void loadMacro(refresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [researchItems, loadMacro]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const handleRefresh = useCallback(() => {
    void load(true);
    void loadChart(candleInterval, true);
    void loadIchimoku(ichimokuInterval, true);
    void loadEntryChart(true);
    void loadHeatmap(heatmapExchange);
  }, [load, loadChart, loadIchimoku, ichimokuInterval, loadEntryChart, candleInterval, loadHeatmap, heatmapExchange]);

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
      setEntryChartCandles(null);
      setEntryTechnical(null);
      setTechnical(null);
      setRiskZones(null);
      setError(null);
      skipIntervalChartLoad.current = true;
      return;
    }
    skipIntervalChartLoad.current = true;
    void Promise.all([loadRef.current(), loadChart(candleInterval), loadEntryChart(), loadIchimoku(ichimokuInterval)]);
    // ログイン中はシナリオ再分析を自動実行しない（手動の「再分析」のみ）
    const scenarioPollId = user
      ? null
      : window.setInterval(() => {
          void loadRef.current();
        }, 60_000);
    const clockId = window.setInterval(() => {
      api.getMarketSessions().then(setSessions).catch(() => {});
    }, 30_000);
    return () => {
      if (scenarioPollId != null) clearInterval(scenarioPollId);
      clearInterval(clockId);
    };
  }, [canAccessApp, user, loadChart, loadEntryChart, loadIchimoku, candleInterval, ichimokuInterval]);

  useEffect(() => {
    if (!canAccessApp) return;
    void loadIchimoku(ichimokuInterval);
  }, [canAccessApp, ichimokuInterval, loadIchimoku]);

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
      setPaperTrades([]);
      return;
    }
    const unsub = subscribePaperTrades(
      user.uid,
      (records) => setPaperTrades(records),
      (message) => console.warn("paper trades subscribe failed", message),
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

  const entryHistory = entryChartCandles?.candles.length
    ? entryChartCandles.candles.map((c) => ({
        ts: formatEntryChartCompact(c.ts),
        isoTs: c.ts,
        price: c.close,
        type: "history" as const,
      }))
    : [];

  const fgValue = sentiment?.fear_greed?.value ?? scenario?.indicators.fear_greed ?? null;
  const usdtDominance = resolveUsdtDominance(macroContext?.usdt_dominance, scenario);
  const macroContextWithUsdt = useMemo((): MacroContextSnapshot | null => {
    if (!macroContext && !usdtDominance) return macroContext;
    if (!macroContext) {
      return {
        options: null,
        etf_flows: null,
        onchain: null,
        usdt_dominance: usdtDominance,
        equity_markets: null,
        fetched_at: usdtDominance?.timestamp ?? null,
      };
    }
    if (macroContext.usdt_dominance || !usdtDominance) return macroContext;
    return { ...macroContext, usdt_dominance: usdtDominance };
  }, [macroContext, usdtDominance]);

  const handleIndicatorNavigate = useCallback((target: IndicatorNavTarget) => {
    pendingScrollRef.current = target;
    setActiveSection(target.section);
    saveDashboardSection(target.section);
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (!target || activeSection !== target.section) return;
    scrollToIndicatorAnchor(target.anchorId, () => {
      pendingScrollRef.current = null;
    });
  }, [
    activeSection,
    macroLoading,
    macroEventsLoading,
    chartLoading,
    heatmapLoading,
    sessions,
    macroContext,
    technical,
    snapshot,
  ]);

  const signalStripItems = useMemo((): SignalStripItem[] => {
    const targetFor = (id: string) =>
      INDICATOR_NAV_TARGETS[id] ?? { section: "overview" as const, anchorId: "market-sessions" as const };

    const items: SignalStripItem[] = [
      {
        id: "technical",
        label: "テクニカル",
        target: targetFor("technical"),
        signal: technicalSignal(technical),
      },
      {
        id: "macro",
        label: "マクロ環境",
        target: targetFor("macro"),
        signal: macroContext?.overall_summary_ja
          ? {
              stance: macroContext.overall_stance ?? "neutral",
              signalJa: macroContext.overall_signal_ja ?? "様子見",
              summaryJa: macroContext.overall_summary_ja,
            }
          : { stance: "neutral", signalJa: "様子見", summaryJa: "マクロデータを読み込み中です。" },
      },
      {
        id: "equity-markets",
        label: "世界株",
        target: targetFor("equity-markets"),
        signal: equityMarketsSignal(macroContext?.equity_markets),
      },
      {
        id: "stochastic",
        label: "ストキャス",
        target: targetFor("stochastic"),
        signal: stochasticSignal(technical),
      },
      {
        id: "ichimoku",
        label: "一目均衡表",
        target: targetFor("ichimoku"),
        signal: ichimokuSignal(ichimokuTechnical),
      },
      {
        id: "usdt-dominance",
        label: "USDT.D",
        target: targetFor("usdt-dominance"),
        signal: usdtDominanceSignal(usdtDominance),
      },
      {
        id: "fear-greed",
        label: "Fear & Greed",
        target: targetFor("fear-greed"),
        signal: fearGreedSignal(fgValue, sentiment?.fear_greed?.classification),
      },
      {
        id: "derivatives",
        label: "先物",
        target: targetFor("derivatives"),
        signal: coinglassSignal(sentiment?.coinglass ?? null),
      },
      {
        id: "long-short-ratio",
        label: "L/S比率",
        target: targetFor("long-short-ratio"),
        signal: longShortRatioSignal(sentiment?.coinglass ?? null),
      },
      {
        id: "heatmap",
        label: "板厚み",
        target: targetFor("heatmap"),
        signal: heatmapSignal(heatmap),
      },
      {
        id: "risk",
        label: "リキッド帯",
        target: targetFor("risk"),
        signal: riskZonesSignal(riskZones),
      },
      {
        id: "sessions",
        label: "世界時間",
        target: targetFor("sessions"),
        signal: sessionsSignal(sessions),
      },
    ];
    if (snapshot) {
      items.push({
        id: "exchange",
        label: "取引所乖離",
        target: targetFor("exchange"),
        signal: exchangeSignal(snapshot.divergence_pct),
      });
    }
    return items;
  }, [technical, ichimokuTechnical, macroContext, usdtDominance, fgValue, sentiment, heatmap, riskZones, sessions, snapshot]);

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
    <section id="indicator-stochastic" className="scroll-mt-24 rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title={<h2 className="font-english text-sm font-medium text-slate-200">₿BTCUSDT</h2>}
        sourceHref={EXTERNAL_LINKS.tradingView}
        sourceLabel="TradingView"
        updatedAt={candles?.fetched_at ?? technical?.fetched_at}
        onRefresh={() => void loadChart(candleInterval, true)}
        refreshing={isRefreshing("chart") || chartLoading}
        refreshLabel="チャートを更新"
        headerActions={
          <div className="flex flex-wrap items-center gap-3">
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
        }
      />
      <IndicatorSignalHeader signal={stochasticSignal(technical)} />
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <p className="font-english text-sm text-slate-200">
          %K{" "}
          <span className="font-semibold text-cyan-300">
            {technical?.stoch_k?.toFixed(1) ?? "—"}
          </span>
          <span className="mx-2 text-content-muted">/</span>
          %D{" "}
          <span className="font-semibold text-orange-300">
            {technical?.stoch_d?.toFixed(1) ?? "—"}
          </span>
        </p>
        {technical?.stoch_last_cross ? (
          <span
            className={`rounded-full px-2 py-0.5 font-japanese text-[10px] font-medium ${
              technical.stoch_last_cross === "gc"
                ? "bg-accent-green/15 text-accent-green"
                : "bg-accent-red/15 text-accent-red"
            }`}
          >
            直近{technical.stoch_last_cross === "gc" ? "GC" : "DC"}
          </span>
        ) : null}
      </div>
      {chartLoading && !candles?.candles?.length ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-surface-border/60 text-sm text-content-muted">
          チャート読み込み中…
        </div>
      ) : (
        <TechnicalLinkedChart
          candles={candles?.candles ?? []}
          interval={candleInterval}
          overlays={technical?.overlay_series ?? []}
          stochSeries={technical?.stoch_series ?? []}
          support={technical?.support}
          resistance={technical?.resistance}
          longLiqLow={riskZones?.long_liquidation?.zone_low}
          longLiqHigh={riskZones?.long_liquidation?.zone_high}
          shortSqLow={riskZones?.short_squeeze?.zone_low}
          shortSqHigh={riskZones?.short_squeeze?.zone_high}
        />
      )}
      {technical?.stoch_summary_ja ? (
        <p className="mt-3 font-japanese text-xs leading-relaxed text-content-muted">
          {technical.stoch_summary_ja}
        </p>
      ) : null}
    </section>
  );

  const showInviteNav = Boolean(user?.email && isEmailAllowedByEnv(user.email));

  const renderSection = () => {
    switch (activeSection) {
      case "overview": {
        const primary = scenario ? primaryRecommendation(scenario) : null;
        const recommended = scenario ? recommendedBranch(scenario) : "bullish";
        const recommendedDirectional =
          scenario && primary && primary !== "watch"
            ? resolveDirectionalScenario(scenario, primary)
            : null;
        const recommendedHorizon = scenario
          ? resolveActiveHorizon(
              recommendedDirectional ??
                (primary === "watch"
                  ? resolveDirectionalScenario(scenario, recommended)
                  : null),
              normalizeHorizonId(activeHorizonId),
            )
          : null;
        const viewingReference =
          Boolean(scenario) &&
          primary !== "watch" &&
          activeBranch !== recommended;

        return (
          <div className="space-y-6">
            {scenario ? (
              <ScenarioRecommendationHero
                scenario={scenario}
                recommendedHorizon={
                  primary === "watch" ? null : recommendedHorizon
                }
                watch={scenario.watch}
                viewingReference={viewingReference}
                entryBlocked={
                  primary !== "watch" &&
                  !isActiveHodl &&
                  Boolean(
                    scenario.indicators?.mtf_entry_blocked ??
                      scenario.mtf_gates?.some((g) => g.entry_blocked),
                  )
                }
                entryCaution={
                  scenario.indicators?.mtf_summary_ja ??
                  scenario.mtf_gates?.find(
                    (g) => g.side === recommendedHorizon?.entry.side,
                  )?.gate_summary_ja ??
                  null
                }
              />
            ) : null}
            {openedAt && price > 0 && activeHorizon && scenario && entryHistory.length > 0 && (
              <ScenarioPriceChart
                history={entryHistory}
                currentPrice={price}
                openedAt={openedAt}
                forecast={activeHorizon.forecast}
                entry={activeHorizon.entry}
                exit={activeHorizon.exit}
                horizonId={activeHorizon.id}
                horizonMode={activeHorizon.horizon_mode}
                holdContext={activeHorizon.hold_context}
                periodHint={
                  activeHorizon.id === "hodl"
                    ? activeHorizon.period_hint
                    : entryChartPeriodHint()
                }
                indicators={scenario.indicators}
                branchLabel={
                  viewingReference
                    ? `${activeBranch === "bullish" ? "上昇" : "下落"}シナリオ（参考）`
                    : primary === "watch"
                      ? `${activeBranch === "bullish" ? "上昇" : "下落"}シナリオ（参考）`
                      : activeBranch === "bullish"
                        ? "上昇シナリオ"
                        : "下落シナリオ"
                }
                primaryRecommendation={primary ?? "watch"}
                stochSeries={entryTechnical?.stoch_series ?? []}
                macroEvents={macroEvents?.events ?? []}
                mtfGates={scenario.mtf_gates}
                chartUpdatedAt={entryChartCandles?.fetched_at}
                scenarioGeneratedAt={scenario.generated_at}
                onRefresh={() => void loadEntryChart(true)}
                refreshing={isRefreshing("entryChart")}
              />
            )}
            {scenario ? (
              <ScenarioCard
                scenario={scenario}
                activeBranch={activeBranch}
                onBranchChange={setActiveBranch}
                activeHorizonId={activeHorizonId}
                onHorizonChange={setActiveHorizonId}
                onRefresh={() => void refreshScenarioOnly()}
                refreshing={isRefreshing("scenario")}
              />
            ) : null}
            {scenario?.watch && !isWatchRecommended(scenario) ? (
              <WatchScenarioCard watch={scenario.watch} />
            ) : null}
            {!isActiveHodl && activeHorizon && scenario ? (
              <CollapsibleSection
                title="取引計画（レベル・数量）"
                storageKey="tradeLevelsPanelOpen"
                defaultOpen
              >
                <TradeLevelsCard
                  entry={activeHorizon.entry}
                  exit={activeHorizon.exit}
                  onPaperEntry={user ? handlePaperEntry : undefined}
                  updatedAt={scenario.generated_at}
                  onRefresh={() => void refreshScenarioOnly()}
                  refreshing={isRefreshing("scenario")}
                />
              </CollapsibleSection>
            ) : null}
            {user && !isActiveHodl ? (
              <PaperTradePanel
                uid={user.uid}
                trades={paperTrades}
                currentPrice={price}
              />
            ) : null}
            {sessions && (
              <div id="market-sessions" className="scroll-mt-24">
                <IndicatorSignalHeader signal={sessionsSignal(sessions)} />
                <MarketSessionsPanel
                  data={sessions}
                  onRefresh={() => void refreshSessionsOnly()}
                  refreshing={isRefreshing("sessions")}
                />
              </div>
            )}
            <OverviewSignalStrip items={signalStripItems} onNavigate={handleIndicatorNavigate} />
          </div>
        );
      }

      case "technical":
        return (
          <div className="space-y-4">
            <div>
              <IndicatorSignalHeader signal={technicalSignal(technical)} />
              {candleSection}
            </div>
            <div id="indicator-technical" className="scroll-mt-24">
              <IndicatorSignalHeader signal={technicalSignal(technical)} />
              <TechnicalAnalysisPanel
                data={technical}
                interval={candleInterval}
                onRefresh={() => void loadChart(candleInterval, true)}
                refreshing={isRefreshing("chart") || chartLoading}
              />
            </div>
            <div id="indicator-ichimoku" className="scroll-mt-24">
              <IndicatorSignalHeader signal={ichimokuSignal(ichimokuTechnical)} />
              <IchimokuPanel
                data={ichimokuTechnical}
                interval={ichimokuInterval}
                onIntervalChange={setIchimokuInterval}
                loading={ichimokuLoading}
                onRefresh={() => void loadIchimoku(ichimokuInterval, true)}
                refreshing={isRefreshing("ichimoku") || ichimokuLoading}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div id="risk-zones" className="scroll-mt-24">
                <IndicatorSignalHeader signal={riskZonesSignal(riskZones)} />
                <RiskZonesPanel
                  data={riskZones}
                  onRefresh={() => void refreshRiskZonesOnly()}
                  refreshing={isRefreshing("riskZones")}
                />
              </div>
              <div id="fear-greed" className="scroll-mt-24">
                <IndicatorSignalHeader
                  signal={fearGreedSignal(fgValue, sentiment?.fear_greed?.classification)}
                />
                <FearGreedMeter
                  value={fgValue}
                  classification={sentiment?.fear_greed?.classification}
                  updatedAt={sentiment?.fear_greed?.timestamp ?? sentiment?.fetched_at}
                  history={sentiment?.fear_greed_history}
                  onRefresh={() => void refreshSentimentOnly()}
                  refreshing={isRefreshing("sentiment")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div id="heatmap" className="scroll-mt-24">
                <IndicatorSignalHeader signal={heatmapSignal(heatmap)} />
                <VolumeHeatmap
                  cells={heatmap}
                  referencePrice={price > 0 ? price : undefined}
                  exchange={heatmapExchange}
                  onExchangeChange={setHeatmapExchange}
                  loading={heatmapLoading}
                  collectedAt={heatmapCollectedAt ?? snapshot?.collected_at}
                  onRefresh={() => void loadHeatmap(heatmapExchange)}
                  refreshing={isRefreshing("heatmap")}
                />
              </div>
              {snapshot && (
                <div id="exchange-divergence" className="scroll-mt-24">
                  <IndicatorSignalHeader signal={exchangeSignal(snapshot.divergence_pct)} />
                  <ExchangeDivergence
                    tickers={snapshot.tickers}
                    divergence={snapshot.divergence_pct}
                    collectedAt={snapshot.collected_at}
                    onRefresh={() => void refreshSnapshotOnly()}
                    refreshing={isRefreshing("snapshot")}
                  />
                </div>
              )}
            </div>
            <div id="derivatives" className="scroll-mt-24">
              <IndicatorSignalHeader signal={coinglassSignal(sentiment?.coinglass ?? null)} />
              <CoinglassPanel
                data={sentiment?.coinglass ?? null}
                onRefresh={() => void refreshSentimentOnly()}
                refreshing={isRefreshing("sentiment")}
              />
            </div>
            <div id="long-short-ratio" className="scroll-mt-24">
              <IndicatorSignalHeader signal={longShortRatioSignal(sentiment?.coinglass ?? null)} />
              <LongShortRatioPanel
                data={sentiment?.coinglass ?? null}
                onRefresh={() => void refreshSentimentOnly()}
                refreshing={isRefreshing("sentiment")}
              />
            </div>
          </div>
        );

      case "context":
        return (
          <div className="space-y-6">
            <div id="usdt-dominance" className="scroll-mt-24">
              <IndicatorSignalHeader signal={usdtDominanceSignal(usdtDominance)} />
              <UsdtDominancePanel
                data={usdtDominance}
                onRefresh={() => void refreshMacroContextOnly()}
                refreshing={isRefreshing("macro")}
              />
            </div>
            <div>
              <IndicatorSignalHeader signal={equityMarketsSignal(macroContext?.equity_markets)} />
              <EquityMarketsPanel
                data={macroContext?.equity_markets}
                loading={macroLoading}
                onRefresh={() => void refreshMacroContextOnly()}
                refreshing={isRefreshing("macro")}
              />
            </div>
            <div id="macro-calendar" className="scroll-mt-24">
              <EconomicCalendarPanel
                data={macroEvents}
                loading={macroEventsLoading}
                onRefresh={() => void refreshMacroEventsOnly()}
                refreshing={isRefreshing("macroEvents")}
              />
            </div>
            <MacroContextPanel
              data={macroContextWithUsdt}
              loading={macroLoading}
              error={macroError}
              onRefresh={() => void refreshMacroContextOnly()}
              refreshing={isRefreshing("macro")}
            />
            {user && (
              <ResearchPanel userId={user.uid} items={researchItems} loading={researchLoading} />
            )}
          </div>
        );

      case "records":
        return (
          <div className="space-y-4">
            <section className="space-y-4">
              <header>
                <h3 className="font-japanese text-sm font-medium text-slate-300">シナリオ分析データ</h3>
                <p className="mt-1 font-japanese text-xs text-content-muted">
                  保存したシナリオの的中率と履歴です。
                </p>
              </header>
              {user && (
                <AccuracyPanel
                  data={accuracy}
                  loading={accuracyLoading}
                  savedRecords={savedRecords}
                  priceUpdatedAt={snapshot?.collected_at}
                  onRefresh={() => void refreshAccuracyOnly()}
                  refreshing={isRefreshing("accuracy")}
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
            </section>
            {user && (
              <JournalPanel userId={user.uid} entries={journalEntries} loading={journalLoading} />
            )}
          </div>
        );

      case "invite":
        return <InvitePanel userEmail={user?.email} />;

      case "support":
        return <SupportPanel userEmail={user?.email} />;

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
      showInviteNav={showInviteNav}
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
