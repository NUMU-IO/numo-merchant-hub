import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useLanguage } from "@/contexts/LanguageContext";
import { PROMO_SLIDES, slideImage, type PromoSlide } from "@/lib/dashboard/promo-slides";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "numu:promo-dismissed";
const AUTOPLAY_MS = 6000;

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Zid-style promo swiper for the dashboard home. Embla carousel (swipe on
 * touch, RTL-aware), looped autoplay that pauses on hover / focus / hidden
 * tab and honours reduced-motion, real pagination dots, and a per-slide
 * dismiss that's remembered in this browser. Each slide is one link.
 */
export function PromoSwiper({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const slides = useMemo(() => PROMO_SLIDES.filter((s) => !dismissed.includes(s.id)), [dismissed]);

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  // Autoplay — plain interval over the Embla API; no extra plugin dependency.
  useEffect(() => {
    if (!api || paused || reducedMotion.current || slides.length < 2) return;
    const tick = () => {
      if (document.visibilityState === "visible") api.scrollNext();
    };
    const id = window.setInterval(tick, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [api, paused, slides.length]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  if (slides.length === 0) return null;

  return (
    <section
      className={cn("relative", className)}
      aria-roledescription="carousel"
      aria-label={t("promo.label")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: slides.length > 1, direction: isAr ? "rtl" : "ltr", align: "start", duration: 28 }}
        className="overflow-hidden rounded-2xl shadow-depth-navy"
      >
        <CarouselContent className="ml-0">
          {slides.map((slide, i) => (
            <CarouselItem key={slide.id} className="pl-0">
              <Slide slide={slide} isAr={isAr} active={i === current} onDismiss={() => dismiss(slide.id)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {slides.length > 1 && (
        <>
          <ArrowButton side="prev" onClick={() => api?.scrollPrev()} label={t("promo.prev")} />
          <ArrowButton side="next" onClick={() => api?.scrollNext()} label={t("promo.next")} />
        </>
      )}

      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === current ? "w-5 bg-[#FBEFD6]" : "w-2 bg-white/40 hover:bg-white/70",
                )}
                aria-label={t("promo.goTo", { n: i + 1 })}
                aria-current={i === current ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Prev/next chevrons on the slide edges; flip sides for RTL via logical start/end. */
function ArrowButton({ side, onClick, label }: { side: "prev" | "next"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        side === "prev" ? "start-3" : "end-3",
      )}
      aria-label={label}
    >
      {side === "prev" ? (
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      ) : (
        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
      )}
    </button>
  );
}

function Slide({
  slide,
  isAr,
  active,
  onDismiss,
}: {
  slide: PromoSlide;
  isAr: boolean;
  active: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const external = /^(https?:|mailto:)/.test(slide.href);
  const alt = isAr ? slide.alt.ar : slide.alt.en;
  const { src, placeholder } = slideImage(slide, isAr ? "ar" : "en");
  // Language switch swaps the creative — fade the new one in from the placeholder.
  useEffect(() => setLoaded(false), [src]);

  const img = (
    <div
      className="relative aspect-[2/1] w-full bg-[#0B1E3B] bg-cover bg-center"
      style={{ backgroundImage: `url(${placeholder})` }}
    >
      <img
        key={src}
        src={src}
        alt={alt}
        width={1600}
        height={797}
        loading={active ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn("h-full w-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );

  return (
    <div className="group relative" aria-roledescription="slide" aria-hidden={!active}>
      {external ? (
        <a href={slide.href} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-none" tabIndex={active ? 0 : -1}>
          {img}
        </a>
      ) : (
        <Link to={slide.href} className="block focus-visible:outline-none" tabIndex={active ? 0 : -1}>
          {img}
        </Link>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/50 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={t("promo.dismiss")}
        title={t("promo.dismiss")}
        tabIndex={active ? 0 : -1}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default PromoSwiper;
