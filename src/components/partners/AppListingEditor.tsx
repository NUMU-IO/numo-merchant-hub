import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppListingView } from "@/components/apps/AppListingView";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import {
  getAppListing,
  saveAppListing,
  submitAppListing,
  uploadListingScreenshot,
  type ListingContent,
} from "@/services/partnersApi";

const LANGS = ["ar", "en"] as const;
const EDITABLE = ["draft", "changes_requested"];
const MAX_SHOTS = 8;
const MAX_KEYWORDS = 10;

const splitKeywords = (s: string) =>
  s
    .split(/[,،]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);

export function useAppListing(appId: string) {
  return useQuery({ queryKey: ["partners", "apps", appId, "listing"], queryFn: () => getAppListing(appId) });
}

export function listingEditable(status: string | undefined) {
  return !status || EDITABLE.includes(status);
}

export function AppListingEditor({ appId, catalogVisible }: { appId: string; catalogVisible: boolean }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const listing = useAppListing(appId);
  const [form, setForm] = useState<ListingContent | null>(null);
  const [keywords, setKeywords] = useState({ ar: "", en: "" });
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const data = listing.data;
  const status = data?.draft?.status;
  const editable = listingEditable(status);

  useEffect(() => {
    if (!data) return;
    const c = data.draft?.content ?? data.live;
    setForm(c);
    setKeywords({ ar: c.keywords.ar.join("، "), en: c.keywords.en.join(", ") });
  }, [data]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["partners", "apps", appId] });
  const body = (): ListingContent => ({
    ...form!,
    video_url: form!.video_url?.trim() || null,
    keywords: { ar: splitKeywords(keywords.ar), en: splitKeywords(keywords.en) },
  });
  const save = useMutation({
    mutationFn: () => saveAppListing(appId, body()),
    onSuccess: () => {
      toast.success(t("partnerListing.saved"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });
  const submit = useMutation({
    mutationFn: async () => {
      await saveAppListing(appId, body());
      return submitAppListing(appId);
    },
    onSuccess: () => {
      toast.success(t("partnerApps.submitted"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });

  if (!data || !form) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof ListingContent>(key: K, value: ListingContent[K]) => setForm({ ...form, [key]: value });
  const setBi = (key: "name" | "tagline" | "description", lang: "ar" | "en", value: string) =>
    setForm({ ...form, [key]: { ...form[key], [lang]: value } });
  const nameChanges = form.name.ar !== data.live.name.ar || form.name.en !== data.live.name.en;
  const busy = save.isPending || submit.isPending || uploading;

  const addShots = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      const room = MAX_SHOTS - form.screenshots.length;
      const urls = [];
      for (const file of Array.from(files).slice(0, room)) urls.push((await uploadListingScreenshot(appId, file)).url);
      setForm((f) => (f ? { ...f, screenshots: [...f.screenshots, ...urls.map((src) => ({ src }))] } : f));
    } catch (err) {
      showError(err, language);
    } finally {
      setUploading(false);
    }
  };

  const previewApp = {
    ...data.preview,
    listing: {
      ...data.preview.listing,
      app_locales: Object.fromEntries(LANGS.map((l) => [l, { name: form.name[l], description: form.description[l] }])),
      locales: Object.fromEntries(LANGS.map((l) => [l, { tagline: form.tagline[l] }])),
      tagline: form.tagline.en,
      screenshots: form.screenshots.map((s) => ({
        url: s.src,
        locales: s.caption ? Object.fromEntries(LANGS.map((l) => [l, { caption: s.caption![l] }])) : undefined,
      })),
      video_url: form.video_url?.trim() || null,
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{t("partnerListing.title")}</CardTitle>
          {status && <Badge variant="secondary">{t(`partnerListing.st_${status}`)}</Badge>}
          <Badge variant={catalogVisible ? "default" : "outline"}>
            {t(catalogVisible ? "partnerApps.listed" : "partnerApps.notListed")}
          </Badge>
        </div>
        <CardDescription>{t("partnerListing.listedHelp")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editable && <p className="text-sm text-muted-foreground">{t("partnerListing.locked")}</p>}
        {nameChanges && (
          <p className="rounded-md border border-amber-500/50 p-2 text-sm">
            {t("partnerListing.nameChange", { from: data.live.name[language === "ar" ? "ar" : "en"], to: form.name[language === "ar" ? "ar" : "en"] })}
          </p>
        )}
        <fieldset disabled={!editable || busy} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {LANGS.map((l) => (
              <div key={l} className="space-y-3" dir={l === "ar" ? "rtl" : "ltr"}>
                <div className="space-y-1.5">
                  <Label htmlFor={`ln-name-${l}`}>{t(`partnerListing.name_${l}`)}</Label>
                  <Input id={`ln-name-${l}`} maxLength={100} value={form.name[l]} onChange={(e) => setBi("name", l, e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ln-tag-${l}`}>{t(`partnerListing.tagline_${l}`)}</Label>
                  <Input id={`ln-tag-${l}`} maxLength={80} value={form.tagline[l]} onChange={(e) => setBi("tagline", l, e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ln-desc-${l}`}>{t(`partnerListing.description_${l}`)}</Label>
                  <Textarea
                    id={`ln-desc-${l}`}
                    rows={6}
                    maxLength={4000}
                    value={form.description[l]}
                    onChange={(e) => setBi("description", l, e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ln-kw-${l}`}>{t(`partnerListing.keywords_${l}`)}</Label>
                  <Input id={`ln-kw-${l}`} value={keywords[l]} onChange={(e) => setKeywords({ ...keywords, [l]: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    {t("partnerListing.keywordsHint", { count: splitKeywords(keywords[l]).length, max: MAX_KEYWORDS })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ln-category">{t("partnerListing.category")}</Label>
              <select
                id="ln-category"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {data.categories.map((c) => (
                  <option key={c} value={c}>
                    {t(`partnerListing.cat.${c}`, { defaultValue: c })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ln-video">{t("partnerListing.video")}</Label>
              <Input
                id="ln-video"
                dir="ltr"
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={form.video_url ?? ""}
                onChange={(e) => set("video_url", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("partnerListing.screenshots", { count: form.screenshots.length, max: MAX_SHOTS })}</Label>
            <div className="flex flex-wrap gap-3">
              {form.screenshots.map((s, i) => (
                <div key={s.src + i} className="relative">
                  <img src={s.src} alt="" className="h-24 w-auto rounded-md border object-contain" />
                  <button
                    type="button"
                    className="absolute -top-2 -end-2 rounded-full border bg-background p-0.5"
                    aria-label={t("partnerListing.removeShot")}
                    onClick={() => set("screenshots", form.screenshots.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {form.screenshots.length < MAX_SHOTS && (
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                aria-label={t("partnerListing.addShots")}
                onChange={(e) => void addShots(e.target.files)}
              />
            )}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!editable || busy} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partnerListing.save")}
          </Button>
          <Button disabled={!editable || busy} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partnerListing.submit")}
          </Button>
          <Button variant="ghost" onClick={() => setPreview(true)}>
            {t("partnerListing.preview")}
          </Button>
        </div>
      </CardContent>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("partnerListing.preview")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <AppListingView app={previewApp} language={language} />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
