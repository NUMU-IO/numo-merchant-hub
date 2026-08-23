import { useId } from "react";
import { cn } from "@/lib/utils";
import { FUNNEL_COLORS } from "./chart-palette";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

interface Props {
  stages: FunnelStage[];
  /** Locale for the numbers (e.g. "ar-EG"). */
  locale?: string;
  /** Put the labels on the left (RTL). */
  rtl?: boolean;
  className?: string;
}


// Geometry (SVG user units). The funnel body sits in [0, BODY_W]; the
// label column takes the rest so long labels never squash the shape.
const VIEW_W = 560;
const VIEW_H = 250;
const BODY_W = 300;
const LABEL_GAP = 22;
const STAGE_GAP = 1.5;
/** A 0% stage still renders as a visible column (Zid does the same). */
const MIN_W = 0.22;

/**
 * Zid-style trapezoid funnel: each stage is a band whose top edge is as
 * wide as the stage's share of the first stage and whose bottom edge
 * narrows to the next stage's share, so the silhouette reads as one
 * continuous funnel. Labels sit beside the bands on leader lines.
 */
export function TrapezoidFunnel({ stages, locale, rtl = false, className }: Props) {
  const gradId = useId();
  const top = Math.max(stages[0]?.value ?? 0, 1);
  const n = stages.length;
  if (n === 0) return null;

  const share = (v: number) => Math.min(v / top, 1);
  const widthOf = (v: number) => (MIN_W + (1 - MIN_W) * share(v)) * BODY_W;
  const bandH = (VIEW_H - STAGE_GAP * (n - 1)) / n;
  const cx = BODY_W / 2;

  const bands = stages.map((s, i) => {
    const wTop = widthOf(s.value);
    const wBot = i < n - 1 ? widthOf(stages[i + 1].value) : wTop * 0.92;
    const y = i * (bandH + STAGE_GAP);
    const pts = [
      [cx - wTop / 2, y],
      [cx + wTop / 2, y],
      [cx + wBot / 2, y + bandH],
      [cx - wBot / 2, y + bandH],
    ]
      .map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`)
      .join(" ");
    const pct = i === 0 ? 100 : (s.value / top) * 100;
    // Leader starts at the band's outer edge at mid-height.
    const midW = (wTop + wBot) / 2;
    const edgeX = rtl ? cx - midW / 2 : cx + midW / 2;
    const labelX = rtl ? -LABEL_GAP : BODY_W + LABEL_GAP;
    return { ...s, pts, pct, y: y + bandH / 2, edgeX, labelX, color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] };
  });

  const fmtPct = (p: number) =>
    `${p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  // Mirror the whole drawing for RTL so the body hugs the right edge.
  const viewBox = rtl ? `${-(VIEW_W - BODY_W)} 0 ${VIEW_W} ${VIEW_H}` : `0 0 ${VIEW_W} ${VIEW_H}`;

  return (
    <svg
      viewBox={viewBox}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={stages.map((s) => `${s.label}: ${s.value}`).join(", ")}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {bands.map((b) => (
        <g key={b.key}>
          <polygon points={b.pts} fill={b.color} />
          <polygon points={b.pts} fill={`url(#${gradId})`} />
          <line
            x1={b.edgeX}
            y1={b.y}
            x2={rtl ? b.labelX + 6 : b.labelX - 6}
            y2={b.y}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
          <text
            x={b.labelX}
            y={b.y}
            dominantBaseline="middle"
            textAnchor={rtl ? "end" : "start"}
            className="fill-foreground"
            style={{ fontSize: 12.5, fontWeight: 600 }}
          >
            {b.label}: {fmtPct(b.pct)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default TrapezoidFunnel;
