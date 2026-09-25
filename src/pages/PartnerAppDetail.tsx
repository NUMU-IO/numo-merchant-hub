/**
 * Partner portal → one app, edited in tabs:
 *
 * - General: OAuth credentials, the permissions the app asks merchants for,
 *   and embedding in the merchant hub.
 * - App details: the store listing (reviewed on its own), the app's links
 *   and support contacts, and installing it on a development store.
 * - Webhooks: endpoint groups, each receiving the events it picks.
 * - Plans: what merchants pay.
 * - Publish: what still blocks review, "Submit for review", the review
 *   history and versions. The CLI's manifest upload stays here too.
 *
 * General, links, webhooks and plans save into the app's draft
 * (``/draft``), which may be incomplete; "Submit for review" turns it and the
 * listing into the next version.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Loader2,
  Plus,
  Send,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api-error";
import { showError } from "@/lib/show-error";
import { cn } from "@/lib/utils";
import {
  devInstallApp,
  getAppDraft,
  getPartnerApp,
  listAppApiLogs,
  listDevStores,
  publishAppVersion,
  rotateAppSecret,
  saveAppDraft,
  submitAppDraft,
  uploadAppVersion,
  uploadListingScreenshot,
  type AppDraft,
  type AppDraftState,
  type AppPricing,
} from "@/services/partnersApi";
import { partnerPath } from "@/lib/partner-host";
import { SecretOnce, appStatusChip } from "@/pages/PartnerApps";
import { AppReviewTimeline } from "@/components/partners/AppReviewTimeline";
import { AppListingEditor } from "@/components/partners/AppListingEditor";

const TABS = ["general", "app-details", "webhooks", "plans", "publish", "logs"] as const;
type Tab = (typeof TABS)[number];
const DOCS = "https://docs.numueg.app";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CopyField({ label, value, masked, action }: { label: string; value: string; masked?: boolean; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-12 items-center gap-2 rounded-lg border bg-card px-3">
        <code dir="ltr" className="flex-1 truncate text-sm">
          {masked ? "•".repeat(36) : value}
        </code>
        {action}
        {!masked && (
          <button
            type="button"
            aria-label={t("partnerApps.copy")}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(value);
              toast.success(t("partnerApps.copied"));
            }}
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function useDraft(id: string) {
  const qc = useQueryClient();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const draft = useQuery({ queryKey: ["partners", "apps", id, "draft"], queryFn: () => getAppDraft(id) });
  const save = useMutation({
    mutationFn: (changes: Partial<Record<keyof AppDraft, unknown>>) => saveAppDraft(id, changes),
    onSuccess: (state) => {
      qc.setQueryData(["partners", "apps", id, "draft"], state);
      toast.success(t("partnerApps.saved"));
    },
    onError: (err) => showError(err, language),
  });
  return { draft, save };
}

// ─── General ─────────────────────────────────────────────────────────

const LEVELS = ["none", "read", "write"] as const;

function scopeLevel(scopes: string[], domain: string) {
  if (scopes.includes(`${domain}:write`)) return "write";
  if (scopes.includes(`${domain}:read`)) return "read";
  return "none";
}

function GeneralTab({ appId, clientId, state }: { appId: string; clientId: string | null; state: AppDraftState }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { save } = useDraft(appId);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const oauth = state.draft.oauth ?? { redirect_urls: [], scopes: [] };
  const [scopes, setScopes] = useState<string[]>(oauth.scopes);
  const [embedded, setEmbedded] = useState(Boolean(state.draft.embedded));
  const [embeddedPath, setEmbeddedPath] = useState(state.draft.embedded_path ?? "");

  const domains = useMemo(() => {
    const out = new Map<string, Set<string>>();
    for (const s of state.meta.scopes) {
      const [d, level] = s.split(":");
      out.set(d, (out.get(d) ?? new Set()).add(level));
    }
    return [...out.entries()];
  }, [state.meta.scopes]);

  const setLevel = (domain: string, level: (typeof LEVELS)[number]) => {
    const rest = scopes.filter((s) => !s.startsWith(`${domain}:`));
    setScopes(level === "none" ? rest : level === "read" ? [...rest, `${domain}:read`] : [...rest, `${domain}:read`, `${domain}:write`]);
  };

  const rotate = useMutation({
    mutationFn: () => rotateAppSecret(appId),
    onSuccess: (r) => setSecret(r.client_secret),
    onError: (err) => showError(err, language),
  });

  return (
    <div>
      <Section title={t("partnerApps.general")} description={t("partnerApps.generalBody")}>
        <div />
      </Section>
      <Section title={t("partnerApps.apiKeys")} description={t("partnerApps.apiKeysBody")}>
        {secret && <SecretOnce secret={secret} onDone={() => setSecret(null)} />}
        <CopyField label={t("partnerApps.authorizeUrl")} value={state.meta.authorize_url} />
        <CopyField label={t("partnerApps.tokenUrl")} value={state.meta.token_url} />
        <CopyField label={t("partnerApps.clientId")} value={clientId ?? ""} />
        <CopyField
          label={t("partnerApps.clientSecret")}
          value=""
          masked
          action={
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setConfirmRotate(true)} disabled={rotate.isPending}>
              {t("partnerApps.rotate")}
            </Button>
          }
        />
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="font-semibold">{t("partnerApps.testAuth")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("partnerApps.testAuthBody")}</p>
          <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
            <a href={`${DOCS}/go/Overview`} target="_blank" rel="noreferrer">
              <ExternalLink className="me-1.5 h-4 w-4" />
              {t("partnerApps.devDocs")}
            </a>
          </Button>
        </div>
        <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("partnerApps.rotate")}</AlertDialogTitle>
              <AlertDialogDescription>{t("partnerApps.rotateConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => rotate.mutate()}>{t("partnerApps.rotate")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <Section title={t("partnerApps.permissions")} description={t("partnerApps.permissionsBody")}>
        <div className="divide-y rounded-xl border">
          {domains.map(([domain, levels]) => {
            const current = scopeLevel(scopes, domain);
            const options = LEVELS.filter((l) => l === "none" || levels.has(l));
            return (
              <div key={domain} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{t(`partnerApps.scope_${domain}`, { defaultValue: domain })}</p>
                  <bdi dir="ltr" className="text-xs text-muted-foreground">{domain}</bdi>
                </div>
                <div className="inline-flex rounded-lg border p-0.5">
                  {options.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(domain, l)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs",
                        current === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t(`partnerApps.level_${l}`)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <Button
          className="rounded-full"
          disabled={save.isPending}
          onClick={() => save.mutate({ oauth: { ...oauth, scopes } })}
        >
          {t("partnerApps.savePermissions")}
        </Button>
      </Section>

      <Section title={t("partnerApps.embedTitle")} description={t("partnerApps.embedBody")}>
        <div className="flex items-center gap-2">
          <Switch id="embedded" checked={embedded} onCheckedChange={setEmbedded} />
          <Label htmlFor="embedded">{t("partnerApps.embedToggle")}</Label>
        </div>
        {embedded && (
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="embedded-path">{t("partnerApps.embedPath")}</Label>
            <Input id="embedded-path" dir="ltr" placeholder="/" value={embeddedPath} onChange={(e) => setEmbeddedPath(e.target.value)} />
          </div>
        )}
        <Button
          variant="outline"
          className="rounded-full"
          disabled={save.isPending}
          onClick={() => save.mutate({ embedded, embedded_path: embedded && embeddedPath.trim() ? embeddedPath.trim() : null })}
        >
          {t("partnerApps.saveEmbed")}
        </Button>
      </Section>
    </div>
  );
}

// ─── App details ─────────────────────────────────────────────────────

function LinksSection({ appId, state }: { appId: string; state: AppDraftState }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { save } = useDraft(appId);
  const d = state.draft;
  const [appUrl, setAppUrl] = useState(d.app_url ?? "");
  const [redirects, setRedirects] = useState((d.oauth?.redirect_urls ?? []).join("\n"));
  const [dev, setDev] = useState({
    support_email: d.developer?.support_email ?? "",
    support_url: d.developer?.support_url ?? "",
    privacy_policy_url: d.developer?.privacy_policy_url ?? "",
    terms_url: d.developer?.terms_url ?? "",
  });
  const [icon, setIcon] = useState(d.icon ?? "");
  const [uploading, setUploading] = useState(false);

  const field = (key: keyof typeof dev, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`dev-${key}`}>{label}</Label>
      <Input id={`dev-${key}`} dir="ltr" value={dev[key]} onChange={(e) => setDev({ ...dev, [key]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <>
      <Section title={t("partnerApps.linksTitle")} description={t("partnerApps.linksBody")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="app-url">{t("partnerApps.appUrl")}</Label>
            <Input id="app-url" dir="ltr" placeholder="https://" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("partnerApps.httpsOnly")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirects">{t("partnerApps.redirectUrls")}</Label>
            <Textarea id="redirects" dir="ltr" rows={3} placeholder="https://example.com/oauth/callback" value={redirects} onChange={(e) => setRedirects(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("partnerApps.redirectHint")}</p>
          </div>
        </div>
      </Section>
      <Section title={t("partnerApps.supportTitle")} description={t("partnerApps.supportBody")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("support_email", t("partnerApps.supportEmail"), t("partnerApps.supportEmailHint"))}
          {field("support_url", t("partnerApps.supportUrl"))}
          {field("privacy_policy_url", t("partnerApps.privacyUrl"), t("partnerApps.privacyHint"))}
          {field("terms_url", t("partnerApps.termsUrl"))}
        </div>
      </Section>
      <Section title={t("partnerApps.iconTitle")} description={t("partnerApps.iconBody")}>
        <div className="flex items-center gap-4">
          {icon ? (
            <img src={icon} alt="" className="h-16 w-16 rounded-xl border object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-xl border border-dashed" />
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-muted">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {icon ? t("partnerApps.replace") : t("partnerApps.uploadIcon")}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  setIcon((await uploadListingScreenshot(appId, file)).url);
                } catch (err) {
                  showError(err, language);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
      </Section>
      <Button
        className="mt-2 rounded-full"
        disabled={save.isPending}
        onClick={() =>
          save.mutate({
            app_url: appUrl.trim() || null,
            icon: icon || null,
            oauth: {
              ...(d.oauth ?? { scopes: [] }),
              redirect_urls: redirects
                .split(/\s+/)
                .map((u) => u.trim())
                .filter(Boolean),
            },
            developer: Object.fromEntries(Object.entries(dev).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
          })
        }
      >
        {t("partnerApps.saveDetails")}
      </Button>
    </>
  );
}

function DevStoreSection({ appId }: { appId: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const stores = useQuery({ queryKey: ["partners", "dev-stores"], queryFn: listDevStores });
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const install = useMutation({
    mutationFn: (storeId: string) => devInstallApp(appId, storeId),
    onSuccess: (_r, storeId) => {
      setInstalled((s) => new Set(s).add(storeId));
      toast.success(t("partnerApps.devInstalled"));
    },
    onError: (err) => showError(err, language),
  });
  return (
    <Section title={t("partnerApps.devInstall")} description={t("partnerApps.devInstallBody")}>
      {(stores.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("partnerApps.noDevStores")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {stores.data!.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium">{s.name}</p>
                {s.url && (
                  <bdi dir="ltr" className="truncate text-xs text-muted-foreground">{s.url}</bdi>
                )}
              </div>
              {installed.has(s.id) ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("partnerApps.installed")}
                </span>
              ) : (
                <Button size="sm" variant="outline" className="rounded-full" disabled={install.isPending} onClick={() => install.mutate(s.id)}>
                  {t("partnerApps.devInstallBtn")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── Webhooks ────────────────────────────────────────────────────────

const LIFECYCLE = ["app.uninstalled", "store.redact"];

function WebhooksTab({ appId, state }: { appId: string; state: AppDraftState }) {
  const { t } = useTranslation();
  const { save } = useDraft(appId);
  const initial = useMemo(() => {
    const byUrl = new Map<string, string[]>();
    for (const w of state.draft.webhooks ?? []) byUrl.set(w.url, [...(byUrl.get(w.url) ?? []), w.event]);
    return [...byUrl.entries()].map(([url, events]) => ({ url, events }));
  }, [state.draft.webhooks]);
  const [groups, setGroups] = useState(initial);
  const update = (i: number, g: { url: string; events: string[] }) => setGroups(groups.map((x, j) => (j === i ? g : x)));
  const hasUninstall = groups.some((g) => g.url.trim() && g.events.includes("app.uninstalled"));

  return (
    <Section title={t("partnerApps.webhooksTitle")} description={t("partnerApps.webhooksBody")}>
      {!hasUninstall && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t("partnerApps.uninstallRequired")}
        </p>
      )}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="font-semibold">{t("partnerApps.noWebhookGroups")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("partnerApps.noWebhookGroupsBody")}</p>
        </div>
      ) : (
        groups.map((g, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`wh-${i}`}>{t("partnerApps.webhookUrl")}</Label>
                <Input id={`wh-${i}`} dir="ltr" placeholder="https://" value={g.url} onChange={(e) => update(i, { ...g, url: e.target.value })} />
              </div>
              <Button variant="ghost" size="icon" aria-label={t("partnerApps.remove")} onClick={() => setGroups(groups.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {state.meta.events.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={g.events.includes(ev)}
                    onCheckedChange={(on) =>
                      update(i, { ...g, events: on ? [...g.events, ev] : g.events.filter((x) => x !== ev) })
                    }
                  />
                  <bdi dir="ltr" className={cn(LIFECYCLE.includes(ev) && "font-semibold")}>{ev}</bdi>
                </label>
              ))}
            </div>
          </div>
        ))
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" onClick={() => setGroups([...groups, { url: "", events: ["app.uninstalled"] }])}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("partnerApps.addWebhookGroup")}
        </Button>
        <Button
          className="rounded-full"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              webhooks: groups
                .filter((g) => g.url.trim())
                .flatMap((g) => g.events.map((event) => ({ event, url: g.url.trim() }))),
            })
          }
        >
          {t("partnerApps.saveWebhooks")}
        </Button>
      </div>
    </Section>
  );
}

// ─── Plans ───────────────────────────────────────────────────────────

function PlansTab({ appId, state }: { appId: string; state: AppDraftState }) {
  const { t } = useTranslation();
  const { save } = useDraft(appId);
  const current = state.draft.pricing ?? { model: "free" };
  const [p, setP] = useState<AppPricing>(current);
  const billing = state.meta.billing_enabled;
  const models: AppPricing["model"][] = ["free", "external", "recurring"];

  return (
    <Section title={t("partnerApps.plansTitle")} description={t("partnerApps.plansBody")}>
      <div className="grid gap-3 sm:grid-cols-3">
        {models.map((m) => {
          const locked = m === "recurring" && !billing;
          return (
            <button
              key={m}
              type="button"
              disabled={locked}
              onClick={() => setP(m === "recurring" ? { model: m, price_cents: p.price_cents ?? 9900, cycle: p.cycle ?? "monthly", trial_days: p.trial_days } : m === "external" ? { model: m, label: p.label ?? { ar: "", en: "" } } : { model: m })}
              className={cn(
                "rounded-xl border p-4 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                p.model === m ? "border-primary ring-1 ring-primary" : "hover:bg-muted/40",
              )}
            >
              <p className="font-semibold">{t(`partnerApps.plan_${m}`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {locked ? t("partnerApps.billingNotLive") : t(`partnerApps.plan_${m}Body`)}
              </p>
            </button>
          );
        })}
      </div>
      {current.model === "usage" && <p className="text-sm text-muted-foreground">{t("partnerApps.usageViaCli")}</p>}
      {p.model === "external" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="label-ar">{t("partnerApps.priceLabelAr")}</Label>
            <Input id="label-ar" dir="rtl" value={p.label?.ar ?? ""} onChange={(e) => setP({ ...p, label: { ar: e.target.value, en: p.label?.en ?? "" } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label-en">{t("partnerApps.priceLabelEn")}</Label>
            <Input id="label-en" dir="ltr" value={p.label?.en ?? ""} onChange={(e) => setP({ ...p, label: { ar: p.label?.ar ?? "", en: e.target.value } })} />
          </div>
        </div>
      )}
      {p.model === "recurring" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="price">{t("partnerApps.priceEgp")}</Label>
            <Input id="price" type="number" min={5} dir="ltr" value={(p.price_cents ?? 0) / 100} onChange={(e) => setP({ ...p, price_cents: Math.round(Number(e.target.value) * 100) })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("partnerApps.cycle")}</Label>
            <Select value={p.cycle ?? "monthly"} onValueChange={(v) => setP({ ...p, cycle: v as "monthly" | "annual" })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("partnerApps.monthly")}</SelectItem>
                <SelectItem value="annual">{t("partnerApps.annual")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trial">{t("partnerApps.trialDays")}</Label>
            <Input id="trial" type="number" min={0} max={90} dir="ltr" value={p.trial_days ?? 0} onChange={(e) => setP({ ...p, trial_days: Number(e.target.value) || undefined })} />
          </div>
        </div>
      )}
      <Button className="rounded-full" disabled={save.isPending || current.model === "usage"} onClick={() => save.mutate({ pricing: p })}>
        {t("partnerApps.savePlan")}
      </Button>
    </Section>
  );
}

// ─── Publish ─────────────────────────────────────────────────────────

function PublishTab({ appId, state, onChanged }: { appId: string; state: AppDraftState; onChanged: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const app = useQuery({ queryKey: ["partners", "apps", appId], queryFn: () => getPartnerApp(appId) });
  const a = app.data;
  const chip = a ? appStatusChip(a) : null;
  const ready = state.problems.length === 0;

  const submit = useMutation({
    mutationFn: () => submitAppDraft(appId),
    onSuccess: () => {
      toast.success(t("partnerApps.submitted"));
      void qc.invalidateQueries({ queryKey: ["partners", "apps", appId] });
      onChanged();
    },
    onError: (err) => showError(err, language),
  });
  const publish = useMutation({
    mutationFn: (versionId: string) => publishAppVersion(appId, versionId),
    onSuccess: () => {
      toast.success(t("partnerApps.published"));
      void qc.invalidateQueries({ queryKey: ["partners", "apps"] });
    },
    onError: (err) => showError(err, language),
  });

  return (
    <div>
      <Section title={t("partnerApps.publishTitle")} description={t("partnerApps.publishBody")}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{t("partnerApps.currentStatus")}</span>
          {chip && <span className={cn("rounded-full px-2.5 py-0.5 text-xs", chip.tone)}>{t(`partnerApps.chip_${chip.key}`)}</span>}
        </div>
        {ready ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t("partnerApps.readyToSubmit", { version: state.next_version })}
          </p>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">{t("partnerApps.stillMissing")}</p>
            <ul dir="ltr" className="list-disc space-y-1 ps-5 text-xs text-amber-900 dark:text-amber-200">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("partnerApps.submitExplain")}</p>
        <Button className="w-fit rounded-full" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4 rtl:-scale-x-100" />}
          {a?.private_store_id ? t("partnerApps.saveVersion") : t("partnerApps.submitForReview")}
        </Button>
      </Section>

      {a && a.versions.length > 0 && (
        <Section title={t("partnerApps.versions")}>
          <ul className="divide-y rounded-xl border">
            {a.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
                <bdi dir="ltr" className="font-medium">v{v.version}</bdi>
                <Badge variant={v.status === "published" ? "default" : "secondary"}>{t(`partnerApps.st_${v.status}`)}</Badge>
                {v.review_notes && (
                  <p className="w-full whitespace-pre-line text-sm text-muted-foreground">
                    {v.review_notes[language as "ar" | "en"] ?? v.review_notes.en}
                  </p>
                )}
                <div className="flex-1" />
                {v.status === "approved" && (
                  <Button size="sm" className="rounded-full" disabled={publish.isPending} onClick={() => publish.mutate(v.id)}>
                    {t("partnerApps.publish")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="py-6">
        <AppReviewTimeline appId={appId} />
      </div>

      <ManifestUpload appId={appId} onUploaded={onChanged} />
    </div>
  );
}

function ManifestUpload({ appId, onUploaded }: { appId: string; onUploaded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [manifest, setManifest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: (parsed: unknown) => uploadAppVersion(appId, { manifest: parsed }),
    onSuccess: () => {
      toast.success(t("partnerApps.uploaded"));
      setManifest("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["partners", "apps", appId] });
      onUploaded();
    },
    onError: (err) => {
      const body = err instanceof ApiError ? (err.body as { error?: unknown } | null) : null;
      setError(body?.error ? JSON.stringify(body.error, null, 2) : String(err));
    },
  });
  return (
    <Section title={t("partnerApps.upload")} description={t("partnerApps.manifestHint")}>
      {!open ? (
        <Button variant="outline" size="sm" className="w-fit rounded-full" onClick={() => setOpen(true)}>
          {t("partnerApps.uploadOpen")}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              upload.mutate(JSON.parse(manifest));
            } catch {
              setError(t("partnerApps.badJson"));
            }
          }}
        >
          <Textarea dir="ltr" rows={10} className="font-mono text-xs" value={manifest} onChange={(e) => setManifest(e.target.value)} aria-label={t("partnerApps.manifest")} />
          <input
            type="file"
            accept="application/json,.json"
            aria-label={t("partnerApps.chooseFile")}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setManifest(await file.text());
            }}
          />
          {error && (
            <pre dir="ltr" className="max-h-60 overflow-auto rounded-md border border-destructive/50 p-2 text-xs text-destructive">
              {error}
            </pre>
          )}
          <Button type="submit" disabled={!manifest.trim() || upload.isPending}>
            {upload.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partnerApps.uploadBtn")}
          </Button>
        </form>
      )}
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function PartnerAppDetail() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const app = useQuery({ queryKey: ["partners", "apps", id], queryFn: () => getPartnerApp(id) });
  const { draft } = useDraft(id);
  const hashTab = location.hash.slice(1) as Tab;
  const tab: Tab = TABS.includes(hashTab) ? hashTab : "general";
  const [secret, setSecret] = useState<string | null>(
    (location.state as { secret?: string } | null)?.secret ?? null,
  );
  // Remounting a tab reseeds its form from the draft after a CLI upload or
  // a submission changed it underneath.
  const [epoch, setEpoch] = useState(0);
  const changed = () => {
    void qc.invalidateQueries({ queryKey: ["partners", "apps", id, "draft"] });
    setEpoch((e) => e + 1);
  };

  useEffect(() => {
    if (secret) window.history.replaceState({}, "");
  }, [secret]);

  const a = app.data;
  const state = draft.data;
  const chip = a ? appStatusChip(a) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-10">
      {app.isLoading || !a ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={t("partnerApps.title")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card hover:bg-muted"
              onClick={() => navigate(partnerPath("/apps"))}
            >
              <ArrowRight className="h-4 w-4 ltr:rotate-180" />
            </button>
            {a.icon_url ? (
              <img src={a.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/80 font-bold text-primary-foreground">
                {a.name.charAt(0).toUpperCase()}
              </span>
            )}
            <h1 className="text-xl font-bold">{language === "ar" && a.name_ar ? a.name_ar : a.name}</h1>
            {chip && <span className={cn("rounded-full px-2.5 py-0.5 text-xs", chip.tone)}>{t(`partnerApps.chip_${chip.key}`)}</span>}
          </div>

          {secret && <SecretOnce secret={secret} onDone={() => setSecret(null)} />}

          <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-card px-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]" aria-label={t("partnerApps.title")}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate({ hash: key }, { replace: true })}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-4 text-sm transition-colors",
                  tab === key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`partnerApps.tab_${key.replace("-", "_")}`)}
              </button>
            ))}
          </nav>

          <div className="rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {tab === "logs" ? (
              <ApiLogs appId={id} />
            ) : !state ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : tab === "general" ? (
              <GeneralTab key={epoch} appId={id} clientId={a.client_id} state={state} />
            ) : tab === "app-details" ? (
              <div key={epoch}>
                <AppListingEditor appId={id} catalogVisible={a.catalog_visible} />
                <LinksSection appId={id} state={state} />
                <DevStoreSection appId={id} />
              </div>
            ) : tab === "webhooks" ? (
              <WebhooksTab key={epoch} appId={id} state={state} />
            ) : tab === "plans" ? (
              <PlansTab key={epoch} appId={id} state={state} />
            ) : (
              <PublishTab appId={id} state={state} onChanged={changed} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

const ALL = "all";

function ApiLogs({ appId }: { appId: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const [hours, setHours] = useState("24");
  const [statusClass, setStatusClass] = useState(ALL);
  const [route, setRoute] = useState(ALL);
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const params = {
    hours: Number(hours),
    status_class: statusClass === ALL ? undefined : statusClass,
    route: route === ALL ? undefined : route,
    store_id: store?.id,
    page,
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["partners", "api-logs", appId, params],
    queryFn: () => listAppApiLogs(appId, params),
  });
  const filter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };
  const pct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const s = data?.stats;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("partnerPortal.apiLogsHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Activity} loading={isLoading} label={t("partnerPortal.requests")} value={(s?.requests ?? 0).toLocaleString(locale)} />
        <StatTile icon={AlertTriangle} tone="terra" loading={isLoading} label={t("partnerPortal.errorRate")} value={pct(s?.error_rate)} />
        <StatTile icon={Timer} tone="saffron" loading={isLoading} label={t("partnerPortal.p95")} value={s?.p95_ms != null ? `${s.p95_ms} ms` : "—"} />
        <StatTile icon={Gauge} tone="sage" loading={isLoading} label={t("partnerPortal.rateLimited")} value={(s?.rate_limited ?? 0).toLocaleString(locale)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={hours} onValueChange={filter(setHours)}>
          <SelectTrigger className="w-40" aria-label={t("partnerPortal.time")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">{t("partnerPortal.last24h")}</SelectItem>
            <SelectItem value="168">{t("partnerPortal.last7d")}</SelectItem>
            <SelectItem value="336">{t("partnerPortal.last14d")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusClass} onValueChange={filter(setStatusClass)}>
          <SelectTrigger className="w-36" aria-label={t("partnerPortal.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("partnerPortal.allStatusClasses")}</SelectItem>
            {["2xx", "3xx", "4xx", "5xx"].map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={route} onValueChange={filter(setRoute)}>
          <SelectTrigger className="w-72" aria-label={t("partnerPortal.request")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("partnerPortal.allRoutes")}</SelectItem>
            {(data?.routes ?? []).map((r) => (
              <SelectItem key={r} value={r}>
                <span dir="ltr">{r}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {store && (
          <Button size="sm" variant="secondary" onClick={() => filter(() => setStore(null))("")}>
            {store.name} ×
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {isError && <p className="text-sm text-destructive">{t("partnerPortal.logsUnavailable")}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("partnerPortal.time")}</TableHead>
                <TableHead>{t("partnerPortal.request")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
                <TableHead>{t("partnerPortal.latency")}</TableHead>
                <TableHead>{t("partnerPortal.store")}</TableHead>
                <TableHead>{t("partnerPortal.requestId")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((l, i) => (
                <TableRow key={`${l.request_id}-${i}`}>
                  <TableCell>
                    <bdi dir="ltr" className="whitespace-nowrap text-xs">
                      {new Date(l.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </bdi>
                  </TableCell>
                  <TableCell>
                    <code dir="ltr" className="text-xs">
                      {l.method} {l.route}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.status < 400 ? "default" : l.status < 500 && !l.rate_limited ? "secondary" : "destructive"} dir="ltr">
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr" className="text-xs">{Math.round(l.latency_ms)} ms</TableCell>
                  <TableCell>
                    {l.store_id ? (
                      <button
                        type="button"
                        className="text-start text-xs underline-offset-2 hover:underline"
                        onClick={() => filter(() => setStore({ id: l.store_id!, name: l.store_name ?? l.store_id!.slice(0, 8) }))("")}
                      >
                        {l.store_name ?? l.store_id.slice(0, 8)}
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <code dir="ltr" className="text-[11px] text-muted-foreground">{l.request_id ?? "—"}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("partnerPortal.noLogs")}</p>
          )}
          {data && data.total > data.page_size && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t("partnerPortal.prev")}
              </Button>
              <span dir="ltr" className="text-sm text-muted-foreground">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t("partnerPortal.next")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
