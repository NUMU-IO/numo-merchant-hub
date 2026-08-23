import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72; // px of pull before release triggers a refresh
const MAX_PULL = 110; // visual cap
const RESISTANCE = 0.55;

type Phase = "idle" | "pulling" | "ready" | "refreshing";

/**
 * Pull-to-refresh for touch devices. Installed PWAs never get the browser's
 * native gesture (Android standalone and iOS both drop it), and we disable
 * the native overscroll bounce globally — so this is the one refresh gesture
 * merchants have on their phone.
 *
 * Release past the threshold refetches every active query (orders, stats,
 * notifications…) instead of reloading the whole app — same result as a
 * native refresh, without dropping form state or re-downloading the shell.
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const atTop = (target: EventTarget | null) => {
      if ((document.scrollingElement?.scrollTop ?? window.scrollY) > 0) return false;
      // Any scrollable ancestor that isn't at its top owns the gesture.
      let el = target instanceof Element ? target : null;
      while (el && el !== document.body) {
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === "refreshing" || e.touches.length !== 1) return;
      startY.current = atTop(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null || phaseRef.current === "refreshing") return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (phaseRef.current !== "idle") {
          setPhase("idle");
          setPull(0);
        }
        return;
      }
      const eased = Math.min(dy * RESISTANCE, MAX_PULL);
      setPull(eased);
      setPhase(eased >= THRESHOLD ? "ready" : "pulling");
    };
    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (phaseRef.current !== "ready") {
        setPhase("idle");
        setPull(0);
        return;
      }
      setPhase("refreshing");
      setPull(THRESHOLD * 0.8);
      try {
        await Promise.race([
          qc.refetchQueries({ type: "active" }),
          new Promise((r) => setTimeout(r, 8_000)),
        ]);
      } finally {
        setPhase("idle");
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [qc]);

  if (phase === "idle" && pull === 0) return null;

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{ top: `calc(var(--topbar-h) + ${pull - 44}px)`, transition: phase === "refreshing" || phase === "idle" ? "top 200ms ease" : undefined }}
      aria-live="polite"
      aria-label={phase === "refreshing" ? "Refreshing" : undefined}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-navy shadow-lg dark:text-saffron",
        )}
        style={{ opacity: Math.max(progress, 0.35), transform: `rotate(${progress * 180}deg)` }}
      >
        {phase === "refreshing" ? (
          <Loader2 className="h-5 w-5 animate-spin" style={{ transform: "rotate(-180deg)" }} />
        ) : (
          <ArrowDown className="h-5 w-5" strokeWidth={2.4} />
        )}
      </div>
    </div>
  );
}

export default PullToRefresh;
