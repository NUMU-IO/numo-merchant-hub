/**
 * Partner portal pages that sit in the sidebar groups: subscriptions across
 * apps, payouts, and help.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Copy, Download, ExternalLink, Headphones, Loader2, Palette, Search, Terminal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showError } from "@/lib/show-error";
import { merchantHubUrl } from "@/lib/partner-host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Page, Panel } from "@/components/partners/PortalPage";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney } from "@/lib/format-money";
import {
  createDevStore,
  getPartnerMe,
  listDevStores,
  listPartnerApps,
  listPartnerSubscriptions,
  seedDevStore,
} from "@/services/partnersApi";
import { Earnings } from "@/pages/Partners";

const ALL = "all";
const DOCS = "https://docs.numueg.app";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  trial: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  past_due: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

export function PartnerSubscriptions() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [appId, setAppId] = useState(ALL);
  const [search, setSearch] = useState("");
  const apps = useQuery({ queryKey: ["partners", "apps"], queryFn: listPartnerApps });
  const subs = useQuery({
    queryKey: ["partners", "subscriptions", appId === ALL ? undefined : appId],
    queryFn: () => listPartnerSubscriptions({ app_id: appId === ALL ? undefined : appId }),
  });
  const day = (iso: string) => new Date(iso).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB");
  const money = (cents: number, currency: string) =>
    formatMoney(cents, { fromCents: true, currency, locale: language === "ar" ? "ar" : "en", fixed: true });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (subs.data?.items ?? []).filter(
      (s) => !q || (s.store_name ?? "").toLowerCase().includes(q) || s.app_name.toLowerCase().includes(q),
    );
  }, [subs.data, search]);

  const exportCsv = () => {
    const head = ["store", "app", "status", "price", "currency", "cycle", "started", "renews"];
    const lines = rows.map((s) =>
      [s.store_name ?? "", s.app_name, s.status, (s.price_cents / 100).toFixed(2), s.currency, s.cycle, s.created_at, s.current_period_end]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title={t("partnerPortal.nav.subscriptions")}
      subtitle={t("partnerPortal.subscriptionsSubtitle")}
      action={
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="me-1.5 h-4 w-4" />
          {t("partnerPortal.exportAll")}
        </Button>
      }
    >
      <div className="max-w-sm space-y-1.5">
        <Label>{t("partnerPortal.app")}</Label>
        <Select value={appId} onValueChange={setAppId}>
          <SelectTrigger className="bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("partnerPortal.allApps")}</SelectItem>
            {(apps.data ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {language === "ar" && a.name_ar ? a.name_ar : a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Panel
        title={t("partnerPortal.nav.subscriptions")}
        action={
          <div className="relative w-64">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("partnerPortal.search")} className="rounded-full ps-9" />
          </div>
        }
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>{t("partnerPortal.store")}</TableHead>
                <TableHead>{t("partnerPortal.app")}</TableHead>
                <TableHead>{t("partnerPortal.planPrice")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
                <TableHead>{t("partnerPortal.startDate")}</TableHead>
                <TableHead>{t("partnerPortal.endDate")}</TableHead>
                <TableHead>{t("partnerPortal.recurring")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-primary">{s.store_name ?? "—"}</TableCell>
                  <TableCell><bdi>{s.app_name}</bdi></TableCell>
                  <TableCell><bdi dir="ltr">{money(s.price_cents, s.currency)}</bdi></TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_TONE[s.status] ?? ""}`}>
                      {t(`partnerPortal.sub_${s.status}`)}
                    </span>
                  </TableCell>
                  <TableCell><bdi dir="ltr">{day(s.created_at)}</bdi></TableCell>
                  <TableCell><bdi dir="ltr">{day(s.current_period_end)}</bdi></TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-full font-normal">
                      {s.cancel_at_period_end ? t("partnerPortal.no") : t("partnerPortal.yes")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!subs.isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("partnerPortal.noSubscriptions")}</p>
          )}
        </div>
      </Panel>
    </Page>
  );
}

export function PartnerPayouts() {
  const { t } = useTranslation();
  return (
    <Page title={t("partnerPortal.nav.payouts")} subtitle={t("partnerPortal.payoutsSubtitle")}>
      <Earnings />
    </Page>
  );
}

function HelpCard({ icon: Icon, title, body, href }: { icon: typeof BookOpen; title: string; body: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-muted/40"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </a>
  );
}

export function PartnerHelp() {
  const { t } = useTranslation();
  return (
    <Page title={t("partnerPortal.nav.help")}>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t("partnerPortal.help.howTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("partnerPortal.help.howBody")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <HelpCard icon={Headphones} title={t("partnerPortal.help.contact")} body={t("partnerPortal.help.contactBody")} href="mailto:engineering@numueg.app?subject=NUMU%20Partners" />
        <HelpCard icon={Terminal} title={t("partnerPortal.help.cli")} body={t("partnerPortal.help.cliBody")} href="https://www.npmjs.com/package/@numueg/theme-cli" />
      </div>
      <div className="space-y-2 pt-2">
        <h2 className="text-xl font-bold">{t("partnerPortal.help.integrateTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("partnerPortal.help.integrateBody")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <HelpCard icon={BookOpen} title={t("partnerPortal.help.apiDocs")} body={t("partnerPortal.help.apiDocsBody")} href={`${DOCS}/go/Overview`} />
        <HelpCard icon={Palette} title={t("partnerPortal.help.themeDocs")} body={t("partnerPortal.help.themeDocsBody")} href={DOCS} />
      </div>
    </Page>
  );
}

/** Like Zid's rds9ao.zid.store: a random address, whatever the name is. */
const randomSubdomain = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const pick = (from: string) => from[Math.floor(Math.random() * from.length)];
  return pick(chars.slice(0, 26)) + Array.from({ length: 5 }, () => pick(chars)).join("");
};

