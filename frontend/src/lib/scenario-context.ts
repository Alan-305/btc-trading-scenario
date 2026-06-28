import type { ResearchContextItem, ResearchItem } from "../types/research";

export function buildResearchContext(items: ResearchItem[]): ResearchContextItem[] {
  return items
    .filter(
      (item) =>
        item.status === "active" &&
        item.includeInAnalysis &&
        item.summaryLine.trim().length > 0,
    )
    .map((item) => ({
      title: item.title,
      summary_line: item.summaryLine,
      source_type: item.sourceType,
      tags: item.tags,
      market_context: item.marketContext,
    }));
}
