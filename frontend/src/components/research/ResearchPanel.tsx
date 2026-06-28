import { useMemo, useState } from "react";
import type { ResearchItem, ResearchItemInput, ResearchListQuery, ResearchPreferences } from "../../types/research";
import { DEFAULT_RESEARCH_LIST_QUERY } from "../../types/research";
import {
  bulkDeleteResearchItems,
  bulkUpdateResearchItems,
  createResearchItem,
  deleteResearchItem,
  updateResearchItem,
} from "../../lib/firestore-research";
import {
  collectResearchTags,
  filterAndSortResearchItems,
  formatResearchWhen,
  loadResearchPreferences,
  RESEARCH_SOURCE_LABEL,
  saveResearchPreferences,
  staleResearchItems,
} from "../../lib/research-utils";
import { ResearchAddForm } from "./ResearchAddForm";
import { ExternalLink } from "../ui/ExternalLink";

interface ResearchPanelProps {
  userId: string;
  items: ResearchItem[];
  loading: boolean;
}

export function ResearchPanel({ userId, items, loading }: ResearchPanelProps) {
  const [preferences, setPreferences] = useState<ResearchPreferences>(loadResearchPreferences);
  const [query, setQuery] = useState<ResearchListQuery>(DEFAULT_RESEARCH_LIST_QUERY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ResearchItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => filterAndSortResearchItems(items, query), [items, query]);
  const allTags = useMemo(() => collectResearchTags(items), [items]);
  const staleCandidates = useMemo(
    () => staleResearchItems(items, preferences.staleDaysHint),
    [items, preferences.staleDaysHint],
  );
  const analysisCount = items.filter((i) => i.status === "active" && i.includeInAnalysis).length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((i) => i.id)));
  };

  const runBulk = async (action: "include" | "exclude" | "archive" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !window.confirm(`${ids.length} 件を削除しますか？`)) return;
    setSaving(true);
    setError(null);
    try {
      if (action === "delete") {
        await bulkDeleteResearchItems(userId, ids);
      } else {
        const patch =
          action === "include"
            ? { includeInAnalysis: true }
            : action === "exclude"
              ? { includeInAnalysis: false }
              : { status: "archived" as const };
        await bulkUpdateResearchItems(userId, ids, patch);
      }
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "一括操作に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (input: Omit<ResearchItemInput, "status">) => {
    setSaving(true);
    setError(null);
    try {
      await createResearchItem(userId, {
        ...input,
        status: "active",
      });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (input: Omit<ResearchItemInput, "status">) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateResearchItem(userId, editing.id, {
        ...input,
        status: editing.status,
      });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const toggleInclude = async (item: ResearchItem) => {
    try {
      await updateResearchItem(userId, item.id, {
        title: item.title,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        contentExcerpt: item.contentExcerpt,
        summaryLine: item.summaryLine,
        tags: item.tags,
        includeInAnalysis: !item.includeInAnalysis,
        status: item.status,
        marketContext: item.marketContext,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  };

  const savePrefs = (next: ResearchPreferences) => {
    setPreferences(next);
    saveResearchPreferences(next);
    setShowSettings(false);
  };

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-japanese text-sm font-medium text-slate-300">シナリオ分析データ</h2>
          <p className="mt-1 text-xs text-slate-500">
            記事・URL・YouTube などを要約1行で管理。分析に使うデータだけを ON にしてください。
          </p>
          <p className="mt-1 text-xs text-accent-blue">
            分析対象: {analysisCount} 件 / 全 {items.length} 件
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="min-h-[44px] rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-400"
          >
            設定
          </button>
          {!showForm && !editing && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="min-h-[44px] rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white"
            >
              データを追加
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="mb-4 rounded-lg border border-surface-border/60 bg-slate-900/30 p-4 text-sm">
          <h3 className="mb-3 text-xs font-medium text-slate-400">取捨選択の設定</h3>
          <label className="mb-3 flex min-h-[44px] items-center gap-2 text-slate-400">
            <input
              type="checkbox"
              checked={preferences.defaultIncludeInAnalysis}
              onChange={(e) =>
                savePrefs({ ...preferences, defaultIncludeInAnalysis: e.target.checked })
              }
            />
            新規データはデフォルトで「分析に使う」
          </label>
          <label className="mb-1 block text-xs text-slate-500">
            古いデータの目安（日数）— この期間より前を「整理候補」として表示
          </label>
          <select
            value={preferences.staleDaysHint}
            onChange={(e) =>
              savePrefs({ ...preferences, staleDaysHint: Number(e.target.value) })
            }
            className="min-h-[44px] rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} 日
              </option>
            ))}
          </select>
          {staleCandidates.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-200/80">
                整理候補 {staleCandidates.length} 件（{preferences.staleDaysHint}日以上前）
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSelected(new Set(staleCandidates.map((i) => i.id)));
                  setQuery((q) => ({ ...q, statusFilter: "active" }));
                }}
                className="text-xs text-accent-blue hover:underline"
              >
                候補を選択
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void runBulk("archive")}
                className="text-xs text-slate-400 hover:underline"
              >
                選択をアーカイブ
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {(showForm || editing) && (
        <div className="mb-4">
          <ResearchAddForm
            preferences={preferences}
            saving={saving}
            initial={editing}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={closeForm}
          />
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <input
          type="search"
          value={query.search}
          onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="キーワード検索"
          className="min-h-[44px] rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        />
        <select
          value={query.sourceType}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              sourceType: e.target.value as ResearchListQuery["sourceType"],
            }))
          }
          className="min-h-[44px] rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        >
          <option value="all">種類: すべて</option>
          {Object.entries(RESEARCH_SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={query.includeFilter}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              includeFilter: e.target.value as ResearchListQuery["includeFilter"],
            }))
          }
          className="min-h-[44px] rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        >
          <option value="all">分析: すべて</option>
          <option value="yes">分析 ON のみ</option>
          <option value="no">分析 OFF のみ</option>
        </select>
        <select
          value={query.statusFilter}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              statusFilter: e.target.value as ResearchListQuery["statusFilter"],
            }))
          }
          className="min-h-[44px] rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        >
          <option value="active">有効のみ</option>
          <option value="archived">アーカイブのみ</option>
          <option value="all">すべて</option>
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <select
          value={query.tag}
          onChange={(e) => setQuery((q) => ({ ...q, tag: e.target.value }))}
          className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 text-slate-300"
        >
          <option value="">タグ: すべて</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
        <select
          value={`${query.sortKey}-${query.sortDir}`}
          onChange={(e) => {
            const [sortKey, sortDir] = e.target.value.split("-") as [
              ResearchListQuery["sortKey"],
              ResearchListQuery["sortDir"],
            ];
            setQuery((q) => ({ ...q, sortKey, sortDir }));
          }}
          className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 text-slate-300"
        >
          <option value="createdAt-desc">新しい順</option>
          <option value="createdAt-asc">古い順</option>
          <option value="title-asc">タイトル A→Z</option>
          <option value="includeInAnalysis-desc">分析 ON 優先</option>
        </select>
        {selected.size > 0 && (
          <>
            <span className="text-slate-500">{selected.size} 件選択</span>
            <button type="button" onClick={() => void runBulk("include")} className="text-accent-green hover:underline">
              分析 ON
            </button>
            <button type="button" onClick={() => void runBulk("exclude")} className="text-slate-400 hover:underline">
              分析 OFF
            </button>
            <button type="button" onClick={() => void runBulk("archive")} className="text-slate-400 hover:underline">
              アーカイブ
            </button>
            <button type="button" onClick={() => void runBulk("delete")} className="text-red-300 hover:underline">
              削除
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">該当するデータがありません。</p>
      ) : (
        <ul className="space-y-2">
          <li className="flex items-center gap-2 px-2 text-[10px] text-slate-600">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAllVisible}
              aria-label="表示中をすべて選択"
            />
            要約1行（分析に使うかの判断基準）
          </li>
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-3 py-2 ${
                item.includeInAnalysis && item.status === "active"
                  ? "border-accent-blue/30 bg-accent-blue/5"
                  : "border-surface-border/60 bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-1"
                  aria-label={`${item.title} を選択`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-japanese text-xs font-medium text-slate-200">{item.title}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {RESEARCH_SOURCE_LABEL[item.sourceType]}
                    </span>
                    {item.status === "archived" && (
                      <span className="text-[10px] text-slate-500">アーカイブ</span>
                    )}
                    <span className="text-[10px] text-slate-600">{formatResearchWhen(item.createdAt)}</span>
                  </div>
                  <p className="font-japanese text-sm leading-relaxed text-slate-300">{item.summaryLine}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex min-h-[36px] cursor-pointer items-center gap-1 text-slate-400">
                      <input
                        type="checkbox"
                        checked={item.includeInAnalysis}
                        onChange={() => void toggleInclude(item)}
                      />
                      分析に使う
                    </label>
                    {item.sourceUrl && (
                      <ExternalLink href={item.sourceUrl}>元リンク</ExternalLink>
                    )}
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-slate-600">
                        #{tag}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setShowForm(false);
                      }}
                      className="min-h-[36px] text-accent-blue hover:underline"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteResearchItem(userId, item.id)}
                      className="text-slate-600 hover:text-red-300"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
