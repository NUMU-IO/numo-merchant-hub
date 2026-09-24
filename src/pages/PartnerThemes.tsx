/**
 * Partner portal → themes: the partner's marketplace themes, their listing
 * (ar + en), and versions. A version is a theme ZIP submitted exactly like
 * `numu-theme submit`: it builds, NUMU reviews it, and the partner publishes
 * an approved version so merchants can install it.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CatalogCard } from "@/components/theme-editor/MarketplaceCatalog";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { partnerPath } from "@/lib/partner-host";
import type { CatalogTheme } from "@/services/marketplaceApi";
import {
  createListing,
  listMyThemes,
  listMyVersions,
  publishVersion,
  submitThemeBundle,
  updateListing,
  type MarketplaceTheme,
  type MarketplaceVersion,
} from "@/services/marketplaceDeveloperApi";

const BUSY = ["pending_build", "building"];

function useThemes() {
  return useQuery({ queryKey: ["partners", "themes"], queryFn: listMyThemes });
}

export default function PartnerThemes() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const themes = useThemes();
  const [form, setForm] = useState({ slug: "", name: "", name_ar: "" });

  const create = useMutation({
    mutationFn: () => createListing({ ...form, name_ar: form.name_ar || null }),
    onSuccess: (theme) => {
      void queryClient.invalidateQueries({ queryKey: ["partners", "themes"] });
      navigate(partnerPath(`/themes/${theme.id}`));
    },
    onError: (err) => showError(err, language),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("partnerThemes.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("partnerThemes.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          {themes.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {themes.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("partnerThemes.none")}</p>}
          {themes.data?.map((theme) => (
            <div key={theme.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{language === "ar" && theme.name_ar ? theme.name_ar : theme.name}</div>
                <bdi dir="ltr" className="text-xs text-muted-foreground">
                  {theme.slug}
                </bdi>
              </div>
              <Badge variant={theme.status === "published" ? "default" : "secondary"}>
                {t(`partnerThemes.theme_${theme.status}`)}
              </Badge>
              <Button size="sm" onClick={() => navigate(partnerPath(`/themes/${theme.id}`))}>
                {t("partnerThemes.open")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("partnerThemes.newTitle")}</CardTitle>
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
              <Label htmlFor="theme-slug">{t("partnerThemes.slug")}</Label>
              <Input
                id="theme-slug"
                dir="ltr"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-name-ar">{t("partnerThemes.nameAr")}</Label>
              <Input
                id="theme-name-ar"
                dir="rtl"
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-name-en">{t("partnerThemes.nameEn")}</Label>
              <Input
                id="theme-name-en"
                dir="ltr"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <Button
              type="submit"
              className="sm:col-span-3 sm:justify-self-start"
              disabled={form.slug.length < 3 || !form.name.trim() || create.isPending}
            >
              {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("partnerThemes.create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type ListingForm = {
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  short_description: string;
  demo_store_url: string;
  thumbnail_url: string;
  category: string;
  tags: string;
  screenshots: string;
};

function toForm(theme: MarketplaceTheme): ListingForm {
  return {
    name: theme.name,
    name_ar: theme.name_ar ?? "",
    description: theme.description ?? "",
    description_ar: theme.description_ar ?? "",
    short_description: theme.short_description ?? "",
    demo_store_url: theme.demo_store_url ?? "",
    thumbnail_url: theme.thumbnail_url ?? "",
    category: theme.category ?? "",
    tags: (theme.tags ?? []).join(", "),
    screenshots: (theme.screenshots ?? []).map((s) => s.url).join("\n"),
  };
}

function fromForm(f: ListingForm) {
  return {
    name: f.name.trim(),
    name_ar: f.name_ar.trim() || null,
    description: f.description.trim() || null,
    description_ar: f.description_ar.trim() || null,
    short_description: f.short_description.trim() || null,
    demo_store_url: f.demo_store_url.trim() || null,
    thumbnail_url: f.thumbnail_url.trim() || null,
    category: f.category.trim() || null,
    tags: f.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    screenshots: f.screenshots
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url })),
  };
}

export function PartnerThemeDetail() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const themes = useThemes();
  const theme = themes.data?.find((x) => x.id === id);
  const versions = useQuery({
    queryKey: ["partners", "themes", id, "versions"],
    queryFn: () => listMyVersions(id),
    refetchInterval: (q) => (q.state.data?.some((v) => BUSY.includes(v.status)) ? 5000 : false),
  });
  const [form, setForm] = useState<ListingForm | null>(null);
  const [bundle, setBundle] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (theme && !form) setForm(toForm(theme));
  }, [theme, form]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partners", "themes"] });
  const save = useMutation({
    mutationFn: () => updateListing(id, fromForm(form!)),
    onSuccess: () => {
      toast.success(t("partnerThemes.saved"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });
  const submit = useMutation({
    mutationFn: () => submitThemeBundle(id, bundle!, version.trim(), notes.trim()),
    onSuccess: () => {
      toast.success(t("partnerThemes.submitted"));
      setBundle(null);
      setVersion("");
      setNotes("");
      refresh();
    },
    onError: (err) => showError(err, language),
  });
  const publish = useMutation({
    mutationFn: publishVersion,
    onSuccess: () => {
      toast.success(t("partnerThemes.published"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });

  if (themes.isLoading || !theme || !form) {
    return (
      <div className="p-8">
        {themes.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm text-muted-foreground">{t("partnerThemes.notFound")}</p>
        )}
      </div>
    );
  }

  const listing = fromForm(form);
  const preview = {
    ...theme,
    ...listing,
    name: language === "ar" && listing.name_ar ? listing.name_ar : listing.name,
    description: language === "ar" && listing.description_ar ? listing.description_ar : listing.description,
  } as unknown as CatalogTheme;
  const field = (key: keyof ListingForm, dir: "ltr" | "rtl", multiline = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`listing-${key}`}>{t(`partnerThemes.f_${key}`)}</Label>
      {multiline ? (
        <Textarea
          id={`listing-${key}`}
          dir={dir}
          rows={3}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <Input
          id={`listing-${key}`}
          dir={dir}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(partnerPath("/themes"))}>
        {t("partnerThemes.title")}
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {language === "ar" && theme.name_ar ? theme.name_ar : theme.name}
        </h1>
        <Badge variant={theme.status === "published" ? "default" : "secondary"}>
          {t(`partnerThemes.theme_${theme.status}`)}
        </Badge>
        <bdi dir="ltr" className="text-xs text-muted-foreground">
          {theme.slug} · {t("partnerThemes.installs")}: {theme.install_count}
        </bdi>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("partnerThemes.listing")}</CardTitle>
            <CardDescription>{t("partnerThemes.listingHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              {field("name_ar", "rtl")}
              {field("name", "ltr")}
              {field("description_ar", "rtl", true)}
              {field("description", "ltr", true)}
              {field("short_description", "ltr")}
              {field("category", "ltr")}
              {field("tags", "ltr")}
              {field("demo_store_url", "ltr")}
              {field("thumbnail_url", "ltr")}
              <div className="space-y-1.5">
                <Label htmlFor="listing-price">{t("partnerThemes.price")}</Label>
                <Input id="listing-price" dir="ltr" value={t("partnerThemes.free")} disabled />
                <p className="text-xs text-muted-foreground">{t("partnerThemes.paidSoon")}</p>
              </div>
              <div className="sm:col-span-2">{field("screenshots", "ltr", true)}</div>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("partnerThemes.imageHint")}</p>
              <Button
                type="submit"
                className="sm:col-span-2 sm:justify-self-start"
                disabled={!form.name.trim() || save.isPending}
              >
                {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partnerThemes.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">{t("partnerThemes.preview")}</div>
          <CatalogCard
            theme={preview}
            installed={undefined}
            busy={false}
            onInstall={() => {}}
            onGoToLibrary={() => {}}
            onCustomize={() => {}}
            onOpenDetail={() => {}}
            onPreview={() => listing.demo_store_url && window.open(listing.demo_store_url, "_blank", "noopener")}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("partnerThemes.versions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {versions.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {versions.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("partnerThemes.noVersions")}</p>}
          {versions.data?.map((v) => (
            <VersionRow key={v.id} v={v} busy={publish.isPending} onPublish={() => publish.mutate(v.id)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("partnerThemes.submitTitle")}</CardTitle>
          <CardDescription>{t("partnerThemes.submitHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="theme-zip">{t("partnerThemes.bundle")}</Label>
              <Input
                id="theme-zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setBundle(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="theme-version">{t("partnerThemes.version")}</Label>
              <Input
                id="theme-version"
                dir="ltr"
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="theme-notes">{t("partnerThemes.releaseNotes")}</Label>
              <Textarea id="theme-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button
              type="submit"
              className="sm:col-span-2 sm:justify-self-start"
              disabled={!bundle || !/^\d+\.\d+\.\d+/.test(version.trim()) || submit.isPending}
            >
              {submit.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("partnerThemes.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function VersionRow({ v, busy, onPublish }: { v: MarketplaceVersion; busy: boolean; onPublish: () => void }) {
  const { t } = useTranslation();
  const issues = v.lint_issues?.issues ?? [];
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <bdi dir="ltr" className="font-medium">
          v{v.version_string}
        </bdi>
        <Badge
          variant={
            v.status === "published" ? "default" : ["build_failed", "rejected"].includes(v.status) ? "destructive" : "secondary"
          }
        >
          {BUSY.includes(v.status) && <Loader2 className="me-1 h-3 w-3 animate-spin" />}
          {t(`partnerThemes.st_${v.status}`)}
        </Badge>
        {v.lint_status && <Badge variant="outline">{t("partnerThemes.lint", { status: v.lint_status })}</Badge>}
        <div className="flex-1" />
        {v.status === "approved" && (
          <Button size="sm" disabled={busy} onClick={onPublish}>
            {t("partnerThemes.publish")}
          </Button>
        )}
      </div>
      {v.review_notes && (
        <div className="rounded-md border border-dashed p-2 text-sm">
          <div className="text-xs font-medium text-muted-foreground">{t("partnerThemes.reviewNotes")}</div>
          <p className="whitespace-pre-line">{v.review_notes}</p>
        </div>
      )}
      {issues.length > 0 && (
        <ul dir="ltr" className="space-y-1 text-xs">
          {issues.map((i, n) => (
            <li key={n} className={i.severity === "error" ? "text-destructive" : "text-muted-foreground"}>
              [{i.severity}] {i.rule}: {i.message}
            </li>
          ))}
        </ul>
      )}
      {v.status === "build_failed" && v.build_log && (
        <pre dir="ltr" className="max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs">
          {v.build_log}
        </pre>
      )}
    </div>
  );
}
