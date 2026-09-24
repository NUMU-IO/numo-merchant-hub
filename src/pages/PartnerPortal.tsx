import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AppWindow,
  Copy,
  BarChart3,
  CreditCard,
  Download,
  Gift,
  LayoutDashboard,
  Percent,
  Languages,
  LifeBuoy,
  Loader2,
  LogOut,
  Palette,
  Star,
  Store,
  Ticket,
  Trash2,
  UserCog,
  Users,
  Webhook,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { StatTile } from "@/components/ui/stat-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { BreakdownPie } from "@/components/analytics/BreakdownPie";
import { BrandLoadingScreen } from "@/components/NumuLoader/BrandLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { Textarea } from "@/components/ui/textarea";
import {
  NewTicketForm,
  ReviewItem,
  Stars,
  TicketList,
  TicketThread,
} from "@/components/apps/AppFeedback";
import { formatMoney } from "@/lib/format-money";
import Partners from "@/pages/Partners";
import PartnerApps from "@/pages/PartnerApps";
import PartnerAppDetail from "@/pages/PartnerAppDetail";
import { PartnerNotificationBell, PartnerNotificationsPage } from "@/components/partners/PartnerNotifications";
import PartnerThemes, { PartnerThemeDetail } from "@/pages/PartnerThemes";
import {
  createPartnerCoupon,
  getPartnerAnalytics,
  getPartnerDashboard,
  getPartnerMe,
  listCouponRedemptions,
  listPartnerCoupons,
  listPartnerSubscriptions,
  setPartnerCouponActive,
  closePartnerTicket,
  getPartnerTicket,
  listPartnerReviews,
  listPartnerTickets,
  openPartnerTicket,
  replyPartnerReview,
  replyPartnerTicket,
  reportPartnerReview,
  getPartnerReferrals,
  invitePartnerMember,
  listPartnerApps,
  listPartnerTeam,
  listWebhookDeliveries,
  removePartnerMember,
  resendWebhookDelivery,
  updatePartnerMember,
  updatePartnerProfile,
  type PartnerMe,
  type PartnerService,
} from "@/services/partnersApi";
import type { AppReview, SupportThread } from "@/services/appsApi";

const ALL = "all";
const MANAGERS = ["owner", "admin"];

