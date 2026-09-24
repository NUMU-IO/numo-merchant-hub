import { useState, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppWindow,
  CreditCard,
  Download,
  LayoutDashboard,
  Languages,
  LifeBuoy,
  Loader2,
  LogOut,
  Star,
  Store,
  Trash2,
  UserCog,
  Users,
  Webhook,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import Partners from "@/pages/Partners";
import PartnerApps from "@/pages/PartnerApps";
import PartnerAppDetail from "@/pages/PartnerAppDetail";
import {
  closePartnerTicket,
  getPartnerDashboard,
  getPartnerMe,
  getPartnerTicket,
  listPartnerReviews,
  listPartnerTickets,
  openPartnerTicket,
  replyPartnerReview,
  replyPartnerTicket,
  reportPartnerReview,
  invitePartnerMember,
  listPartnerApps,
  listPartnerTeam,
  listWebhookDeliveries,
  removePartnerMember,
  resendWebhookDelivery,
  updatePartnerMember,
  updatePartnerProfile,
  type PartnerMe,
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
        <Route path="apps" element={<PartnerApps />} />
        <Route path="apps/:id" element={<PartnerAppDetail />} />
        <Route path="dev-stores" element={<Partners />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="support" element={<Support />} />
        <Route path="team" element={<Team me={me} />} />
        <Route path="profile" element={<Profile me={me} />} />
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
    { to: "/apps", icon: AppWindow, label: t("partnerPortal.nav.apps") },
    { to: "/dev-stores", icon: Store, label: t("partnerPortal.nav.devStores") },
    { to: "/webhooks", icon: Webhook, label: t("partnerPortal.nav.webhooks") },
    { to: "/reviews", icon: Star, label: t("appFeedback.partner.navReviews") },
    { to: "/support", icon: LifeBuoy, label: t("appFeedback.partner.navSupport") },
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

function Dashboard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDate();
  const [appId, setAppId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { app_id: appId === ALL ? undefined : appId, from: from || undefined, to: to || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["partners", "dashboard", params],
    queryFn: () => getPartnerDashboard(params),
  });
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Download} loading={isLoading} label={t("partnerPortal.installsTotal")} value={data?.installs_total ?? 0} />
        <StatTile icon={Trash2} tone="terra" loading={isLoading} label={t("partnerPortal.install_uninstalled")} value={data?.uninstalled ?? 0} sub={t("partnerPortal.uninstalledHint")} />
        <StatTile icon={CreditCard} tone="saffron" label={t("partnerPortal.revenue")} value={0} sub={t("partnerPortal.billingNotLive")} />
        <StatTile icon={Users} tone="sage" label={t("partnerPortal.subscriptions")} value={0} sub={t("partnerPortal.billingNotLive")} />
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
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
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

function Reviews() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState(ALL);
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
  const [kind, setKind] = useState<"app" | "partner">("app");
  const [status, setStatus] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
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
    </Page>
  );
}
