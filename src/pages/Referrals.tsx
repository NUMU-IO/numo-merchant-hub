import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2, Users, Wallet, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/format-money";

interface ReferralSummary {
  total_earned_cents: number;
  confirmed_cents: number;
  pending_cents: number;
  total_referrals: number;
  tier: string;
}

interface ReferredMerchant {
  tenant_name: string;
  subdomain: string;
  referral_date: string;
  orders: number;
  commission_earned_cents: number;
}

interface MyReferralsResponse {
  summary: ReferralSummary;
  referrals: ReferredMerchant[];
}

const TIER_DISPLAY: Record<string, { label: string; labelAr: string; rate: string; color: string }> = {
  bronze: { label: "Bronze", labelAr: "برونزي", rate: "5%", color: "bg-amber-700" },
  silver: { label: "Silver", labelAr: "فضي", rate: "6%", color: "bg-gray-400" },
  gold: { label: "Gold", labelAr: "ذهبي", rate: "7%", color: "bg-yellow-500" },
  diamond: { label: "Diamond", labelAr: "ألماسي", rate: "8%", color: "bg-blue-400" },
};

const Referrals = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isAr = language === "ar";

  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [data, setData] = useState<MyReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Both calls used to swallow their errors, so an API outage rendered a
    // complete-looking page of zeros. A merchant owed commission cannot tell
    // "you have earned nothing" from "we could not ask" — say which.
    Promise.allSettled([
      apiClient<{ referral_code: string; referral_link: string }>("/referrals/my-code"),
      apiClient<MyReferralsResponse>("/referrals/my-referrals"),
    ]).then(([codeRes, listRes]) => {
      if (cancelled) return;
      if (codeRes.status === "fulfilled") {
        setCode(codeRes.value.referral_code);
        setLink(codeRes.value.referral_link);
      }
      if (listRes.status === "fulfilled") setData(listRes.value);
      setFailed(codeRes.status === "rejected" || listRes.status === "rejected");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const copyCode = async () => {
    if (!code) return;
    try {
      // Rejects outside a secure context or when the permission is denied;
      // the toast used to fire regardless and tell the merchant their empty
      // clipboard held a code.
      await navigator.clipboard.writeText(code);
      toast({ description: isAr ? "تم نسخ الكود" : "Code copied!" });
    } catch {
      toast({
        variant: "destructive",
        description: isAr ? "تعذّر نسخ الكود" : "Couldn't copy the code",
      });
    }
  };

  const shareWhatsApp = () => {
    if (!code || !link) return;
    const text = isAr
      ? `افتح متجرك مجاناً على NUMU واستخدم كود الدعوة بتاعي: ${code}\n${link}`
      : `Open your free store on NUMU using my referral code: ${code}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const summary = data?.summary;
  // The API's enums are not uniformly lower-cased, so an uppercase "BRONZE"
  // would miss every key here and silently pin every merchant to Bronze —
  // including the ones actually earning 8%.
  const tier =
    TIER_DISPLAY[(summary?.tier || "bronze").toLowerCase()] || TIER_DISPLAY.bronze;

  // Commission is paid in the merchant's own currency; the tiles used to
  // divide by 100, drop the piasters with toFixed(0) and label it "ج.م"
  // regardless of what the store actually trades in.
  const money = (cents?: number) =>
    formatMoney(cents ?? 0, { fromCents: true, locale: isAr ? "ar" : "en" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAr ? "برنامج الإحالة" : "Referral Program"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAr ? "أحِل تجار واكسب عمولة على كل أوردر" : "Refer merchants and earn commission on every order"}
        </p>
      </div>

      {failed && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-2.5 py-4">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">
              {isAr
                ? "تعذّر تحميل بيانات الإحالة. الأرقام تحت ممكن تكون ناقصة — حدّث الصفحة."
                : "Couldn't load your referral data. The figures below may be incomplete — try refreshing."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Referral Code */}
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "كود الإحالة" : "Your Referral Code"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {/* dir=ltr: the code is a Latin token on an RTL page, and the
                bidi algorithm otherwise reorders its hyphen-separated parts. */}
            <code
              dir="ltr"
              className="flex-1 px-4 py-2.5 rounded-lg bg-muted text-sm font-mono tracking-wider text-start"
            >
              {loading ? "…" : code || "—"}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyCode}
              disabled={!code}
              aria-label={isAr ? "نسخ كود الإحالة" : "Copy referral code"}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={shareWhatsApp} disabled={!code || !link} className="w-full sm:w-auto gap-2" variant="outline">
            <Share2 className="h-4 w-4" />
            {isAr ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Wallet className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{money(summary?.total_earned_cents)}</p>
            <p className="text-xs text-muted-foreground">
              {isAr ? "إجمالي الأرباح" : "Total earned"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{money(summary?.confirmed_cents)}</p>
            <p className="text-xs text-muted-foreground">{isAr ? "مؤكد للسحب" : "Confirmed"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{money(summary?.pending_cents)}</p>
            <p className="text-xs text-muted-foreground">{isAr ? "في الانتظار" : "Pending"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">
              {(summary?.total_referrals || 0).toLocaleString(isAr ? "ar-EG" : "en-US")}
            </p>
            <p className="text-xs text-muted-foreground">{isAr ? "تجار محالين" : "Referrals"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{isAr ? "رتبتك" : "Your tier"}</p>
            <p className="text-xs text-muted-foreground">{isAr ? `عمولة ${tier.rate}` : `${tier.rate} commission rate`}</p>
          </div>
          <Badge className={`${tier.color} text-white`}>
            {isAr ? tier.labelAr : tier.label}
          </Badge>
        </CardContent>
      </Card>

      {/* Referral Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "التجار المحالين" : "Referred Merchants"}</CardTitle>
        </CardHeader>
        <CardContent>
          {(!data?.referrals || data.referrals.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              {isAr ? "مفيش إحالات لسه. شارك الكود بتاعك!" : "No referrals yet. Share your code!"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-start py-2">{isAr ? "المتجر" : "Store"}</th>
                    <th className="text-start py-2">{isAr ? "التاريخ" : "Date"}</th>
                    <th className="text-center py-2">{isAr ? "أوردرات" : "Orders"}</th>
                    <th className="text-end py-2">{isAr ? "عمولة" : "Commission"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r) => (
                    <tr key={r.subdomain} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{r.tenant_name}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {new Date(r.referral_date).toLocaleDateString(
                          isAr ? "ar-EG" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {r.orders.toLocaleString(isAr ? "ar-EG" : "en-US")}
                      </td>
                      <td className="py-2.5 text-end font-mono">
                        {formatMoney(r.commission_earned_cents, {
                          fromCents: true,
                          locale: isAr ? "ar" : "en",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Referrals;
