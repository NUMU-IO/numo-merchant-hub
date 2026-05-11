import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Lock } from "lucide-react";

interface DemoLockOverlayProps {
  /** The reason shown to the user — e.g. "Payment credentials" */
  feature?: string;
  children: React.ReactNode;
}

/**
 * Wraps a form/section that should be disabled in demo mode.
 * In demo mode: renders a semi-transparent overlay with a lock icon.
 * In real mode: renders children normally with no wrapper overhead.
 */
const DemoLockOverlay: React.FC<DemoLockOverlayProps> = ({ feature, children }) => {
  const { isDemoMode } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (!isDemoMode) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {isAr ? "مش متاح في الوضع التجريبي" : "Disabled in demo mode"}
          </p>
          {feature && (
            <p className="text-xs text-muted-foreground/60">
              {isAr ? `${feature} — احفظ شغلك الأول` : `${feature} — save your work first`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoLockOverlay;
