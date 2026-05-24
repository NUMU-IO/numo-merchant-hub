/**
 * MarketingAudiences — Meta Custom Audience sync hub page.
 *
 * Surfaces the 3 prebuilt audience segments (high_ltv /
 * cart_abandoners / lapsed) and lets the merchant push each one to
 * their Meta ad account as a Custom Audience with one click. Wraps
 * the backend at `/stores/{id}/marketing/audiences` (NUMU-api PR #340).
 *
 * Empty state: when the merchant hasn't completed Meta OAuth (no
 * connected ad_account_id + no on-file CAPI token), render a
 * "Connect Meta" CTA pointing at the existing tracking settings
 * page instead of letting them click Sync into a 412.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Users,
  ShoppingCart,
  Clock,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  listAudiences,
  syncAudience,
  createLookalike,
  type AudienceSegmentKey,
  type AudienceStatus,
} from "@/services/marketingAudiencesApi";
import { showError } from "@/lib/show-error";

const SEGMENT_ICONS: Record<AudienceSegmentKey, React.ComponentType<{ className?: string }>> = {
  high_ltv: Users,
  cart_abandoners: ShoppingCart,
  lapsed: Clock,
};

// Meta's Lookalike minimum. Surface this on rows so merchants know
// their tiny segments won't power a Lookalike — the limit is silent
// on Meta's side; surfacing it here saves a confused support ticket.
const LOOKALIKE_MIN_MEMBERS = 100;

// MENA-default country list. EG sits at the top because ~99% of NUMU
// stores ship Egypt-only; SA/AE/KW round out the most-asked
// additional targets per merchant feedback. Anything outside this
// list can land via a future "Custom country" input.
const COUNTRY_OPTIONS: Array<{ code: string; en: string; ar: string }> = [
  { code: "EG", en: "Egypt", ar: "مصر" },
  { code: "SA", en: "Saudi Arabia", ar: "السعودية" },
  { code: "AE", en: "UAE", ar: "الإمارات" },
  { code: "KW", en: "Kuwait", ar: "الكويت" },
  { code: "QA", en: "Qatar", ar: "قطر" },
  { code: "BH", en: "Bahrain", ar: "البحرين" },
  { code: "OM", en: "Oman", ar: "عُمان" },
];

const LOOKALIKE_SIZES = [
  { ratio: 0.01, label: "1%" },
  { ratio: 0.03, label: "3%" },
  { ratio: 0.05, label: "5%" },
];

export default function MarketingAudiences() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { t: _t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [metaConnected, setMetaConnected] = useState(false);
  const [audiences, setAudiences] = useState<AudienceStatus[]>([]);
  const [syncingKey, setSyncingKey] = useState<AudienceSegmentKey | null>(null);

  // Lookalike dialog state. ``lookalikeFor`` doubles as the dialog-open
  // flag — non-null when open, null when closed.
  const [lookalikeFor, setLookalikeFor] = useState<AudienceStatus | null>(null);
  const [lookalikeRatios, setLookalikeRatios] = useState<Set<number>>(
    new Set([0.01]),
  );
  const [lookalikeCountry, setLookalikeCountry] = useState<string>("EG");
  const [creatingLookalike, setCreatingLookalike] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await listAudiences(storeId);
      setAudiences(res.audiences);
      setMetaConnected(res.meta_connected);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async (key: AudienceSegmentKey) => {
    if (!storeId) return;
    setSyncingKey(key);
    try {
      const res = await syncAudience(storeId, key);
      toast.success(
        isAr
          ? `تم رفع ${res.member_count} عضو إلى ميتا`
          : `Pushed ${res.member_count} members to Meta`,
      );
      // Re-fetch instead of patching local state: backend writes the
      // canonical synced_at + audience_id and we want them shown verbatim.
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setSyncingKey(null);
    }
  };

  const handleOpenLookalike = (audience: AudienceStatus) => {
    setLookalikeFor(audience);
    // Reset selections to the most common defaults each open so
    // a stale 5% AE doesn't persist into the next dialog opening.
    setLookalikeRatios(new Set([0.01]));
    setLookalikeCountry("EG");
  };

  const handleCreateLookalike = async () => {
    if (!storeId || !lookalikeFor) return;
    const specs = Array.from(lookalikeRatios).map((ratio) => ({
      country: lookalikeCountry,
      ratio,
    }));
    if (specs.length === 0) return;
    setCreatingLookalike(true);
    try {
      const res = await createLookalike(
        storeId,
        lookalikeFor.segment_key,
        specs,
      );
      const successCount = res.created.filter((r) => r.meta_audience_id).length;
      const failureCount = res.created.length - successCount;
      if (failureCount === 0) {
        toast.success(
          isAr
            ? `تم إنشاء ${successCount} جمهور شبيه`
            : `Built ${successCount} Lookalike audience${successCount === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning(
          isAr
            ? `تم إنشاء ${successCount} وفشل ${failureCount}. راجع رسائل الخطأ.`
            : `Created ${successCount}, ${failureCount} failed. Check error messages.`,
        );
      }
      setLookalikeFor(null);
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setCreatingLookalike(false);
    }
  };

  const toggleRatio = (ratio: number) => {
    setLookalikeRatios((prev) => {
      const next = new Set(prev);
      if (next.has(ratio)) next.delete(ratio);
      else next.add(ratio);
      return next;
    });
  };

  const formatTimeAgo = (iso: string | null) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return isAr ? "الآن" : "Just now";
    if (mins < 60)
      return isAr ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isAr ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return isAr ? `منذ ${days} يوم` : `${days}d ago`;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAr ? "الجماهير" : "Audiences"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {isAr
              ? "ارفع جماهير مخصصة إلى ميتا للإعلانات الموجهة وبناء جماهير شبيهة."
              : "Push Custom Audiences to Meta for targeted retargeting + Lookalike sources. Members are SHA-256 hashed before leaving NUMU."}
          </p>
        </div>
      </div>

      {!metaConnected && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isAr ? "لم تربط ميتا بعد" : "Meta isn't connected yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {isAr
                  ? "اربط حساب ميتا للأعمال أولاً علشان نقدر نرفع الجماهير لحساب الإعلانات بتاعك."
                  : "Connect your Meta Business account first so we can push audiences to your ad account."}
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to="/settings/tracking">
                {isAr ? "اذهب لإعدادات التتبع" : "Go to tracking settings"}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-5">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : (
          audiences.map((a) => {
            const Icon = SEGMENT_ICONS[a.segment_key];
            const isSyncing = syncingKey === a.segment_key;
            const isSynced = !!a.meta_audience_id;
            const belowLookalikeMin =
              isSynced &&
              a.member_count !== null &&
              a.member_count < LOOKALIKE_MIN_MEMBERS;

            return (
              <Card key={a.segment_key}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        {isAr ? a.label_ar : a.label_en}
                        {isSynced ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal gap-1 text-emerald-700 border-emerald-300"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {isAr ? "متزامن" : "Synced"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal text-muted-foreground"
                          >
                            {isAr ? "لم يُزامن" : "Not synced"}
                          </Badge>
                        )}
                        {belowLookalikeMin && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal text-amber-700 border-amber-300"
                            title={
                              isAr
                                ? `يحتاج ${LOOKALIKE_MIN_MEMBERS} عضو على الأقل لبناء جمهور شبيه`
                                : `Needs ${LOOKALIKE_MIN_MEMBERS}+ members to seed a Lookalike`
                            }
                          >
                            {isAr ? "صغير لشبيه" : "Below Lookalike min"}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAr ? a.description_ar : a.description_en}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Build Lookalike — visible only when synced + above min */}
                    {isSynced && !belowLookalikeMin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenLookalike(a)}
                        disabled={!metaConnected}
                        className="gap-1.5"
                        title={
                          isAr
                            ? "إنشاء جمهور شبيه"
                            : "Build a Lookalike from this audience"
                        }
                      >
                        <Target className="h-3.5 w-3.5" />
                        {isAr ? "شبيه" : "Lookalike"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={isSynced ? "outline" : "default"}
                      onClick={() => handleSync(a.segment_key)}
                      disabled={!metaConnected || isSyncing}
                      className="gap-1.5"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isSynced ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {isSynced
                        ? isAr
                          ? "إعادة المزامنة"
                          : "Resync"
                        : isAr
                          ? "مزامنة لميتا"
                          : "Sync to Meta"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-1 pb-4 space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {a.member_count !== null && (
                      <span>
                        <span className="font-medium text-foreground">
                          {a.member_count.toLocaleString()}
                        </span>{" "}
                        {isAr ? "عضو" : "members"}
                      </span>
                    )}
                    {a.last_synced_at && (
                      <span>
                        {isAr ? "آخر مزامنة: " : "Last synced "}
                        {formatTimeAgo(a.last_synced_at)}
                      </span>
                    )}
                    {a.meta_audience_id && (
                      <span className="font-mono text-[10px]">
                        ID: {a.meta_audience_id}
                      </span>
                    )}
                  </div>

                  {a.lookalikes.length > 0 && (
                    <div className="flex items-start gap-2 pt-1 border-t">
                      <Target className="h-3.5 w-3.5 text-muted-foreground mt-2 shrink-0" />
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {a.lookalikes.map((lk) => (
                          <Badge
                            key={lk.meta_audience_id}
                            variant="outline"
                            className="text-[10px] gap-1 font-normal"
                            title={`${lk.meta_audience_id} · ${formatTimeAgo(lk.created_at)}`}
                          >
                            {lk.country} · {Math.round(lk.ratio * 100)}%
                            {lk.status === "CREATING" || lk.status === null ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin opacity-60" />
                            ) : lk.status === "READY" ? (
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-2.5 w-2.5 text-amber-600" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={!!lookalikeFor}
        onOpenChange={(open) => !open && setLookalikeFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "إنشاء جمهور شبيه" : "Build Lookalike"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? `يبني ميتا جمهور شبيه من ${lookalikeFor?.label_ar ?? ""} في الدولة المختارة. يستغرق 6-24 ساعة.`
                : `Meta builds a Lookalike from ${lookalikeFor?.label_en ?? ""} in the selected country. Takes 6-24h to be ready.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {isAr ? "الحجم" : "Size"}
              </Label>
              <div className="flex gap-2">
                {LOOKALIKE_SIZES.map((s) => (
                  <label
                    key={s.ratio}
                    className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors flex-1 justify-center"
                  >
                    <Checkbox
                      checked={lookalikeRatios.has(s.ratio)}
                      onCheckedChange={() => toggleRatio(s.ratio)}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "1% = أقرب تشابه (الأفضل للتحويل). 5% = جمهور أوسع."
                  : "1% = closest match (best for conversion). 5% = broader reach."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lk-country" className="text-xs uppercase tracking-wide text-muted-foreground">
                {isAr ? "الدولة" : "Country"}
              </Label>
              <Select value={lookalikeCountry} onValueChange={setLookalikeCountry}>
                <SelectTrigger id="lk-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {isAr ? opt.ar : opt.en}{" "}
                      <span className="text-muted-foreground font-mono text-[10px] ms-1">
                        {opt.code}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLookalikeFor(null)}
              disabled={creatingLookalike}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCreateLookalike}
              disabled={creatingLookalike || lookalikeRatios.size === 0}
              className="gap-2"
            >
              {creatingLookalike && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr
                ? `إنشاء ${lookalikeRatios.size > 0 ? lookalikeRatios.size : ""}`
                : `Build ${lookalikeRatios.size > 0 ? `(${lookalikeRatios.size})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
