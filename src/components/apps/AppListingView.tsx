import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Ban,
  BadgeCheck,
  ExternalLink,
  Image as ImageIcon,
  Languages,
  LayoutGrid,
  List,
  Mail,
  Palette,
  Plug,
  Shapes,
  Sparkles,
  Tag,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AppCatalogEntry } from "@/services/appsApi";

/** Pull the viewer's language out of a manifest `locales` block. */
function localized(
  node: { locales?: Record<string, Record<string, string | undefined>> } | undefined,
  key: string,
  language: string,
): string | undefined {
  const locales = node?.locales;
  if (!locales) return undefined;
  return locales[language]?.[key] ?? locales.en?.[key];
}

/**
 * Feature icons an app may name in its manifest.
 *
 * A closed map, not a dynamic lookup: an app cannot pull an arbitrary icon into
 * the hub, and a name nobody implemented falls back to a neutral mark rather
 * than rendering a hole in the list.
 */
const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  palette: Palette,
  image: ImageIcon,
  shapes: Shapes,
  ban: Ban,
  grid: LayoutGrid,
  tag: Tag,
  list: List,
  languages: Languages,
  plug: Plug,
};

/** Language codes an app declares, in the reader's own language. */
const LANGUAGE_NAMES: Record<string, { ar: string; en: string }> = {
  ar: { ar: "العربية", en: "Arabic" },
  en: { ar: "الإنجليزية", en: "English" },
};

/** The listing strings in the viewer's language, falling back to English. */
export function appDisplay(app: AppCatalogEntry, language: string) {
  const listing = app.listing;
  // An Arabic-first platform must read the APP in Arabic too, not just its
  // chrome. Falls back to the English columns for a locale nobody translated.
  const l10n = listing?.app_locales?.[language] ?? listing?.app_locales?.en;
  return {
    listing,
    displayName: l10n?.name || app.name,
    displayDescription: l10n?.description || app.description,
    displayTagline:
      listing?.locales?.[language]?.tagline ?? listing?.locales?.en?.tagline ?? listing?.tagline,
    pricingLabel:
      listing?.pricing?.locales?.[language]?.label ?? listing?.pricing?.locales?.en?.label,
    compatibility:
      listing?.compatibility?.locales?.[language]?.text ??
      listing?.compatibility?.locales?.en?.text,
  };
}

function videoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

interface Props {
  app: AppCatalogEntry;
  language: string;
  /** Beside the name: status badges the host page owns. */
  badges?: ReactNode;
  /** The header's action column (install, open, uninstall...). */
  actions?: ReactNode;
  /** Between the header and the gallery. */
  children?: ReactNode;
  /** After the details. */
  footer?: ReactNode;
}

/**
 * The App Store listing of one app: header, gallery, video, about, feature
 * tour and details. Everything comes from the app's own manifest
 * (`listing.*`) and anything an app does not supply is omitted. Shared by the
 * merchant App detail page and the partner portal's listing preview, so a
 * partner previews exactly what a merchant will see.
 */
