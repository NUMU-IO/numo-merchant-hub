/**
 * Blocks a route below a breakpoint BEFORE its component is rendered.
 *
 * ─── WHY THIS DOES NOT USE useIsMobile() ─────────────────────────────────────
 * `useIsMobile()` resolves in a `useEffect`, so its FIRST render always returns
 * `false`. Wrapping a lazily-imported route in it would render the desktop
 * branch once — which fires `lazy(() => import(...))` — and only then swap to
 * the gate. The chunk downloads regardless.
 *
 * For Monaco that means ~11.1 MB pulled onto a phone over Egyptian mobile data
 * before the merchant is told to use a computer: the exact outcome the gate
 * exists to prevent. So the breakpoint is read SYNCHRONOUSLY on first render,
 * and children are never mounted below it.
 *
 * The gate must therefore wrap the element, not live inside it — hiding the
 * rendered output with CSS has the same fatal flaw.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/** Matches Tailwind's `md` and the MOBILE_BREAKPOINT in use-mobile.tsx. */
const QUERY = "(max-width: 767px)";

interface DesktopOnlyRouteProps {
  children: React.ReactNode;
  /** What the merchant is being told they cannot open here. */
  title: string;
  titleAr: string;
  /** Where "Go back" lands. */
  fallbackPath?: string;
}

export function DesktopOnlyRoute({
  children,
  title,
  titleAr,
  fallbackPath = "/online-store/themes",
}: DesktopOnlyRouteProps) {
  // Synchronous initial value — see the header comment. This is the whole point.
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const Back = isRTL ? ArrowRight : ArrowLeft;

  if (!isNarrow) return <>{children}</>;

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <div className="ichip ichip-navy mx-auto mb-5 !h-14 !w-14">
          <Monitor className="h-7 w-7" />
        </div>

        <h1 className="text-xl font-extrabold leading-tight">
          {isRTL ? titleAr : title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {isRTL
            ? "المحرر ده محتاج شاشة كبيرة وكيبورد. افتحه من الكمبيوتر."
            : "This editor needs a large screen and a keyboard. Open it on a computer."}
        </p>

        <Button
          type="button"
          onClick={() => navigate(fallbackPath)}
          className="mt-6 h-12 w-full rounded-xl font-bold"
        >
          <Back className="me-2 h-4 w-4" />
          {isRTL ? "رجوع" : "Go back"}
        </Button>
      </div>
    </div>
  );
}
