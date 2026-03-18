/**
 * CustomizationWalkthrough — interactive guided tour for the customization
 * panel. Highlights actual DOM elements with a spotlight / cutout overlay.
 *
 * Each step targets a real UI element via `data-tour` attributes, positions a
 * tooltip card beside it, and dims the rest of the page.
 *
 * Shows on first visit, can be re-triggered via `useWalkthroughStatus`.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Palette,
  LayoutGrid,
  Eye,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "numu-customization-walkthrough-done";

/** Padding around the spotlight cutout (px). */
const SPOTLIGHT_PAD = 10;
/** Border-radius for the spotlight cutout (px). */
const SPOTLIGHT_RADIUS = 12;

// ─── Step definitions ─────────────────────────────────────────────────────────

type TooltipPosition = "below" | "above" | "left" | "right";

interface WalkthroughStep {
  /** CSS selector for the target element. `null` = centered overlay (no target). */
  selector: string | null;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  icon: typeof Sparkles;
  /** Preferred tooltip position relative to the target. */
  position: TooltipPosition;
}

const STEPS: WalkthroughStep[] = [
  {
    selector: null,
    title: "Welcome to Theme Customization",
    titleAr: "مرحبا في تخصيص الثيم",
    description:
      "Customize your storefront's look and feel. Choose a theme, pick colors, fonts, and arrange sections — all with a live preview.",
    descriptionAr:
      "خصّص شكل متجرك. اختار ثيم، غيّر الألوان والخطوط، ورتّب الأقسام — مع معاينة مباشرة.",
    icon: Sparkles,
    position: "below",
  },
  {
    selector: '[data-tour="theme-picker"]',
    title: "Choose your theme style",
    titleAr: "اختر ستايل الثيم",
    description:
      "Pick a pre-built theme as your starting point. Each theme comes with its own color palette, typography, and layout style.",
    descriptionAr:
      "اختار ثيم جاهز كنقطة بداية. كل ثيم بييجي بألوانه وخطوطه وتصميمه الخاص.",
    icon: Sparkles,
    position: "below",
  },
  {
    selector: '[data-tour="colors-typography"]',
    title: "Customize colors and fonts",
    titleAr: "خصّص الألوان والخطوط",
    description:
      "Fine-tune your store's primary colors, background, and fonts. Each change updates the preview instantly.",
    descriptionAr:
      "ظبط ألوان متجرك الأساسية والخلفية والخطوط. كل تغيير بيتحدث في المعاينة فوراً.",
    icon: Palette,
    position: "below",
  },
  {
    selector: '[data-tour="home-sections"]',
    title: "Edit home page sections",
    titleAr: "عدّل أقسام الصفحة الرئيسية",
    description:
      "Click any section to edit its content (titles, reviews, images). Drag to reorder, toggle to show/hide.",
    descriptionAr:
      "اضغط على أي قسم عشان تعدّل محتواه (عناوين، تقييمات، صور). اسحب عشان ترتب، أو فعّل/عطّل.",
    icon: LayoutGrid,
    position: "below",
  },
  {
    selector: '[data-tour="preview-toggle"]',
    title: "Toggle live preview",
    titleAr: "فعّل المعاينة المباشرة",
    description:
      "Toggle live preview to see changes in real time. You can resize the preview panel by dragging the divider.",
    descriptionAr:
      "فعّل المعاينة المباشرة عشان تشوف التغييرات لحظياً. ممكن تغيّر حجم المعاينة بالسحب.",
    icon: Eye,
    position: "below",
  },
  {
    selector: '[data-tour="action-bar"]',
    title: "Save & Publish",
    titleAr: "احفظ وانشر",
    description:
      "Save your draft or publish to make it live. Unsaved changes are marked so you never lose work.",
    descriptionAr:
      "احفظ المسودة أو انشر عشان التغييرات تبقى لايف. التغييرات غير المحفوظة بتتعلّم عشان ما تضيعش.",
    icon: Save,
    position: "below",
  },
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

function getElementRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
    bottom: r.bottom + window.scrollY,
    right: r.right + window.scrollX,
  };
}

