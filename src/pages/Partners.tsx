/**
 * Partner portal (apps plan, Phase 2): apply, see the review status, and
 * manage development stores. One page for every state, because a partner
 * moves through them in order: closed → apply → pending → approved (or
 * rejected → apply again, or suspended).
 *
 * Lives outside the dashboard layout: a partner does not need a store.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Copy, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney } from "@/lib/format-money";
import { showError } from "@/lib/show-error";
import {
  acceptAgreement,
  applyPartner,
  createDevStore,
  getPartnerEarnings,
  getPartnerMe,
  listDevStores,
  seedDevStore,
  type PartnerAccount,
  type PartnerMe,
} from "@/services/partnersApi";

export default function Partners() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { hasStores } = useDashboardStore();
  const { data: me, isLoading } = useQuery({ queryKey: ["partners", "me"], queryFn: getPartnerMe });

  return (
    // The app's own surface, not the cream auth backdrop: that one is
    // light-only, and in dark mode it put light text on cream.
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <span className="souq-wordmark text-base font-black tracking-[0.18em]">NUMU</span>
          {hasStores && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              {t("partners.backToDashboard")}
            </Button>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("partners.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("partners.subtitle")}</p>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : me === null || me === undefined ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("partners.closed")}
            </CardContent>
          </Card>
        ) : !me.account || me.account.status === "rejected" ? (
          <>
            {me.account?.status === "rejected" && (
              <StatusCard
                title={t("partners.rejectedTitle")}
                body={t("partners.rejectedBody")}
                notes={me.account.review_notes?.[language as "ar" | "en"]}
              />
            )}
            <ApplyForm me={me} previous={me.account} />
          </>
        ) : me.account.status === "pending" ? (
          <StatusCard title={t("partners.pendingTitle")} body={t("partners.pendingBody")} />
        ) : me.account.status === "suspended" ? (
          <StatusCard
            title={t("partners.suspendedTitle")}
            body={t("partners.suspendedBody")}
            notes={me.account.review_notes?.[language as "ar" | "en"]}
          />
        ) : (
          <Approved me={me} />
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, body, notes }: { title: string; body: string; notes?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {notes && (
        <CardContent>
          <p className="rounded-md border border-dashed p-3 text-sm whitespace-pre-line">{notes}</p>
        </CardContent>
      )}
    </Card>
  );
}

function ApplyForm({ me, previous }: { me: PartnerMe; previous: PartnerAccount | null }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PartnerAccount["kind"]>(previous?.kind ?? "individual");
  const [form, setForm] = useState({
    display_name: previous?.display_name ?? "",
    legal_name: previous?.legal_name ?? "",
    website_url: previous?.website_url ?? "",
    support_email: previous?.support_email ?? "",
    support_phone: previous?.support_phone ?? "",
  });
  const [accepted, setAccepted] = useState(false);
  const apply = useMutation({
    mutationFn: () =>
      applyPartner({
        kind,
        display_name: form.display_name.trim(),
        legal_name: form.legal_name.trim() || null,
        website_url: form.website_url.trim() || null,
        support_email: form.support_email.trim(),
        support_phone: form.support_phone.trim() || null,
        country: "EG",
        agreement_version: me.agreement_version,
        accept_agreement: accepted,
      }),
    onSuccess: () => {
      toast.success(t("partners.applied"));
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (err) => showError(err, language),
  });
  const field = (key: keyof typeof form, label: string, hint?: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`p-${key}`}>{label}</Label>
      <Input
        id={`p-${key}`}
        type={type}
        dir={type === "email" || type === "url" || type === "tel" ? "ltr" : undefined}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("partners.applyTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate();
          }}
        >
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("partners.kind")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["individual", "company"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-11 rounded-lg border px-3 text-sm ${
                    kind === k ? "border-foreground bg-muted/40" : "border-border"
                  }`}
                >
                  {t(`partners.${k}`)}
                </button>
              ))}
            </div>
          </fieldset>
          {field("display_name", t("partners.displayName"), t("partners.displayNameHint"))}
          {field("legal_name", t("partners.legalName"), t("partners.legalNameHint"))}
          {field("support_email", t("partners.supportEmail"), t("partners.supportEmailHint"), "email")}
          {field("support_phone", t("partners.supportPhone"), undefined, "tel")}
          {field("website_url", t("partners.website"), undefined, "url")}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>{t("partners.agreement", { version: me.agreement_version })}</span>
          </label>
          <Button
            type="submit"
            disabled={!accepted || !form.display_name.trim() || !form.support_email.trim() || apply.isPending}
          >
            {apply.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("partners.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Approved({ me }: { me: PartnerMe }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refetchStores } = useDashboardStore();
  const { data: stores } = useQuery({ queryKey: ["partners", "dev-stores"], queryFn: listDevStores });
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partners"] });

  const create = useMutation({
    mutationFn: () => createDevStore({ name: name.trim(), subdomain }),
    onSuccess: async (store) => {
      toast.success(t("partners.created"));
      setName("");
      setSubdomain("");
      refresh();
      // It is a store the user owns, so it joins their store switcher.
      await refetchStores(store.id);
    },
    onError: (err) => showError(err, language),
  });
  const seed = useMutation({
    mutationFn: seedDevStore,
    onSuccess: () => {
      toast.success(t("partners.seededToast"));
      refresh();
    },
    onError: (err) => showError(err, language),
  });
  const accept = useMutation({
    mutationFn: () => acceptAgreement(me.agreement_version),
    onSuccess: refresh,
    onError: (err) => showError(err, language),
  });
  const atLimit = (stores?.length ?? 0) >= me.max_dev_stores;

  return (
    <>
      <StatusCard title={t("partners.approvedTitle")} body={me.account?.display_name ?? ""} />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm">{t("partnerApps.subtitle")}</p>
          <Button size="sm" onClick={() => navigate("/partners/apps")}>
            {t("partnerApps.title")}
          </Button>
        </CardContent>
      </Card>
      {me.needs_agreement && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">{t("partners.agreementUpdate")}</p>
            <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate()}>
              {t("partners.acceptNew", { version: me.agreement_version })}
            </Button>
          </CardContent>
        </Card>
      )}
      <Earnings />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("partners.devStores")}</CardTitle>
          <CardDescription>{t("partners.devStoresHint", { max: me.max_dev_stores })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(stores ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("partners.noDevStores")}</p>
          )}
          {(stores ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.name}</div>
                {s.url && (
                  <bdi dir="ltr" className="text-xs text-muted-foreground">
                    {s.url.replace("https://", "")}
                  </bdi>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t("partners.storeId")}:</span>
                  <code dir="ltr" className="break-all rounded bg-muted px-1.5 py-0.5">{s.id}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    aria-label={t("partnerApps.copy")}
                    onClick={() => {
                      void navigator.clipboard.writeText(s.id);
                      toast.success(t("partnerApps.copied"));
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {s.seeded ? (
                <Badge variant="secondary">{t("partners.seeded")}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={seed.isPending}
                  onClick={() => seed.mutate(s.id)}
                >
                  {seed.isPending && seed.variables === s.id && (
                    <Loader2 className="me-2 h-3 w-3 animate-spin" />
                  )}
                  {t("partners.seed")}
                </Button>
              )}
              {s.url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {t("partners.visit")}
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                onClick={async () => {
                  await refetchStores(s.id);
                  navigate("/");
                }}
              >
                {t("partners.open")}
              </Button>
            </div>
          ))}

          {atLimit ? (
            <p className="text-sm text-muted-foreground">
              {t("partners.limitReached", { max: me.max_dev_stores })}
            </p>
          ) : (
            <form
              className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="dev-name">{t("partners.storeName")}</Label>
                <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-sub">{t("partners.subdomain")}</Label>
                <Input
                  id="dev-sub"
                  dir="ltr"
                  value={subdomain}
                  onChange={(e) =>
                    setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                />
              </div>
              <Button
                type="submit"
                disabled={name.trim().length < 2 || subdomain.length < 3 || create.isPending}
              >
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partners.create")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/**
 * What NUMU owes the partner (paid apps, Phase 7): their 80% of every charge
 * on their apps, minus the bank transfers NUMU has sent. NUMU billing for
 * Partner Apps is behind a platform switch until legal sign-off, so an empty
 * ledger says exactly that instead of showing zeros.
 */
