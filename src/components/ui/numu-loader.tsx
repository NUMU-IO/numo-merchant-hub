/**
 * NumuLoader — the brand mark as a loading state.
 *
 * The N is a CSS mask (see `.numu-mark` in index.css), so the fill that
 * animates is the element's own background clipped to the letterform.
 * That keeps the silhouette the real asset at every size instead of a
 * redrawn approximation.
 *
 * Two motions, and the size decides which:
 *
 *   rise     saffron floods bottom-to-top. Enough movement to read as
 *            "working" at 40px and up.
 *   breathe  opacity pulse. Below ~28px a rising fill line is about two
 *            pixels of travel and reads as flicker, so small sizes pulse.
 *
 * `variant="auto"` (the default) picks between them on `size`, which is
 * what callers should almost always use.
 *
 * Use this for a card or page whose CONTENT is not yet known. Keep the
 * skeleton where the shape itself is the information — a list of rows
 * tells the merchant what is about to arrive; a spinning mark does not.
 */

import { cn } from "@/lib/utils";

/** Below this the fill line stops being legible and we pulse instead. */
const BREATHE_BELOW_PX = 28;

export interface NumuLoaderProps {
  /** Rendered width in px; height follows the mark's 496:528 ratio. */
  size?: number;
  variant?: "auto" | "rise" | "breathe";
  /**
   * 0–100. When set, the mark fills to that value instead of animating —
   * for work with a real percentage (imports, backfills). Anything else
   * should stay indeterminate rather than fake a number.
   */
  progress?: number;
  /** Announced to screen readers. Defaults to a generic "Loading". */
  label?: string;
  className?: string;
}

export function NumuLoader({
  size = 44,
  variant = "auto",
  progress,
  label,
  className,
}: NumuLoaderProps) {
  const isDeterminate = typeof progress === "number";
  const resolved =
    variant === "auto" ? (size < BREATHE_BELOW_PX ? "breathe" : "rise") : variant;

  const clamped = isDeterminate
    ? Math.max(0, Math.min(100, progress))
    : undefined;

  return (
    <span
      className={cn(
        "numu-mark",
        isDeterminate
          ? "numu-mark--progress"
          : resolved === "breathe"
            ? "numu-mark--breathe"
            : "numu-mark--rise",
        className,
      )}
      style={
        {
          "--numu-mark-size": `${size}px`,
          ...(isDeterminate
            ? { "--numu-mark-progress": `${clamped}%` }
            : null),
        } as React.CSSProperties
      }
      // A determinate fill IS a progress bar and should expose its value;
      // an indeterminate one is a live region that says work is happening.
      role={isDeterminate ? "progressbar" : "status"}
      aria-live={isDeterminate ? undefined : "polite"}
      aria-valuenow={isDeterminate ? clamped : undefined}
      aria-valuemin={isDeterminate ? 0 : undefined}
      aria-valuemax={isDeterminate ? 100 : undefined}
      aria-label={label ?? "Loading"}
    />
  );
}

export interface NumuLoaderPanelProps extends NumuLoaderProps {
  /** Optional line under the mark. Keep it short — it sits in a card. */
  caption?: string;
  /** Matches the height of the content it stands in for, so nothing jumps. */
  minHeight?: number;
}

/**
 * A centred loader sized to hold a card's body open while it loads, so
 * the layout doesn't collapse and then snap back when data lands.
 */
export function NumuLoaderPanel({
  caption,
  minHeight = 160,
  className,
  size = 44,
  ...rest
}: NumuLoaderPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className,
      )}
      style={{ minHeight }}
    >
      <NumuLoader size={size} label={caption} {...rest} />
      {caption && (
        <span className="text-[12px] text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}
