import { useEffect, useMemo, useState } from "react";
import type { EntryZone, ExitStrategy, TradeSide } from "../../types/scenario";
import {
  computePositionSizing,
  formatBtcQty,
  formatUsd,
  loadPositionSizingPrefs,
  savePositionSizingPrefs,
  toCopyNumber,
  type EntryBasis,
  type PositionSizingInput,
} from "../../lib/position-sizing";

interface TradeLevelsCardProps {
  entry: EntryZone;
  exit: ExitStrategy;
}

const SIDE_LABEL: Record<TradeSide, { text: string; className: string }> = {
  long: { text: "ロング", className: "bg-accent-green/20 text-accent-green" },
  short: { text: "ショート", className: "bg-accent-red/20 text-accent-red" },
  neutral: { text: "中立", className: "bg-surface-hover text-content-muted" },
};

const ENTRY_BASIS_LABEL: Record<EntryBasis, string> = {
  low: "安値",
  mid: "中央",
  high: "高値",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // clipboard unavailable (e.g. non-secure context) — silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${label}をコピー`}
      title={`${label}をコピー`}
      className={`min-h-[32px] rounded-md px-2 py-1 text-[11px] font-medium transition ${
        copied
          ? "bg-accent-green/25 text-accent-green"
          : "border border-surface-border text-content-secondary hover:border-content-muted hover:text-slate-200"
      }`}
    >
      {copied ? "コピー済" : "コピー"}
    </button>
  );
}

interface LevelRowProps {
  label: string;
  display: string;
  copyValue: string;
  accent?: string;
}

function LevelRow({ label, display, copyValue, accent }: LevelRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-card px-3 py-2">
      <span className="text-xs text-content-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-english text-base tabular-nums ${accent ?? "text-slate-100"}`}>
          {display}
        </span>
        <CopyButton value={copyValue} label={label} />
      </div>
    </div>
  );
}

export function TradeLevelsCard({ entry, exit }: TradeLevelsCardProps) {
  const [prefs, setPrefs] = useState<PositionSizingInput>(() => loadPositionSizingPrefs());

  useEffect(() => {
    savePositionSizingPrefs(prefs);
  }, [prefs]);

  const sizing = useMemo(
    () => computePositionSizing(entry, exit, prefs),
    [entry, exit, prefs],
  );

  const sideMeta = SIDE_LABEL[entry.side];
  const priceFmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="mt-4 rounded-lg border border-surface-border bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-japanese text-sm font-medium text-slate-200">
          取引計画（レベル・数量）
        </h3>
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${sideMeta.className}`}>
          {sideMeta.text}
        </span>
      </div>

      <div className="space-y-1.5">
        <LevelRow
          label="エントリー安値"
          display={priceFmt(entry.zone_low)}
          copyValue={toCopyNumber(entry.zone_low)}
          accent="text-accent-blue"
        />
        <LevelRow
          label="エントリー高値"
          display={priceFmt(entry.zone_high)}
          copyValue={toCopyNumber(entry.zone_high)}
          accent="text-accent-blue"
        />
        {exit.take_profit.map((tp, i) => (
          <LevelRow
            key={`tp-${i}`}
            label={`TP${i + 1}（利確）`}
            display={priceFmt(tp)}
            copyValue={toCopyNumber(tp)}
            accent="text-accent-green"
          />
        ))}
        <LevelRow
          label="SL（損切り）"
          display={priceFmt(exit.stop_loss)}
          copyValue={toCopyNumber(exit.stop_loss)}
          accent="text-accent-red"
        />
      </div>

      {/* ポジションサイジング電卓 */}
      <div className="mt-4 border-t border-surface-border pt-4">
        <h4 className="mb-3 font-japanese text-sm font-medium text-slate-200">
          ポジションサイズ計算
        </h4>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-content-muted">口座残高（USD/USDT）</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={100}
              value={prefs.accountBalance || ""}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, accountBalance: Number(e.target.value) || 0 }))
              }
              className="min-h-[40px] rounded-md border border-surface-border bg-surface-card px-2 text-sm text-slate-100 focus:border-accent-blue focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-content-muted">リスク %（1トレード）</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={prefs.riskPct || ""}
              onChange={(e) => setPrefs((p) => ({ ...p, riskPct: Number(e.target.value) || 0 }))}
              className="min-h-[40px] rounded-md border border-surface-border bg-surface-card px-2 text-sm text-slate-100 focus:border-accent-blue focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-content-muted">エントリー基準</span>
            <select
              value={prefs.entryBasis}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, entryBasis: e.target.value as EntryBasis }))
              }
              className="min-h-[40px] rounded-md border border-surface-border bg-surface-card px-2 text-sm text-slate-100 focus:border-accent-blue focus:outline-none"
            >
              {(["low", "mid", "high"] as const).map((b) => (
                <option key={b} value={b}>
                  {ENTRY_BASIS_LABEL[b]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sizing.valid ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="建てる数量"
                value={`${formatBtcQty(sizing.positionSizeBtc)} BTC`}
                copyValue={toCopyNumber(sizing.positionSizeBtc, 6)}
                accent="text-slate-100"
              />
              <Stat
                label="想定建玉"
                value={formatUsd(sizing.positionNotionalUsd)}
                accent="text-slate-100"
              />
              <Stat
                label="許容損失（SL時）"
                value={`-${formatUsd(sizing.riskAmountUsd)}`}
                accent="text-accent-red"
              />
            </div>

            <div className="space-y-1.5">
              {sizing.takeProfits.map((tp) => (
                <div
                  key={`tp-row-${tp.index}`}
                  className="flex items-center justify-between rounded-md bg-surface-card px-3 py-2 text-xs"
                >
                  <span className="text-content-muted">
                    TP{tp.index + 1} @ {priceFmt(tp.price)} 到達時
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-english tabular-nums text-content-secondary">
                      R {tp.rMultiple.toFixed(2)}
                    </span>
                    <span className="font-english tabular-nums text-accent-green">
                      +{formatUsd(tp.rewardAmount)}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] leading-relaxed text-content-faint">
              リスク {prefs.riskPct}%（{formatUsd(sizing.riskAmountUsd)}）固定。エントリー
              {priceFmt(sizing.entryPrice)}・SL {priceFmt(sizing.stopLoss)} の値幅から数量を算出。
              レバレッジ・手数料・スリッページは含みません。
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-surface-card px-3 py-2 text-xs text-accent-amber">
            {sizing.invalidReason ?? "数量を計算できません。"}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  copyValue,
  accent,
}: {
  label: string;
  value: string;
  copyValue?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md bg-surface-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-content-muted">{label}</span>
        {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
      </div>
      <p className={`mt-1 font-english text-sm tabular-nums ${accent ?? "text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}
