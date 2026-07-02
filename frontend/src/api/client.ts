import type {
  AccuracySummary,
  CandlesResponse,
  RiskZonesResponse,
  SavedPredictionInput,
  TechnicalAnalysis,
} from "../types/market";
import type { ResearchContextItem, ResearchSummarizeRequest, ResearchSummarizeResponse } from "../types/research";
import type {
  HeatmapExchange,
  HeatmapResponse,
  MacroContextSnapshot,
  MarketSnapshot,
  ScenarioResponse,
  SentimentIndicators,
} from "../types/scenario";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setApiAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

async function authHeaders(): Promise<HeadersInit> {
  if (!authTokenProvider) return {};
  const token = await authTokenProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(path: string, refresh = false): Promise<T> {
  const url = `${API_BASE}${path}${refresh ? (path.includes("?") ? "&" : "?") + "refresh=true" : ""}`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (res.status === 401) throw new Error("ログインが必要です。");
  if (res.status === 403) throw new Error("このアカウントは招待されていません。");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiErrorMessage(res: Response): Promise<string> {
  let detail = `API error: ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    /* ignore */
  }
  return detail;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("ログインが必要です。");
  if (res.status === 403) throw new Error("このアカウントは招待されていません。");
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  return res.json() as Promise<T>;
}

export const api = {
  getMarketSnapshot: (refresh = false) =>
    fetchJson<MarketSnapshot>("/api/v1/market/snapshot", refresh),
  getScenario: (refresh = false) =>
    fetchJson<ScenarioResponse>("/api/v1/scenario", refresh),
  buildScenario: (research: ResearchContextItem[] = []) =>
    postJson<ScenarioResponse>("/api/v1/scenario", { research }),
  getSentiment: () => fetchJson<SentimentIndicators>("/api/v1/indicators/sentiment"),
  getMacroContext: (refresh = false) =>
    fetchJson<MacroContextSnapshot>("/api/v1/indicators/macro", refresh),
  getMacroEvents: (days = 7, refresh = false) =>
    fetchJson<import("../types/macro-events").MacroEventsResponse>(
      `/api/v1/indicators/macro-events?days=${days}`,
      refresh,
    ),
  getHeatmap: (exchange: HeatmapExchange = "all") => {
    const q =
      exchange && exchange !== "all"
        ? `?exchange=${encodeURIComponent(exchange)}`
        : "";
    return fetchJson<HeatmapResponse>(
      `/api/v1/market/orderbook-heatmap${q}`,
    );
  },
  getMarketSessions: () =>
    fetchJson<import("../types/sessions").MarketSessionsResponse>("/api/v1/market/sessions"),
  getCandles: (interval = "4h", limit = 250, refresh = false) =>
    fetchJson<CandlesResponse>(
      `/api/v1/market/candles?interval=${interval}&limit=${limit}`,
      refresh,
    ),
  getTechnical: (interval = "4h", refresh = false) =>
    fetchJson<TechnicalAnalysis>(`/api/v1/market/technical?interval=${interval}`, refresh),
  getRiskZones: () => fetchJson<RiskZonesResponse>("/api/v1/market/risk-zones"),
  evaluatePredictions: (predictions: SavedPredictionInput[]) =>
    postJson<AccuracySummary>("/api/v1/scenario/evaluate", predictions),
  sendInvite: (email: string) =>
    postJson<{ email: string; message: string }>("/api/v1/invites", { email }),
  sendSupport: (body: { category: string; subject: string; message: string }) =>
    postJson<{ message: string }>("/api/v1/support", body),
  summarizeResearch: (body: ResearchSummarizeRequest) =>
    postJson<ResearchSummarizeResponse>("/api/v1/research/summarize", body),
  notifyPaperTradeFill: (body: import("../types/paper-trade").PaperTradeFillNotifyRequest) =>
    postJson<{ status: string }>("/api/v1/paper-trades/notify-fill", body),
};
