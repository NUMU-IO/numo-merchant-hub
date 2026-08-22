import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavConfig } from "@/hooks/useNavConfig";
import { normalizeArabic } from "@/lib/arabic-normalize";
import { cn } from "@/lib/utils";

import {
  visibleSettingsSections,
  type ItemFlag,
} from "@/lib/settings-sections";

const TONE_CHIP = {
  navy: "ichip-navy",
  saffron: "ichip-saffron",
  sage: "ichip-sage",
  terra: "ichip-terra",
} as const;

const FLAG_STYLE: Record<ItemFlag, { card: string; badge: string }> = {
  advanced: {
    card: "border-amber-300/50 dark:border-amber-500/30",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-300/50",
  },
  danger: {
    card: "border-destructive/30",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export default function Settings() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isVisible } = useNavConfig();
  const isAr = language === "ar";
  const [query, setQuery] = useState("");

  const isOwner = user?.role === "store_owner";

  // Gating first, search second — a hidden card must never "come back"
  // because a search term matched it.
  const visibleSections = useMemo(
    () => visibleSettingsSections(isVisible, isOwner),
    [isOwner, isVisible],
  );

  const filteredSections = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q) return visibleSections;
    return visibleSections
      .map((section) => {
        const sectionHit = normalizeArabic(`${section.title.en} ${section.title.ar}`).includes(q);
        return {
          ...section,
          items: sectionHit
            ? section.items
            : section.items.filter((item) =>
                normalizeArabic(
                  [
                    item.title.en,
                    item.title.ar,
                    item.description.en,
                    item.description.ar,
                    ...(item.aliases ?? []),
                  ].join(" "),
                ).includes(q),
              ),
        };
      })
      .filter((section) => section.items.length > 0);
  }, [query, visibleSections]);

  /* Souq Settings hub — display title, prominent search, brand-tinted
     ichip icons per section (a fixed tone per section, so colours no
     longer reshuffle as search filters sections out). Section headers
     carry a count badge. High-risk cards (money, access, API keys) get a
     tinted border + label so they read differently from "Display". */
  return (
    <div className="space-y-7">
      <PageHeader
        title={isAr ? "الإعدادات" : "Settings"}
        subtitle={isAr ? "إدارة متجرك وحسابك من مكان واحد" : "Manage your store and account from one place"}
        className="md:items-end"
        actions={
          <div className="relative w-full md:w-96">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? "دوّر في الإعدادات…" : "Search settings…"}
              className="ps-11"
              aria-label={isAr ? "ابحث في الإعدادات" : "Search settings"}
            />
          </div>
        }
      />

      {filteredSections.length === 0 ? (
        <EmptyState
          icon={Search}
          title={isAr ? "مفيش نتائج" : "No matches"}
          description={
            isAr
              ? `لا يوجد إعداد بـ "${query}". جرّب كلمة تانية.`
              : `Nothing matches "${query}". Try another keyword.`
          }
          className="rounded-2xl border border-dashed border-border-strong"
        />
      ) : (
        filteredSections.map((section) => {
          const tone = TONE_CHIP[section.tone];
          return (
            <section key={section.title.en} className="space-y-3">
              {/* Section header — eyebrow + count */}
              <div className="flex items-center justify-between gap-3 pb-1">
                <h2 className="souq-eyebrow">
                  § {isAr ? section.title.ar : section.title.en}
                </h2>
                <span className="text-[11px] font-bold tabular-nums text-ink-faint">
                  {isAr ? section.items.length.toLocaleString("ar-EG") : section.items.length}
                  {" "}{isAr ? "عنصر" : section.items.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const flag = item.flag ? FLAG_STYLE[item.flag] : null;
                  return (
                    <Link
                      key={item.title.en + item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover-lift",
                        flag?.card,
                      )}
                    >
                      <div className={`ichip ${tone} shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-bold leading-snug">
                            {isAr ? item.title.ar : item.title.en}
                          </h3>
                          {(item.flag || item.ownerOnly) && (
                            <span className="flex shrink-0 items-center gap-1">
                              {item.ownerOnly && (
                                <Lock
                                  className="h-3 w-3 text-ink-faint"
                                  aria-label={t("settings.ownerOnly")}
                                />
                              )}
                              {item.flag && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9.5px] px-1.5 py-0 rounded-md", flag?.badge)}
                                >
                                  {t(`settings.flag.${item.flag}`)}
                                </Badge>
                              )}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                          {isAr ? item.description.ar : item.description.en}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
