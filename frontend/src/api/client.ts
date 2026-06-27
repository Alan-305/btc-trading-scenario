import type {
  AccuracySummary,
  CandlesResponse,
  RiskZonesResponse,
  SavedPredictionInput,
  TechnicalAnalysis,
} from "../types/market";
import type {
  HeatmapCell,
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  getMarketSnapshot: (refresh = false) =>
    fetchJson<MarketSnapshot>("/api/v1/market/snapshot", refresh),
  getScenario: (refresh = false) =>
    fetchJson<ScenarioResponse>("/api/v1/scenario", refresh),
  getSentiment: () => fetchJson<SentimentIndicators>("/api/v1/indicators/sentiment"),
  getHeatmap: () =>
    fetchJson<{ cells: HeatmapCell[] }>("/api/v1/market/orderbook-heatmap"),
  getMarketSessions: () =>
    fetchJson<import("../types/sessions").MarketSessionsResponse>("/api/v1/market/sessions"),
  getCandles: (interval = "4h", limit = 250) =>
    fetchJson<CandlesResponse>(`/api/v1/market/candles?interval=${interval}&limit=${limit}`),
  getTechnical: (interval = "4h") =>
    fetchJson<TechnicalAnalysis>(`/api/v1/market/technical?interval=${interval}`),
  getRiskZones: () => fetchJson<RiskZonesResponse>("/api/v1/market/risk-zones"),
  evaluatePredictions: (predictions: SavedPredictionInput[]) =>
    postJson<AccuracySummary>("/api/v1/scenario/evaluate", predictions),
};
