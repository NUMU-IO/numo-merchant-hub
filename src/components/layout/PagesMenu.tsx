import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, Plus, PushPin, Star, Trash, X } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHubPages, type ResolvedPage } from "@/lib/nav/useHubPages";
import { normalizePageUrl } from "@/lib/nav/pages-store";
import { cn } from "@/lib/utils";

/** Open the popover from anywhere (dashboard "View all" link). */
export const OPEN_PAGES_EVENT = "numu:open-pages";

/**
 * Zid-style "My pages" popover: an explainer nudge, the merchant's pinned
 * pages, their recent activity (star any row to pin it) and an "Add custom
 * pages" form for deep links the sidebar doesn't list (a filtered orders
 * view, a specific report…).
 */
export function PagesMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, pinned, recent, actions } = useHubPages();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_PAGES_EVENT, handler);
    return () => window.removeEventListener(OPEN_PAGES_EVENT, handler);
  }, []);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAdding(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors", className)}
          aria-label={t("pages.title")}
          title={t("pages.title")}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <PushPin className="h-[19px] w-[19px]" weight={pinned.length ? "fill" : "regular"} />
          {pinned.length > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-navy-900 ring-2 ring-[hsl(var(--topbar))]">
              {pinned.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(94vw,380px)] overflow-hidden rounded-2xl border-border p-0 shadow-depth-navy"
      >
        {!state.introDismissed && (
          <div className="relative m-3 mb-2 rounded-xl bg-navy/[0.06] p-3.5 pe-9 dark:bg-saffron/10">
            <button
              type="button"
              onClick={() => actions?.dismissIntro()}
              className="absolute end-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
              aria-label={t("nav.close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-start gap-2.5">
              <span className="ichip ichip-navy mt-0.5 h-8 w-8 shrink-0 rounded-lg">
                <PushPin className="!h-4 !w-4" weight="fill" />
              </span>
              <div>
                <p className="text-[13px] font-extrabold leading-tight">{t("pages.introTitle")}</p>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{t("pages.introBody")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pinned */}
        <Section title={t("pages.pinned")}>
          {pinned.length === 0 ? (
            <p className="px-4 pb-3 text-[12px] text-muted-foreground">{t("pages.pinnedEmpty")}</p>
          ) : (
            <ul className="pb-1">
              {pinned.map((p) => (
                <PageRow key={p.url} page={p} onOpen={go} onToggle={() => actions?.togglePin(p.url)} onRemove={p.custom ? () => actions?.removeCustom(p.url) : undefined} />
              ))}
            </ul>
          )}
        </Section>

        {/* Recent */}
        <Section
          title={t("pages.recent")}
          aside={
            recent.length > 0 ? (
              <button type="button" onClick={() => actions?.clearRecent()} className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">
                {t("pages.clear")}
              </button>
            ) : null
          }
        >
          {recent.length === 0 ? (
            <p className="px-4 pb-3 text-[12px] text-muted-foreground">{t("pages.recentEmpty")}</p>
          ) : (
            <ul className="max-h-[min(40vh,260px)] overflow-y-auto pb-1">
              {recent.map((p) => (
                <PageRow key={p.url} page={p} icon={Clock} onOpen={go} onToggle={() => actions?.togglePin(p.url)} />
              ))}
            </ul>
          )}
        </Section>

        {/* Add custom page */}
        <div className="border-t border-border/70 bg-muted/40">
          {adding ? (
            <AddCustomForm
              onCancel={() => setAdding(false)}
              onAdd={(page) => {
                actions?.addCustom(page);
                setAdding(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-[12.5px] font-bold text-navy hover:bg-muted/70 dark:text-saffron"
            >
              {t("pages.addCustom")}
              <Plus className="h-4 w-4" weight="bold" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

function PageRow({
  page,
  icon,
  onOpen,
  onToggle,
  onRemove,
}: {
  page: ResolvedPage;
  icon?: typeof Clock;
  onOpen: (url: string) => void;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = icon ?? page.icon;
  return (
    <li className="group flex items-center gap-1 px-2">
      <button
        type="button"
        onClick={() => onOpen(page.url)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-start hover:bg-muted/70"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{page.label}</span>
          {page.group && <span className="block truncate text-[11px] text-muted-foreground">{page.group}</span>}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={t("pages.remove")}
          title={t("pages.remove")}
        >
          <Trash className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "rounded-md p-1.5 transition-colors hover:bg-muted",
          page.pinned ? "text-saffron-600 dark:text-saffron" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={page.pinned ? t("pages.unpin") : t("pages.pin")}
        aria-pressed={page.pinned}
        title={page.pinned ? t("pages.unpin") : t("pages.pin")}
      >
        <Star className="h-4 w-4" weight={page.pinned ? "fill" : "regular"} />
      </button>
    </li>
  );
}

function AddCustomForm({ onAdd, onCancel }: { onAdd: (p: { url: string; label: string }) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizePageUrl(url);
    if (!clean) {
      setError(t("pages.invalidUrl"));
      return;
    }
    onAdd({ url: clean, label: label.trim() || clean });
  };

  return (
    <form onSubmit={submit} className="space-y-2 px-4 py-3">
      <p className="text-[12px] font-bold">{t("pages.addCustom")}</p>
      <Input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("pages.customLabel")}
        className="h-9 rounded-lg text-[13px]"
        maxLength={40}
      />
      <Input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError(null); }}
        placeholder={t("pages.customUrl")}
        className="h-9 rounded-lg font-mono text-[12.5px]"
        dir="ltr"
        aria-invalid={!!error}
      />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">{t("pages.customHint")}</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" className="h-8 rounded-lg" disabled={!url.trim()}>
          {t("pages.save")}
        </Button>
      </div>
    </form>
  );
}

export default PagesMenu;
