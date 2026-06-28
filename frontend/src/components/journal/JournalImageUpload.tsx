import { useRef } from "react";
import type { JournalImage } from "../../types/journal";
import {
  JOURNAL_IMAGE_MAX_COUNT,
  validateJournalImageFile,
} from "../../lib/journal-storage";

interface JournalImageUploadProps {
  existing: JournalImage[];
  pendingFiles: File[];
  pendingPreviews: string[];
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemoveExisting: (index: number) => void;
  onRemovePending: (index: number) => void;
  onError: (message: string) => void;
}

export function JournalImageUpload({
  existing,
  pendingFiles,
  pendingPreviews,
  disabled,
  onAdd,
  onRemoveExisting,
  onRemovePending,
  onError,
}: JournalImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const total = existing.length + pendingFiles.length;
  const canAdd = total < JOURNAL_IMAGE_MAX_COUNT;

  const handlePick = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next: File[] = [];
    for (const file of Array.from(fileList)) {
      if (total + next.length >= JOURNAL_IMAGE_MAX_COUNT) break;
      const err = validateJournalImageFile(file);
      if (err) {
        onError(err);
        continue;
      }
      next.push(file);
    }
    if (next.length) onAdd(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-xs text-slate-500">
        チャート画像（最大 {JOURNAL_IMAGE_MAX_COUNT} 枚・各 2MB 以下）
      </legend>
      <div className="flex flex-wrap gap-3">
        {existing.map((image, index) => (
          <div key={image.url} className="relative">
            <img
              src={image.url}
              alt={image.name}
              className="h-24 w-24 rounded-lg border border-surface-border object-cover"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemoveExisting(index)}
              className="absolute -right-2 -top-2 min-h-[28px] min-w-[28px] rounded-full bg-slate-900 px-2 text-xs text-red-300 shadow"
              aria-label="画像を削除"
            >
              ×
            </button>
          </div>
        ))}
        {pendingPreviews.map((preview, index) => (
          <div key={preview} className="relative">
            <img
              src={preview}
              alt={pendingFiles[index]?.name ?? "添付画像"}
              className="h-24 w-24 rounded-lg border border-surface-border object-cover"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemovePending(index)}
              className="absolute -right-2 -top-2 min-h-[28px] min-w-[28px] rounded-full bg-slate-900 px-2 text-xs text-red-300 shadow"
              aria-label="添付を取消"
            >
              ×
            </button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 min-h-[44px] items-center justify-center rounded-lg border border-dashed border-surface-border text-xs text-slate-500 hover:border-accent-blue hover:text-accent-blue"
          >
            + 画像
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />
    </fieldset>
  );
}