export function AppListingView({ app, language, badges, actions, children, footer }: Props) {
  const { t } = useTranslation();
  const { listing, displayName, displayDescription, displayTagline, pricingLabel, compatibility } =
    appDisplay(app, language);
  const video = listing?.video_url ? videoEmbed(listing.video_url) : null;

  return (
    <>
      {/* ── Header: identity, who made it, and the install control ── */}
      <div className="flex flex-wrap items-start gap-4">
        {app.icon_url ? (
          <img
            src={app.icon_url}
            alt=""
            className="h-16 w-16 rounded-xl border border-border/50 object-contain bg-background"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-muted" />
        )}

        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
              {displayName}
            </h1>
            {/* Version is digits: it stays LTR in an Arabic page. */}
            <span className="text-xs text-muted-foreground">
              <bdi dir="ltr">v{app.version}</bdi>
            </span>
            {pricingLabel && (
              <Badge variant="secondary" className="font-medium">
                {pricingLabel}
              </Badge>
            )}
            {badges}
          </div>

          {displayTagline && (
            <p className="text-sm text-muted-foreground mt-1">{displayTagline}</p>
          )}

          {listing?.developer?.name && (
            // A <div>, not a <p>: Badge renders a <div>, and a <div> inside a
            // <p> is invalid HTML — React logged validateDOMNesting on every
            // render and the browser silently closed the paragraph early.
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("apps.by")} <span className="font-medium">{listing.developer.name}</span>
              </span>
              {listing.developer.is_first_party ? (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  {t("apps.firstParty")}
                </Badge>
              ) : (
                <Badge variant="outline">{t("apps.partnerBadge")}</Badge>
              )}
              {listing.developer.url && (
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  href={listing.developer.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t("apps.website")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {listing.developer.support_email && (
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  href={`mailto:${listing.developer.support_email}`}
                >
                  <Mail className="h-3 w-3" />
                  {t("apps.support")}
                </a>
              )}
            </div>
          )}
        </div>

        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      {children}

      {/* ── Gallery, before the prose: a merchant comparing apps decides with
             their eyes first. Its own horizontal scroller, so the page body
             never scrolls sideways — the RTL-safe way to overflow a row. ── */}
      {(listing?.screenshots?.length ?? 0) > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
          {listing!.screenshots!.map((shot, i) =>
            shot.url ? (
              <figure key={i} className="shrink-0 snap-start">
                <img
                  src={shot.url}
                  alt={localized(shot, "caption", language) ?? ""}
                  loading="lazy"
                  className="h-56 w-auto max-w-full rounded-xl border border-border/60 object-contain bg-background"
                />
                {localized(shot, "caption", language) && (
                  <figcaption className="mt-2 text-xs text-muted-foreground max-w-[320px]">
                    {localized(shot, "caption", language)}
                  </figcaption>
                )}
              </figure>
            ) : null,
          )}
        </div>
      )}

      {listing?.video_url &&
        (video ? (
          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-border/60">
            <iframe
              src={video}
              title={t("apps.video")}
              className="h-full w-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ) : (
          <a
            className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
            href={listing.video_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("apps.video")}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}

      {/* ── What it does ── */}
      {(displayDescription || (listing?.highlights?.length ?? 0) > 0) && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <h2 className="text-sm font-semibold">{t("apps.about")}</h2>
            {displayDescription && (
              <p className="text-sm text-muted-foreground">{displayDescription}</p>
            )}
            {(listing?.highlights?.length ?? 0) > 0 && (
              <ul className="space-y-1.5">
                {listing!.highlights!.map((h, i) => {
                  const text = localized(h, "text", language);
                  if (!text) return null;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── The feature tour. A plain two-column list, not a grid of cards:
             nine identical bordered boxes is the shape a merchant scrolls
             past, and every row here is the same conceptual weight. ── */}
      {(listing?.features?.length ?? 0) > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">{t("apps.features")}</h2>
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {listing!.features!.map((f, i) => {
              const loc = f.locales?.[language] ?? f.locales?.en;
              if (!loc?.title) return null;
              const Icon = FEATURE_ICONS[f.icon ?? ""] ?? Sparkles;
              return (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-snug">{loc.title}</h3>
                    {loc.body && (
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {loc.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Details: the facts a merchant checks last, before installing. ── */}
      {(pricingLabel || (listing?.languages?.length ?? 0) > 0 || compatibility) && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-3 text-sm font-semibold">{t("apps.details")}</h2>
            <dl className="divide-y divide-border/60 text-sm">
              {pricingLabel && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.pricing")}
                  </dt>
                  <dd className="min-w-0 flex-1">{pricingLabel}</dd>
                </div>
              )}
              {(listing?.languages?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.languages")}
                  </dt>
                  <dd className="min-w-0 flex-1">
                    {listing!
                      .languages!.map(
                        (code) =>
                          LANGUAGE_NAMES[code]?.[language === "ar" ? "ar" : "en"] ?? code,
                      )
                      .join(language === "ar" ? "، " : ", ")}
                  </dd>
                </div>
              )}
              {compatibility && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.worksWith")}
                  </dt>
                  <dd className="min-w-0 flex-1 leading-relaxed">{compatibility}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {footer}
    </>
  );
}
