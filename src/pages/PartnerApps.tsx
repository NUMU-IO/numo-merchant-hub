/**
 * Partner portal → apps: every app in one table, and "Create app" as a short
 * dialog (names, category, tags). The rest of the app is edited on its own
 * page, where the client secret shown once at creation is waiting.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Page } from "@/components/partners/PortalPage";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { cn } from "@/lib/utils";
import {
  APP_CATEGORIES,
  createPartnerApp,
  deletePartnerApp,
  listPartnerApps,
  type PartnerApp,
} from "@/services/partnersApi";
import { partnerPath } from "@/lib/partner-host";

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

/** The app's status as merchants would read it: a version in review wins. */
export function appStatusChip(app: Pick<PartnerApp, "status" | "latest_version">) {
  const v = app.latest_version?.status;
  if (app.status === "published") return { key: "published", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
  if (app.status === "suspended") return { key: "suspended", tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
  if (v === "submitted" || v === "in_review") return { key: "in_review", tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  if (v === "changes_requested" || v === "rejected") return { key: v, tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
  if (v === "approved") return { key: "approved", tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" };
  return { key: "draft", tone: "bg-muted text-muted-foreground" };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

const ARABIC = /^[؀-ۿ\s0-9]+$/;

function CreateAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [custom, setCustom] = useState(false);
  const [store, setStore] = useState("");
  const [touched, setTouched] = useState(false);

  const arOk = nameAr.trim().length >= 3 && nameAr.trim().length <= 24 && ARABIC.test(nameAr.trim());
  const enOk = nameEn.trim().length >= 3 && nameEn.trim().length <= 24 && slugify(nameEn).length >= 3;

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        name_ar: nameAr.trim(),
        name_en: nameEn.trim(),
        category: category || undefined,
        tags,
        private_store: custom ? store.trim() : undefined,
      };
      const base = slugify(nameEn);
      try {
        return await createPartnerApp({ ...body, slug: base });
      } catch (err) {
        // The slug is ours to pick, not the partner's: a taken one gets a suffix.
        if ((err as { status?: number }).status !== 409) throw err;
        return createPartnerApp({ ...body, slug: `${base}-${Math.random().toString(36).slice(2, 6)}` });
      }
    },
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: ["partners", "apps"] });
      onOpenChange(false);
      navigate(partnerPath(`/apps/${app.id}`), { state: { secret: app.client_secret } });
    },
    onError: (err) => showError(err, language),
  });

  const addTag = () => {
    const v = tag.trim();
    if (v && !tags.includes(v) && tags.length < 10) setTags([...tags, v]);
    setTag("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b p-6">
          <DialogTitle className="text-xl">{t("partnerApps.createTitle")}</DialogTitle>
          <DialogDescription>{t("partnerApps.createBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="app-name-ar" className={cn(touched && !arOk && "text-destructive")}>
                {t("partnerApps.nameAr")}
              </Label>
              <Input
                id="app-name-ar"
                dir="rtl"
                value={nameAr}
                placeholder={t("partnerApps.nameArPlaceholder")}
                aria-invalid={touched && !arOk}
                className={cn(touched && !arOk && "border-destructive")}
                onChange={(e) => setNameAr(e.target.value)}
                onBlur={() => setTouched(true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-name-en">{t("partnerApps.nameEn")}</Label>
              <Input
                id="app-name-en"
                dir="ltr"
                value={nameEn}
                placeholder="e.g. Smart Analytics"
                onChange={(e) => setNameEn(e.target.value)}
              />
            </div>
          </div>
          {touched && !arOk && <p className="text-xs text-destructive">{t("partnerApps.nameArRule")}</p>}
          <div className="space-y-1.5">
            <Label>{t("partnerApps.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("partnerApps.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {APP_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`partnerListing.cat.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-tag">{t("partnerApps.tags")}</Label>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
              {tags.map((x) => (
                <span key={x} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {x}
                  <button type="button" aria-label={t("partnerApps.remove")} onClick={() => setTags(tags.filter((y) => y !== x))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="app-tag"
                value={tag}
                placeholder={tags.length ? "" : t("partnerApps.tagsPlaceholder")}
                className="min-w-24 flex-1 bg-transparent text-sm outline-none"
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="app-custom" checked={custom} onCheckedChange={setCustom} />
            <Label htmlFor="app-custom">{t("partnerApps.customToggle")}</Label>
          </div>
          {custom && (
            <div className="space-y-1.5">
              <Label htmlFor="app-store">{t("partnerApps.customStore")}</Label>
              <Input id="app-store" dir="ltr" value={store} onChange={(e) => setStore(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("partnerApps.customHint")}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 border-t p-6 sm:justify-start">
          <Button
            className="rounded-full px-6"
            disabled={!arOk || !enOk || (custom && !store.trim()) || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partnerApps.create")}
          </Button>
          <Button variant="outline" className="rounded-full px-8" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnerApps() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: ["partners", "apps"], queryFn: listPartnerApps });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<PartnerApp | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deletePartnerApp(id),
    onSuccess: () => {
      toast.success(t("partnerApps.deleted"));
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["partners", "apps"] });
    },
    onError: (err) => showError(err, language),
  });

  const nameOf = (a: PartnerApp) => (language === "ar" && a.name_ar ? a.name_ar : a.name);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (apps.data ?? []).filter(
      (a) => !q || a.name.toLowerCase().includes(q) || (a.name_ar ?? "").includes(q) || a.slug.includes(q),
    );
  }, [apps.data, search]);
  const day = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB") : "—";

  return (
    <Page
      title={t("partnerApps.title")}
      subtitle={t("partnerApps.subtitle")}
      action={
        <Button className="rounded-full px-5" onClick={() => setCreating(true)}>
          {t("partnerApps.createTitle")}
        </Button>
      }
    >
      <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("partnerPortal.search")} className="rounded-full ps-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>{t("partnerApps.colId")}</TableHead>
                <TableHead>{t("partnerApps.colIcon")}</TableHead>
                <TableHead>{t("partnerApps.colName")}</TableHead>
                <TableHead>{t("partnerApps.colType")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
                <TableHead>{t("partnerApps.installs")}</TableHead>
                <TableHead>{t("partnerApps.colCreated")}</TableHead>
                <TableHead>{t("partnerApps.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const chip = appStatusChip(a);
                const deletable = a.status === "draft" && a.installs === 0;
                return (
                  <TableRow key={a.id} className="h-[68px]">
                    <TableCell>
                      <bdi dir="ltr" className="text-sm text-muted-foreground">{a.slug}</bdi>
                    </TableCell>
                    <TableCell>
                      {a.icon_url ? (
                        <img src={a.icon_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/80 text-sm font-bold text-primary-foreground">
                          {a.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <button type="button" className="hover:underline" onClick={() => navigate(partnerPath(`/apps/${a.id}`))}>
                        {nameOf(a)}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {a.private_store_id ? t("partnerApps.typeCustom") : "OAuth"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs", chip.tone)}>{t(`partnerApps.chip_${chip.key}`)}</span>
                    </TableCell>
                    <TableCell>{a.installs}</TableCell>
                    <TableCell>
                      <bdi dir="ltr">{day(a.created_at)}</bdi>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={t("partnerApps.edit")}
                          title={t("partnerApps.edit")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border hover:bg-muted"
                          onClick={() => navigate(partnerPath(`/apps/${a.id}`))}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("partnerApps.delete")}
                          title={deletable ? t("partnerApps.delete") : t("partnerApps.deleteBlocked")}
                          disabled={!deletable}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {apps.isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {apps.data && rows.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("partnerApps.none")}</p>
          )}
        </div>
      </div>

      <CreateAppDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("partnerApps.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("partnerApps.deleteBody", { name: deleting ? nameOf(deleting) : "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {t("partnerApps.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
