import type {
  HeatmapCell,
  MarketSnapshot,
  ScenarioResponse,
  SentimentIndicators,
} from "../types/scenario";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function fetchJson<T>(path: string, refresh = false): Promise<T> {
  const url = `${API_BASE}${path}${refresh ? (path.includes("?") ? "&" : "?") + "refresh=true" : ""}`;
  const res = await fetch(url);
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
};
