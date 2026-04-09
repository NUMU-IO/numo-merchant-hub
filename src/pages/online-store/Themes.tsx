import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchThemes,
  fetchStoreThemes,
  submitExternalTheme,
  fetchBuildStatus,
  rebuildExternalTheme,
  removeExternalTheme,
  connectDevServer,
  validateExternalTheme,
  type AvailableTheme,
} from "@/services/themeApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
  CheckCircle2, Clock, Loader2, ArrowUpRight, Layers, Github, Trash2, RefreshCw, ShieldCheck,
} from "lucide-react";

// ─── Theme visual palettes ───────────────────────────────────────────────────
const THEME_PALETTES: Record<string, { bg: string; accent: string; text: string; card: string }> = {
  modern:            { bg: "#f8fafc", accent: "#6366f1", text: "#0f172a", card: "#ffffff" },
  boutique:          { bg: "#fdf8f3", accent: "#c4956a", text: "#3d2b1a", card: "#fff9f4" },
  elegant:           { bg: "#0f1117", accent: "#c9a96e", text: "#f5f0e8", card: "#1a1d27" },
  skeuomorphic:      { bg: "#e8e0d8", accent: "#8b6f52", text: "#2c1f14", card: "#f2ece4" },
  "neo-brutalism":   { bg: "#f5f500", accent: "#000000", text: "#000000", card: "#ffffff" },
  "tech-wave":       { bg: "#0a0e1a", accent: "#00f0ff", text: "#e0e8f0", card: "#111827" },
  editorial:         { bg: "#f5f5f0", accent: "#1a3a2a", text: "#1a1a1a", card: "#ffffff" },
  "luxury-minimal":  { bg: "#fafaf8", accent: "#8a7e6b", text: "#2c2c2c", card: "#ffffff" },
  empire:            { bg: "#fafafa", accent: "#1a1a1a", text: "#0a0a0a", card: "#ffffff" },
  "kick-game":       { bg: "#f5f0e8", accent: "#c8a87c", text: "#1a1510", card: "#faf8f4" },
  street:            { bg: "#1a1a2e", accent: "#ffd600", text: "#f0f0f0", card: "#252540" },
  rabbitsocks:       { bg: "#f9f9f7", accent: "#001f3f", text: "#000613", card: "#f4f4f2" },
  default:           { bg: "#f1f5f9", accent: "#3b82f6", text: "#1e293b", card: "#ffffff" },
};

