import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchThemes,
  fetchCustomization,
  updateCustomization,
  type AvailableTheme,
  type CustomizationData,
} from "@/services/themeApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { getStoreUrl } from "@/lib/storefront";
import {
  Pencil, MoreHorizontal, ExternalLink, Eye, Copy, Sparkles,
  CheckCircle2, Clock, Loader2, ArrowUpRight, Layers,
} from "lucide-react";

// ─── Theme visual palettes ───────────────────────────────────────────────────
const THEME_PALETTES: Record<string, { bg: string; accent: string; text: string; card: string }> = {
  modern:          { bg: "#f8fafc", accent: "#6366f1", text: "#0f172a", card: "#ffffff" },
  boutique:        { bg: "#fdf8f3", accent: "#c4956a", text: "#3d2b1a", card: "#fff9f4" },
  elegant:         { bg: "#0f1117", accent: "#c9a96e", text: "#f5f0e8", card: "#1a1d27" },
  skeuomorphic:    { bg: "#e8e0d8", accent: "#8b6f52", text: "#2c1f14", card: "#f2ece4" },
  "neo-brutalism": { bg: "#f5f500", accent: "#000000", text: "#000000", card: "#ffffff" },
  default:         { bg: "#f1f5f9", accent: "#3b82f6", text: "#1e293b", card: "#ffffff" },
};

const LAYOUT_LABELS: Record<string, { en: string; ar: string }> = {
  default:         { en: "Default",        ar: "افتراضي"       },
  skeuomorphic:    { en: "Skeuomorphic",   ar: "واقعي"         },
  "neo-brutalism": { en: "Neo-Brutalism",  ar: "نيو برتاليزم"  },
  editorial:       { en: "Editorial",      ar: "تحريري"        },
  "luxury-minimal":{ en: "Luxury Minimal", ar: "فاخر بسيط"     },
};

