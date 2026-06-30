/** ISO文字列・Date を「最終更新」表示用に整形（日本時間） */
export function formatDataUpdatedAt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 複数の候補から最も新しい更新日時を返す */
export function latestUpdatedAt(
  ...candidates: (string | Date | null | undefined)[]
): string | null {
  let best: Date | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const d = c instanceof Date ? c : new Date(c);
    if (Number.isNaN(d.getTime())) continue;
    if (!best || d > best) best = d;
  }
  return best ? best.toISOString() : null;
}
