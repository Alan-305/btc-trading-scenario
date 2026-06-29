import type { HoldScenarioContext } from "../../types/scenario";

interface HoldScenarioPanelProps {
  context: HoldScenarioContext;
}

export function HoldScenarioPanel({ context }: HoldScenarioPanelProps) {
  return (
    <div className="mb-4 space-y-4 rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
      <div>
        <p className="font-japanese text-xs font-medium text-violet-200">サイクル位置</p>
        <p className="mt-1 font-japanese text-sm text-slate-200">{context.cycle_phase_ja}</p>
        <p className="mt-1 font-japanese text-[11px] text-content-muted">
          {context.last_halving_label}から {context.days_since_halving} 日 /
          {context.next_halving_label}まで約 {context.days_to_next_halving} 日
        </p>
        <p className="mt-1 font-japanese text-[11px] text-content-muted">{context.cycle_window_note_ja}</p>
      </div>

      <div>
        <p className="mb-2 font-japanese text-xs font-medium text-violet-200">積み増し候補（買い場）</p>
        <ul className="space-y-2">
          {context.buy_zones.map((zone) => (
            <li
              key={zone.label}
              className="rounded-lg border border-surface-border/60 bg-surface/40 px-3 py-2"
            >
              <p className="font-japanese text-xs font-medium text-slate-200">{zone.label}</p>
              <p className="font-english text-sm text-cyan-200">
                ${zone.zone_low.toLocaleString()} – ${zone.zone_high.toLocaleString()}
              </p>
              <p className="mt-1 font-japanese text-[10px] text-content-muted">{zone.rationale}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 font-japanese text-xs font-medium text-violet-200">
          参考上値（2028・2032半減期サイクル）
        </p>
        <ul className="space-y-2">
          {context.peak_targets.map((peak) => (
            <li
              key={peak.cycle_label}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
            >
              <p className="font-japanese text-xs font-medium text-emerald-100">{peak.cycle_label}</p>
              <p className="font-english text-sm text-emerald-200">
                ${peak.price_low.toLocaleString()} – ${peak.price_high.toLocaleString()}
              </p>
              <p className="font-japanese text-[10px] text-content-muted">{peak.peak_window}</p>
              <p className="mt-1 font-japanese text-[10px] text-content-muted">{peak.note_ja}</p>
            </li>
          ))}
        </ul>
      </div>

      {context.research_notes.length > 0 ? (
        <div>
          <p className="mb-1 font-japanese text-xs font-medium text-violet-200">独自調査メモ</p>
          <ul className="list-inside list-disc font-japanese text-[11px] text-content-muted">
            {context.research_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="font-japanese text-[10px] text-amber-100/80">
        ガチホでは損切りラインを表示しません。上記は半減期サイクルモデルに基づく参考値です。
      </p>
    </div>
  );
}