// ─── Mini theme preview SVG ───────────────────────────────────────────────────
function ThemePreviewSVG({ themeId, palette }: { themeId: string; palette: typeof THEME_PALETTES[string] }) {
  const isBrut = themeId === "neo-brutalism";
  const isElegant = themeId === "elegant";
  return (
    <svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Background */}
      <rect width="240" height="140" fill={palette.bg} />
      {/* Header bar */}
      <rect width="240" height={isElegant ? 22 : 20} fill={isElegant ? palette.card : palette.accent} opacity={isElegant ? 1 : 0.92} />
      {/* Logo dot */}
      <circle cx={isBrut ? 14 : 16} cy={10} r={isBrut ? 5 : 4} fill={isElegant ? palette.accent : palette.card} opacity="0.9" />
      {/* Nav links */}
      {[50, 75, 100].map((x, i) => (
        <rect key={i} x={x} y={8} width={isBrut ? 16 : 14} height={isBrut ? 4 : 3} rx={isBrut ? 0 : 1.5}
          fill={isElegant ? palette.accent : palette.card} opacity={i === 0 ? 0.9 : 0.55} />
      ))}
      {/* Hero area */}
      <rect x="0" y={isElegant ? 22 : 20} width="240" height={isElegant ? 50 : 46}
        fill={isElegant ? "#16202e" : isBrut ? palette.accent : palette.card}
        stroke={isBrut ? palette.text : "none"} strokeWidth={isBrut ? 2 : 0} />
      <rect x={isBrut ? 14 : 20} y={isElegant ? 32 : 30} width={isBrut ? 80 : 70} height={isBrut ? 6 : 5}
        rx={isBrut ? 0 : 2} fill={isElegant ? palette.accent : isBrut ? palette.text : palette.accent} opacity="0.85" />
      <rect x={isBrut ? 14 : 20} y={isElegant ? 42 : 40} width={isBrut ? 55 : 50} height={isBrut ? 4 : 3}
        rx={isBrut ? 0 : 1.5} fill={isElegant ? palette.text : palette.text} opacity="0.35" />
      <rect x={isBrut ? 14 : 20} y={isElegant ? 52 : 50} width={isBrut ? 40 : 36} height={isBrut ? 10 : 9}
        rx={isBrut ? 0 : 3} fill={isBrut ? palette.text : palette.accent} />
      {/* Product grid */}
      {[0, 1, 2, 3].map((i) => {
        const col = i % 4;
        const x = 14 + col * 56;
        const y = isElegant ? 80 : 76;
        return (
          <g key={i}>
            <rect x={x} y={y} width="48" height="40" rx={isBrut ? 0 : 4}
              fill={palette.card} stroke={isBrut ? palette.text : palette.bg}
              strokeWidth={isBrut ? 2 : 1} />
            <rect x={x + 4} y={y + 4} width="40" height="22" rx={isBrut ? 0 : 2}
              fill={palette.accent} opacity="0.18" />
            <rect x={x + 4} y={y + 30} width="28" height="3" rx={1}
              fill={palette.text} opacity="0.4" />
            <rect x={x + 4} y={y + 35} width="18" height="2.5" rx={1}
              fill={palette.accent} opacity="0.7" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnlineStoreThemes() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switchTarget, setSwitchTarget] = useState<AvailableTheme | null>(null);

  const storeId = currentStore?.id ?? "";
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

  const { data: themes = [], isLoading: themesLoading } = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
  });

  const { data: customization, isLoading: custLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  const switchMutation = useMutation({
    mutationFn: (themeId: string) =>
      updateCustomization(storeId, { theme: { base_theme: themeId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم تغيير الثيم" : "Theme switched");
      setSwitchTarget(null);
    },
    onError: (err) => showError(err),
  });

  const activeThemeId = customization?.theme?.base_theme ?? themes[0]?.id;
  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0];
  const libraryThemes = themes.filter((t) => t.id !== activeThemeId);
  const isLoading = themesLoading || custLoading;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isRTL ? "الثيمات" : "Themes"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRTL ? "إدارة مظهر متجرك الإلكتروني" : "Manage the look and feel of your online store"}
          </p>
        </div>
        {storeUrl && (
          <Button variant="outline" size="sm" onClick={() => window.open(storeUrl, "_blank")}>
            <Eye className="h-3.5 w-3.5 me-1.5" />
            {isRTL ? "عرض المتجر" : "View store"}
            <ArrowUpRight className="h-3 w-3 ms-1 opacity-50" />
          </Button>
        )}
      </div>

      {/* Current theme */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
          {isRTL ? "الثيم النشط" : "Active theme"}
        </p>
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-2xl" />
        ) : activeTheme ? (
          <ActiveThemeCard
            theme={activeTheme}
            customization={customization}
            isRTL={isRTL}
            onCustomize={() => navigate("/online-store/themes/editor")}
            onPreview={() => storeUrl && window.open(storeUrl, "_blank")}
          />
        ) : (
          <div className="rounded-2xl border-2 border-dashed p-12 text-center">
            <Layers className="mx-auto h-8 w-8 text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">{isRTL ? "لا يوجد ثيم نشط" : "No active theme"}</p>
          </div>
        )}
      </section>

      {/* Theme library */}
      {(isLoading || libraryThemes.length > 0) && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
            {isRTL ? "مكتبة الثيمات" : "Theme library"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
              : libraryThemes.map((theme) => (
                  <LibraryThemeCard
                    key={theme.id}
                    theme={theme}
                    isRTL={isRTL}
                    isSwitching={switchMutation.isPending && switchTarget?.id === theme.id}
                    onActivate={() => setSwitchTarget(theme)}
                    onCustomize={() => navigate("/online-store/themes/editor")}
                  />
                ))}
          </div>
        </section>
      )}

      {/* Marketplace CTA */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/3 p-5">
        <div className="absolute -top-4 -end-4 h-24 w-24 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{isRTL ? "استعرض المزيد من الثيمات" : "Explore more themes"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRTL ? "اكتشف ثيمات مصممة خصيصًا لمتاجر نومو" : "Themes crafted specifically for NUMU stores"}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px] px-2">
            {isRTL ? "قريبًا" : "Coming soon"}
          </Badge>
        </div>
      </div>

      {/* Switch confirmation */}
      <Dialog open={!!switchTarget} onOpenChange={() => setSwitchTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تفعيل الثيم" : "Activate theme"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `سيصبح ثيم "${switchTarget?.nameAr ?? switchTarget?.name}" هو الثيم النشط في متجرك.`
                : `"${switchTarget?.name}" will become the active theme for your store.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchTarget(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={() => switchTarget && switchMutation.mutate(switchTarget.id)}
              disabled={switchMutation.isPending}
            >
              {switchMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? "تفعيل" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Active theme card ────────────────────────────────────────────────────────
interface ActiveThemeCardProps {
  theme: AvailableTheme;
  customization: CustomizationData | undefined;
  isRTL: boolean;
  onCustomize: () => void;
  onPreview: () => void;
}

function ActiveThemeCard({ theme, customization, isRTL, onCustomize, onPreview }: ActiveThemeCardProps) {
  const palette = THEME_PALETTES[theme.id] ?? THEME_PALETTES.default;
  const layoutLabel = LAYOUT_LABELS[theme.layout]?.[isRTL ? "ar" : "en"] ?? theme.layout;
  const isPublished = customization?.is_published ?? false;
  const lastPublished = customization?.last_published_at;

  // Use actual theme colors if available
  const previewPalette = {
    ...palette,
    accent: customization?.theme?.primary_color || palette.accent,
    bg: customization?.theme?.background_color || palette.bg,
    text: customization?.theme?.text_color || palette.text,
  };

  return (
    <div className="group rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="grid sm:grid-cols-[2fr_1fr]">
        {/* Preview */}
        <div className="relative h-44 sm:h-auto overflow-hidden border-b sm:border-b-0 sm:border-e" style={{ background: palette.bg }}>
          <ThemePreviewSVG themeId={theme.id} palette={previewPalette} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Info */}
        <div className="flex flex-col p-5 gap-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-base leading-tight">
                  {isRTL ? theme.nameAr : theme.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{layoutLabel}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0 shrink-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={onPreview}>
                    <Eye className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "معاينة" : "Preview"}
                    <ExternalLink className="h-3 w-3 ms-auto opacity-40" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCustomize}>
                    <Copy className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "نسخ" : "Duplicate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              {isPublished ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {isRTL ? "منشور" : "Published"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {isRTL ? "مسودة غير منشورة" : "Unpublished draft"}
                </span>
              )}
            </div>

            {lastPublished && (
              <p className="text-[11px] text-muted-foreground/70">
                {isRTL ? "آخر نشر" : "Published"}{" "}
                {new Date(lastPublished).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}

            {/* Color swatches */}
            {customization?.theme && (
              <div className="flex items-center gap-1 pt-1">
                {[
                  customization.theme.primary_color,
                  customization.theme.secondary_color,
                  customization.theme.accent_color,
                  customization.theme.background_color,
                ].filter(Boolean).map((color, i) => (
                  <div
                    key={i}
                    className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto">
            <Button size="sm" className="w-full" onClick={onCustomize}>
              <Pencil className="h-3.5 w-3.5 me-1.5" />
              {isRTL ? "تخصيص الثيم" : "Customize"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Library theme card ───────────────────────────────────────────────────────
interface LibraryThemeCardProps {
  theme: AvailableTheme;
  isRTL: boolean;
  isSwitching: boolean;
  onActivate: () => void;
  onCustomize: () => void;
}

function LibraryThemeCard({ theme, isRTL, isSwitching, onActivate, onCustomize }: LibraryThemeCardProps) {
  const palette = THEME_PALETTES[theme.id] ?? THEME_PALETTES.default;
  const layoutLabel = LAYOUT_LABELS[theme.layout]?.[isRTL ? "ar" : "en"] ?? theme.layout;

  return (
    <div className="group rounded-2xl border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Preview */}
      <div className="relative h-40 overflow-hidden" style={{ background: palette.bg }}>
        <ThemePreviewSVG themeId={theme.id} palette={palette} />
        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs font-medium shadow-lg"
            onClick={onActivate}
            disabled={isSwitching}
          >
            {isSwitching ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : null}
            {isRTL ? "تفعيل" : "Activate"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 px-0 shadow-lg" onClick={onCustomize}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{isRTL ? theme.nameAr : theme.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{layoutLabel}</p>
          </div>
          {/* Color dots */}
          <div className="flex gap-1 shrink-0">
            {[palette.accent, palette.bg, palette.text].map((c, i) => (
              <div key={i} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />
            ))}
          </div>
        </div>
        {/* Mobile fallback buttons */}
        <div className="flex gap-2 mt-3 sm:hidden">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onActivate} disabled={isSwitching}>
            {isSwitching && <Loader2 className="h-3 w-3 me-1.5 animate-spin" />}
            {isRTL ? "تفعيل" : "Activate"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 px-0" onClick={onCustomize}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
