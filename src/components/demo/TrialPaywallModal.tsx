import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Rocket } from "lucide-react";

export type PaywallReason =
  | "connect_payment"
  | "publish_store"
  | "custom_domain"
  | "generic";

interface TrialPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: PaywallReason;
  onUpgrade: () => void;
}

const COPY: Record<
  PaywallReason,
  { ar: { title: string; body: string }; en: { title: string; body: string } }
> = {
  connect_payment: {
    ar: {
      title: "ابدأ تجربتك عشان تقبل مدفوعات حقيقية",
      body: "الوضع التجريبي للعرض فقط. ابدأ التجربة المجانية ٣٠ يوم عشان تربط فوري أو كاشير أو باي موب وتستقبل فلوسك.",
    },
    en: {
      title: "Start your trial to accept real payments",
      body: "Demo mode is exploration only. Start your 30-day free trial to connect Fawry, Kashier, or Paymob and take real money.",
    },
  },
  publish_store: {
    ar: {
      title: "ابدأ تجربتك عشان تنشر المتجر",
      body: "في الوضع التجريبي التغييرات بتتحفظ محلياً. ابدأ التجربة المجانية ٣٠ يوم عشان تنشر المتجر لعميلك.",
    },
    en: {
      title: "Start your trial to publish your store",
      body: "In demo mode, changes stay local. Start your 30-day free trial to publish your store to customers.",
    },
  },
  custom_domain: {
    ar: {
      title: "ابدأ تجربتك عشان تربط دومين خاص",
      body: "الدومين الخاص متاح على التجربة الكاملة. ابدأ ٣٠ يوم مجاناً.",
    },
    en: {
      title: "Start your trial to connect a custom domain",
      body: "Custom domains are a full-trial feature. Start 30 days free.",
    },
  },
  generic: {
    ar: {
      title: "ابدأ تجربتك عشان تفتح الميزة دي",
      body: "الميزة دي متاحة بعد ما تبدأ التجربة المجانية ٣٠ يوم. مش محتاج بطاقة.",
    },
    en: {
      title: "Start your trial to unlock this",
      body: "This feature is available once you start your free 30-day trial. No card required.",
    },
  },
};

const TrialPaywallModal: React.FC<TrialPaywallModalProps> = ({
  open,
  onOpenChange,
  reason,
  onUpgrade,
}) => {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const isAr = language === "ar";
  const copy = COPY[reason][isAr ? "ar" : "en"];
  const daysLeft = tenant?.days_remaining ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-500/10 mb-3 mx-auto">
            <Rocket className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
          <DialogDescription className="text-center">
            {copy.body}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              {isAr
                ? "٣٠ يوم مجاناً — مش محتاج بطاقة ائتمانية"
                : "30 days free — no credit card needed"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              {isAr
                ? "كل اللي عملته هيتحفظ — مش هتخسر شغلك"
                : "Everything you built is kept — no lost work"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              {isAr
                ? "قبول فوري لفوري وكاشير وباي موب"
                : "Instant Fawry, Kashier, Paymob access"}
            </span>
          </div>
        </div>

        {daysLeft > 0 && daysLeft <= 3 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {isAr
              ? `عرضك التجريبي هينتهي بعد ${daysLeft} يوم`
              : `Your demo expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
          </p>
        )}

        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isAr ? "مش دلوقتي" : "Not now"}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onUpgrade();
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isAr ? "ابدأ التجربة المجانية" : "Start free trial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrialPaywallModal;
