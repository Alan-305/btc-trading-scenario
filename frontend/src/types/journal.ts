export type JournalEntryType = "idea" | "entry" | "exit" | "review";
export type JournalSide = "long" | "short" | "watch";
export type JournalLinkKind = "chart" | "research" | "data" | "other";
export type JournalTradeStatus = "open" | "closed" | "cancelled";

export interface JournalLink {
  label: string;
  url: string;
  kind: JournalLinkKind;
}

export interface JournalImage {
  url: string;
  name: string;
}

export interface JournalEntry {
  id: string;
  templateId: string | null;
  type: JournalEntryType;
  side: JournalSide | null;
  status: JournalTradeStatus | null;
  snapshotId: string | null;
  parentEntryId: string | null;
  title: string;
  note: string;
  links: JournalLink[];
  tags: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  size: number | null;
  plannedSl: number | null;
  plannedTp: number | null;
  reviewScore: number | null;
  reviewLesson: string;
  images: JournalImage[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface JournalEntryInput {
  templateId: string | null;
  type: JournalEntryType;
  side: JournalSide | null;
  status: JournalTradeStatus | null;
  snapshotId: string | null;
  parentEntryId: string | null;
  title: string;
  note: string;
  links: JournalLink[];
  tags: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  size: number | null;
  plannedSl: number | null;
  plannedTp: number | null;
  reviewScore: number | null;
  reviewLesson: string;
  images: JournalImage[];
}

/** Local file pending upload on save */
export interface PendingJournalImage {
  id: string;
  file: File;
  previewUrl: string;
}
