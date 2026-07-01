import type { MacroStance } from "../../../types/scenario";

export const MACRO_STANCE_STYLE: Record<
  MacroStance,
  { text: string; color: string; bg: string }
> = {
  bullish: {
    text: "上昇支援",
    color: "text-accent-green",
    bg: "bg-accent-green/10 border-accent-green/30",
  },
  bearish: {
    text: "下落の症候",
    color: "text-accent-red",
    bg: "bg-accent-red/10 border-accent-red/30",
  },
  neutral: {
    text: "様子見",
    color: "text-accent-amber",
    bg: "bg-accent-amber/10 border-accent-amber/30",
  },
  reversal: {
    text: "トレンド転換の兆候",
    color: "text-accent-amber",
    bg: "bg-accent-amber/10 border-accent-amber/30",
  },
  caution: {
    text: "不安拡大",
    color: "text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/30",
  },
};

interface MacroSignalBadgeProps {
  signalJa: string;
  stance?: MacroStance;
}

export function MacroSignalBadge({ signalJa, stance = "neutral" }: MacroSignalBadgeProps) {
  const style = MACRO_STANCE_STYLE[stance] ?? MACRO_STANCE_STYLE.neutral;
  return (
    <span
      className={`inline-flex min-h-[28px] items-center rounded-full border px-2.5 py-0.5 font-japanese text-xs font-medium ${style.bg} ${style.color}`}
    >
      {signalJa || style.text}
    </span>
  );
}

export function MacroSummaryText({ summary }: { summary: string }) {
  if (!summary) return null;
  return (
    <p className="mt-3 font-japanese text-xs leading-relaxed text-content-muted">{summary}</p>
  );
}
