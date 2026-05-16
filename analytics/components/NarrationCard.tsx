"use client";

import type { NarrationResponse } from "@/lib/types";

type Props = {
  narration: NarrationResponse;
};

const TREND_ICON = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

const TREND_COLOR = {
  up: "text-emerald-400",
  down: "text-red-400",
  neutral: "text-zinc-400",
};

export function NarrationCard({ narration }: Props) {
  return (
    <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-xl p-5 flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
        AI
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${TREND_COLOR[narration.trend]}`}>
            {TREND_ICON[narration.trend]} {narration.headline}
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{narration.summary}</p>
        <p className="text-xs text-zinc-600 mt-2">
          Narrated by Gemini · {new Date(narration.generated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
