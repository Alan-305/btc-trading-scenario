import type { ResearchItem, ResearchListQuery, ResearchPreferences } from "../types/research";

export const RESEARCH_SOURCE_LABEL: Record<string, string> = {
  text: "テキスト",
  url: "URL",
  youtube: "YouTube",
  pdf: "PDF",
};

export const MARKET_CONTEXT_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "bullish", label: "上昇トレンド時" },
  { value: "bearish", label: "下降トレンド時" },
  { value: "range", label: "レンジ時" },
] as const;

export function normalizeResearchTags(raw: string): string[] {
  return [...new Set(raw.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

export function filterAndSortResearchItems(
  items: ResearchItem[],
  query: ResearchListQuery,
): ResearchItem[] {
  const search = query.search.trim().toLowerCase();
  let rows = items.filter((item) => {
    if (query.statusFilter !== "all" && item.status !== query.statusFilter) return false;
    if (query.sourceType !== "all" && item.sourceType !== query.sourceType) return false;
    if (query.includeFilter === "yes" && !item.includeInAnalysis) return false;
    if (query.includeFilter === "no" && item.includeInAnalysis) return false;
    if (query.tag && !item.tags.includes(query.tag)) return false;
    if (!search) return true;
    const haystack = [item.title, item.summaryLine, item.tags.join(" "), item.contentExcerpt]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  rows = [...rows].sort((a, b) => compareResearchItems(a, b, query.sortKey, query.sortDir));
  return rows;
}

function compareResearchItems(
  a: ResearchItem,
  b: ResearchItem,
  key: ResearchListQuery["sortKey"],
  dir: ResearchListQuery["sortDir"],
): number {
  let cmp = 0;
  if (key === "title") {
    cmp = a.title.localeCompare(b.title, "ja");
  } else if (key === "includeInAnalysis") {
    cmp = Number(a.includeInAnalysis) - Number(b.includeInAnalysis);
  } else {
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    cmp = at - bt;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function collectResearchTags(items: ResearchItem[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "ja"));
}

export function staleResearchItems(items: ResearchItem[], staleDays: number): ResearchItem[] {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  return items.filter(
    (item) =>
      item.status === "active" &&
      item.createdAt != null &&
      item.createdAt.getTime() < cutoff,
  );
}

export function loadResearchPreferences(): ResearchPreferences {
  try {
    const raw = localStorage.getItem("researchPreferences");
    if (!raw) return { defaultIncludeInAnalysis: true, staleDaysHint: 14 };
    return { defaultIncludeInAnalysis: true, staleDaysHint: 14, ...JSON.parse(raw) };
  } catch {
    return { defaultIncludeInAnalysis: true, staleDaysHint: 14 };
  }
}

export function saveResearchPreferences(prefs: ResearchPreferences): void {
  localStorage.setItem("researchPreferences", JSON.stringify(prefs));
}

export function formatResearchWhen(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
