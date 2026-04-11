import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Timer, ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import DemoConvertModal from "./DemoConvertModal";

const DemoBanner = () => {
  const { isDemoMode, tenant } = useAuth();
  const { language } = useLanguage();
  const [convertOpen, setConvertOpen] = useState(false);
  const isAr = language === "ar";

  if (!isDemoMode || !tenant) return null;

  const daysLeft = tenant.days_remaining ?? 0;
  const storefrontUrl = `https://${tenant.subdomain}.numu.io`;

  return (
    <>
      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-950/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Timer className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
              {isAr
                ? `وضع تجريبي — باقي ${daysLeft} يوم`
                : `Demo mode — ${daysLeft} days left`}
            </p>
            <p className="text-xs text-violet-700/70 dark:text-violet-300/70">
              {isAr
                ? "احفظ شغلك عشان ما يتمسحش لما الفترة تخلص."
                : "Save your work so it's not lost when the demo expires."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-violet-300 dark:border-violet-600">
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? "شوف المتجر" : "View store"}
            </Button>
          </a>
          <Button
            size="sm"
            className="text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => setConvertOpen(true)}
          >
            <Save className="h-3.5 w-3.5" />
            {isAr ? "احفظ شغلي" : "Save my work"}
          </Button>
        </div>
      </div>
      <DemoConvertModal open={convertOpen} onOpenChange={setConvertOpen} />
    </>
  );
};

export default DemoBanner;
