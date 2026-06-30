import { useEffect, useMemo, useRef, useState } from "react";
import type { PaperTrade, PaperTradePeriod } from "../../types/paper-trade";
import {
  closePaperTrade,
  deletePaperTrade,
  deletePaperTrades,
  updatePaperTradeFields,
  type PaperTradeEditableFields,
} from "../../lib/firestore-paper-trades";
import {
  filterPaperTradesByPeriod,
  isPaperTradeOpen,
  resolvePaperTradeExit,
  statusLabelJa,
  summarizePaperTrades,
  takeProfitTargetLabel,
  unrealizedPnlUsd,
} from "../../lib/paper-trade-math";
import { notifyPaperTradeFill } from "../../lib/paper-trade-notify";
import { formatBtcQty, formatUsd } from "../../lib/position-sizing";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { TakeProfitTargetPicker } from "./TakeProfitTargetPicker";

const PERIOD_OPTIONS: { id: PaperTradePeriod; label: string }[] = [
  { id: "today", label: "本日" },
  { id: "week", label: "7日" },
  { id: "month", label: "30日" },
  { id: "all", label: "すべて" },
];

interface PaperTradePanelProps {
  uid: string;
  trades: PaperTrade[];
  currentPrice: number;
}

function formatTs(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-surface-border/60 bg-surface-elevated/50 px-3 py-2">
      <p className="font-japanese text-[10px] text-content-muted">{label}</p>
      <p className={`mt-1 font-english text-sm tabular-nums ${accent ?? "text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}

interface PositionEditorProps {
  trade: PaperTrade;
  onSave: (fields: PaperTradeEditableFields) => void;
  onCancel: () => void;
}

function PositionEditor({ trade, onSave, onCancel }: PositionEditorProps) {
  const [fields, setFields] = useState<PaperTradeEditableFields>({
    entryPrice: trade.entryPrice,
    sizeBtc: trade.sizeBtc,
    stopLoss: trade.stopLoss,
    takeProfit1: trade.takeProfit1,
    takeProfit2: trade.takeProfit2,
    takeProfitTarget: trade.takeProfitTarget,
    label: trade.label,
  });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-surface-border bg-surface-card p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            ["entryPrice", "エントリー"],
            ["sizeBtc", "数量 BTC"],
            ["stopLoss", "SL"],
            ["takeProfit1", "TP1"],
            ["takeProfit2", "TP2"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[10px] text-content-muted">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              value={fields[key] ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === "" ? null : Number(raw);
                setFields((f) => ({
                  ...f,
                  [key]: parsed != null && Number.isFinite(parsed) ? parsed : null,
                }));
              }}
              className="min-h-[36px] rounded-md border border-surface-border bg-surface-elevated px-2 text-xs text-slate-100"
            />
          </label>
        ))}
      </div>
      <TakeProfitTargetPicker
        value={fields.takeProfitTarget}
        onChange={(takeProfitTarget) => setFields((f) => ({ ...f, takeProfitTarget }))}
        hasTp1={fields.takeProfit1 != null}
        hasTp2={fields.takeProfit2 != null}
        compact
      />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-content-muted">メモ</span>
        <input
          type="text"
          value={fields.label}
          onChange={(e) => setFields((f) => ({ ...f, label: e.target.value }))}
          className="min-h-[36px] rounded-md border border-surface-border bg-surface-elevated px-2 text-xs text-slate-100"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(fields)}
          className="min-h-[40px] rounded-lg bg-accent-blue px-3 py-2 text-xs font-medium text-white"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] rounded-lg border border-surface-border px-3 py-2 text-xs text-content-secondary"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

interface PositionCardProps {
  trade: PaperTrade;
  currentPrice: number;
  uid: string;
  bulkMode: boolean;
  selected: boolean;
  onSelectChange: (tradeId: string, selected: boolean) => void;
}

function PositionCard({
  trade,
  currentPrice,
  uid,
  bulkMode,
  selected,
  onSelectChange,
}: PositionCardProps) {
  const [editing, setEditing] = useState(false);
  const open = isPaperTradeOpen(trade);
  const uPnl = open ? unrealizedPnlUsd(trade, currentPrice) : 0;
  const rPnl = trade.realizedPnlUsd ?? 0;

  const handleSave = async (fields: PaperTradeEditableFields) => {
    await updatePaperTradeFields(uid, trade.id, fields);
    setEditing(false);
  };

  const handleManualClose = async () => {
    if (!currentPrice) return;
    await closePaperTrade(uid, trade.id, currentPrice, "closed_manual", trade);
  };

  const handleDelete = async () => {
    if (!window.confirm("この擬似ポジションを削除しますか？")) return;
    await deletePaperTrade(uid, trade.id);
  };

  return (
    <li
      className={`rounded-lg border p-3 transition ${
        bulkMode && selected
          ? "border-accent-blue/60 bg-accent-blue/10"
          : "border-surface-border/70 bg-surface-elevated/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {bulkMode ? (
            <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelectChange(trade.id, e.target.checked)}
                className="h-4 w-4 rounded border-surface-border accent-accent-blue"
                aria-label={`${trade.side === "long" ? "ロング" : "ショート"}を選択`}
              />
            </label>
          ) : null}
          <div className="min-w-0">
            <p className="font-japanese text-xs font-medium text-slate-200">
              {trade.side === "long" ? "ロング" : "ショート"}
              <span className="mx-2 text-content-muted">·</span>
              {statusLabelJa(trade.status)}
            </p>
            <p className="mt-1 font-japanese text-[10px] text-content-muted">
              建玉 {formatTs(trade.openedAt)}
              {trade.closedAt ? ` → 決済 ${formatTs(trade.closedAt)}` : ""}
              {open ? (
                <span className="ml-2 text-content-secondary">
                  自動利確: {takeProfitTargetLabel(trade.takeProfitTarget)}
                </span>
              ) : null}
            </p>
            {trade.label ? (
              <p className="mt-1 font-japanese text-[10px] text-content-secondary">{trade.label}</p>
            ) : null}
          </div>
        </div>
        <p
          className={`font-english text-sm tabular-nums ${
            (open ? uPnl : rPnl) >= 0 ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {open ? formatUsd(uPnl) : formatUsd(rPnl)}
          {open ? <span className="ml-1 text-[10px] text-content-muted">含み</span> : null}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-japanese text-[10px] text-content-muted sm:grid-cols-3">
        <div>
          エントリー <span className="font-english text-slate-300">${trade.entryPrice.toLocaleString()}</span>
        </div>
        <div>
          数量 <span className="font-english text-slate-300">{formatBtcQty(trade.sizeBtc)} BTC</span>
        </div>
        <div>
          SL <span className="font-english text-accent-red">${trade.stopLoss.toLocaleString()}</span>
        </div>
        {trade.takeProfit1 != null ? (
          <div>
            TP1{" "}
            <span className="font-english text-accent-green">
              ${trade.takeProfit1.toLocaleString()}
            </span>
          </div>
        ) : null}
        {trade.takeProfit2 != null ? (
          <div>
            TP2{" "}
            <span className="font-english text-accent-green">
              ${trade.takeProfit2.toLocaleString()}
            </span>
          </div>
        ) : null}
        {trade.exitPrice != null ? (
          <div>
            決済 <span className="font-english text-slate-300">${trade.exitPrice.toLocaleString()}</span>
          </div>
        ) : null}
      </dl>

      {editing ? (
        <PositionEditor trade={trade} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : bulkMode ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {open ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-[40px] rounded-lg border border-surface-border px-3 py-2 text-xs text-content-secondary hover:text-slate-200"
              >
                編集
              </button>
              <button
                type="button"
                onClick={handleManualClose}
                className="min-h-[40px] rounded-lg border border-accent-amber/40 px-3 py-2 text-xs text-amber-200"
              >
                いまの価格で決済
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            className="min-h-[40px] rounded-lg border border-accent-red/30 px-3 py-2 text-xs text-accent-red"
          >
            削除
          </button>
        </div>
      )}
    </li>
  );
}

interface PositionListProps {
  trades: PaperTrade[];
  currentPrice: number;
  uid: string;
  bulkMode: boolean;
  selectedIds: Set<string>;
  onSelectChange: (tradeId: string, selected: boolean) => void;
  emptyMessage: string;
}

function PositionList({
  trades,
  currentPrice,
  uid,
  bulkMode,
  selectedIds,
  onSelectChange,
  emptyMessage,
}: PositionListProps) {
  if (trades.length === 0) {
    return <p className="font-japanese text-xs text-content-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {trades.map((t) => (
        <PositionCard
          key={t.id}
          trade={t}
          currentPrice={currentPrice}
          uid={uid}
          bulkMode={bulkMode}
          selected={selectedIds.has(t.id)}
          onSelectChange={onSelectChange}
        />
      ))}
    </ul>
  );
}

export function PaperTradePanel({
  uid,
  trades,
  currentPrice,
}: PaperTradePanelProps) {
  const [period, setPeriod] = useState<PaperTradePeriod>("month");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const resolvingRef = useRef<Set<string>>(new Set());

  const periodTrades = useMemo(
    () => filterPaperTradesByPeriod(trades, period),
    [trades, period],
  );
  const stats = useMemo(() => summarizePaperTrades(periodTrades), [periodTrades]);
  const openTrades = useMemo(() => trades.filter(isPaperTradeOpen), [trades]);
  const closedTrades = useMemo(
    () => periodTrades.filter((t) => !isPaperTradeOpen(t)),
    [periodTrades],
  );
  const bulkTargetTrades = useMemo(
    () => [...openTrades, ...closedTrades],
    [openTrades, closedTrades],
  );
  const selectedCount = selectedIds.size;

  const handleSelectChange = (tradeId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(tradeId);
      else next.delete(tradeId);
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(bulkTargetTrades.map((t) => t.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    if (!window.confirm(`選択した ${selectedCount} 件の擬似ポジションを削除しますか？`)) return;

    setBulkDeleting(true);
    try {
      await deletePaperTrades(uid, [...selectedIds]);
      exitBulkMode();
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    if (!bulkMode) return;
    setSelectedIds((prev) => {
      const visible = new Set(bulkTargetTrades.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [bulkMode, bulkTargetTrades]);

  useEffect(() => {
    if (currentPrice <= 0 || openTrades.length === 0) return;

    for (const trade of openTrades) {
      if (resolvingRef.current.has(trade.id)) continue;
      const resolution = resolvePaperTradeExit(trade, currentPrice);
      if (!resolution) continue;

      resolvingRef.current.add(trade.id);
      const { exitPrice, status } = resolution;
      void closePaperTrade(uid, trade.id, exitPrice, status, trade)
        .then(() => notifyPaperTradeFill(trade, exitPrice, status))
        .finally(() => {
          resolvingRef.current.delete(trade.id);
        });
    }
  }, [currentPrice, openTrades, uid]);

  const summaryText = `オープン ${stats.openCount} · 勝率 ${
    stats.winRatePct != null ? `${stats.winRatePct}%` : "—"
  } · 損益 ${formatUsd(stats.totalRealizedPnlUsd)}`;

  return (
    <CollapsibleSection
      title="擬似トレード"
      summary={summaryText}
      storageKey="paperTradePanelOpen"
      defaultOpen
    >
      <p className="mb-4 font-japanese text-xs leading-relaxed text-content-muted">
        取引計画の「仮想エントリー」でポジションを記録します。選択した TP1 / TP2 または SL で自動決済し、約定時にログイン中のメールへ通知します。実際の取引所注文は行いません。
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`min-h-[40px] rounded-lg px-3 py-2 text-xs font-medium ${
              period === p.id
                ? "bg-accent-blue text-white"
                : "border border-surface-border text-content-secondary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox
          label="勝率（決済済み）"
          value={stats.winRatePct != null ? `${stats.winRatePct}%` : "—"}
          accent="text-accent-blue"
        />
        <StatBox
          label="勝ち / 負け"
          value={`${stats.winCount} / ${stats.lossCount}`}
        />
        <StatBox
          label="期間損益"
          value={formatUsd(stats.totalRealizedPnlUsd)}
          accent={stats.totalRealizedPnlUsd >= 0 ? "text-accent-green" : "text-accent-red"}
        />
        <StatBox label="決済数" value={String(stats.closedCount)} />
      </div>

      {trades.length > 0 ? (
        <div className="mb-4 rounded-lg border border-surface-border/70 bg-surface-elevated/30 p-3">
          {!bulkMode ? (
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className="min-h-[44px] rounded-lg border border-surface-border px-4 py-2 font-japanese text-xs text-content-secondary hover:text-slate-200"
            >
              一括選択して削除
            </button>
          ) : (
            <div className="space-y-3">
              <p className="font-japanese text-xs text-content-muted">
                削除するポジションにチェックを入れてください（オープン・決済済みの両方）。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  disabled={bulkDeleting || bulkTargetTrades.length === 0}
                  className="min-h-[44px] rounded-lg border border-surface-border px-3 py-2 text-xs text-content-secondary disabled:opacity-50"
                >
                  表示中をすべて選択（{bulkTargetTrades.length}）
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={bulkDeleting || selectedCount === 0}
                  className="min-h-[44px] rounded-lg border border-surface-border px-3 py-2 text-xs text-content-secondary disabled:opacity-50"
                >
                  選択解除
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkDeleting || selectedCount === 0}
                  className="min-h-[44px] rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs font-medium text-accent-red disabled:opacity-50"
                >
                  {bulkDeleting ? "削除中…" : `選択を削除（${selectedCount}）`}
                </button>
                <button
                  type="button"
                  onClick={exitBulkMode}
                  disabled={bulkDeleting}
                  className="min-h-[44px] rounded-lg px-3 py-2 text-xs text-content-muted disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <CollapsibleSection
        title={`オープンポジション（${openTrades.length}）`}
        defaultOpen
        storageKey="paperTradeOpenList"
        className="mb-4 border-surface-border/60 bg-transparent"
      >
        <PositionList
          trades={openTrades}
          currentPrice={currentPrice}
          uid={uid}
          bulkMode={bulkMode}
          selectedIds={selectedIds}
          onSelectChange={handleSelectChange}
          emptyMessage="オープン中の擬似ポジションはありません。取引計画から「仮想エントリー」を押してください。"
        />
      </CollapsibleSection>

      <CollapsibleSection
        title={`決済済み（${closedTrades.length}）`}
        defaultOpen={false}
        storageKey="paperTradeClosedList"
        className="border-surface-border/60 bg-transparent"
      >
        <PositionList
          trades={closedTrades}
          currentPrice={currentPrice}
          uid={uid}
          bulkMode={bulkMode}
          selectedIds={selectedIds}
          onSelectChange={handleSelectChange}
          emptyMessage="この期間の決済履歴はありません。"
        />
      </CollapsibleSection>
    </CollapsibleSection>
  );
}
