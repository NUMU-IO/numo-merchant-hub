/**
 * My Theme Submissions — developer-facing dashboard.
 *
 * Listed under /online-store/my-themes for any merchant who has also
 * created marketplace listings (the backend filter `developer_id =
 * current user` makes the page empty for non-developers, so we don't
 * gate visibility further on the frontend).
 *
 * Three things this page does:
 *   1. Lists the developer's themes with status badges (draft, pending
 *      review, published, rejected). The catalog/admin pipeline is the
 *      source of truth — we just visualize it.
 *   2. Per theme, expands the version history with build status,
 *      release notes, and (when set by an admin reviewer) review
 *      notes. Failed-build versions show a placeholder for the build
 *      log; the full log is currently inspected in the admin tool.
 *   3. "Install on this store" — uses the developer-install endpoint,
 *      which bypasses the must-be-published gate so a dev can run
 *      their unpublished build on their own store immediately.
 *
 * Why we don't merge with /online-store/themes:
 *   That page is the merchant-facing catalog (built-in + active
 *   external + marketplace install picker). Cluttering it with the
 *   developer's submission state was rejected during scoping —
 *   different audience, different mental model.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Package,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  activateTheme,
  developerInstallTheme,
  listMyThemes,
  listMyVersions,
  type MarketplaceTheme,
  type MarketplaceThemeStatus,
  type MarketplaceVersion,
  type MarketplaceVersionStatus,
} from "@/services/marketplaceDeveloperApi";

// ── Status helpers ─────────────────────────────────────────────────────────

const THEME_STATUS_VARIANT: Record<
  MarketplaceThemeStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  pending_review: { label: "Pending review", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  suspended: { label: "Suspended", variant: "destructive" },
};

const VERSION_STATUS_VARIANT: Record<
  MarketplaceVersionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }
> = {
  pending_build: { label: "Pending build", variant: "outline", icon: Clock },
  building: { label: "Building", variant: "outline", icon: Loader2 },
  build_failed: { label: "Build failed", variant: "destructive", icon: XCircle },
  pending_review: { label: "Pending review", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  published: { label: "Published", variant: "default", icon: CheckCircle2 },
};

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

// ── Version row ────────────────────────────────────────────────────────────

function VersionRow({ version }: { version: MarketplaceVersion }) {
  const meta = VERSION_STATUS_VARIANT[version.status];
  const Icon = meta.icon;
  // Spinner animation for building state — Loader2 renders motionless
  // without it.
  const iconClass =
    version.status === "building" ? "h-3 w-3 animate-spin" : "h-3 w-3";

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">v{version.version_string}</span>
          <Badge variant={meta.variant} className="gap-1">
            <Icon className={iconClass} />
            {meta.label}
          </Badge>
        </div>
        {version.release_notes && (
          <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
            {version.release_notes}
          </div>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatDate(version.created_at)}
          {version.checksum && (
            <>
              {" · "}
              <span className="font-mono">
                sha256:{version.checksum.slice(0, 12)}…
              </span>
            </>
          )}
        </div>
      </div>
      {version.bundle_url && (
        <a
          href={version.bundle_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          <Download className="h-3 w-3" />
          Bundle
        </a>
      )}
    </div>
  );
}

// ── Theme card ─────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  storeId,
  onInstalled,
}: {
  theme: MarketplaceTheme;
  storeId: string | undefined;
  onInstalled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = THEME_STATUS_VARIANT[theme.status];

  const versionsQuery = useQuery({
    queryKey: ["my-theme-versions", theme.id],
    queryFn: () => listMyVersions(theme.id),
    enabled: expanded,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("No active store selected");
      const result = await developerInstallTheme(storeId, theme.id);
      // Auto-activate so the merchant doesn't need a second click —
      // they explicitly asked to use this theme on this store. Skipping
      // activate here would leave them at "installed but not in use".
      await activateTheme(storeId, theme.id);
      return result;
    },
    onSuccess: (data) => {
      toast.success(
        `Installed v${data.version_string} (${data.version_status}) on this store`,
      );
      onInstalled();
    },
    onError: (err) =>
      toast.error((err as Error).message || "Install failed"),
  });

  const hasInstallableVersion =
    !versionsQuery.isLoading &&
    (versionsQuery.data ?? []).some((v) => v.bundle_url);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <span className="truncate">{theme.name}</span>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {theme.price_cents > 0 && (
                <Badge variant="outline">
                  {(theme.price_cents / 100).toFixed(2)} {theme.currency}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 truncate">
              {theme.short_description ?? theme.description ?? theme.slug}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={
                !storeId ||
                installMutation.isPending ||
                (expanded && !hasInstallableVersion)
              }
              onClick={() => installMutation.mutate()}
              title={
                !storeId
                  ? "Select a store first"
                  : "Install on the active store (bypasses publish gate)"
              }
            >
              {installMutation.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Download className="mr-2 h-3 w-3" />
              )}
              Install on my store
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-3" />
          <div className="text-xs uppercase text-muted-foreground mb-2">
            Versions
          </div>
          {versionsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
            </div>
          ) : versionsQuery.error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Failed to load versions
            </div>
          ) : (versionsQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No versions yet. Submit your first build via{" "}
              <code>numu-theme submit</code>.
            </div>
          ) : (
            <div className="divide-y">
              {versionsQuery.data!.map((v) => (
                <VersionRow key={v.id} version={v} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MyThemeSubmissions() {
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();

  const themesQuery = useQuery({
    queryKey: ["my-marketplace-themes"],
    queryFn: listMyThemes,
  });

  const themes = themesQuery.data ?? [];
  const onInstalled = () => {
    queryClient.invalidateQueries({ queryKey: ["my-marketplace-themes"] });
    queryClient.invalidateQueries({ queryKey: ["store-themes"] });
  };

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My Theme Submissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Themes you've submitted to the marketplace. Install your own
          drafts on this store immediately — no need to wait for review.
        </p>
      </div>

      {themesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : themesQuery.error ? (
        <Card>
          <CardContent className="py-6 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Failed to load your submissions. Try refreshing.
            </span>
          </CardContent>
        </Card>
      ) : themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div className="text-base font-medium">No submissions yet</div>
            <div className="text-sm text-muted-foreground max-w-md">
              Run <code>numu-theme init</code> to scaffold a theme,{" "}
              <code>numu-theme dev</code> to design it, then{" "}
              <code>numu-theme submit</code> to publish it here.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {themes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              storeId={currentStore?.id}
              onInstalled={onInstalled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