function Earnings() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : "en";
  const { data, isError } = useQuery({ queryKey: ["partners", "earnings"], queryFn: getPartnerEarnings });

  if (isError) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          {t("partnerEarnings.loadFailed")}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const money = (cents: number, signed = false) => (
    <bdi dir="ltr">
      {formatMoney(cents, { fromCents: true, currency: data.currency, locale: lang, fixed: true, signed })}
    </bdi>
  );
  const empty = data.balance_cents === 0 && data.entries.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("partnerEarnings.title")}</CardTitle>
        <CardDescription className="leading-relaxed">
          {t(empty ? "partnerEarnings.notLive" : "partnerEarnings.how")}
        </CardDescription>
      </CardHeader>
      {!empty && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              icon={Wallet}
              label={t("partnerEarnings.balance")}
              value={money(data.balance_cents)}
              sub={t("partnerEarnings.balanceHint")}
            />
            <StatTile
              icon={Banknote}
              tone="saffron"
              label={t("partnerEarnings.payable")}
              value={money(data.payable_cents)}
              sub={t("partnerEarnings.payableHint")}
            />
          </div>
          <ul className="divide-y rounded-lg border">
            {data.entries.map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-4 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {t(`partnerEarnings.kind_${e.kind}`)}
                    {/* The app's own name, often Latin inside an Arabic line. */}
                    {e.app_name && <> · <bdi>{e.app_name}</bdi></>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.kind === "sale" && e.gross_cents != null && e.platform_fee_cents != null ? (
                      <>
                        {t("partnerEarnings.merchantPaid")} {money(e.gross_cents)} ·{" "}
                        {t("partnerEarnings.numuFee")} {money(e.platform_fee_cents)}
                      </>
                    ) : (
                      t(`partnerEarnings.detail_${e.kind}`)
                    )}
                  </p>
                  {e.reference && (
                    <p className="text-xs text-muted-foreground">
                      {t("partnerEarnings.reference")}{" "}
                      <bdi dir="ltr" className="font-mono">
                        {e.reference}
                      </bdi>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-end">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      e.amount_cents < 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {money(e.amount_cents, true)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <bdi dir="ltr">
                      {new Date(e.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </bdi>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
