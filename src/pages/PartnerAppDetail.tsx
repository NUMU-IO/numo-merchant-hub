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
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiError } from "@/lib/api-error";
import { showError } from "@/lib/show-error";
import {
  devInstallApp,
  getPartnerApp,
  listDevStores,
  publishAppVersion,
  rotateAppSecret,
  submitAppVersion,
  uploadAppVersion,
} from "@/services/partnersApi";
import { SecretOnce } from "@/pages/PartnerApps";

export default function PartnerAppDetail() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const app = useQuery({ queryKey: ["partners", "apps", id], queryFn: () => getPartnerApp(id) });
  const devStores = useQuery({ queryKey: ["partners", "dev-stores"], queryFn: listDevStores });
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
    mutationFn: async ({ kind, versionId }: { kind: "submit" | "publish"; versionId: string }) => {
      if (kind === "submit") await submitAppVersion(id, versionId);
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
        <Button variant="ghost" size="sm" onClick={() => navigate("/partners/apps")}>
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
              {a.status === "published" && (
                <Badge variant="outline">
                  {t(a.catalog_visible ? "partnerApps.listed" : "partnerApps.notListed")}
                </Badge>
              )}
              <bdi dir="ltr" className="text-xs text-muted-foreground">
                {a.slug} · v{a.version} · {t("partnerApps.installs")}: {a.installs}
              </bdi>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}