const LAYOUT_LABELS: Record<string, { en: string; ar: string }> = {
  default:           { en: "Default",        ar: "افتراضي"       },
  skeuomorphic:      { en: "Skeuomorphic",   ar: "واقعي"         },
  "neo-brutalism":   { en: "Neo-Brutalism",  ar: "نيو برتاليزم"  },
  editorial:         { en: "Editorial",      ar: "تحريري"        },
  "luxury-minimal":  { en: "Luxury Minimal", ar: "فاخر بسيط"     },
  empire:            { en: "Empire",         ar: "إمباير"        },
  "kick-game":       { en: "Kick Game",      ar: "كيك جيم"      },
  street:            { en: "Street Vibes",   ar: "ستريت"         },
  rabbitsocks:       { en: "RabbitSocks",    ar: "رابيت سوكس"    },
  "tech-wave":       { en: "Tech Wave",      ar: "موجة تقنية"    },
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

  // ─── External theme (BYOT) state ─────────────────────────────────────
  const [submitOpen, setSubmitOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<ThemeBuildStatus | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // ─── Dev server connection state ─────────────────────────────────────
  const [devOpen, setDevOpen] = useState(false);
  const [devUrl, setDevUrl] = useState("http://localhost:4321");
  const [devError, setDevError] = useState<string | null>(null);

  const storeId = currentStore?.id ?? "";
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

  // Built-in themes (legacy endpoint)
  const { data: builtinThemes = [], isLoading: themesLoading } = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
  });

  // Store-scoped themes including external (new endpoint)
  const { data: storeThemes } = useQuery({
    queryKey: ["store-themes", storeId],
    queryFn: () => fetchStoreThemes(storeId),
    enabled: !!storeId,
  });

  const { data: customization, isLoading: custLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  const switchMutation = useMutation({
    mutationFn: async (themeId: string) => {
      // Save the theme to draft, then auto-publish so storefront picks it up
      await updateCustomization(storeId, { theme: { base_theme: themeId } });
      await publishCustomization(storeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      toast.success(isRTL ? "تم تغيير ونشر الثيم" : "Theme switched & published");
      setSwitchTarget(null);
    },
    onError: (err) => showError(err),
  });

  // ─── External theme submission ───────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!githubUrl.trim()) throw new Error("GitHub URL is required");
      return submitExternalTheme(storeId, githubUrl.trim());
    },
    onSuccess: (data) => {
      setActiveBuildId(data.build_id);
      setBuildStatus(data.status);
      setBuildError(null);
      toast.success(isRTL ? "بدأ بناء الثيم" : "Theme build started");
    },
    onError: (err) => {
      showError(err);
      setBuildError(err instanceof Error ? err.message : "Build failed");
    },
  });

  // Poll build status while building
  useEffect(() => {
    if (!activeBuildId || !storeId) return;
    if (buildStatus === "complete" || buildStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const status = await fetchBuildStatus(storeId, activeBuildId);
        setBuildStatus(status.status);
        if (status.status === "complete") {
          clearInterval(interval);
          toast.success(isRTL ? "تم بناء الثيم بنجاح! 🎉" : "Theme built successfully! 🎉");
          queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
          queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
          // Close modal after a short delay
          setTimeout(() => {
            setSubmitOpen(false);
            setGithubUrl("");
            setActiveBuildId(null);
            setBuildStatus(null);
          }, 2000);
        } else if (status.status === "failed") {
          clearInterval(interval);
          setBuildError(status.error || "Build failed");
          toast.error(isRTL ? "فشل بناء الثيم" : "Theme build failed");
        }
      } catch (e) {
        // Continue polling on transient errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBuildId, storeId, buildStatus, isRTL, queryClient]);

  // Remove external theme
  
  const [rebuildBranch, setRebuildBranch] = useState("main");
  const validateThemeMutation = useMutation({
    mutationFn: () => validateExternalTheme(storeId),
    onSuccess: (res) => {
      if(res.data) {
        let msg = res.data.valid ? "Theme is valid!\n" : "Theme has errors.\n";
        res.data.errors.forEach((e: any) => msg += `- Error: ${e.message}\n`);
        res.data.warnings.forEach((w: any) => msg += `- Warning: ${w.message}\n`);
        toast[res.data.valid ? "success" : "error"](res.data.valid ? "Validation Passed" : "Validation Failed", { description: msg });
      }
    },
    onError: (err: any) => toast.error("Validation Error", { description: err.message || "Failed validate." })
  });

  const rebuildThemeMutation = useMutation({
    mutationFn: () => rebuildExternalTheme(storeId, rebuildBranch),
    onSuccess: (res) => {
      toast.success("Rebuild Started", { description: res.data.message || "Task queued." });
      setPollBuildId(res.data.task_id || null);
    },
    onError: (err: any) => toast.error("Rebuild Error", { description: err.message || "Failed queue." })
  });

  const removeExternalMutation = useMutation({
    mutationFn: () => removeExternalTheme(storeId, "modern"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم إزالة الثيم الخارجي" : "External theme removed");
    },
    onError: (err) => showError(err),
  });

  // Connect local dev server (numu-theme dev)
  const connectDevMutation = useMutation({
    mutationFn: async () => {
      if (!devUrl.trim()) throw new Error("Dev URL is required");
      return connectDevServer(storeId, devUrl.trim());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(
        isRTL
          ? `تم الاتصال بـ ${data.theme_id} 🎉`
          : `Connected to ${data.theme_id} 🎉`,
      );
      setDevOpen(false);
      setDevError(null);
    },
    onError: (err) => {
      showError(err);
      setDevError(err instanceof Error ? err.message : "Failed to connect");
    },
  });

  // Merge built-in themes with the store's external theme (if any)
  const externalThemeFromStore = storeThemes?.themes?.find((t) => t.is_external);
  const themes: AvailableTheme[] = [
    ...builtinThemes,
    ...(externalThemeFromStore
      ? [
          {
            id: externalThemeFromStore.id,
            name: externalThemeFromStore.name,
            nameAr: externalThemeFromStore.nameAr,
            layout: externalThemeFromStore.layout as any,
            description: externalThemeFromStore.description,
          },
        ]
      : []),
  ];

  const activeThemeId = customization?.theme?.base_theme ?? themes[0]?.id;
  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0];
  const libraryThemes = themes.filter((t) => t.id !== activeThemeId);
  const isLoading = themesLoading || custLoading;
  const isExternalActive = externalThemeFromStore?.id === activeThemeId;

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
                    onCustomize={() => navigate(`/online-store/themes/editor?theme=${theme.id}`)}
                  />
                ))}
          </div>
        </section>
      )}

      {/* External theme (BYOT) section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
            {isRTL ? "الثيمات المخصصة (BYOT)" : "Custom themes (BYOT)"}
          </p>
          {externalThemeFromStore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => removeExternalMutation.mutate()}
              disabled={removeExternalMutation.isPending}
            >
              {removeExternalMutation.isPending ? (
                <Loader2 className="h-3 w-3 me-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 me-1.5" />
              )}
              {isRTL ? "إزالة الثيم الخارجي" : "Remove external theme"}
            </Button>
          )}
        </div>

        {externalThemeFromStore ? (
          <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold">
                    {isRTL ? externalThemeFromStore.nameAr : externalThemeFromStore.name}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {isRTL ? "خارجي" : "External"}
                  </Badge>
                  {externalThemeFromStore.mode === "dev" && (
                    <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                      {isRTL ? "وضع التطوير" : "Dev mode"}
                    </Badge>
                  )}
                  {isExternalActive && (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                      {isRTL ? "نشط" : "Active"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {externalThemeFromStore.description}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  {externalThemeFromStore.version && (
                    <span className="text-[10px] text-muted-foreground">
                      v{externalThemeFromStore.version}
                    </span>
                  )}
                  {externalThemeFromStore.source_repo && (
                    <a
                      href={externalThemeFromStore.source_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Github className="h-3 w-3" />
                      {isRTL ? "المصدر" : "Source"}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {!isExternalActive && (
                  <Button
                    size="sm"
                    onClick={() => switchMutation.mutate(externalThemeFromStore.id)}
                    disabled={switchMutation.isPending}
                  >
                    {switchMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                    )}
                    {isRTL ? "تفعيل" : "Activate"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/online-store/themes/editor?theme=${externalThemeFromStore.id}`)}
                >
                  <Pencil className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "تخصيص" : "Customize"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Production: GitHub repo → build pipeline → CDN */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-br from-primary/5 via-background to-primary/3 p-5">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Github className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isRTL ? "إنتاج (من GitHub)" : "Production (from GitHub)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? "اربط مستودع GitHub — سنبنيه ونرفعه على CDN تلقائيًا"
                      : "Connect a GitHub repo — we'll build & deploy it to the CDN"}
                  </p>
                </div>
                <Button size="sm" className="w-full" onClick={() => setSubmitOpen(true)}>
                  <Github className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "إضافة من GitHub" : "Add from GitHub"}
                </Button>
              </div>
            </div>

            {/* Dev: Local dev server (numu-theme dev) */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-br from-amber-500/5 via-background to-amber-500/3 p-5">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isRTL ? "تطوير (محلي)" : "Dev (local server)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? "شغّل numu-theme dev في مجلد ثيمك واربط الـURL هنا"
                      : "Run `numu-theme dev` in your theme repo and paste the URL here"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => setDevOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "اربط خادم التطوير" : "Connect dev server"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

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

      {/* External theme submission modal */}
      <Dialog
        open={submitOpen}
        onOpenChange={(open) => {
          if (!submitMutation.isPending && !activeBuildId) {
            setSubmitOpen(open);
            if (!open) {
              setGithubUrl("");
              setBuildError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              {isRTL ? "إضافة ثيم خارجي" : "Add external theme"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "أدخل رابط مستودع GitHub العام يحتوي على ثيم Prism."
                : "Enter the public GitHub URL of a Prism-compatible theme."}
            </DialogDescription>
          </DialogHeader>

          {/* Form */}
          {!activeBuildId && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="github-url" className="text-xs">
                  {isRTL ? "رابط GitHub" : "GitHub URL"}
                </Label>
                <Input
                  id="github-url"
                  placeholder="https://github.com/user/my-numu-theme"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={submitMutation.isPending}
                  dir="ltr"
                />
              </div>
              {buildError && (
                <p className="text-xs text-destructive">{buildError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isRTL
                  ? "يجب أن يحتوي المستودع على theme.json و settings_schema.json و styles.css و index.ts."
                  : "The repo must contain theme.json, settings_schema.json, styles.css, and index.ts."}
              </p>
            </div>
          )}

          {/* Build progress */}
          {activeBuildId && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                {buildStatus === "complete" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : buildStatus === "failed" ? (
                  <Trash2 className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {buildStatus === "queued" && (isRTL ? "في الانتظار..." : "Queued...")}
                    {buildStatus === "cloning" && (isRTL ? "جاري الاستنساخ..." : "Cloning repository...")}
                    {buildStatus === "validating" && (isRTL ? "جاري التحقق..." : "Validating contract...")}
                    {buildStatus === "building" && (isRTL ? "جاري البناء..." : "Building theme...")}
                    {buildStatus === "uploading" && (isRTL ? "جاري الرفع..." : "Uploading to CDN...")}
                    {buildStatus === "complete" && (isRTL ? "تم بنجاح! 🎉" : "Complete! 🎉")}
                    {buildStatus === "failed" && (isRTL ? "فشل البناء" : "Build failed")}
                  </p>
                  <p className="text-xs text-muted-foreground">Build ID: {activeBuildId.slice(0, 8)}</p>
                </div>
              </div>
              {buildError && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive break-words">{buildError}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!activeBuildId ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setSubmitOpen(false)}
                  disabled={submitMutation.isPending}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !githubUrl.trim()}
                >
                  {submitMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                  )}
                  {isRTL ? "بناء الثيم" : "Build theme"}
                </Button>
              </>
            ) : buildStatus === "failed" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setActiveBuildId(null);
                  setBuildStatus(null);
                  setBuildError(null);
                }}
              >
                {isRTL ? "حاول مرة أخرى" : "Try again"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Dev Server modal */}
      <Dialog
        open={devOpen}
        onOpenChange={(open) => {
          if (!connectDevMutation.isPending) {
            setDevOpen(open);
            if (!open) setDevError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              {isRTL ? "اربط خادم التطوير" : "Connect Dev Server"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "شغّل numu-theme dev في مجلد ثيمك ثم الصق الـURL الذي يظهر هنا."
                : "Run `numu-theme dev` in your theme folder and paste the URL it prints here."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dev-url" className="text-xs">
                {isRTL ? "رابط خادم التطوير" : "Dev server URL"}
              </Label>
              <Input
                id="dev-url"
                placeholder="http://localhost:4321"
                value={devUrl}
                onChange={(e) => setDevUrl(e.target.value)}
                disabled={connectDevMutation.isPending}
                dir="ltr"
              />
            </div>

            {devError && (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-xs text-destructive break-words">{devError}</p>
              </div>
            )}

            {/* Quick instructions */}
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isRTL ? "كيف تشغل الخادم؟" : "How to start the server"}
              </p>
              <pre className="text-[11px] font-mono text-muted-foreground bg-background/50 px-2 py-1.5 rounded overflow-x-auto" dir="ltr">
{`cd my-theme
npx numu-theme dev`}
              </pre>
              <p className="text-[10px] text-muted-foreground/80">
                {isRTL
                  ? "في وضع التطوير لا يتم تخزين الثيم مؤقتًا — التغييرات تظهر فور التحديث."
                  : "Dev mode disables caching — changes appear on refresh."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDevOpen(false)}
              disabled={connectDevMutation.isPending}
            >
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => connectDevMutation.mutate()}
              disabled={connectDevMutation.isPending || !devUrl.trim()}
            >
              {connectDevMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              )}
              {isRTL ? "اتصل" : "Connect"}
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
