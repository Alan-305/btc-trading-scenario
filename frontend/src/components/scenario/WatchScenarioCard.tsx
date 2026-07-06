import type { WatchScenario } from "../../types/scenario";

interface WatchScenarioCardProps {
  watch: WatchScenario;
  /** いまのおすすめが様子見のときはヒーローに統合するため非表示 */
  hidden?: boolean;
}

export function WatchScenarioCard({ watch, hidden = false }: WatchScenarioCardProps) {
  if (hidden) return null;

  const low = Math.min(watch.range_low, watch.range_high);
  const high = Math.max(watch.range_low, watch.range_high);

  return (
    <article
      id="watch-scenario"
      className="scroll-mt-24 rounded-xl border border-surface-border/70 bg-surface-card/80 p-4 opacity-90"
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-japanese text-sm font-medium text-content-secondary">
            参考：様子見シナリオ
          </h2>
        </div>
        <span className="font-japanese text-xs text-content-muted">
          信頼度 {(watch.confidence * 100).toFixed(0)}%
        </span>
      </header>

      <p className="whitespace-pre-wrap break-words font-japanese text-xs leading-relaxed text-content-muted">
        {watch.scenario_text_ja}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-surface-border/50 pt-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="font-japanese text-content-muted">想定レンジ</dt>
          <dd className="font-english text-content-secondary">
            ${low.toLocaleString()} – ${high.toLocaleString()}
          </dd>
        </div>
        {watch.support != null ? (
          <div>
            <dt className="font-japanese text-content-muted">支持</dt>
            <dd className="font-english text-accent-red/80">${watch.support.toLocaleString()}</dd>
          </div>
        ) : null}
        {watch.resistance != null ? (
          <div>
            <dt className="font-japanese text-content-muted">抵抗</dt>
            <dd className="font-english text-accent-green/80">
              ${watch.resistance.toLocaleString()}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-japanese text-content-muted">エントリー</dt>
          <dd className="font-japanese text-content-muted">見送り推奨</dd>
        </div>
      </dl>
    </article>
  );
}
