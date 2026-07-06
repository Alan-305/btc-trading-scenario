import type { EntryGuide } from "../lib/entry-guide";
import type { PrimaryRecommendation } from "./scenario-branches";
import { PRIMARY_LABEL } from "./scenario-branches";

export interface EntryGuidePresentation {
  headline: string;
  subheadline?: string;
  badgeClass: string;
  showCautionStrip: boolean;
}

const PRIMARY_BADGE: Record<PrimaryRecommendation, string> = {
  bullish: "bg-accent-green/25 text-accent-green ring-1 ring-accent-green/40",
  bearish: "bg-accent-red/25 text-accent-red ring-1 ring-accent-red/40",
  watch: "bg-accent-amber/20 text-amber-200 ring-1 ring-accent-amber/40",
};

export function presentEntryGuide(
  guide: EntryGuide,
  primary: PrimaryRecommendation,
): EntryGuidePresentation {
  const primaryLabel = PRIMARY_LABEL[primary];

  if (primary === "watch") {
    return {
      headline: `${primaryLabel}（おすすめ）`,
      subheadline: guide.headline,
      badgeClass: PRIMARY_BADGE.watch,
      showCautionStrip: guide.status !== "neutral" && guide.status !== "watch",
    };
  }

  if (
    (primary === "bullish" || primary === "bearish") &&
    (guide.status === "htf_blocked" || guide.status === "wait_timing" || guide.status === "watch")
  ) {
    return {
      headline: `${primaryLabel}（おすすめ）`,
      subheadline: guide.headline,
      badgeClass: PRIMARY_BADGE[primary],
      showCautionStrip: true,
    };
  }

  if (primary === "bullish" && guide.status === "in_zone") {
    return {
      headline: guide.headline,
      badgeClass: "bg-accent-green/20 text-accent-green",
      showCautionStrip: false,
    };
  }

  if (primary === "bearish" && guide.status === "in_zone") {
    return {
      headline: guide.headline,
      badgeClass: "bg-accent-red/20 text-accent-red",
      showCautionStrip: false,
    };
  }

  const statusBadge: Record<string, string> = {
    in_zone: PRIMARY_BADGE[primary],
    wait_pullback: "bg-accent-amber/20 text-amber-200",
    wait_rally: "bg-accent-amber/20 text-amber-200",
    passed: "bg-surface-elevated text-content-primary",
    neutral: "bg-surface-elevated text-content-secondary",
    watch: "bg-surface-elevated text-content-secondary",
    htf_blocked: PRIMARY_BADGE[primary],
    near_tp: "bg-accent-green/20 text-accent-green",
    near_sl: "bg-accent-red/20 text-accent-red",
    trend_reversal: "bg-accent-amber/25 text-amber-100",
    wait_timing: PRIMARY_BADGE[primary],
  };

  return {
    headline: guide.headline,
    badgeClass: statusBadge[guide.status] ?? PRIMARY_BADGE[primary],
    showCautionStrip: guide.status === "htf_blocked" || guide.status === "trend_reversal",
  };
}

export const HERO_THEME: Record<
  PrimaryRecommendation,
  { border: string; ring: string; badge: string; title: string }
> = {
  bullish: {
    border: "border-accent-green/50",
    ring: "ring-accent-green/20",
    badge: "bg-accent-green/25 text-accent-green",
    title: "text-accent-green",
  },
  bearish: {
    border: "border-accent-red/50",
    ring: "ring-accent-red/20",
    badge: "bg-accent-red/25 text-accent-red",
    title: "text-accent-red",
  },
  watch: {
    border: "border-accent-amber/50",
    ring: "ring-accent-amber/20",
    badge: "bg-accent-amber/25 text-amber-200",
    title: "text-amber-200",
  },
};
