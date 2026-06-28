import type { JournalEntryInput } from "../types/journal";

export interface JournalTemplate {
  id: string;
  label: string;
  description: string;
  defaults: Pick<
    JournalEntryInput,
    "type" | "side" | "status" | "title" | "note" | "tags" | "reviewScore"
  >;
}

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: "swing-idea",
    label: "スイング検討",
    description: "AI シナリオをもとに短期スイングを検討",
    defaults: {
      type: "idea",
      side: "watch",
      status: null,
      title: "スイング検討",
      note: "【背景】\n\n【根拠】\n\n【懸念】\n",
      tags: ["スイング"],
      reviewScore: null,
    },
  },
  {
    id: "entry-log",
    label: "エントリー記録",
    description: "実際に入ったポジションの記録",
    defaults: {
      type: "entry",
      side: "long",
      status: "open",
      title: "エントリー記録",
      note: "【エントリー理由】\n\n【想定シナリオ】\n",
      tags: ["エントリー"],
      reviewScore: null,
    },
  },
  {
    id: "exit-review",
    label: "決済振り返り",
    description: "決済後の振り返りと教訓",
    defaults: {
      type: "review",
      side: "watch",
      status: "closed",
      title: "決済振り返り",
      note: "【結果】\n\n【良かった点】\n\n【改善点】\n",
      tags: ["振り返り"],
      reviewScore: 3,
    },
  },
  {
    id: "session-note",
    label: "時間帯メモ",
    description: "欧州・米国などセッション別の観察",
    defaults: {
      type: "idea",
      side: "watch",
      status: null,
      title: "時間帯メモ",
      note: "【セッション】\n\n【板・出来高】\n\n【気づき】\n",
      tags: ["セッション"],
      reviewScore: null,
    },
  },
];

export function getJournalTemplate(id: string): JournalTemplate | undefined {
  return JOURNAL_TEMPLATES.find((t) => t.id === id);
}
