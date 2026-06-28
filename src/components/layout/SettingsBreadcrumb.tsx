import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SettingsBreadcrumbProps {
  /** Current page label, e.g. "Store profile" / "إعدادات المتجر". */
  current: string;
  /** Optional middle crumb (for 3-level deep pages: e.g. Settings › Channels › WhatsApp). */
  parent?: { label: string; to: string };
  className?: string;
}

/* Sticky breadcrumb for any settings sub-page so merchants always
   have a one-click escape back to the Settings hub. Reads RTL/LTR
   from LanguageContext and flips the chevron automatically. Place
   it as the first child of the page wrapper. */
export function SettingsBreadcrumb({ current, parent, className }: SettingsBreadcrumbProps) {
  const { isRTL, language } = useLanguage();
  const settingsLabel = language === "ar" ? "الإعدادات" : "Settings";

  return (
    <nav
      aria-label={language === "ar" ? "مسار التنقل" : "Breadcrumb"}
      className={`flex items-center gap-2 text-[13px] font-semibold mb-5 ${className ?? ""}`}
    >
      <Link
        to="/settings"
        className="text-ink-soft hover:text-navy transition-colors"
      >
        {settingsLabel}
      </Link>
      <ChevronRight className={`h-3.5 w-3.5 text-ink-faint shrink-0 ${isRTL ? "rotate-180" : ""}`} />
      {parent && (
        <>
          <Link
            to={parent.to}
            className="text-ink-soft hover:text-navy transition-colors truncate"
          >
            {parent.label}
          </Link>
          <ChevronRight className={`h-3.5 w-3.5 text-ink-faint shrink-0 ${isRTL ? "rotate-180" : ""}`} />
        </>
      )}
      <span className="text-foreground truncate" aria-current="page">{current}</span>
    </nav>
  );
}
