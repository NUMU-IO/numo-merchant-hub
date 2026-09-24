/**
 * Partner portal → one app (apps plan, Phase 3).
 *
 * Credentials (client id; rotating shows the new secret once), versions
 * (each a numu.app.json: upload → submit → NUMU review → publish, with
 * NUMU's notes in the partner's language), and installing the app on one of
 * the partner's own development stores at any status.
 *
 * Webhooks, installs detail and earnings arrive with Phases 4 and 7.
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Gauge, Loader2, Timer } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api-error";
import { showError } from "@/lib/show-error";
import {
  devInstallApp,
  getPartnerApp,
  listAppApiLogs,
  listDevStores,
  publishAppVersion,
  rotateAppSecret,
  submitAppVersion,
  uploadAppVersion,
} from "@/services/partnersApi";
import { partnerPath } from "@/lib/partner-host";
import { SecretOnce } from "@/pages/PartnerApps";
import { AppReviewTimeline } from "@/components/partners/AppReviewTimeline";
import { AppListingEditor, listingEditable, useAppListing } from "@/components/partners/AppListingEditor";

export default function PartnerAppDetail() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const app = useQuery({ queryKey: ["partners", "apps", id], queryFn: () => getPartnerApp(id) });
  const devStores = useQuery({ queryKey: ["partners", "dev-stores"], queryFn: listDevStores });
  const listing = useAppListing(id);
  const draft = listing.data?.draft;
  const canAttachListing = Boolean(draft) && listingEditable(draft?.status);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [manifest, setManifest] = useState("");
  const [notesAr, setNotesAr] = useState("");
  const [notesEn, setNotesEn] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [devStore, setDevStore] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partners", "apps"] });

  const rotate = useMutation({
    mutationFn: () => rotateAppSecret(id),
    onSuccess: (r) => setSecret(r.client_secret),
    onError: (err) => showError(err, language),
  });
  const upload = useMutation({
    mutationFn: (parsed: unknown) =>
      uploadAppVersion(id, {
        manifest: parsed,
        release_notes_ar: notesAr.trim() || undefined,
        release_notes_en: notesEn.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("partnerApps.uploaded"));
      setManifest("");
      setNotesAr("");
      setNotesEn("");
      setUploadError(null);
      refresh();
    },
    onError: (err) => {
      // A manifest can break several rules at once; show every one.
      const body = err instanceof ApiError ? (err.body as { error?: unknown } | null) : null;
      setUploadError(body?.error ? JSON.stringify(body.error, null, 2) : String(err));
    },
  });
  const act = useMutation({
    mutationFn: async ({
      kind,
      versionId,
      withListing = false,
    }: {
      kind: "submit" | "publish";
      versionId: string;
      withListing?: boolean;
    }) => {
      if (kind === "submit") await submitAppVersion(id, versionId, withListing);
      else await publishAppVersion(id, versionId);
    },
    onSuccess: (_r, { kind }) => {
      toast.success(t(kind === "submit" ? "partnerApps.submitted" : "partnerApps.published"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });
  const install = useMutation({
    mutationFn: () => devInstallApp(id, devStore),
    onSuccess: () => toast.success(t("partnerApps.devInstalled")),
    onError: (err) => showError(err, language),
  });

  const a = app.data;
  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(partnerPath("/apps"))}>
          {t("partnerApps.title")}
        </Button>
        {app.isLoading || !a ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight">
                {language === "ar" && a.name_ar ? a.name_ar : a.name}
              </h1>
              <Badge variant={a.status === "published" ? "default" : "secondary"}>
                {t(`partnerApps.app_${a.status}`)}
              </Badge>
              <Badge variant="outline">
                {t(a.catalog_visible ? "partnerApps.listed" : "partnerApps.notListed")}
              </Badge>
              <bdi dir="ltr" className="text-xs text-muted-foreground">
                {a.slug} · v{a.version} · {t("partnerApps.installs")}: {a.installs}
              </bdi>
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{t("partnerPortal.overviewTab")}</TabsTrigger>
                <TabsTrigger value="logs">{t("partnerPortal.apiLogsTab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-6">
            {secret && <SecretOnce secret={secret} onDone={() => setSecret(null)} />}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("partnerApps.credentials")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="text-sm">{t("partnerApps.clientId")}</span>
                <code dir="ltr" className="rounded-md bg-muted px-2 py-1 text-xs">
                  {a.client_id}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rotate.isPending}
                  onClick={() => setConfirmRotate(true)}
                >
                  {t("partnerApps.rotate")}
                </Button>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("partnerApps.versions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.versions.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("partnerApps.noVersions")}</p>
                )}
                {a.versions.map((v) => (
                  <div key={v.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <bdi dir="ltr" className="font-medium">
                        v{v.version}
                      </bdi>
                      <Badge variant={v.status === "published" ? "default" : "secondary"}>
                        {t(`partnerApps.st_${v.status}`)}
                      </Badge>
                      <div className="flex-1" />
                      {(v.status === "draft" || v.status === "changes_requested") && (
                        <Button
                          size="sm"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ kind: "submit", versionId: v.id })}
                        >
                          {t("partnerApps.submit")}
                        </Button>
                      )}
                      {(v.status === "draft" || v.status === "changes_requested") && canAttachListing && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ kind: "submit", versionId: v.id, withListing: true })}
                        >
                          {t("partnerApps.submitWithListing")}
                        </Button>
                      )}
                      {v.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ kind: "publish", versionId: v.id })}
                        >
                          {t("partnerApps.publish")}
                        </Button>
                      )}
                    </div>
                    {v.review_notes && (
                      <div className="rounded-md border border-dashed p-2 text-sm">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t("partnerApps.reviewNotes")}
                        </div>
                        <p className="whitespace-pre-line">
                          {v.review_notes[language as "ar" | "en"] ?? v.review_notes.en}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <AppReviewTimeline appId={id} />

            <AppListingEditor appId={id} catalogVisible={a.catalog_visible} />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("partnerApps.upload")}</CardTitle>
                <CardDescription>{t("partnerApps.manifestHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      upload.mutate(JSON.parse(manifest));
                    } catch {
                      setUploadError(t("partnerApps.badJson"));
                    }
                  }}
                >
                  <Label htmlFor="app-manifest">{t("partnerApps.manifest")}</Label>
                  <Textarea
                    id="app-manifest"
                    dir="ltr"
                    rows={10}
                    className="font-mono text-xs"
                    value={manifest}
                    onChange={(e) => setManifest(e.target.value)}
                  />
                  <input
                    type="file"
                    accept="application/json,.json"
                    aria-label={t("partnerApps.chooseFile")}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setManifest(await file.text());
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="notes-ar">{t("partnerApps.notesAr")}</Label>
                      <Textarea id="notes-ar" dir="rtl" rows={2} value={notesAr} onChange={(e) => setNotesAr(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="notes-en">{t("partnerApps.notesEn")}</Label>
                      <Textarea id="notes-en" dir="ltr" rows={2} value={notesEn} onChange={(e) => setNotesEn(e.target.value)} />
                    </div>
                  </div>
                  {uploadError && (
                    <pre dir="ltr" className="max-h-60 overflow-auto rounded-md border border-destructive/50 p-2 text-xs text-destructive">
                      {uploadError}
                    </pre>
                  )}
                  <Button type="submit" disabled={!manifest.trim() || upload.isPending}>
                    {upload.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("partnerApps.uploadBtn")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("partnerApps.devInstall")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                {(devStores.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("partnerApps.noDevStores")}</p>
                ) : (
                  <>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={devStore}
                      onChange={(e) => setDevStore(e.target.value)}
                    >
                      <option value="" />
                      {devStores.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" disabled={!devStore || install.isPending} onClick={() => install.mutate()}>
                      {t("partnerApps.devInstallBtn")}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
              </TabsContent>
              <TabsContent value="logs">
                <ApiLogs appId={id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
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
