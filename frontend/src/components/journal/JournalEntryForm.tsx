import { useEffect, useState } from "react";
import type { JournalEntry, JournalEntryInput, JournalImage, JournalLinkKind } from "../../types/journal";
import { JOURNAL_TEMPLATES, getJournalTemplate } from "../../lib/journal-templates";
import {
  JOURNAL_LINK_KIND_LABEL,
  JOURNAL_SIDE_LABEL,
  JOURNAL_STATUS_LABEL,
  JOURNAL_TYPE_LABEL,
  REVIEW_SCORE_LABEL,
  defaultStatusForType,
  isValidJournalUrl,
  normalizeTags,
  parseOptionalPrice,
  reviewFieldsVisible,
  sanitizeLinks,
  tradeFieldsRequired,
} from "../../lib/journal-utils";
import { JournalImageUpload } from "./JournalImageUpload";

const EMPTY_LINK = { label: "", url: "", kind: "chart" as JournalLinkKind };

interface JournalEntryFormProps {
  initial?: JournalEntry | null;
  saving: boolean;
  openEntries?: JournalEntry[];
  onSubmit: (input: JournalEntryInput, pendingImages: File[]) => void;
  onCancel: () => void;
}

function priceToInput(value: number | null): string {
  return value != null ? String(value) : "";
}