/** One field, like Zid: any name, in any language. The address is random,
 *  and sample products and orders go in unless the partner opts out. */
function CreateDevStoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [sample, setSample] = useState(true);
  const valid = name.trim().length >= 2 && name.trim().length <= 100;

  const create = useMutation({
    mutationFn: async () => {
      let store;
      try {
        store = await createDevStore({ name: name.trim(), subdomain: randomSubdomain() });
      } catch (err) {
        // A taken address: draw another.
        if ((err as { status?: number }).status !== 409) throw err;
        store = await createDevStore({ name: name.trim(), subdomain: randomSubdomain() });
      }
      if (sample) await seedDevStore(store.id);
      return store;
    },
    onSuccess: () => {
      toast.success(t("partners.created"));
      setName("");
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["partners", "dev-stores"] });
    },
    onError: (err) => showError(err, language),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b p-6">
          <DialogTitle className="text-xl">{t("partnerPortal.devStores.createTitle")}</DialogTitle>
          <DialogDescription>{t("partnerPortal.devStores.createBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="dev-store-name">{t("partners.storeName")}</Label>
            <Input
              id="dev-store-name"
              autoFocus
              value={name}
              placeholder={t("partnerPortal.devStores.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && valid && create.mutate()}
            />
            <p className="text-xs text-muted-foreground">{t("partnerPortal.devStores.nameRule")}</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={sample} onCheckedChange={(v) => setSample(v === true)} className="mt-0.5" />
            <span>
              {t("partnerPortal.devStores.sample")}
              <span className="block text-xs text-muted-foreground">{t("partnerPortal.devStores.sampleHint")}</span>
            </span>
          </label>
        </div>
        <DialogFooter className="gap-2 border-t p-6 sm:justify-start">
          <Button className="rounded-full px-6" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partnerPortal.devStores.create")}
          </Button>
          <Button variant="outline" className="rounded-full px-8" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerDevStores() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["partners", "me"], queryFn: getPartnerMe });
  const stores = useQuery({ queryKey: ["partners", "dev-stores"], queryFn: listDevStores });
  const [creating, setCreating] = useState(false);
  const max = me.data?.max_dev_stores ?? 0;
  const atLimit = (stores.data?.length ?? 0) >= max && max > 0;

  const seed = useMutation({
    mutationFn: seedDevStore,
    onSuccess: () => {
      toast.success(t("partners.seededToast"));
      void qc.invalidateQueries({ queryKey: ["partners", "dev-stores"] });
    },
    onError: (err) => showError(err, language),
  });
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("partnerApps.copied"));
  };
  // The merchant hub opens straight on this store (?store= picks it when it
  // is one of the signed-in user's stores).
  const hubFor = (id: string) =>
    `${merchantHubUrl ?? window.location.origin}/?store=${encodeURIComponent(id)}`;
  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <Page
      title={t("partnerPortal.nav.devStores")}
      subtitle={t("partnerPortal.devStores.subtitle", { max })}
      action={
        <Button className="rounded-full px-5" disabled={atLimit} onClick={() => setCreating(true)}>
          {t("partnerPortal.devStores.createTitle")}
        </Button>
      }
    >
      {atLimit && <p className="text-sm text-muted-foreground">{t("partners.limitReached", { max })}</p>}
      <div className="overflow-x-auto rounded-2xl bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>{t("partnerPortal.devStores.colId")}</TableHead>
              <TableHead>{t("partners.storeName")}</TableHead>
              <TableHead>{t("partnerPortal.devStores.colStorefront")}</TableHead>
              <TableHead>{t("partnerPortal.devStores.colHub")}</TableHead>
              <TableHead>{t("partnerApps.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stores.data ?? []).map((s) => (
              <TableRow key={s.id} className="h-[68px]">
                <TableCell>
                  <button type="button" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => copy(s.id)} title={s.id}>
                    <bdi dir="ltr">{s.id.slice(0, 8)}</bdi>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  {s.url ? (
                    <div className="flex items-center gap-2">
                      <button type="button" className={iconBtn} aria-label={t("partnerApps.copy")} onClick={() => copy(s.url!)}>
                        <Copy className="h-4 w-4" />
                      </button>
                      <a href={s.url} target="_blank" rel="noreferrer" className={iconBtn} aria-label={t("partners.visit")}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <bdi dir="ltr" className="text-sm">{s.url.replace("https://", "")}</bdi>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <a href={hubFor(s.id)} target="_blank" rel="noreferrer">
                      {t("partnerPortal.devStores.openHub")}
                    </a>
                  </Button>
                </TableCell>
                <TableCell>
                  {s.seeded ? (
                    <Badge variant="secondary" className="rounded-full font-normal">{t("partners.seeded")}</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={seed.isPending} onClick={() => seed.mutate(s.id)}>
                      {seed.isPending && seed.variables === s.id && <Loader2 className="me-1.5 h-3 w-3 animate-spin" />}
                      {t("partners.seed")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {stores.data && stores.data.length === 0 && (
          <div className="py-14 text-center">
            <p className="font-semibold">{t("partners.noDevStores")}</p>
            <Button className="mt-4 rounded-full" onClick={() => setCreating(true)}>
              {t("partnerPortal.devStores.createTitle")}
            </Button>
          </div>
        )}
      </div>
      <CreateDevStoreDialog open={creating} onOpenChange={setCreating} />
    </Page>
  );
}
