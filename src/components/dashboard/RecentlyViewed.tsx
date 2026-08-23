import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClockCounterClockwise, Star } from "@phosphor-icons/react";
import { useHubPages, type ResolvedPage } from "@/lib/nav/useHubPages";
import { OPEN_PAGES_EVENT } from "@/components/layout/PagesMenu";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 8;

/**
 * Zid-style "Recently viewed" strip on the dashboard home: pinned pages
 * first, then the latest opened ones, each with a star to pin/unpin.
 * Renders nothing until there's at least one page to show (the dashboard
 * itself is excluded — you're already on it).
 */
export function RecentlyViewed({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { pinned, recent, actions } = useHubPages();

  const chips: ResolvedPage[] = [];
  const seen = new Set<string>();
  for (const p of [...pinned, ...recent]) {
    if (p.url === "/" || seen.has(p.url)) continue;
    seen.add(p.url);
    chips.push(p);
    if (chips.length >= MAX_CHIPS) break;
  }
  if (chips.length === 0) return null;

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card px-4 py-3 shadow-sm", className)}
      aria-label={t("pages.recentlyViewed")}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
          <ClockCounterClockwise className="h-[18px] w-[18px] text-muted-foreground" />
          {t("pages.recentlyViewed")}
        </h2>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PAGES_EVENT))}
          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("pages.viewAll")}
        </button>
      </div>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
        {chips.map((p) => (
          <li key={p.url} className="shrink-0">
            <span className="group inline-flex h-9 items-center overflow-hidden rounded-lg border border-border bg-background text-[13px] font-semibold transition-colors hover:border-navy/40 dark:hover:border-saffron/50">
              <button
                type="button"
                onClick={() => actions?.togglePin(p.url)}
                className={cn(
                  "flex h-full items-center ps-2.5 pe-1.5 transition-colors hover:bg-muted",
                  p.pinned ? "text-saffron-600 dark:text-saffron" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={p.pinned ? t("pages.unpin") : t("pages.pin")}
                aria-pressed={p.pinned}
                title={p.pinned ? t("pages.unpin") : t("pages.pin")}
              >
                <Star className="h-4 w-4" weight={p.pinned ? "fill" : "regular"} />
              </button>
              <Link to={p.url} className="flex h-full items-center pe-3 ps-0.5 hover:bg-muted">
                {p.label}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RecentlyViewed;
