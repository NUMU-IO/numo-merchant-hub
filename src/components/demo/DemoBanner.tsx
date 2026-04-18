import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Timer, ExternalLink, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DemoConvertModal from "./DemoConvertModal";

/**
 * Tiered urgency banner for demo tenants.
 *
 * - days > 3: low-key violet banner, "save your work" messaging.
 * - days 2-3: amber banner, stronger copy.
 * - days ≤ 1: red banner with alarm icon, "expires today" framing.
 *
 * Tiering is about loss aversion — by day 5/6 the user has built
 * something and the banner leans on "don't lose it" rather than features.
 */
const DemoBanner = () => {
  const { isDemoMode, tenant } = useAuth();
  const { language } = useLanguage();
  const [convertOpen, setConvertOpen] = useState(false);
  const isAr = language === "ar";

  if (!isDemoMode || !tenant) return null;

  const daysLeft = tenant.days_remaining ?? 0;
  const storefrontUrl = `https://${tenant.subdomain}.numu.io`;

  const urgency: "low" | "mid" | "high" =
    daysLeft <= 1 ? "high" : daysLeft <= 3 ? "mid" : "low";

  const tone = {
    low: {
      wrapper:
        "border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-950/40",
      icon: "text-violet-600 dark:text-violet-400",
      title: "text-violet-800 dark:text-violet-200",
      body: "text-violet-700/70 dark:text-violet-300/70",
      button: "bg-violet-600 hover:bg-violet-700 text-white",
      outline: "border-violet-300 dark:border-violet-600",
    },
    mid: {
      wrapper:
        "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-950/40",
      icon: "text-amber-600 dark:text-amber-400",
      title: "text-amber-900 dark:text-amber-200",
      body: "text-amber-800/80 dark:text-amber-300/80",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
      outline: "border-amber-400 dark:border-amber-600",
    },
    high: {
      wrapper:
        "border-red-300 bg-red-50/90 dark:border-red-500/40 dark:bg-red-950/40",
      icon: "text-red-600 dark:text-red-400",
      title: "text-red-900 dark:text-red-200",
      body: "text-red-800/80 dark:text-red-300/80",
      button: "bg-red-600 hover:bg-red-700 text-white",
      outline: "border-red-400 dark:border-red-600",
    },
  }[urgency];

  const title = (() => {
    if (urgency === "high") {
      return isAr
        ? daysLeft <= 0
          ? "عرضك التجريبي خلص — احفظ شغلك دلوقتي"
          : "آخر يوم في العرض التجريبي"
        : daysLeft <= 0
          ? "Your demo expired — save your work now"
          : "Last day of your demo";
    }
    if (urgency === "mid") {
      return isAr
        ? `باقي ${daysLeft} أيام — ابدأ التجربة عشان تحتفظ بكل اللي بنيته`
        : `${daysLeft} days left — start your trial to keep what you built`;
    }
    return isAr
      ? `وضع تجريبي — باقي ${daysLeft} يوم`
      : `Demo mode — ${daysLeft} days left`;
  })();

  const subtitle = (() => {
    if (urgency === "high") {
      return isAr
        ? "كل منتجاتك وإعداداتك هتتمسح لما العرض يخلص. ابدأ التجربة المجانية ٣٠ يوم مجاناً."
        : "All your products and settings will be wiped when the demo ends. Start a free 30-day trial now.";
    }
    if (urgency === "mid") {
      return isAr
        ? "٣٠ يوم مجاناً. مش محتاج بطاقة. شغلك يفضل زي ما هو."
        : "30 days free. No card required. Your work carries over.";
    }
    return isAr
      ? "احفظ شغلك عشان ما يتمسحش لما الفترة تخلص."
      : "Save your work so it's not lost when the demo expires.";
  })();

  const Icon = urgency === "high" ? AlertTriangle : Timer;

  return (
    <>
      <div
        className={`mb-5 rounded-xl border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${tone.wrapper}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${tone.icon}`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${tone.title}`}>{title}</p>
            <p className={`text-xs ${tone.body}`}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className={`text-xs gap-1.5 ${tone.outline}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? "شوف المتجر" : "View store"}
            </Button>
          </a>
          <Button
            size="sm"
            className={`text-xs gap-1.5 ${tone.button}`}
            onClick={() => setConvertOpen(true)}
          >
            <Save className="h-3.5 w-3.5" />
            {urgency === "high"
              ? isAr
                ? "احفظ شغلي دلوقتي"
                : "Save now"
              : isAr
                ? "احفظ شغلي"
                : "Save my work"}
          </Button>
        </div>
      </div>
      <DemoConvertModal open={convertOpen} onOpenChange={setConvertOpen} />
    </>
  );
};

export default DemoBanner;
