export type ResearchSourceType = "text" | "url" | "youtube" | "pdf";
export type ResearchItemStatus = "active" | "archived";

export interface ResearchItem {
  id: string;
  title: string;
  sourceType: ResearchSourceType;
  sourceUrl: string | null;
  contentExcerpt: string;
  summaryLine: string;
  tags: string[];
  includeInAnalysis: boolean;
  status: ResearchItemStatus;
  marketContext: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ResearchItemInput {
  title: string;
  sourceType: ResearchSourceType;
  sourceUrl: string | null;
  contentExcerpt: string;
  summaryLine: string;
  tags: string[];
  includeInAnalysis: boolean;
  status: ResearchItemStatus;
  marketContext: string | null;
}

export interface ResearchPreferences {
  defaultIncludeInAnalysis: boolean;
  staleDaysHint: number;
}

export const DEFAULT_RESEARCH_PREFERENCES: ResearchPreferences = {
  defaultIncludeInAnalysis: true,
  staleDaysHint: 14,
};

export type ResearchSortKey = "createdAt" | "title" | "includeInAnalysis";
export type ResearchSortDir = "asc" | "desc";

export interface ResearchListQuery {
  search: string;
  sourceType: ResearchSourceType | "all";
  includeFilter: "all" | "yes" | "no";
  statusFilter: "active" | "archived" | "all";
  tag: string;
  sortKey: ResearchSortKey;
  sortDir: ResearchSortDir;
}

export const DEFAULT_RESEARCH_LIST_QUERY: ResearchListQuery = {
  search: "",
  sourceType: "all",
  includeFilter: "all",
  statusFilter: "active",
  tag: "",
  sortKey: "createdAt",
  sortDir: "desc",
};

export interface ResearchSummarizeRequest {
  source_type: ResearchSourceType;
  title: string;
  content?: string | null;
  url?: string | null;
}

export interface ResearchSummarizeResponse {
  summary_line: string;
  content_excerpt: string;
}

export interface ResearchContextItem {
  title: string;
  summary_line: string;
  source_type: string;
  tags: string[];
  market_context: string | null;
}