/**
 * Scroll the target element into view smoothly, with some margin so the
 * tooltip has room.
 */
function scrollToElement(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const margin = 120;
  if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────

const TOOLTIP_W = 380;
const TOOLTIP_GAP = 16;

function computeTooltipStyle(
  targetRect: Rect,
  preferred: TooltipPosition,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollY = window.scrollY;

  // Convert target rect to viewport-relative for collision checks
  const tTop = targetRect.top - scrollY;
  const tBottom = targetRect.bottom - scrollY;
  const tCenterX = targetRect.left + targetRect.width / 2;

  // Determine actual position (fall back if not enough space)
  let pos = preferred;
  const spaceBelow = vh - tBottom - SPOTLIGHT_PAD;
  const spaceAbove = tTop - SPOTLIGHT_PAD;

  if (pos === "below" && spaceBelow < 200) pos = "above";
  if (pos === "above" && spaceAbove < 200) pos = "below";

  const style: React.CSSProperties = {
    position: "fixed",
    width: TOOLTIP_W,
    maxWidth: "90vw",
    zIndex: 10002,
  };

  if (pos === "below") {
    style.top = tBottom + SPOTLIGHT_PAD + TOOLTIP_GAP;
    style.left = Math.max(
      12,
      Math.min(tCenterX - TOOLTIP_W / 2, vw - TOOLTIP_W - 12),
    );
  } else if (pos === "above") {
    // We'll use `bottom` calc via top
    style.top = tTop - SPOTLIGHT_PAD - TOOLTIP_GAP;
    style.transform = "translateY(-100%)";
    style.left = Math.max(
      12,
      Math.min(tCenterX - TOOLTIP_W / 2, vw - TOOLTIP_W - 12),
    );
  } else if (pos === "right") {
    const tRight = targetRect.right - window.scrollX + SPOTLIGHT_PAD;
    style.top = tTop;
    style.left = Math.min(tRight + TOOLTIP_GAP, vw - TOOLTIP_W - 12);
  } else {
    // left
    style.top = tTop;
    style.left = Math.max(
      12,
      targetRect.left - window.scrollX - SPOTLIGHT_PAD - TOOLTIP_W - TOOLTIP_GAP,
    );
  }

  return style;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CustomizationWalkthroughProps {
  language: string;
  forceShow?: boolean;
  onDismiss?: () => void;
}

export function CustomizationWalkthrough({
  language,
  forceShow,
  onDismiss,
}: CustomizationWalkthroughProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const rafRef = useRef<number>(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  // ── Show / hide logic ───────────────────────────────────────────────────

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setStep(0);
      return;
    }
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch {
      /* noop */
    }
  }, [forceShow]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    onDismiss?.();
  }, [onDismiss]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const goTo = useCallback(
    (nextStep: number) => {
      if (nextStep < 0 || nextStep >= STEPS.length) return;
      setTransitioning(true);
      // Brief transition gap for smooth feel
      setTimeout(() => {
        setStep(nextStep);
        setTransitioning(false);
      }, 150);
    },
    [],
  );

  const next = useCallback(() => {
    if (step < STEPS.length - 1) goTo(step + 1);
    else dismiss();
  }, [step, goTo, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  // ── Measure & track target element ──────────────────────────────────────

  const measure = useCallback(() => {
    const current = STEPS[step];
    if (!current.selector) {
      setTargetRect(null);
      return;
    }
    const rect = getElementRect(current.selector);
    setTargetRect(rect);
  }, [step]);

  // Scroll to target whenever step changes
  useEffect(() => {
    const current = STEPS[step];
    if (current.selector) {
      scrollToElement(current.selector);
      // Give scroll a moment, then measure
      const t = setTimeout(measure, 350);
      return () => clearTimeout(t);
    } else {
      setTargetRect(null);
    }
  }, [step, measure]);

  // Continuously re-measure with rAF (handles scroll, resize, layout shifts)
  useEffect(() => {
    if (!visible) return;

    let running = true;
    const loop = () => {
      if (!running) return;
      measure();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [visible, measure]);

  // Also use ResizeObserver on the target element for layout changes
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current.selector) return;

    const el = document.querySelector(current.selector);
    if (!el) return;

    observerRef.current = new ResizeObserver(() => measure());
    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [visible, step, measure]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight") {
        // RTL: ArrowRight = prev, LTR: ArrowRight = next
        if (language === "ar") { prev(); } else { next(); }
      }
      if (e.key === "ArrowLeft") {
        if (language === "ar") { next(); } else { prev(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, language, next, prev, dismiss]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!visible) return null;

  const current = STEPS[step];
  const isAr = language === "ar";
  const Icon = current.icon;

  // Spotlight rect (viewport-fixed) for the cutout
  const spotViewport = targetRect
    ? {
        top: targetRect.top - window.scrollY - SPOTLIGHT_PAD,
        left: targetRect.left - window.scrollX - SPOTLIGHT_PAD,
        width: targetRect.width + SPOTLIGHT_PAD * 2,
        height: targetRect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  // Tooltip style
  const tooltipStyle: React.CSSProperties = targetRect
    ? computeTooltipStyle(targetRect, current.position)
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: TOOLTIP_W,
        maxWidth: "90vw",
        zIndex: 10002,
      };

  return createPortal(
    <>
      {/* Full-screen overlay that catches clicks */}
      <div
        className="fixed inset-0 transition-opacity duration-200"
        style={{ zIndex: 10000, pointerEvents: "auto" }}
        onClick={dismiss}
      />

      {/* Spotlight cutout — sits exactly over the target element */}
      {spotViewport && !transitioning && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out"
          style={{
            zIndex: 10001,
            top: spotViewport.top,
            left: spotViewport.left,
            width: spotViewport.width,
            height: spotViewport.height,
            borderRadius: SPOTLIGHT_RADIUS,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
          }}
        />
      )}

      {/* Dark overlay for centered (no-target) steps */}
      {!targetRect && !transitioning && (
        <div
          className="fixed inset-0 bg-black/50 pointer-events-none transition-opacity duration-200"
          style={{ zIndex: 10001 }}
        />
      )}

      {/* Tooltip card */}
      {!transitioning && (
        <div
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-5 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground hover:text-foreground"
                  onClick={dismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <h3 className="text-base font-bold mt-3 text-foreground leading-tight">
                {isAr ? current.titleAr : current.title}
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAr ? current.descriptionAr : current.description}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-6 py-3 bg-muted/30">
              {/* Step dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-200",
                      i === step
                        ? "w-6 bg-primary"
                        : i < step
                          ? "w-2 bg-primary/40"
                          : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40",
                    )}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                {step === 0 && (
                  <button
                    onClick={dismiss}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                  >
                    {isAr ? "تخطي" : "Skip"}
                  </button>
                )}
                {step > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prev}
                    className="h-8 gap-1 text-xs"
                  >
                    {isAr ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                    {isAr ? "السابق" : "Back"}
                  </Button>
                )}
                <Button size="sm" onClick={next} className="h-8 gap-1 text-xs">
                  {step < STEPS.length - 1
                    ? isAr
                      ? "التالي"
                      : "Next"
                    : isAr
                      ? "ابدأ التخصيص"
                      : "Start Customizing"}
                  {step < STEPS.length - 1 &&
                    (isAr ? (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ))}
                </Button>
              </div>
            </div>
          </div>

          {/* Step counter */}
          <div className="text-center mt-2">
            <span className="text-[11px] text-white/70">
              {step + 1} / {STEPS.length}
            </span>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook to check if walkthrough has been completed.
 * Returns `[isDone, resetWalkthrough]`.
 */
export function useWalkthroughStatus(): [boolean, () => void] {
  const [done, setDone] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setDone(false);
  }, []);

  return [done, reset];
}
