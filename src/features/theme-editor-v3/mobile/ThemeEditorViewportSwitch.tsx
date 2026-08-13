/**
 * Picks the theme editor that fits the screen.
 *
 * ─── THE BREAKPOINT IS READ SYNCHRONOUSLY, ON PURPOSE ────────────────────────
 * `useIsMobile()` resolves inside a `useEffect`, so its FIRST render always
 * returns `false`. Using it here would mount the DESKTOP branch for one frame
 * on every phone — and because both branches are `lazy()`, that one frame is
 * enough to fetch the entire desktop customizer chunk before swapping it out.
 * The merchant pays for a bundle they never see.
 *
 * Same reasoning as `DesktopOnlyRoute` (used for the Monaco route). Reading
 * `matchMedia` during the initial state computation means only one branch is
 * ever mounted, and only one chunk is ever fetched.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** Tailwind `md` — matches MOBILE_BREAKPOINT in use-mobile.tsx. */
const QUERY = "(max-width: 767px)";

const ThemeCustomizerV3 = lazy(() =>
  import("../pages/ThemeCustomizerV3").then((m) => ({ default: m.ThemeCustomizerV3 })),
);
const MobileLiteEditor = lazy(() =>
  import("./MobileLiteEditor").then((m) => ({ default: m.MobileLiteEditor })),
);

function EditorFallback() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ThemeEditorViewportSwitch() {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <Suspense fallback={<EditorFallback />}>
      {isNarrow ? <MobileLiteEditor /> : <ThemeCustomizerV3 />}
    </Suspense>
  );
}
