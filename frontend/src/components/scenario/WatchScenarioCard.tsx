import type { WatchScenario } from "../../types/scenario";

interface WatchScenarioCardProps {
  watch: WatchScenario;
  isRecommended?: boolean;
}

export function WatchScenarioCard({ watch, isRecommended }: WatchScenarioCardProps) {
  const low = Math.min(watch.range_low, watch.range_high);
  const high = Math.max(watch.range_low, watch.range_high);

  return (
    <article className="rounded-xl border border-accent-amber/30 bg-surface-card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-100">様子見シナリオ</h2>
          {isRecommended ? (
            <span className="rounded-full bg-accent-amber/20 px-2 py-0.5 text-[10px] font-medium text-amber-200">
              いまのおすすめ
            </span>
          ) : null}
        </div>
        <span className="text-xs text-content-muted">
          信頼度: {(watch.confidence * 100).toFixed(0)}%
        </span>
      </header>

      <p className="whitespace-pre-wrap break-words font-japanese text-sm leading-relaxed text-slate-300">
        {watch.scenario_text_ja}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border/60 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-content-muted">想定レンジ</dt>
          <dd className="font-english text-slate-200">
            ${low.toLocaleString()} – ${high.toLocaleString()}
          </dd>
        </div>
        {watch.support != null ? (
          <div>
            <dt className="text-xs text-content-muted">支持（下抜け注意）</dt>
            <dd className="font-english text-accent-red">${watch.support.toLocaleString()}</dd>
          </div>
        ) : null}
        {watch.resistance != null ? (
          <div>
            <dt className="text-xs text-content-muted">抵抗（上抜け注目）</dt>
            <dd className="font-english text-accent-green">
              ${watch.resistance.toLocaleString()}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-content-muted">エントリー</dt>
          <dd className="text-slate-300">見送り推奨</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-content-muted">
        チャートは上昇・下落シナリオのタブで確認できます。レンジ内では新規エントリーを控えましょう。
      </p>
    </article>
  );
}
