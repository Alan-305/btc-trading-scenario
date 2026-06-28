import type { JournalLink, JournalLinkKind, JournalEntry, JournalTradeStatus } from "../types/journal";
import type { ScenarioResponse } from "../types/scenario";

const HTTPS = /^https:\/\/.+/i;

export function isValidJournalUrl(url: string): boolean {
  return HTTPS.test(url.trim());
}

export function normalizeTags(raw: string): string[] {
  return [...new Set(raw.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

export function sanitizeLinks(links: JournalLink[]): JournalLink[] {
  return links
    .map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
      kind: link.kind,
    }))
    .filter((link) => link.label && isValidJournalUrl(link.url))
    .slice(0, 10);
}

export const JOURNAL_TYPE_LABEL: Record<string, string> = {
  idea: "検討",
  entry: "エントリー",
  exit: "決済",
  review: "振り返り",
};

export const JOURNAL_SIDE_LABEL: Record<string, string> = {
  long: "ロング",
  short: "ショート",
  watch: "様子見",
};

export const JOURNAL_LINK_KIND_LABEL: Record<JournalLinkKind, string> = {
  chart: "チャート",
  research: "調査",
  data: "データ",
  other: "その他",
};

export function defaultJournalTitleFromScenario(scenario: ScenarioResponse): string {
  const trend =
    scenario.macro_trend === "bullish"
      ? "上昇寄り"
      : scenario.macro_trend === "bearish"
        ? "下降寄り"
        : "レンジ";
  const side =
    scenario.entry.side === "long"
      ? "ロング"
      : scenario.entry.side === "short"
        ? "ショート"
        : "様子見";
  return `${trend}・${side}のメモ`;
}

export const JOURNAL_STATUS_LABEL: Record<JournalTradeStatus, string> = {
  open: "保有中",
  closed: "決済済",
  cancelled: "取消",
};

export function parseOptionalPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function defaultStatusForType(type: JournalEntry["type"]): JournalTradeStatus | null {
  if (type === "entry") return "open";
  if (type === "exit") return "closed";
  return null;
}

/** 日誌で「実際にエントリーした」とマークされた AI 連携トレード */
export function isActualTrade(entry: JournalEntry): boolean {
  return (
    entry.snapshotId != null &&
    entry.type === "entry" &&
    entry.side !== "watch" &&
    entry.status !== "cancelled"
  );
}

export function computeTradePnlPct(entry: JournalEntry): number | null {
  if (entry.entryPrice == null || entry.exitPrice == null || entry.side == null) return null;
  if (entry.side === "watch") return null;
  const entryPx = entry.entryPrice;
  const exitPx = entry.exitPrice;
  if (entry.side === "long") return ((exitPx - entryPx) / entryPx) * 100;
  return ((entryPx - exitPx) / entryPx) * 100;
}

export function tradeFieldsRequired(type: JournalEntry["type"]): boolean {
  return type === "entry" || type === "exit";
}

export function reviewFieldsVisible(type: JournalEntry["type"], status: JournalEntry["status"]): boolean {
  return type === "review" || status === "closed";
}

export const REVIEW_SCORE_LABEL: Record<number, string> = {
  1: "要改善",
  2: "やや不満",
  3: "普通",
  4: "良い",
  5: "非常に良い",
};

export function formatReviewScore(score: number | null): string {
  if (score == null) return "—";
  return `${score} / 5（${REVIEW_SCORE_LABEL[score] ?? ""}）`;
}

export function sideFromScenario(scenario: ScenarioResponse): "long" | "short" | "watch" {
  if (scenario.entry.side === "long") return "long";
  if (scenario.entry.side === "short") return "short";
  return "watch";
}
