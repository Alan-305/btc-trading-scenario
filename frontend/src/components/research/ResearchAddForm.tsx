import { useState } from "react";
import { api } from "../../api/client";
import {
  MARKET_CONTEXT_OPTIONS,
  RESEARCH_SOURCE_LABEL,
  normalizeResearchTags,
} from "../../lib/research-utils";
import type { ResearchItem, ResearchPreferences, ResearchSourceType } from "../../types/research";

export type ResearchFormInput = {
  title: string;
  sourceType: ResearchSourceType;
  sourceUrl: string | null;
  contentExcerpt: string;
  summaryLine: string;
  tags: string[];
  includeInAnalysis: boolean;
  marketContext: string | null;
};

interface ResearchAddFormProps {
  preferences: ResearchPreferences;
  saving: boolean;
  initial?: ResearchItem | null;
  onSubmit: (input: ResearchFormInput) => Promise<void>;
  onCancel: () => void;
}

export function ResearchAddForm({
  preferences,
  saving,
  initial = null,
  onSubmit,
  onCancel,
}: ResearchAddFormProps) {
  const [sourceType, setSourceType] = useState<ResearchSourceType>(initial?.sourceType ?? "text");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.sourceUrl ?? "");
  const [content, setContent] = useState(initial?.contentExcerpt ?? "");
  const [tagsRaw, setTagsRaw] = useState(initial?.tags.join(", ") ?? "");
  const [marketContext, setMarketContext] = useState(initial?.marketContext ?? "");
  const [includeInAnalysis, setIncludeInAnalysis] = useState(
    initial?.includeInAnalysis ?? preferences.defaultIncludeInAnalysis,
  );
  const [summarizing, setSummarizing] = useState(false);
  const [summaryLine, setSummaryLine] = useState(initial?.summaryLine ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("タイトルを入力してください");
      return;
    }
    setSummarizing(true);
    setError(null);
    try {
      const result = await api.summarizeResearch({
        source_type: sourceType,
        title: trimmedTitle,
        content: content.trim() || null,
        url: url.trim() || null,
      });
      setSummaryLine(result.summary_line);
      if (!content.trim() && result.content_excerpt) {
        setContent(result.content_excerpt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "要約に失敗しました");
    } finally {
      setSummarizing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("タイトルを入力してください");
      return;
    }
    if (!summaryLine.trim()) {
      setError("「AI要約を生成」を実行するか、要約（箇条書き）を入力してください");
      return;
    }
    setError(null);
    await onSubmit({
      title: trimmedTitle,
      sourceType,
      sourceUrl: url.trim() || null,
      contentExcerpt: content.trim().slice(0, 500),
      summaryLine: summaryLine.trim().slice(0, 1200),
      tags: normalizeResearchTags(tagsRaw),
      includeInAnalysis,
      marketContext: marketContext || null,
    });
  };

  return (
    <form onSubmit={handleSave} className="rounded-lg border border-surface-border bg-slate-900/40 p-4">
      {initial && (
        <p className="mb-3 text-xs text-slate-500">
          登録済みデータの編集 — 内容を直して「AI要約を生成」を押せます
        </p>
      )}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="research-source-type" className="mb-1 block text-xs text-slate-500">
            種類
          </label>
          <select
            id="research-source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as ResearchSourceType)}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            {Object.entries(RESEARCH_SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="research-market-context" className="mb-1 block text-xs text-slate-500">
            想定トレンド（任意）
          </label>
          <select
            id="research-market-context"
            value={marketContext}
            onChange={(e) => setMarketContext(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            {MARKET_CONTEXT_OPTIONS.map((opt) => (
              <option key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="research-title" className="mb-1 block text-xs text-slate-500">
          タイトル
        </label>
        <input
          id="research-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        />
      </div>

      {sourceType !== "text" && (
        <div className="mb-3">
          <label htmlFor="research-url" className="mb-1 block text-xs text-slate-500">
            URL
          </label>
          <input
            id="research-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="https://..."
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          />
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="research-content" className="mb-1 block text-xs text-slate-500">
          {sourceType === "text" ? "本文" : "補足テキスト（任意・YouTube/PDF はここに貼り付け）"}
        </label>
        <textarea
          id="research-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSummarize()}
          disabled={summarizing || saving}
          className="min-h-[44px] rounded-lg border border-accent-blue/50 bg-accent-blue/10 px-4 py-2 text-sm text-accent-blue hover:bg-accent-blue/20 disabled:opacity-50"
        >
          {summarizing ? "要約中…" : "AI要約を生成"}
        </button>
        {sourceType === "youtube" && !content.trim() && (
          <p className="self-center text-xs text-slate-500">
            字幕・要点を補足テキストに貼ると要約精度が上がります
          </p>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="research-summary" className="mb-1 block text-xs text-slate-500">
          要約（箇条書き2〜10項目・最大1200文字）— シナリオ分析に渡す要点
        </label>
        <textarea
          id="research-summary"
          value={summaryLine}
          onChange={(e) => setSummaryLine(e.target.value.slice(0, 1200))}
          rows={8}
          placeholder={
            "例（情報量に応じて2〜10行）:\n・米金利低下観測でリスクオン寄り\n・BTCは高値圏で利確圧力に注意\n・半減期後の供給減は中長期で意識"
          }
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm leading-relaxed text-slate-200"
        />
        <p className="mt-1 text-xs text-slate-500">
          {summaryLine.split("\n").filter((l) => l.trim()).length} 行 / 最大10項目 · {summaryLine.length}/1200 文字
        </p>
      </div>

      <div className="mb-3">
        <label htmlFor="research-tags" className="mb-1 block text-xs text-slate-500">
          タグ
        </label>
        <input
          id="research-tags"
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        />
      </div>

      <label className="mb-4 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          checked={includeInAnalysis}
          onChange={(e) => setIncludeInAnalysis(e.target.checked)}
          className="h-4 w-4"
        />
        今後のシナリオ分析に使う
      </label>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-lg bg-accent-blue px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : initial ? "更新する" : "リストに追加"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-lg border border-surface-border px-5 py-2 text-sm text-slate-400"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
