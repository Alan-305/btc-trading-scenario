import { useState } from "react";
import type { JournalEntry, JournalEntryInput } from "../../types/journal";
import {
  createJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
} from "../../lib/firestore-journal";
import {
  deleteJournalImages,
  deleteRemovedJournalImages,
  uploadJournalImages,
} from "../../lib/journal-storage";
import { JournalEntryCard } from "./JournalEntryCard";
import { JournalEntryForm } from "./JournalEntryForm";

interface JournalPanelProps {
  userId: string;
  entries: JournalEntry[];
  loading: boolean;
}

function entryToInput(entry: JournalEntry): JournalEntryInput {
  return {
    templateId: entry.templateId,
    type: entry.type,
    side: entry.side,
    status: entry.status,
    snapshotId: entry.snapshotId,
    parentEntryId: entry.parentEntryId,
    title: entry.title,
    note: entry.note,
    links: entry.links,
    tags: entry.tags,
    entryPrice: entry.entryPrice,
    exitPrice: entry.exitPrice,
    size: entry.size,
    plannedSl: entry.plannedSl,
    plannedTp: entry.plannedTp,
    reviewScore: entry.reviewScore,
    reviewLesson: entry.reviewLesson,
    images: entry.images,
  };
}

export function JournalPanel({ userId, entries, loading }: JournalPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  const openEntries = entries.filter((e) => e.type === "entry" && e.status === "open");

  const syncParentOnExit = async (input: JournalEntryInput) => {
    if (input.type !== "exit" || !input.parentEntryId || input.exitPrice == null) return;
    const parent = entries.find((e) => e.id === input.parentEntryId);
    if (!parent) return;
    await updateJournalEntry(userId, parent.id, {
      ...entryToInput(parent),
      status: "closed",
      exitPrice: input.exitPrice,
    });
  };

  const persistImages = async (
    entryId: string,
    input: JournalEntryInput,
    pendingImages: File[],
    previousImages: JournalEntry["images"],
  ): Promise<JournalEntryInput> => {
    if (editing) {
      await deleteRemovedJournalImages(userId, entryId, previousImages, input.images);
    }
    if (pendingImages.length === 0) return input;
    const uploaded = await uploadJournalImages(userId, entryId, pendingImages);
    return { ...input, images: [...input.images, ...uploaded] };
  };

  const handleCreate = async (input: JournalEntryInput, pendingImages: File[]) => {
    setSaving(true);
    setError(null);
    try {
      const entryId = await createJournalEntry(userId, { ...input, images: [] });
      const withImages = await persistImages(entryId, input, pendingImages, []);
      if (withImages.images.length > 0 || input.images.length > 0) {
        await updateJournalEntry(userId, entryId, withImages);
      }
      await syncParentOnExit(withImages);
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (input: JournalEntryInput, pendingImages: File[]) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const withImages = await persistImages(editing.id, input, pendingImages, editing.images);
      await updateJournalEntry(userId, editing.id, {
        ...withImages,
        snapshotId: editing.snapshotId,
      });
      await syncParentOnExit(withImages);
      setEditing(null);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsTrade = async (entry: JournalEntry) => {
    setSaving(true);
    setError(null);
    try {
      await updateJournalEntry(userId, entry.id, {
        ...entryToInput(entry),
        type: "entry",
        status: "open",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!window.confirm(`「${entry.title}」を削除しますか？`)) return;
    try {
      if (entry.images.length > 0) {
        await deleteJournalImages(userId, entry.id, entry.images);
      }
      await deleteJournalEntry(userId, entry.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-japanese text-sm font-medium text-slate-300">トレード日誌</h2>
          <p className="mt-1 text-xs text-slate-500">
            テンプレート・振り返り・チャート画像（直近90日・最大100件）
          </p>
        </div>
        {!showForm && !editing && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="min-h-[44px] rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            新規メモ
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {(showForm || editing) && (
        <div className="mb-4">
          <JournalEntryForm
            initial={editing}
            saving={saving}
            openEntries={openEntries}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">
          まだ日誌がありません。「新規メモ」またはシナリオ保存時の「日誌にも記録」で追加できます。
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <JournalEntryCard
                entry={entry}
                onEdit={() => {
                  setEditing(entry);
                  setShowForm(false);
                }}
                onDelete={() => void handleDelete(entry)}
                onMarkAsTrade={() => void handleMarkAsTrade(entry)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
