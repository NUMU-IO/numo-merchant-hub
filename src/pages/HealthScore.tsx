/**
 * Detailed Health Score page — explains each metric and how it's calculated.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Lightbulb, RefreshCw, TrendingUp, Truck, ShieldCheck, PackageCheck, RotateCcw, Timer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getHealthScore } from "@/services/analyticsApi";
import type { HealthScoreData } from "@/services/analyticsApi";

export default function HealthScore() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const [forceLive, setForceLive] = useState(false);

  const { data: healthScore, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["healthScore", "detail", storeId, forceLive],
    queryFn: () => getHealthScore(storeId!, forceLive, language),
    enabled: !!storeId,
  });

  const handleRefresh = async () => {
    setForceLive(true);
    await refetch();
    // Also invalidate the dashboard's cached copy so the small card updates.
    queryClient.invalidateQueries({ queryKey: ["dashboard", "healthScore", storeId] });
  };

  const insufficient = healthScore?.insufficient_data || healthScore?.score == null;
  const insufficientMetrics = new Set(healthScore?.insufficient_metrics || []);
  // The backend computes over a 90-day rolling window (window_days in the
  // response) — the page previously hardcoded "30 days" everywhere, so the
  // copy contradicted the numbers.
  const windowDays = healthScore?.window_days ?? 90;

  const gradeColor = (grade?: string) => {
    switch (grade) {
      case "A": return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "stroke-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
      case "B": return { text: "text-blue-500", bg: "bg-blue-500", ring: "stroke-blue-500", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
      case "C": return { text: "text-amber-500", bg: "bg-amber-500", ring: "stroke-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
      case "D": return { text: "text-orange-500", bg: "bg-orange-500", ring: "stroke-orange-500", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400" };
      default: return { text: "text-muted-foreground", bg: "bg-muted", ring: "stroke-muted", badge: "bg-muted text-muted-foreground" };
    }
  };

  // Tone classes for sub-score buckets. Returned as static class strings
  // so Tailwind's JIT scanner can see them; dynamic `${color}/10` style
  // concatenation gets purged.
  const subTone = (sub: number, unavailable = false) => {
    if (unavailable) {
      return {
        bar: "bg-muted-foreground/30",
        text: "text-muted-foreground",
        iconBg: "bg-muted/30",
        badge: "bg-muted text-muted-foreground",
      };
    }
    if (sub >= 75) {
      return {
        bar: "bg-emerald-500",
        text: "text-emerald-500",
        iconBg: "bg-emerald-500/10",
        badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    }
    if (sub >= 50) {
      return {
        bar: "bg-amber-500",
        text: "text-amber-500",
        iconBg: "bg-amber-500/10",
        badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    }
    return {
      bar: "bg-red-500",
      text: "text-red-500",
      iconBg: "bg-red-500/10",
      badge: "bg-red-500/10 text-red-700 dark:text-red-400",
    };
  };

  const subText = (sub: number, unavailable = false) => {
    if (unavailable) return isAr ? "لا توجد بيانات كافية" : "Not enough data";
    if (sub >= 75) return isAr ? "ممتاز" : "Excellent";
    if (sub >= 50) return isAr ? "متوسط" : "Average";
    return isAr ? "يحتاج تحسين" : "Needs improvement";
  };

  const metrics = healthScore ? [
    {
      key: "delivery",
      subKey: "delivery_success",
      icon: Truck,
      label: isAr ? "معدل التوصيل الناجح" : "Delivery Success Rate",
      value: healthScore.metrics.delivery_success_rate,
      sub: healthScore.sub_scores.delivery_success,
      weight: 30,
      unit: "%",
      description: isAr
        ? `نسبة الشحنات التي تم تسليمها بنجاح من إجمالي الشحنات (بدون الملغاة قبل الاستلام). يتم حسابه من بيانات شركات الشحن خلال آخر ${windowDays} يوم.`
        : `Percentage of shipments successfully delivered out of total shipments (excluding those cancelled before pickup). Calculated from carrier data over the last ${windowDays} days.`,
      formula: isAr
        ? "الشحنات المسلّمة ÷ إجمالي الشحنات × 100"
        : "Delivered shipments ÷ Total shipments × 100",
      tips: isAr
        ? ["تأكد من صحة عناوين العملاء قبل الشحن", "تواصل مع العميل قبل الشحن لتأكيد العنوان", "اختر شركة شحن موثوقة في منطقة العميل"]
        : ["Verify customer addresses before shipping", "Contact customer to confirm address before dispatch", "Choose a reliable carrier for the customer's area"],
    },
    {
      key: "cod",
      subKey: "cod_acceptance",
      icon: ShieldCheck,
      label: isAr ? "معدل قبول الدفع عند الاستلام" : "COD Acceptance Rate",
      value: healthScore.metrics.cod_acceptance_rate,
      sub: healthScore.sub_scores.cod_acceptance,
      weight: 25,
      unit: "%",
      description: isAr
        ? "نسبة طلبات الدفع عند الاستلام التي تم تسليمها وتحصيل المبلغ بنجاح. الطلبات المرفوضة عند التسليم تخفض هذا المعدل."
        : "Percentage of COD orders that were delivered and payment collected successfully. Orders rejected at delivery lower this rate.",
      formula: isAr
        ? "طلبات COD المسلّمة ÷ إجمالي طلبات COD × 100"
        : "Delivered COD orders ÷ Total COD orders × 100",
      tips: isAr
        ? ["فعّل تأكيد الطلب عبر OTP لتقليل الطلبات الوهمية", "أرسل رسالة تأكيد للعميل قبل الشحن", "راجع الطلبات ذات القيمة العالية يدويًا"]
        : ["Enable OTP order confirmation to reduce fake orders", "Send confirmation message before shipping", "Manually review high-value orders"],
    },
    {
      key: "completion",
      subKey: "order_completion",
      icon: PackageCheck,
      label: isAr ? "معدل إتمام الطلبات" : "Order Completion Rate",
      value: healthScore.metrics.order_completion_rate,
      sub: healthScore.sub_scores.order_completion,
      weight: 20,
      unit: "%",
      description: isAr
        ? "نسبة الطلبات المسلّمة من الطلبات المكتملة فقط (تم التوصيل أو الإلغاء أو الفشل أو الإرجاع). الطلبات الجارية لا تدخل في الحساب حتى تصل لحالة نهائية."
        : "Percentage of delivered orders out of settled orders only (delivered, cancelled, failed or returned). In-flight orders don't count until they reach a final status.",
      formula: isAr
        ? "الطلبات المسلّمة ÷ الطلبات المكتملة × 100"
        : "Delivered orders ÷ Settled orders × 100",
      tips: isAr
        ? ["تابع الطلبات المعلقة يوميًا وسرّع التجهيز", "قلل وقت المعالجة بتجهيز المنتجات مسبقًا", "أبلغ العميل بأي تأخير متوقع"]
        : ["Follow up on pending orders daily", "Reduce processing time by pre-packing products", "Notify customer of any expected delays"],
    },
    {
      key: "returns",
      subKey: "low_return",
      icon: RotateCcw,
      label: isAr ? "معدل المرتجعات" : "Return Rate",
      value: healthScore.metrics.return_rate,
      sub: healthScore.sub_scores.low_return,
      weight: 15,
      unit: "%",
      invertedDisplay: true,
      description: isAr
        ? "نسبة الطلبات المرتجعة من إجمالي الطلبات المسلّمة. معدل منخفض يعني رضا أعلى للعملاء. يتم حسابه عكسيًا — معدل أقل = نتيجة أعلى."
        : "Percentage of orders returned out of total delivered orders. A lower rate means higher customer satisfaction. Scored inversely — lower rate = higher score.",
      formula: isAr
        ? "الطلبات المرتجعة ÷ الطلبات المسلّمة × 100 (نتيجة عكسية)"
        : "Returned orders ÷ Delivered orders × 100 (inversely scored)",
      tips: isAr
        ? ["حسّن وصف المنتجات وأضف صور عالية الجودة", "أضف جدول مقاسات واضح للملابس", "تأكد من جودة التغليف لحماية المنتج أثناء الشحن"]
        : ["Improve product descriptions and add high-quality images", "Add clear size charts for clothing", "Ensure quality packaging to protect products during shipping"],
    },
    {
      key: "speed",
      subKey: "response_time",
      icon: Timer,
      label: isAr ? "سرعة التجهيز" : "Fulfillment Speed",
      value: healthScore.metrics.avg_response_hours,
      sub: healthScore.sub_scores.response_time,
      weight: 10,
      unit: isAr ? " ساعة" : "h",
      description: isAr
        ? "متوسط الوقت بين استلام الطلب وإنشاء الشحنة بالساعات. يتم قياسه من وقت إنشاء الطلب حتى وقت إنشاء أول شحنة مرتبطة به."
        : "Average time in hours between receiving an order and creating a shipment. Measured from order creation to the first associated shipment creation.",
      formula: isAr
        ? "مجموع (وقت إنشاء الشحنة - وقت إنشاء الطلب) ÷ عدد الطلبات"
        : "Sum of (shipment creation - order creation) ÷ Number of orders",
      tips: isAr
        ? ["حاول شحن الطلبات خلال 24 ساعة من الاستلام", "جهّز المنتجات الأكثر مبيعًا مسبقًا", "خصص وقت يومي ثابت لتجهيز الشحنات"]
        : ["Try to ship orders within 24 hours", "Pre-pack best-selling products", "Set a fixed daily time for fulfillment processing"],
    },
  ] : [];

  const colors = gradeColor(healthScore?.grade);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "تفاصيل صحة المتجر" : "Store Health Details"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? `تحليل شامل لأداء متجرك خلال آخر ${windowDays} يوم` : `Comprehensive analysis of your store performance over the last ${windowDays} days`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleRefresh}
          disabled={isFetching || !storeId}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isAr ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : healthScore && insufficient ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-base font-semibold">{t("dashboard.healthNoData")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {/* The backend distinguishes "no orders at all" from "orders
                  still in flight" — show its sentence when available so a
                  store WITH orders isn't told it has none. */}
              {healthScore.empty_state_message ||
                (isAr
                  ? `نحتاج إلى عدد كافٍ من الطلبات المكتملة خلال آخر ${windowDays} يوم لاحتساب نتيجة دقيقة لمتجرك.`
                  : `We need enough settled orders in the last ${windowDays} days to compute a meaningful score for your store.`)}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
              <span>{isAr ? "طلبات تم تحليلها:" : "Orders analyzed:"} {healthScore.orders_analyzed}</span>
              <span aria-hidden>·</span>
              <span>{isAr ? "شحنات:" : "Shipments:"} {healthScore.shipments_analyzed}</span>
            </div>
          </CardContent>
        </Card>
      ) : healthScore && healthScore.score !== null ? (
        <>
          {/* Overall Score Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-32 h-32 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-muted/20" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${(healthScore.score ?? 0) * 2.64} 264`}
                      className={colors.ring}
                      style={{ transition: "stroke-dasharray 1s ease-out" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold tabular-nums">{healthScore.score}</span>
                    <span className="text-[10px] text-muted-foreground">{isAr ? "من ١٠٠" : "/ 100"}</span>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-start">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <span className={`text-3xl font-black ${colors.text}`}>{healthScore.grade}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${colors.badge}`}>
                      {isAr ? "تقييم" : "Grade"} {healthScore.grade}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {isAr
                      ? `تم تحليل ${healthScore.orders_analyzed} طلب و ${healthScore.shipments_analyzed} شحنة خلال آخر ${windowDays} يوم`
                      : `Analyzed ${healthScore.orders_analyzed} orders and ${healthScore.shipments_analyzed} shipments over the last ${windowDays} days`}
                  </p>
                  <div className="text-[11px] text-muted-foreground/60">
                    {isAr ? "يتم تحديث النتيجة يوميًا تلقائيًا" : "Score is updated daily automatically"}
                  </div>
                </div>
              </div>

              {/* Grade Scale */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-[11px] text-muted-foreground mb-2">{isAr ? "مقياس التقييم" : "Grade Scale"}</p>
                <div className="flex gap-1.5">
                  {[
                    { grade: "A", range: "90-100", color: "bg-emerald-500" },
                    { grade: "B", range: "75-89", color: "bg-blue-500" },
                    { grade: "C", range: "50-74", color: "bg-amber-500" },
                    { grade: "D", range: "30-49", color: "bg-orange-500" },
                    { grade: "F", range: "0-29", color: "bg-red-500" },
                  ].map((g) => (
                    <div
                      key={g.grade}
                      className={`flex-1 rounded-lg p-2 text-center transition-all ${
                        healthScore.grade === g.grade ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/20 scale-105" : "opacity-50"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full ${g.color} mx-auto mb-1 flex items-center justify-center text-white text-[10px] font-bold`}>
                        {g.grade}
                      </div>
                      <p className="text-[9px] text-muted-foreground">{g.range}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How it's calculated */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{isAr ? "كيف يتم حساب النتيجة؟" : "How is the score calculated?"}</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {isAr
                  ? "يتم حساب نتيجة صحة المتجر من 5 مقاييس أساسية، كل منها له وزن مختلف حسب أهميته لنجاح متجرك. كل مقياس يُحوّل إلى نتيجة فرعية من 100، ثم يتم ضربه في وزنه لحساب النتيجة النهائية."
                  : "The store health score is calculated from 5 core metrics, each weighted by its importance to your store's success. Each metric is converted to a sub-score out of 100, then multiplied by its weight to calculate the final score."}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {metrics.map((m) => (
                  <div key={m.key} className="text-center rounded-lg bg-muted/30 p-2">
                    <m.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] font-semibold">{m.weight}%</p>
                    <p className="text-[9px] text-muted-foreground truncate">{m.label.split(" ").slice(0, 2).join(" ")}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          <div className="space-y-4">
            {metrics.map((m) => {
              const unavailable = insufficientMetrics.has(m.subKey);
              const tone = subTone(m.sub, unavailable);
              return (
              <Card key={m.key}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${tone.iconBg} flex items-center justify-center shrink-0`}>
                      <m.icon className={`h-5 w-5 ${tone.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">{m.label}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold tabular-nums">
                            {unavailable ? "—" : `${m.value}${m.unit}`}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tone.badge}`}>
                            {subText(m.sub, unavailable)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${tone.bar}`}
                          style={{ width: `${Math.max(3, unavailable ? 0 : m.sub)}%` }}
                        />
                      </div>

                      {/* Weight badge */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5">
                          {isAr ? `الوزن: ${m.weight}%` : `Weight: ${m.weight}%`}
                        </span>
                        <span className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5">
                          {isAr ? `النتيجة الفرعية: ${unavailable ? "—" : `${m.sub}/100`}` : `Sub-score: ${unavailable ? "—" : `${m.sub}/100`}`}
                        </span>
                        {unavailable && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded px-1.5 py-0.5">
                            {isAr ? "بيانات غير كافية — مستثناة من الحساب" : "Insufficient data — excluded from score"}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{m.description}</p>

                      {/* Formula */}
                      <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 mb-3">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{isAr ? "طريقة الحساب" : "Formula"}</p>
                        <p className="text-xs font-mono">{m.formula}</p>
                      </div>

                      {/* Tips */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">{isAr ? "نصائح للتحسين" : "Tips to improve"}</p>
                        {m.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Lightbulb className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          {/* Recommendations */}
          {healthScore.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold">{isAr ? "توصيات لتحسين أداء متجرك" : "Recommendations"}</h2>
                </div>
                <div className="space-y-2">
                  {healthScore.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/10 px-4 py-3">
                      <span className="text-xs font-bold text-amber-500 mt-0.5">{i + 1}</span>
                      <p className="text-sm text-foreground/80">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("dashboard.healthNoData")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("dashboard.healthNoDataSub")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
