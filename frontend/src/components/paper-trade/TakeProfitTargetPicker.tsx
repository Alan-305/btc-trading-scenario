import type { PaperTradeTakeProfitTarget } from "../../types/paper-trade";

interface TakeProfitTargetPickerProps {
  value: PaperTradeTakeProfitTarget;
  onChange: (value: PaperTradeTakeProfitTarget) => void;
  hasTp1: boolean;
  hasTp2: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function TakeProfitTargetPicker({
  value,
  onChange,
  hasTp1,
  hasTp2,
  disabled = false,
  compact = false,
}: TakeProfitTargetPickerProps) {
  const options: { id: PaperTradeTakeProfitTarget; label: string; enabled: boolean }[] = [
    { id: "tp1", label: "TP1で利確", enabled: hasTp1 },
    { id: "tp2", label: "TP2で利確", enabled: hasTp2 },
  ];

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {!compact ? (
        <p className="font-japanese text-[11px] text-content-muted">自動決済の利確ライン</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled || !opt.enabled}
            onClick={() => onChange(opt.id)}
            className={`min-h-[40px] rounded-lg px-3 py-2 text-xs font-medium transition ${
              value === opt.id
                ? "bg-accent-green/25 text-accent-green"
                : "border border-surface-border text-content-secondary"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {!hasTp2 ? (
        <p className="font-japanese text-[10px] text-content-faint">TP2 が未設定のため TP1 のみ選択できます。</p>
      ) : null}
    </div>
  );
}
