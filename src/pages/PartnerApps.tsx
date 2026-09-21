/**
 * Partner portal → apps (apps plan, Phase 3): the partner's apps, and
 * creating one. Creating returns the OAuth client secret exactly once, so it
 * is shown here until the partner dismisses it.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { createPartnerApp, listPartnerApps } from "@/services/partnersApi";

export function SecretOnce({ secret, onDone }: { secret: string; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="border-amber-500/60">
      <CardHeader>
        <CardTitle className="text-lg">{t("partnerApps.secretTitle")}</CardTitle>
        <CardDescription>{t("partnerApps.secretBody")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <code dir="ltr" className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs">
          {secret}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            toast.success(t("partnerApps.copied"));
          }}
        >
          {t("partnerApps.copy")}
        </Button>
        <Button size="sm" onClick={onDone}>
          OK
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PartnerApps() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: ["partners", "apps"], queryFn: listPartnerApps });
  const [form, setForm] = useState({ slug: "", name_ar: "", name_en: "" });
  const [secret, setSecret] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createPartnerApp(form),
    onSuccess: (app) => {
      setSecret(app.client_secret);
      setForm({ slug: "", name_ar: "", name_en: "" });
      void queryClient.invalidateQueries({ queryKey: ["partners", "apps"] });
    },
    onError: (err) => showError(err, language),
  });

  return (
    // The app's own surface: the cream auth backdrop is light-only.
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/partners")}>
          {t("partnerApps.back")}
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("partnerApps.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("partnerApps.subtitle")}</p>
        </div>

        {secret && <SecretOnce secret={secret} onDone={() => setSecret(null)} />}

        <Card>
          <CardContent className="space-y-3 pt-6">
            {apps.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {apps.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("partnerApps.none")}</p>
            )}
            {apps.data?.map((app) => (
              <div key={app.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {language === "ar" && app.name_ar ? app.name_ar : app.name}
                  </div>
                  <bdi dir="ltr" className="text-xs text-muted-foreground">
                    {app.slug} · v{app.version}
                  </bdi>
                </div>
                <Badge variant={app.status === "published" ? "default" : "secondary"}>
                  {t(`partnerApps.app_${app.status}`)}
                </Badge>
                {app.latest_version && (
                  <Badge variant="outline">{t(`partnerApps.st_${app.latest_version.status}`)}</Badge>
                )}
                <Button size="sm" onClick={() => navigate(`/partners/apps/${app.id}`)}>
                  {t("partnerApps.open")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("partnerApps.newTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-3 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="app-slug">{t("partnerApps.slug")}</Label>
                <Input
                  id="app-slug"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="app-name-ar">{t("partnerApps.nameAr")}</Label>
                <Input
                  id="app-name-ar"
                  dir="rtl"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="app-name-en">{t("partnerApps.nameEn")}</Label>
                <Input
                  id="app-name-en"
                  dir="ltr"
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">{t("partnerApps.slugHint")}</p>
              <Button
                type="submit"
                className="sm:col-span-3 sm:justify-self-start"
                disabled={
                  form.slug.length < 3 || form.name_ar.trim().length < 2 || form.name_en.trim().length < 2 || create.isPending
                }
              >
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partnerApps.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