export function JournalEntryForm({
  initial,
  saving,
  openEntries = [],
  onSubmit,
  onCancel,
}: JournalEntryFormProps) {
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [type, setType] = useState<JournalEntryInput["type"]>(initial?.type ?? "idea");
  const [side, setSide] = useState<JournalEntryInput["side"]>(initial?.side ?? "watch");
  const [status, setStatus] = useState<JournalEntryInput["status"]>(
    initial?.status ?? defaultStatusForType(initial?.type ?? "idea"),
  );
  const [parentEntryId, setParentEntryId] = useState(initial?.parentEntryId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [tagsRaw, setTagsRaw] = useState(initial?.tags.join(", ") ?? "");
  const [reviewScore, setReviewScore] = useState<number | null>(initial?.reviewScore ?? null);
  const [reviewLesson, setReviewLesson] = useState(initial?.reviewLesson ?? "");
  const [entryPriceRaw, setEntryPriceRaw] = useState(priceToInput(initial?.entryPrice ?? null));
  const [exitPriceRaw, setExitPriceRaw] = useState(priceToInput(initial?.exitPrice ?? null));
  const [sizeRaw, setSizeRaw] = useState(priceToInput(initial?.size ?? null));
  const [plannedSlRaw, setPlannedSlRaw] = useState(priceToInput(initial?.plannedSl ?? null));
  const [plannedTpRaw, setPlannedTpRaw] = useState(priceToInput(initial?.plannedTp ?? null));
  const [existingImages, setExistingImages] = useState<JournalImage[]>(initial?.images ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [links, setLinks] = useState(
    initial?.links.length ? initial.links : [{ ...EMPTY_LINK }],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPreviews]);

  useEffect(() => {
    if (!tradeFieldsRequired(type)) {
      setStatus(null);
      return;
    }
    if (status == null) {
      setStatus(defaultStatusForType(type));
    }
  }, [type, status]);

  const applyTemplate = (id: string) => {
    if (!id) {
      setTemplateId("");
      return;
    }
    const template = getJournalTemplate(id);
    if (!template) return;
    setTemplateId(id);
    setType(template.defaults.type);
    setSide(template.defaults.side);
    setStatus(template.defaults.status ?? defaultStatusForType(template.defaults.type));
    setTitle(template.defaults.title);
    setNote(template.defaults.note);
    setTagsRaw(template.defaults.tags.join(", "));
    setReviewScore(template.defaults.reviewScore ?? null);
  };

  const handleTypeChange = (next: JournalEntryInput["type"]) => {
    setType(next);
    setStatus(defaultStatusForType(next));
  };

  const addPendingFiles = (files: File[]) => {
    const previews = files.map((file) => URL.createObjectURL(file));
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [...prev, ...previews]);
  };

  const removePending = (index: number) => {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("タイトルを入力してください");
      return;
    }

    const cleanedLinks = sanitizeLinks(links);
    const invalidLink = links.find((l) => l.url.trim() && !isValidJournalUrl(l.url));
    if (invalidLink) {
      setError("リンクは https:// で始まる URL を入力してください");
      return;
    }

    const entryPrice = parseOptionalPrice(entryPriceRaw);
    const exitPrice = parseOptionalPrice(exitPriceRaw);
    const size = parseOptionalPrice(sizeRaw);
    const plannedSl = parseOptionalPrice(plannedSlRaw);
    const plannedTp = parseOptionalPrice(plannedTpRaw);

    if (type === "entry" && side !== "watch" && entryPrice == null) {
      setError("エントリー種別では約定価格を入力してください");
      return;
    }
    if (type === "exit" && exitPrice == null) {
      setError("決済種別では決済価格を入力してください");
      return;
    }
    if (status === "closed" && type === "entry" && exitPrice == null) {
      setError("決済済みの場合は決済価格を入力してください");
      return;
    }

    setError(null);
    onSubmit(
      {
        templateId: templateId || null,
        type,
        side,
        status: tradeFieldsRequired(type) ? status : null,
        snapshotId: initial?.snapshotId ?? null,
        parentEntryId: type === "exit" && parentEntryId ? parentEntryId : null,
        title: trimmedTitle,
        note: note.trim(),
        links: cleanedLinks,
        tags: normalizeTags(tagsRaw),
        entryPrice,
        exitPrice,
        size,
        plannedSl,
        plannedTp,
        reviewScore,
        reviewLesson: reviewLesson.trim(),
        images: existingImages,
      },
      pendingFiles,
    );
  };

  const updateLink = (index: number, patch: Partial<(typeof links)[0]>) => {
    setLinks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const showTradeFields = tradeFieldsRequired(type) || initial?.entryPrice != null;
  const showReview = reviewFieldsVisible(type, status);

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-surface-border bg-slate-900/40 p-4">
      {!initial && (
        <div className="mb-4">
          <label htmlFor="journal-template" className="mb-1 block text-xs text-slate-500">
            テンプレート（任意）
          </label>
          <select
            id="journal-template"
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            <option value="">なし（白紙から）</option>
            {JOURNAL_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label} — {template.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="journal-type" className="mb-1 block text-xs text-slate-500">
            種類
          </label>
          <select
            id="journal-type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as JournalEntryInput["type"])}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            {Object.entries(JOURNAL_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="journal-side" className="mb-1 block text-xs text-slate-500">
            方向
          </label>
          <select
            id="journal-side"
            value={side ?? "watch"}
            onChange={(e) => setSide(e.target.value as JournalEntryInput["side"])}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          >
            {Object.entries(JOURNAL_SIDE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tradeFieldsRequired(type) && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="journal-status" className="mb-1 block text-xs text-slate-500">
              ポジション状態
            </label>
            <select
              id="journal-status"
              value={status ?? "open"}
              onChange={(e) => setStatus(e.target.value as JournalEntryInput["status"])}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            >
              {Object.entries(JOURNAL_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {type === "exit" && openEntries.length > 0 && (
            <div>
              <label htmlFor="journal-parent" className="mb-1 block text-xs text-slate-500">
                紐づくエントリー
              </label>
              <select
                id="journal-parent"
                value={parentEntryId}
                onChange={(e) => setParentEntryId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
              >
                <option value="">選択なし</option>
                {openEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {showTradeFields && (
        <fieldset className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-surface-border/60 p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs text-slate-500">約定・計画</legend>
          <div>
            <label htmlFor="journal-entry-price" className="mb-1 block text-xs text-slate-500">
              エントリー価格 (USD)
            </label>
            <input
              id="journal-entry-price"
              type="text"
              inputMode="decimal"
              value={entryPriceRaw}
              onChange={(e) => setEntryPriceRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="97000"
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            />
          </div>
          <div>
            <label htmlFor="journal-exit-price" className="mb-1 block text-xs text-slate-500">
              決済価格 (USD)
            </label>
            <input
              id="journal-exit-price"
              type="text"
              inputMode="decimal"
              value={exitPriceRaw}
              onChange={(e) => setExitPriceRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="99500"
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            />
          </div>
          <div>
            <label htmlFor="journal-sl" className="mb-1 block text-xs text-slate-500">
              計画 SL (USD)
            </label>
            <input
              id="journal-sl"
              type="text"
              inputMode="decimal"
              value={plannedSlRaw}
              onChange={(e) => setPlannedSlRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            />
          </div>
          <div>
            <label htmlFor="journal-tp" className="mb-1 block text-xs text-slate-500">
              計画 TP (USD)
            </label>
            <input
              id="journal-tp"
              type="text"
              inputMode="decimal"
              value={plannedTpRaw}
              onChange={(e) => setPlannedTpRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            />
          </div>
          <div>
            <label htmlFor="journal-size" className="mb-1 block text-xs text-slate-500">
              サイズ (BTC)
            </label>
            <input
              id="journal-size"
              type="text"
              inputMode="decimal"
              value={sizeRaw}
              onChange={(e) => setSizeRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="0.01"
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
            />
          </div>
        </fieldset>
      )}

      <div className="mb-3">
        <label htmlFor="journal-title" className="mb-1 block text-xs text-slate-500">
          タイトル
        </label>
        <input
          id="journal-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="例: 欧州時間ショート検討"
          className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="journal-note" className="mb-1 block text-xs text-slate-500">
          メモ
        </label>
        <textarea
          id="journal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={6}
          placeholder="判断理由、板の様子、気づきなど"
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm leading-relaxed text-slate-200"
        />
      </div>

      {showReview && (
        <fieldset className="mb-4 rounded-lg border border-surface-border/60 p-3">
          <legend className="px-1 text-xs text-slate-500">振り返り</legend>
          <p className="mb-3 text-[10px] text-slate-600">判断の質を 1〜5 で評価し、次に活かす教訓を1行で残します。</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setReviewScore(score)}
                className={`min-h-[44px] min-w-[44px] rounded-lg border px-3 text-sm ${
                  reviewScore === score
                    ? "border-accent-blue bg-accent-blue/20 text-accent-blue"
                    : "border-surface-border text-slate-400 hover:border-slate-500"
                }`}
                title={REVIEW_SCORE_LABEL[score]}
              >
                {score}
              </button>
            ))}
            {reviewScore != null && (
              <span className="self-center text-xs text-slate-500">{REVIEW_SCORE_LABEL[reviewScore]}</span>
            )}
          </div>
          <label htmlFor="journal-lesson" className="mb-1 block text-xs text-slate-500">
            教訓（1行）
          </label>
          <input
            id="journal-lesson"
            type="text"
            value={reviewLesson}
            onChange={(e) => setReviewLesson(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="例: TP を早めに取るべきだった"
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          />
        </fieldset>
      )}

      <JournalImageUpload
        existing={existingImages}
        pendingFiles={pendingFiles}
        pendingPreviews={pendingPreviews}
        disabled={saving}
        onAdd={addPendingFiles}
        onRemoveExisting={(index) =>
          setExistingImages((prev) => prev.filter((_, i) => i !== index))
        }
        onRemovePending={removePending}
        onError={setError}
      />

      <div className="mb-3">
        <label htmlFor="journal-tags" className="mb-1 block text-xs text-slate-500">
          タグ（カンマ区切り）
        </label>
        <input
          id="journal-tags"
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="欧州時間, ショート"
          className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
        />
      </div>

      <fieldset className="mb-4 space-y-2">
        <legend className="mb-2 text-xs text-slate-500">参考リンク</legend>
        {links.map((link, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-2 rounded-lg border border-surface-border/60 p-3 sm:grid-cols-12"
          >
            <select
              value={link.kind}
              onChange={(e) => updateLink(index, { kind: e.target.value as JournalLinkKind })}
              className="min-h-[40px] rounded-lg border border-surface-border bg-surface px-2 text-xs text-slate-200 sm:col-span-2"
              aria-label={`リンク種類 ${index + 1}`}
            >
              {Object.entries(JOURNAL_LINK_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={link.label}
              onChange={(e) => updateLink(index, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="表示名"
              className="min-h-[40px] rounded-lg border border-surface-border bg-surface px-2 text-sm text-slate-200 sm:col-span-3"
            />
            <input
              type="url"
              value={link.url}
              onChange={(e) => updateLink(index, { url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="https://..."
              className="min-h-[40px] rounded-lg border border-surface-border bg-surface px-2 text-sm text-slate-200 sm:col-span-6"
            />
            {links.length > 1 && (
              <button
                type="button"
                onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                className="min-h-[40px] text-xs text-slate-500 hover:text-red-300 sm:col-span-1"
              >
                削除
              </button>
            )}
          </div>
        ))}
        {links.length < 10 && (
          <button
            type="button"
            onClick={() => setLinks((prev) => [...prev, { ...EMPTY_LINK }])}
            className="text-xs text-accent-blue hover:underline"
          >
            + リンクを追加
          </button>
        )}
      </fieldset>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-lg bg-accent-blue px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? "保存中…" : initial ? "更新する" : "日誌に保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-lg border border-surface-border px-5 py-2 text-sm text-slate-400 hover:bg-slate-800"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
