import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CreditCard, Package, ShoppingCart, Webhook, Globe, BarChart3,
  Tag, Users, Store, CheckCircle2, XCircle,
} from "lucide-react";
import { getPlanUsage, getAllPlanLimits, PlanUsage, PlanMatrix } from "@/services/planApi";

// ── Helpers ──

function fmt(n: number | null): string {
  if (n === null) return "∞";
  return n.toLocaleString();
}

function pct(used: number, limit: number, unlimited: boolean): number {
  if (unlimited || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageColor(p: number): string {
  if (p >= 90) return "bg-destructive";
  if (p >= 70) return "bg-amber-500";
  return "bg-primary";
}

// ── Sub-components ──

function UsageBar({
  label,
  icon: Icon,
  used,
  limit,
  unlimited,
  isAr,
}: {
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  unlimited: boolean;
  isAr: boolean;
}) {
  const p = pct(used, limit, unlimited);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground text-xs">
          {unlimited
            ? isAr ? `${used.toLocaleString()} / ∞` : `${used.toLocaleString()} / ∞`
            : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usageColor(p)}`}
            style={{ width: `${p}%` }}
          />
        </div>
      )}
      {unlimited && (
        <div className="h-1.5 w-full rounded-full bg-primary/20" />
      )}
    </div>
  );
}

function FeaturePill({ enabled, isAr }: { enabled: boolean; isAr: boolean }) {
  return enabled ? (
    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
  ) : (
    <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

const PLAN_ORDER = ["demo", "free", "starter", "pro", "enterprise"];

// ── Page ──

export default function Plan() {
  const { currentStore } = useDashboardStore();
  const { isRTL } = useLanguage();
  const storeId = currentStore?.id ?? "";

  const { data: usage, isLoading: usageLoading } = useQuery<PlanUsage>({
    queryKey: ["plan-usage", storeId],
    queryFn: () => getPlanUsage(storeId),
    enabled: !!storeId,
  });

  const { data: matrix, isLoading: matrixLoading } = useQuery<PlanMatrix>({
    queryKey: ["plan-matrix", storeId],
    queryFn: () => getAllPlanLimits(storeId),
    enabled: !!storeId,
    staleTime: 30 * 60 * 1000, // plan matrix rarely changes
  });

  const t = {
    title: isRTL ? "الخطة والاستخدام" : "Plan & Usage",
    subtitle: isRTL ? "اطلع على استخدامك الحالي وحدود خطتك" : "Monitor your current usage and plan limits",
    currentPlan: isRTL ? "الخطة الحالية" : "Current Plan",
    usageTitle: isRTL ? "الاستخدام الحالي" : "Current Usage",
    allPlans: isRTL ? "مقارنة الخطط" : "Plan Comparison",
    products: isRTL ? "المنتجات" : "Products",
    ordersMonth: isRTL ? "الطلبات هذا الشهر" : "Orders this month",
    features: isRTL ? "الميزات" : "Features",
    webhooks: isRTL ? "Webhooks" : "Webhooks",
    customDomain: isRTL ? "نطاق مخصص" : "Custom Domain",
    apiAccess: isRTL ? "API Access" : "API Access",
    analytics: isRTL ? "التحليلات" : "Analytics",
    discounts: isRTL ? "رموز الخصم" : "Discount Codes",
    maxProducts: isRTL ? "الحد الأقصى للمنتجات" : "Max Products",
    maxOrders: isRTL ? "الطلبات / شهر" : "Orders / month",
    maxStores: isRTL ? "المتاجر" : "Stores",
    maxStaff: isRTL ? "الموظفون" : "Staff",
    maxCustomers: isRTL ? "العملاء" : "Customers",
    unlimitedLabel: isRTL ? "غير محدود" : "Unlimited",
    contactSales: isRTL ? "تواصل مع المبيعات" : "Contact Sales",
  };

  const orderedPlans = PLAN_ORDER.filter((p) => matrix && p in matrix);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
      </div>

      {/* Current plan + usage row */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        {/* Current plan card */}
        <Card className="md:w-56">
          <CardHeader className="pb-3">
            <CardDescription>{t.currentPlan}</CardDescription>
            {usageLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <CardTitle className="text-2xl capitalize">{usage?.display_name ?? "—"}</CardTitle>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {usageLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))
            ) : usage ? (
              <>
                <FeatureRow icon={Webhook} label={t.webhooks} enabled={usage.features.webhooks} />
                <FeatureRow icon={Globe} label={t.customDomain} enabled={usage.features.custom_domain} />
                <FeatureRow icon={null} label={t.apiAccess} enabled={usage.features.api_access} />
                <FeatureRow icon={BarChart3} label={t.analytics} enabled={usage.features.analytics} />
                <FeatureRow icon={Tag} label={t.discounts} enabled={usage.features.discount_codes} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Usage bars */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.usageTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {usageLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))
            ) : usage ? (
              <>
                <UsageBar
                  label={t.products}
                  icon={Package}
                  used={usage.products.used}
                  limit={usage.products.limit}
                  unlimited={usage.products.unlimited}
                  isAr={isRTL}
                />
                <UsageBar
                  label={t.ordersMonth}
                  icon={ShoppingCart}
                  used={usage.orders_this_month.used}
                  limit={usage.orders_this_month.limit}
                  unlimited={usage.orders_this_month.unlimited}
                  isAr={isRTL}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.allPlans}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {matrixLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : matrix ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40" />
                  {orderedPlans.map((p) => (
                    <TableHead key={p} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold capitalize">{matrix[p].display_name}</span>
                        {usage?.plan === p && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {isRTL ? "حالياً" : "Current"}
                          </Badge>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <MatrixRow
                  label={t.maxProducts}
                  icon={Package}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="max_products"
                  unlimitedLabel={t.unlimitedLabel}
                />
                <MatrixRow
                  label={t.maxOrders}
                  icon={ShoppingCart}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="max_orders_per_month"
                  unlimitedLabel={t.unlimitedLabel}
                />
                <MatrixRow
                  label={t.maxStores}
                  icon={Store}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="max_stores"
                  unlimitedLabel={t.unlimitedLabel}
                />
                <MatrixRow
                  label={t.maxStaff}
                  icon={Users}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="max_staff_members"
                  unlimitedLabel={t.unlimitedLabel}
                />
                <FeatureMatrixRow
                  label={t.webhooks}
                  icon={Webhook}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="webhooks_enabled"
                  isAr={isRTL}
                />
                <FeatureMatrixRow
                  label={t.customDomain}
                  icon={Globe}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="custom_domain_enabled"
                  isAr={isRTL}
                />
                <FeatureMatrixRow
                  label={t.analytics}
                  icon={BarChart3}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="analytics_enabled"
                  isAr={isRTL}
                />
                <FeatureMatrixRow
                  label={t.discounts}
                  icon={Tag}
                  plans={orderedPlans}
                  matrix={matrix}
                  field="discount_codes_enabled"
                  isAr={isRTL}
                />
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Internal table row helpers ──

function FeatureRow({
  icon: Icon,
  label,
  enabled,
}: {
  icon: React.ElementType | null;
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      {enabled ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/30" />
      )}
    </div>
  );
}

function MatrixRow({
  label,
  icon: Icon,
  plans,
  matrix,
  field,
  unlimitedLabel,
}: {
  label: string;
  icon: React.ElementType;
  plans: string[];
  matrix: PlanMatrix;
  field: "max_products" | "max_orders_per_month" | "max_stores" | "max_staff_members" | "max_customers";
  unlimitedLabel: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </TableCell>
      {plans.map((p) => {
        const val = matrix[p][field];
        return (
          <TableCell key={p} className="text-center text-sm">
            {val === null ? unlimitedLabel : val.toLocaleString()}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function FeatureMatrixRow({
  label,
  icon: Icon,
  plans,
  matrix,
  field,
  isAr,
}: {
  label: string;
  icon: React.ElementType;
  plans: string[];
  matrix: PlanMatrix;
  field: "webhooks_enabled" | "custom_domain_enabled" | "api_access_enabled" | "analytics_enabled" | "discount_codes_enabled";
  isAr: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </TableCell>
      {plans.map((p) => (
        <TableCell key={p} className="text-center">
          <FeaturePill enabled={matrix[p][field]} isAr={isAr} />
        </TableCell>
      ))}
    </TableRow>
  );
}
