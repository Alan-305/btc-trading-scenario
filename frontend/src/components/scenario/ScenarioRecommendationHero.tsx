import type {
  ScenarioHorizonBundle,
  ScenarioResponse,
  WatchScenario,
} from "../../types/scenario";
import {
  PRIMARY_LABEL,
  primaryRecommendation,
  resolveDirectionalScenario,
} from "../../lib/scenario-branches";
import { HERO_THEME } from "../../lib/scenario-presentation";
import { isHodlHorizon } from "../../lib/scenario-horizons";

interface ScenarioRecommendationHeroProps {
  scenario: ScenarioResponse;
  activeHorizon: ScenarioHorizonBundle | null;
  watch?: WatchScenario | null;
  entryBlocked?: boolean;
  entryCaution?: string | null;
}

function excerpt(text: string, maxLen = 160): string {
  const line = text.split(/\n/)[0]?.trim() ?? text.trim();
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen)}…`;
}

export function ScenarioRecommendationHero({
  scenario,
  activeHorizon,
  watch,
  entryBlocked = false,
  entryCaution,
}: ScenarioRecommendationHeroProps) {
  const primary = primaryRecommendation(scenario);
  const theme = HERO_THEME[primary];
  const label = PRIMARY_LABEL[primary];

  if (primary === "watch" && watch) {
    const low = Math.min(watch.range_low, watch.range_high);
    const high = Math.max(watch.range_low, watch.range_high);
    return (
      <section
        className={`scroll-mt-24 rounded-xl border bg-surface-card p-6 ring-1 ${theme.border} ${theme.ring}`}
        aria-labelledby="scenario-primary-heading"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 font-japanese text-[11px] font-medium ${theme.badge}`}
          >
            いまのおすすめ
          </span>
          <h2 id="scenario-primary-heading" className={`font-japanese text-xl font-semibold ${theme.title}`}>
            {label}
          </h2>
          <span className="font-japanese text-xs text-content-muted">
            信頼度 {(watch.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p className="font-japanese text-sm leading-relaxed text-slate-200">
          {excerpt(watch.scenario_text_ja, 220)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-japanese text-xs text-content-muted">想定レンジ</dt>
            <dd className="font-english text-slate-200">
              ${low.toLocaleString()} – ${high.toLocaleString()}
            </dd>
          </div>
          {watch.support != null ? (
            <div>
              <dt className="font-japanese text-xs text-content-muted">支持</dt>
              <dd className="font-english text-accent-red">${watch.support.toLocaleString()}</dd>
            </div>
          ) : null}
          {watch.resistance != null ? (
            <div>
              <dt className="font-japanese text-xs text-content-muted">抵抗</dt>
              <dd className="font-english text-accent-green">
                ${watch.resistance.toLocaleString()}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-japanese text-xs text-content-muted">エントリー</dt>
            <dd className="font-japanese text-slate-300">見送り推奨</dd>
          </div>
        </dl>
        <p className="mt-3 font-japanese text-xs text-content-muted">
          下の上昇・下落シナリオは参考です。レンジ内では新規エントリーを控えましょう。
        </p>
      </section>
    );
  }

  const directional = resolveDirectionalScenario(
    scenario,
    primary === "watch" ? "bullish" : primary,
  );
  const horizon = activeHorizon;
  const isHodl = horizon ? isHodlHorizon(horizon.id, horizon.horizon_mode) : false;
  const confidence = directional?.confidence ?? scenario.confidence;
  const entryLow = horizon
    ? Math.min(horizon.entry.zone_low, horizon.entry.zone_high)
    : null;
  const entryHigh = horizon
    ? Math.max(horizon.entry.zone_low, horizon.entry.zone_high)
    : null;

  return (
    <section
      className={`scroll-mt-24 rounded-xl border bg-surface-card p-6 ring-1 ${theme.border} ${theme.ring}`}
      aria-labelledby="scenario-primary-heading"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 font-japanese text-[11px] font-medium ${theme.badge}`}
        >
          いまのおすすめ
        </span>
        <h2 id="scenario-primary-heading" className={`font-japanese text-xl font-semibold ${theme.title}`}>
          {label}
        </h2>
        {horizon ? (
          <span className="font-japanese text-xs text-content-muted">{horizon.label}</span>
        ) : null}
        <span className="font-japanese text-xs text-content-muted">
          信頼度 {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      {entryBlocked ? (
        <div className="mb-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2">
          <p className="font-japanese text-xs leading-relaxed text-amber-100/90">
            <span className="font-medium text-amber-200">エントリー待機：</span>
            {entryCaution ??
              "上位足の方向が揃うまで、新規エントリーは見送りましょう。方針は上記のおすすめシナリオのとおりです。"}
          </p>
        </div>
      ) : null}

      {horizon ? (
        <p className="font-japanese text-sm leading-relaxed text-slate-200">
          {excerpt(horizon.scenario_text_ja, 220)}
        </p>
      ) : null}

      {entryLow != null && entryHigh != null && !isHodl ? (
        <p className="mt-3 font-japanese text-xs text-content-secondary">
          エントリー帯{" "}
          <span className="font-english text-slate-200">
            ${entryLow.toLocaleString()} – ${entryHigh.toLocaleString()}
          </span>
          （{horizon?.entry.side === "long" ? "ロング" : horizon?.entry.side === "short" ? "ショート" : "—"}）
        </p>
      ) : null}

      {scenario.watch ? (
        <p className="mt-3 font-japanese text-xs text-content-muted">
          様子見シナリオは下の参考欄で確認できます。
        </p>
      ) : null}
    </section>
  );
}