export default function PartnerPortal() {
  const { data: me, isLoading } = useQuery({ queryKey: ["partners", "me"], queryFn: getPartnerMe });
  if (isLoading) return <BrandLoadingScreen />;
  if (me?.account?.status !== "approved") return <Partners />;
  return (
    <Shell>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="apps" element={<PartnerApps />} />
        <Route path="apps/:id" element={<PartnerAppDetail />} />
        <Route path="themes" element={<PartnerThemes />} />
        <Route path="themes/:id" element={<PartnerThemeDetail />} />
        <Route path="dev-stores" element={<Partners />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="coupons" element={<Coupons me={me} />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="support" element={<Support />} />
        <Route path="support/:id" element={<Support />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="team" element={<Team me={me} />} />
        <Route path="profile" element={<Profile me={me} />} />
        <Route path="notifications" element={<PartnerNotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { language, setLanguage, isSwitching } = useLanguage();
  const { user, logout } = useAuth();
  const isAr = language === "ar";
  const nav = [
    { to: "/", icon: LayoutDashboard, label: t("partnerPortal.nav.dashboard") },
    { to: "/analytics", icon: BarChart3, label: t("partnerPortal.nav.analytics") },
    { to: "/apps", icon: AppWindow, label: t("partnerPortal.nav.apps") },
    { to: "/themes", icon: Palette, label: t("partnerPortal.nav.themes") },
    { to: "/dev-stores", icon: Store, label: t("partnerPortal.nav.devStores") },
    { to: "/webhooks", icon: Webhook, label: t("partnerPortal.nav.webhooks") },
    { to: "/coupons", icon: Ticket, label: t("partnerPortal.nav.coupons") },
    { to: "/reviews", icon: Star, label: t("appFeedback.partner.navReviews") },
    { to: "/support", icon: LifeBuoy, label: t("appFeedback.partner.navSupport") },
    { to: "/referrals", icon: Gift, label: t("partnerPortal.nav.referrals") },
    { to: "/team", icon: Users, label: t("partnerPortal.nav.team") },
    { to: "/profile", icon: UserCog, label: t("partnerPortal.nav.profile") },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="border-b p-4 md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-e">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="souq-wordmark text-base font-black tracking-[0.18em]">NUMU</span>
          <span className="text-sm font-semibold text-muted-foreground">{t("partnerPortal.brand")}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isActive ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/60"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-end gap-2 border-b px-4">
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <PartnerNotificationBell />
          <ThemeSwitch />
          <Button
            variant="ghost"
            size="sm"
            disabled={isSwitching}
            onClick={() => void setLanguage(isAr ? "en" : "ar")}
            aria-label={isAr ? t("header.switchToEnglish") : t("header.switchToArabic")}
          >
            <Languages className="h-4 w-4" />
            <span className="ms-1">{isAr ? "EN" : "ع"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            <span className="ms-1 hidden sm:inline">{t("header.logout")}</span>
          </Button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function useDate() {
  const { language } = useLanguage();
  return (iso: string) =>
    new Date(iso).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

function AppFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: apps } = useQuery({ queryKey: ["partners", "apps"], queryFn: listPartnerApps });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label={t("partnerPortal.app")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("partnerPortal.allApps")}</SelectItem>
        {(apps ?? []).map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {language === "ar" && a.name_ar ? a.name_ar : a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
};

function useRangeFilter() {
  const { t } = useTranslation();
  const [appId, setAppId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { app_id: appId === ALL ? undefined : appId, from: from || undefined, to: to || undefined };
  const bar = (
    <div className="flex flex-wrap items-end gap-3">
      <AppFilter value={appId} onChange={setAppId} />
      <div className="space-y-1">
        <Label htmlFor="pp-from">{t("partnerPortal.from")}</Label>
        <Input id="pp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pp-to">{t("partnerPortal.to")}</Label>
        <Input id="pp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
    </div>
  );
  return { params, bar };
}

function Dashboard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDate();
  const { params, bar } = useRangeFilter();
  const { data, isLoading } = useQuery({
    queryKey: ["partners", "dashboard", params],
    queryFn: () => getPartnerDashboard(params),
  });
  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["partners", "subscriptions", params.app_id],
    queryFn: () => listPartnerSubscriptions({ app_id: params.app_id }),
  });
  const egp = (cents: number) =>
    formatMoney(cents, { fromCents: true, currency: "EGP", locale: language === "ar" ? "ar" : "en", fixed: true });
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["partners", "reviews", { app_id: params.app_id }],
    queryFn: () => listPartnerReviews({ app_id: params.app_id }),
  });
  const statusLabel = (s: string) => t(`partnerPortal.install_${s}`);
  const slices = data
    ? [
        { name: statusLabel("active"), value: data.active },
        { name: statusLabel("disabled"), value: data.disabled },
        { name: statusLabel("pending"), value: data.pending },
        { name: statusLabel("uninstalled"), value: data.uninstalled },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <Page title={t("partnerPortal.dashboardTitle")}>
      {bar}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Download} loading={isLoading} label={t("partnerPortal.installsTotal")} value={data?.installs_total ?? 0} />
        <StatTile icon={Trash2} tone="terra" loading={isLoading} label={t("partnerPortal.install_uninstalled")} value={data?.uninstalled ?? 0} sub={t("partnerPortal.uninstalledHint")} />
        <StatTile
          icon={CreditCard}
          tone="saffron"
          loading={isLoading}
          label={t("partnerPortal.revenue")}
          value={egp(data?.net_sales_cents ?? 0)}
          sub={t("partnerPortal.revenueHint", {
            balance: egp(data?.balance_cents ?? 0),
            payable: egp(data?.payable_cents ?? 0),
          })}
        />
        <StatTile
          icon={Users}
          tone="sage"
          loading={subsLoading}
          label={t("partnerPortal.subscriptions")}
          value={(subs?.counts.active ?? 0) + (subs?.counts.trial ?? 0)}
          sub={t("partnerPortal.subscriptionsHint", {
            trial: subs?.counts.trial ?? 0,
            pastDue: subs?.counts.past_due ?? 0,
            cancelled: subs?.counts.cancelled ?? 0,
          })}
        />
        <StatTile
          icon={Star}
          tone="saffron"
          loading={reviewsLoading}
          label={t("appFeedback.partner.averageRating")}
          value={reviews?.summary.average != null ? <bdi dir="ltr">{reviews.summary.average.toFixed(1)}</bdi> : "—"}
          sub={t("appFeedback.reviewsCount", { count: reviews?.summary.count ?? 0 })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.installsByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {slices.length ? (
              <BreakdownPie data={slices} locale={language === "ar" ? "ar-EG" : "en-GB"} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("partnerPortal.noInstalls")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.installsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.monthly.length ? (
              <div className="h-60" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [v, t("partnerPortal.installs")]}
                    />
                    <Bar dataKey="installs" fill="hsl(var(--navy))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("partnerPortal.noInstalls")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("partnerPortal.latestInstalls")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("partnerPortal.store")}</TableHead>
                <TableHead>{t("partnerPortal.app")}</TableHead>
                <TableHead>{t("partnerPortal.installedAt")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.latest ?? []).map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.store_name ?? "—"}</TableCell>
                  <TableCell><bdi>{row.app_name}</bdi></TableCell>
                  <TableCell><bdi dir="ltr">{date(row.installed_at)}</bdi></TableCell>
                  <TableCell>
                    <Badge variant={row.status === "active" ? "default" : "secondary"}>{statusLabel(row.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.latest.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("partnerPortal.noInstalls")}</p>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

function ChartCard({ title, hint, empty, children }: { title: string; hint?: string; empty: boolean; children: ReactElement }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("partnerPortal.noData")}</p>
        ) : (
          <div className="h-60" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Analytics() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const date = useDate();
  const { params, bar } = useRangeFilter();
  const { data, isLoading } = useQuery({
    queryKey: ["partners", "analytics", params],
    queryFn: () => getPartnerAnalytics(params),
  });
  const pct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const months = data?.months ?? [];
  const last = months[months.length - 1];
  const hasActivity = months.some((m) => m.installs || m.uninstalls || m.active_stores);
  const churn = months.map((m) => ({ month: m.month, churn: m.churn_rate == null ? null : +(m.churn_rate * 100).toFixed(1) }));
  const requests = (data?.api ?? []).reduce((n, a) => n + a.requests, 0);
  const errors = (data?.api ?? []).reduce((n, a) => n + a.errors, 0);
  const reason = (r: string | null) => t(`apps.uninstallReason_${r ?? "unspecified"}`);
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />;
  const xAxis = <XAxis dataKey="month" tick={{ fontSize: 11 }} />;

  return (
    <Page title={t("partnerPortal.analyticsTitle")}>
      {bar}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Store} loading={isLoading} label={t("partnerPortal.activeStores")} value={last?.active_stores ?? 0} />
        <StatTile icon={Percent} tone="terra" loading={isLoading} label={t("partnerPortal.churn")} value={pct(last?.churn_rate)} sub={last?.month} />
        <StatTile
          icon={CreditCard}
          tone="saffron"
          loading={isLoading}
          label={t("partnerPortal.paidActive")}
          value={data?.paid_active ?? 0}
          sub={`${t("partnerPortal.trialToPaid")}: ${pct(data?.trial_to_paid)}${data?.trial_note ? ` · ${t("partnerPortal.trialNotTracked")}` : ""}`}
        />
        <StatTile
          icon={Activity}
          tone="sage"
          loading={isLoading}
          label={t("partnerPortal.apiHealth")}
          value={requests ? pct(errors / requests) : "—"}
          sub={`${t("partnerPortal.requests")}: ${requests.toLocaleString(locale)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("partnerPortal.activeStores")} hint={t("partnerPortal.activeStoresHint")} empty={!hasActivity}>
          <LineChart data={months}>
            {grid}
            {xAxis}
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, t("partnerPortal.activeStores")]} />
            <Line type="monotone" dataKey="active_stores" stroke="hsl(var(--navy))" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title={t("partnerPortal.installsVsUninstalls")} empty={!hasActivity}>
          <BarChart data={months}>
            {grid}
            {xAxis}
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="installs" name={t("partnerPortal.installs")} fill="hsl(var(--navy))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="uninstalls" name={t("partnerPortal.uninstalls")} fill="hsl(var(--terracotta))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title={t("partnerPortal.churn")} hint={t("partnerPortal.churnHint")} empty={!churn.some((c) => c.churn != null)}>
          <LineChart data={churn}>
            {grid}
            {xAxis}
            <YAxis tick={{ fontSize: 11 }} width={40} unit="%" />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, t("partnerPortal.churn")]} />
            <Line type="monotone" dataKey="churn" stroke="hsl(var(--terracotta))" strokeWidth={2} connectNulls />
          </LineChart>
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.uninstallReasons")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.reasons.length ? (
              <BreakdownPie data={data.reasons.map((r) => ({ name: reason(r.reason), value: r.count }))} locale={locale} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("partnerPortal.noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("partnerPortal.apiHealth")}</CardTitle>
          <CardDescription>{t("partnerPortal.apiHealthHint")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("partnerPortal.app")}</TableHead>
                <TableHead>{t("partnerPortal.requests")}</TableHead>
                <TableHead>{t("partnerPortal.errors")}</TableHead>
                <TableHead>{t("partnerPortal.errorRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.api ?? []).map((a) => (
                <TableRow key={a.app_id}>
                  <TableCell><bdi>{a.app_name}</bdi></TableCell>
                  <TableCell dir="ltr">{a.requests.toLocaleString(locale)}</TableCell>
                  <TableCell dir="ltr">{a.errors.toLocaleString(locale)}</TableCell>
                  <TableCell dir="ltr">{pct(a.error_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!!data?.notes.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.reasonNotes")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notes.map((n, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{reason(n.reason)}</Badge>
                  <bdi dir="ltr">{date(n.created_at)}</bdi>
                </div>
                <p className="whitespace-pre-line">{n.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

function Webhooks() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDate();
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [event, setEvent] = useState("");
  const [page, setPage] = useState(1);
  const params = {
    app_id: appId === ALL ? undefined : appId,
    status: status === ALL ? undefined : status,
    event: event.trim() || undefined,
    page,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["partners", "deliveries", params],
    queryFn: () => listWebhookDeliveries(params),
  });
  const resend = useMutation({
    mutationFn: resendWebhookDelivery,
    onSuccess: () => {
      toast.success(t("partnerPortal.resent"));
      void queryClient.invalidateQueries({ queryKey: ["partners", "deliveries"] });
    },
    onError: (err) => showError(err, language),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const filter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <Page title={t("partnerPortal.webhooksTitle")} subtitle={t("partnerPortal.webhooksSubtitle")}>
      <div className="flex flex-wrap items-end gap-3">
        <AppFilter value={appId} onChange={filter(setAppId)} />
        <Select value={status} onValueChange={filter(setStatus)}>
          <SelectTrigger className="w-40" aria-label={t("partnerPortal.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("partnerPortal.allStatuses")}</SelectItem>
            {["success", "pending", "failed", "exhausted"].map((s) => (
              <SelectItem key={s} value={s}>
                {t(`partnerPortal.delivery_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-56"
          dir="ltr"
          placeholder="order.created"
          aria-label={t("partnerPortal.event")}
          value={event}
          onChange={(e) => filter(setEvent)(e.target.value)}
        />
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("partnerPortal.event")}</TableHead>
                <TableHead>{t("partnerPortal.app")}</TableHead>
                <TableHead>{t("partnerPortal.store")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
                <TableHead>{t("partnerPortal.attempts")}</TableHead>
                <TableHead>{t("partnerPortal.createdAt")}</TableHead>
                <TableHead>{t("partnerPortal.nextRetry")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <code dir="ltr" className="text-xs">{d.event}</code>
                    <div dir="ltr" className="text-[11px] text-muted-foreground" title={d.id}>
                      {d.id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell><bdi>{d.app_name}</bdi></TableCell>
                  <TableCell>{d.store_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "success" ? "default" : d.status === "pending" ? "secondary" : "destructive"}>
                      {t(`partnerPortal.delivery_${d.status}`)}
                    </Badge>
                    {d.status_code != null && <span dir="ltr" className="ms-2 text-xs text-muted-foreground">HTTP {d.status_code}</span>}
                  </TableCell>
                  <TableCell dir="ltr">{d.attempts}</TableCell>
                  <TableCell><bdi dir="ltr">{date(d.created_at)}</bdi></TableCell>
                  <TableCell>
                    {d.status === "pending" && d.next_attempt_at ? <bdi dir="ltr">{date(d.next_attempt_at)}</bdi> : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={d.status === "pending" || resend.isPending}
                      onClick={() => resend.mutate(d.id)}
                    >
                      {t("partnerPortal.resend")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("partnerPortal.noDeliveries")}</p>
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
    </Page>
  );
}

function Coupons({ me }: { me: PartnerMe }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDate();
  const queryClient = useQueryClient();
  const canManage = MANAGERS.includes(me.role ?? "owner");
  const lang = language === "ar" ? "ar" : "en";
  const egp = (cents: number) => formatMoney(cents, { fromCents: true, currency: "EGP", locale: lang, fixed: true });
  const { data: coupons, isLoading } = useQuery({ queryKey: ["partners", "coupons"], queryFn: listPartnerCoupons });
  const [appId, setAppId] = useState(ALL);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [cycles, setCycles] = useState("3");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [storeId, setStoreId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partners", "coupons"] });
  const onError = (err: unknown) => {
    const c = (err as { body?: { detail?: { code?: string } } })?.body?.detail?.code;
    if (c && ["coupon_code_taken", "coupon_app_not_recurring"].includes(c)) toast.error(t(`partnerPortal.${c}`));
    else showError(err, language);
  };
  const create = useMutation({
    mutationFn: () =>
      createPartnerCoupon({
        app_id: appId,
        code: code.trim(),
        percent_off: kind === "percent" ? Number(amount) : null,
        amount_off_cents: kind === "fixed" ? Math.round(Number(amount) * 100) : null,
        duration_cycles: duration === "once" ? 1 : duration === "repeating" ? Number(cycles) : null,
        max_redemptions: maxUses ? Number(maxUses) : null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        store_id: storeId.trim() || null,
      }),
    onSuccess: (c) => {
      toast.success(t("partnerPortal.couponCreated"));
      if (c.capped) toast.warning(t("partnerPortal.couponCapped", { amount: egp(c.max_discount_cents ?? 0) }));
      setCode("");
      setAmount("");
      refresh();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setPartnerCouponActive(v.id, v.active),
    onSuccess: refresh,
    onError,
  });
  const { data: redemptions } = useQuery({
    queryKey: ["partners", "coupons", open, "redemptions"],
    queryFn: () => listCouponRedemptions(open as string),
    enabled: Boolean(open),
  });
  const durationLabel = (n: number | null) =>
    n === null ? t("partnerPortal.couponForever") : n === 1 ? t("partnerPortal.couponOnce") : t("partnerPortal.couponCycles", { count: n });
  const valid = appId !== ALL && code.trim().length >= 3 && Number(amount) > 0 && (kind === "fixed" || Number(amount) <= 100);

  return (
    <Page title={t("partnerPortal.couponsTitle")} subtitle={t("partnerPortal.couponsSubtitle")}>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.couponNew")}</CardTitle>
            <CardDescription>{t("partnerPortal.couponFunding")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>{t("partnerPortal.app")}</Label>
                <AppFilter value={appId} onChange={setAppId} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-code">{t("partnerPortal.couponCode")}</Label>
                <Input id="pc-code" dir="ltr" className="uppercase" maxLength={40} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("partnerPortal.couponDiscount")}</Label>
                <div className="flex gap-2">
                  <Select value={kind} onValueChange={(v) => setKind(v as "percent" | "fixed")}>
                    <SelectTrigger className="w-36" aria-label={t("partnerPortal.couponDiscount")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{t("partnerPortal.couponPercent")}</SelectItem>
                      <SelectItem value="fixed">{t("partnerPortal.couponFixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={kind === "percent" ? 100 : undefined}
                    dir="ltr"
                    aria-label={t("partnerPortal.couponDiscount")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("partnerPortal.couponDuration")}</Label>
                <div className="flex gap-2">
                  <Select value={duration} onValueChange={(v) => setDuration(v as "once" | "repeating" | "forever")}>
                    <SelectTrigger className="w-44" aria-label={t("partnerPortal.couponDuration")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">{t("partnerPortal.couponOnce")}</SelectItem>
                      <SelectItem value="repeating">{t("partnerPortal.couponRepeating")}</SelectItem>
                      <SelectItem value="forever">{t("partnerPortal.couponForever")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {duration === "repeating" && (
                    <Input type="number" min={2} max={120} dir="ltr" aria-label={t("partnerPortal.couponRepeating")} value={cycles} onChange={(e) => setCycles(e.target.value)} />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-max">{t("partnerPortal.couponMax")}</Label>
                <Input id="pc-max" type="number" min={1} dir="ltr" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-exp">{t("partnerPortal.couponExpires")}</Label>
                <Input id="pc-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pc-store">{t("partnerPortal.couponStore")}</Label>
                <Input id="pc-store" dir="ltr" placeholder="00000000-0000-0000-0000-000000000000" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={!valid || create.isPending}>
                  {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("partnerPortal.couponCreate")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("partnerPortal.viewOnly")}</p>
      )}

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("partnerPortal.couponCode")}</TableHead>
                <TableHead>{t("partnerPortal.app")}</TableHead>
                <TableHead>{t("partnerPortal.couponDiscount")}</TableHead>
                <TableHead>{t("partnerPortal.couponDuration")}</TableHead>
                <TableHead>{t("partnerPortal.couponRedeemed")}</TableHead>
                <TableHead>{t("partnerPortal.status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(coupons ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono"><bdi dir="ltr">{c.code}</bdi></TableCell>
                  <TableCell><bdi>{c.app_name}</bdi></TableCell>
                  <TableCell>
                    {c.percent_off != null ? `${c.percent_off}%` : egp(c.amount_off_cents ?? 0)}
                    {c.capped && (
                      <p className="text-xs text-muted-foreground">
                        {t("partnerPortal.couponCapped", { amount: egp(c.max_discount_cents ?? 0) })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{durationLabel(c.duration_cycles)}</TableCell>
                  <TableCell>
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setOpen(open === c.id ? null : c.id)}>
                      {c.redemptions}
                      {c.max_redemptions != null && ` / ${c.max_redemptions}`}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {t(c.active ? "partnerPortal.couponActive" : "partnerPortal.couponDisabled")}
                    </Badge>
                    {c.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("partnerPortal.couponExpires")}: <bdi dir="ltr">{date(c.expires_at)}</bdi>
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                      >
                        {t(c.active ? "partnerPortal.couponDisable" : "partnerPortal.couponEnable")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {coupons && coupons.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("partnerPortal.couponNone")}</p>
          )}
        </CardContent>
      </Card>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.couponRedemptions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(redemptions ?? []).map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                <span>{r.store_name ?? r.store_id}</span>
                <bdi dir="ltr" className="text-muted-foreground">{date(r.created_at)}</bdi>
              </div>
            ))}
            {redemptions && redemptions.length === 0 && (
              <p className="text-muted-foreground">{t("partnerPortal.couponNoRedemptions")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

function Reviews() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [appId, setAppId] = useState(searchParams.get("app") ?? ALL);
  const [rating, setRating] = useState(ALL);
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<AppReview | null>(null);
  const [reply, setReply] = useState("");
  const params = {
    app_id: appId === ALL ? undefined : appId,
    rating: rating === ALL ? undefined : Number(rating),
    page,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["partners", "reviews", params],
    queryFn: () => listPartnerReviews(params),
  });
  const onError = (err: unknown) => showError(err, language);
  const save = useMutation({
    mutationFn: () => replyPartnerReview(replying!.id, reply.trim()),
    onSuccess: () => {
      toast.success(t("appFeedback.partner.replySaved"));
      setReplying(null);
      void queryClient.invalidateQueries({ queryKey: ["partners", "reviews"] });
    },
    onError,
  });
  const report = useMutation({
    mutationFn: (v: { id: string; reason: string }) => reportPartnerReview(v.id, v.reason),
    onSuccess: () => {
      toast.success(t("appFeedback.reported"));
      void queryClient.invalidateQueries({ queryKey: ["partners", "reviews"] });
    },
    onError,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const filter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <Page title={t("appFeedback.partner.reviewsTitle")} subtitle={t("appFeedback.partner.reviewsSubtitle")}>
      <div className="flex flex-wrap items-center gap-3">
        <AppFilter value={appId} onChange={filter(setAppId)} />
        <Select value={rating} onValueChange={filter(setRating)}>
          <SelectTrigger className="w-40" aria-label={t("appFeedback.partner.allRatings")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("appFeedback.partner.allRatings")}</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t("appFeedback.ratingLabel", { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && data.summary.count > 0 && (
          <span className="ms-auto flex items-center gap-2 text-sm">
            <Stars value={data.summary.average ?? 0} />
            <bdi dir="ltr" className="font-semibold">{data.summary.average?.toFixed(1)}</bdi>
            <span className="text-muted-foreground">
              ({t("appFeedback.reviewsCount", { count: data.summary.count })})
            </span>
          </span>
        )}
      </div>
      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {data && data.items.length === 0 && <p className="text-sm text-muted-foreground">{t("appFeedback.noReviews")}</p>}
      <div className="space-y-3">
        {(data?.items ?? []).map((r) => (
          <div key={r.id} className="space-y-2">
            <ReviewItem
              review={r}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplying(r);
                      setReply(r.reply_body ?? "");
                    }}
                  >
                    {r.reply_body ? t("appFeedback.partner.editReply") : t("appFeedback.partner.reply")}
                  </Button>
                  {!r.reported && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = window.prompt(t("appFeedback.reportReason"))?.trim();
                        if (reason && reason.length >= 3) report.mutate({ id: r.id, reason });
                      }}
                    >
                      {t("appFeedback.report")}
                    </Button>
                  )}
                </>
              }
            />
            {replying?.id === r.id && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <Textarea
                  aria-label={t("appFeedback.partner.replyPlaceholder")}
                  placeholder={t("appFeedback.partner.replyPlaceholder")}
                  maxLength={2000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!reply.trim() || save.isPending}>
                    {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("appFeedback.partner.reply")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("partnerPortal.prev")}
          </Button>
          <span dir="ltr" className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t("partnerPortal.next")}
          </Button>
        </div>
      )}
    </Page>
  );
}

function Support() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { id: linkedId } = useParams();
  const [kind, setKind] = useState<"app" | "partner">("app");
  const [status, setStatus] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(linkedId ?? null);
  useEffect(() => {
    if (linkedId) setOpenId(linkedId);
  }, [linkedId]);
  const [composing, setComposing] = useState(false);
  const params = { kind, status: status === ALL ? undefined : status };
  const { data } = useQuery({
    queryKey: ["partners", "support", params],
    queryFn: () => listPartnerTickets(params),
  });
  const { data: thread } = useQuery({
    queryKey: ["partners", "support", "thread", openId],
    queryFn: () => getPartnerTicket(openId!),
    enabled: Boolean(openId),
  });
  const settle = (next: SupportThread) => {
    queryClient.setQueryData(["partners", "support", "thread", next.ticket.id], next);
    void queryClient.invalidateQueries({ queryKey: ["partners", "support", params] });
  };

  return (
    <Page title={t("appFeedback.partner.supportTitle")} subtitle={t("appFeedback.partner.supportSubtitle")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border p-1">
          {(["app", "partner"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? "secondary" : "ghost"}
              onClick={() => {
                setKind(k);
                setOpenId(null);
                setComposing(false);
              }}
            >
              {k === "app" ? t("appFeedback.partner.fromMerchants") : t("appFeedback.partner.toNumu")}
            </Button>
          ))}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label={t("partnerPortal.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("partnerPortal.allStatuses")}</SelectItem>
            {["open", "answered", "closed"].map((s) => (
              <SelectItem key={s} value={s}>
                {t(`appFeedback.status_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kind === "partner" && !composing && !openId && (
          <Button size="sm" className="ms-auto" onClick={() => setComposing(true)}>
            {t("appFeedback.partner.askNumu")}
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="pt-6">
          {composing ? (
            <NewTicketForm
              onCancel={() => setComposing(false)}
              onSubmit={async (form) => {
                const next = await openPartnerTicket(form);
                settle(next);
                setComposing(false);
                setOpenId(next.ticket.id);
              }}
            />
          ) : openId && thread ? (
            <TicketThread
              thread={thread}
              viewer="partner"
              onBack={() => setOpenId(null)}
              onReply={async (form) => settle(await replyPartnerTicket(openId, form))}
              onClose={async () => settle(await closePartnerTicket(openId))}
            />
          ) : (
            <TicketList tickets={data?.items ?? []} onOpen={setOpenId} />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

function Team({ me }: { me: PartnerMe }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const canManage = MANAGERS.includes(me.role ?? "owner");
  const { data: team, isLoading } = useQuery({ queryKey: ["partners", "team"], queryFn: listPartnerTeam });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "developer">("developer");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["partners", "team"] });
  const onError = (err: unknown) => showError(err, language);
  const invite = useMutation({
    mutationFn: () => invitePartnerMember({ email: email.trim(), role }),
    onSuccess: () => {
      toast.success(t("partnerPortal.invited"));
      setEmail("");
      refresh();
    },
    onError,
  });
  const change = useMutation({
    mutationFn: (v: { id: string; role: "admin" | "developer" }) => updatePartnerMember(v.id, v.role),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({ mutationFn: removePartnerMember, onSuccess: refresh, onError });

  return (
    <Page title={t("partnerPortal.teamTitle")} subtitle={t("partnerPortal.teamSubtitle")}>
      <Card>
        <CardContent className="space-y-3 pt-6">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {(team ?? []).map((m) => (
            <div key={m.id ?? "owner"} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.name ?? m.email}</div>
                <bdi dir="ltr" className="text-xs text-muted-foreground">{m.email}</bdi>
              </div>
              {m.status === "invited" && <Badge variant="outline">{t("partnerPortal.pendingInvite")}</Badge>}
              {m.id && canManage ? (
                <>
                  <Select
                    value={m.role}
                    onValueChange={(v) => change.mutate({ id: m.id as string, role: v as "admin" | "developer" })}
                  >
                    <SelectTrigger className="w-36" aria-label={t("partnerPortal.role")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{t("partnerPortal.role_admin")}</SelectItem>
                      <SelectItem value="developer">{t("partnerPortal.role_developer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("partnerPortal.remove")}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("partnerPortal.removeConfirm", { email: m.email }))) remove.mutate(m.id as string);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">{t(`partnerPortal.role_${m.role}`)}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("partnerPortal.inviteTitle")}</CardTitle>
            <CardDescription>{t("partnerPortal.inviteHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="pp-invite">{t("partnerPortal.email")}</Label>
                <Input id="pp-invite" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "developer")}>
                <SelectTrigger className="w-36" aria-label={t("partnerPortal.role")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("partnerPortal.role_admin")}</SelectItem>
                  <SelectItem value="developer">{t("partnerPortal.role_developer")}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!email.includes("@") || invite.isPending}>
                {invite.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partnerPortal.invite")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("partnerPortal.viewOnly")}</p>
      )}
    </Page>
  );
}

function Profile({ me }: { me: PartnerMe }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const account = me.account!;
  const canEdit = MANAGERS.includes(me.role ?? "owner");
  const dir = account.directory_profile ?? {};
  const [listing, setListing] = useState({
    directory_listed: account.directory_listed ?? false,
    logo_url: dir.logo_url ?? "",
    bio_ar: dir.bio_ar ?? "",
    bio_en: dir.bio_en ?? "",
    city: dir.city ?? "",
    services: dir.services ?? [],
    languages: dir.languages ?? [],
  });
  const saveListing = useMutation({
    mutationFn: () =>
      updatePartnerProfile({
        directory_listed: listing.directory_listed,
        directory_profile: {
          logo_url: listing.logo_url.trim() || null,
          bio_ar: listing.bio_ar.trim() || null,
          bio_en: listing.bio_en.trim() || null,
          city: listing.city.trim() || null,
          services: listing.services,
          languages: listing.languages,
        },
      }),
    onSuccess: () => {
      toast.success(t("partnerPortal.saved"));
      void queryClient.invalidateQueries({ queryKey: ["partners", "me"] });
    },
    onError: (err) => showError(err, language),
  });
  const toggle = (key: "services" | "languages", value: string) =>
    setListing((l) => {
      const list = l[key] as string[];
      return { ...l, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  const [form, setForm] = useState({
    display_name: account.display_name,
    legal_name: account.legal_name ?? "",
    website_url: account.website_url ?? "",
    support_email: account.support_email,
    support_phone: account.support_phone ?? "",
  });
  const save = useMutation({
    mutationFn: () =>
      updatePartnerProfile({
        display_name: form.display_name.trim(),
        legal_name: form.legal_name.trim() || null,
        website_url: form.website_url.trim() || null,
        support_email: form.support_email.trim(),
        support_phone: form.support_phone.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t("partnerPortal.saved"));
      void queryClient.invalidateQueries({ queryKey: ["partners", "me"] });
    },
    onError: (err) => showError(err, language),
  });
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`pp-${key}`}>{label}</Label>
      <Input
        id={`pp-${key}`}
        type={type}
        dir={type === "text" ? undefined : "ltr"}
        disabled={!canEdit}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Page title={t("partnerPortal.profileTitle")}>
      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            {field("display_name", t("partners.displayName"))}
            {field("legal_name", t("partners.legalName"))}
            {field("support_email", t("partners.supportEmail"), "email")}
            {field("support_phone", t("partners.supportPhone"), "tel")}
            {field("website_url", t("partners.website"), "url")}
            {canEdit ? (
              <Button type="submit" disabled={!form.display_name.trim() || !form.support_email.trim() || save.isPending}>
                {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partnerPortal.save")}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t("partnerPortal.viewOnly")}</p>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("partnerPortal.directoryTitle")}
            {account.verified && <Badge>{t("partnerPortal.badge_verified")}</Badge>}
            {account.directory_hidden && <Badge variant="destructive">{t("partnerPortal.directoryHiddenByNumu")}</Badge>}
          </CardTitle>
          <CardDescription>{t("partnerPortal.directorySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveListing.mutate();
            }}
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                disabled={!canEdit}
                checked={listing.directory_listed}
                onCheckedChange={(v) => setListing((l) => ({ ...l, directory_listed: v === true }))}
              />
              {t("partnerPortal.directoryListed")}
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="pp-logo">{t("partnerPortal.logoUrl")}</Label>
              <Input
                id="pp-logo"
                type="url"
                dir="ltr"
                disabled={!canEdit}
                value={listing.logo_url}
                onChange={(e) => setListing((l) => ({ ...l, logo_url: e.target.value }))}
              />
            </div>
            {(["bio_ar", "bio_en"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`pp-${key}`}>{t(`partnerPortal.${key}`)}</Label>
                <Textarea
                  id={`pp-${key}`}
                  dir={key === "bio_ar" ? "rtl" : "ltr"}
                  maxLength={600}
                  disabled={!canEdit}
                  value={listing[key]}
                  onChange={(e) => setListing((l) => ({ ...l, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="pp-city">{t("partnerPortal.city")}</Label>
              <Input
                id="pp-city"
                maxLength={80}
                disabled={!canEdit}
                value={listing.city}
                onChange={(e) => setListing((l) => ({ ...l, city: e.target.value }))}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("partnerPortal.services")}</legend>
              <div className="flex flex-wrap gap-4">
                {(["apps", "themes", "setup", "marketing"] as PartnerService[]).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      disabled={!canEdit}
                      checked={listing.services.includes(s)}
                      onCheckedChange={() => toggle("services", s)}
                    />
                    {t(`partnerPortal.service_${s}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("partnerPortal.languages")}</legend>
              <div className="flex flex-wrap gap-4">
                {(["ar", "en", "fr"] as const).map((lang) => (
                  <label key={lang} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      disabled={!canEdit}
                      checked={listing.languages.includes(lang)}
                      onCheckedChange={() => toggle("languages", lang)}
                    />
                    {t(`partnerPortal.lang_${lang}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {canEdit && (
              <Button type="submit" disabled={saveListing.isPending}>
                {saveListing.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("partnerPortal.save")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}

function Referrals() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDate();
  const { data, isLoading } = useQuery({ queryKey: ["partners", "referrals"], queryFn: getPartnerReferrals });
  const money = (cents: number) => formatMoney(cents, { fromCents: true, currency: "EGP", locale: language === "ar" ? "ar" : "en", fixed: true });
  const copy = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success(t("partnerPortal.copied"));
    } catch {
      toast.error(t("partnerPortal.copyFailed"));
    }
  };

  return (
    <Page
      title={t("partnerPortal.referralsTitle")}
      subtitle={
        data ? t("partnerPortal.referralsSubtitle", { pct: data.referral_bps / 100, months: data.referral_months }) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("partnerPortal.referralLink")}</CardTitle>
          <CardDescription>{t("partnerPortal.referralLinkHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly dir="ltr" value={data?.link ?? ""} aria-label={t("partnerPortal.referralLink")} />
          <Button type="button" variant="outline" onClick={copy} disabled={!data?.link}>
            <Copy className="me-2 h-4 w-4" />
            {t("partnerPortal.copy")}
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile icon={Store} loading={isLoading} label={t("partnerPortal.referredStores")} value={data?.stores.length ?? 0} />
        <StatTile
          icon={CreditCard}
          tone="sage"
          loading={isLoading}
          label={t("partnerPortal.earnedToDate")}
          value={money(data?.earned_cents ?? 0)}
        />
      </div>
      <Card>
        <CardContent className="pt-6">
          {data && data.stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("partnerPortal.noReferrals")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("partnerPortal.store")}</TableHead>
                  <TableHead>{t("partnerPortal.signedUp")}</TableHead>
                  <TableHead>{t("partnerPortal.plan")}</TableHead>
                  <TableHead>{t("partnerPortal.status")}</TableHead>
                  <TableHead>{t("partnerPortal.firstPayment")}</TableHead>
                  <TableHead className="text-end">{t("partnerPortal.earned")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.stores ?? []).map((r) => (
                  <TableRow key={r.tenant_id}>
                    <TableCell>
                      <bdi>{r.store_name}</bdi>
                    </TableCell>
                    <TableCell>{date(r.signed_up_at)}</TableCell>
                    <TableCell>{r.plan}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell>{r.first_paid_at ? date(r.first_paid_at) : "—"}</TableCell>
                    <TableCell className="text-end">{money(r.earned_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
