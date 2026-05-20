/**
 * AppEmbedsPanel — placeholder for the App embeds mode.
 *
 * Shopify-parity: this is the panel a merchant sees when they switch
 * from Sections to App embeds mode. Final shape (when the NUMU app
 * extension runtime ships):
 *   - List installed apps that ship storefront extensions.
 *   - Each app surfaces zero or more global "embeds" — analytics
 *     beacons, chat widgets, support floaters, etc. — togglable here.
 *
 * Until that runtime exists, this is an empty state with a "Coming
 * soon" notice + a link to the marketplace. We deliberately ship the
 * panel mount NOW (instead of disabling the mode-switcher tab) so the
 * UX shape is locked and merchants discover the seam early. The
 * `theme_engine.app_embeds_enabled` feature flag can hide the whole
 * mode if it confuses people in user testing — but the most likely
 * outcome is they understand "Coming soon" and move on.
 */

import { ArrowLeft, Puzzle, ExternalLink } from "lucide-react";

import { useCustomizerStore } from "../../store/customizerStore";
import { Button } from "@/components/ui/button";

export function AppEmbedsPanel() {
  const locale = useCustomizerStore((s) => s.locale);
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);
  const isAr = locale === "ar";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setActiveMode("sections")}
          aria-label={isAr ? "العودة إلى الأقسام" : "Back to sections"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Puzzle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold truncate">
          {isAr ? "تكاملات التطبيقات" : "App embeds"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Puzzle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">
            {isAr ? "قريباً" : "Coming soon"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {isAr
              ? "ستظهر هنا تكاملات التطبيقات التي تثبتها على متجرك (مثل أزرار المحادثة، أنظمة التحليلات، أدوات التسويق). نعمل على إطلاق هذه الميزة."
              : "Apps you install will surface their global storefront extensions (chat widgets, analytics beacons, marketing tools) here. We're rolling this out next."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => window.open("/apps", "_self")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {isAr ? "تصفح التطبيقات" : "Browse apps"}
          </Button>
        </div>

        <div className="mt-4 text-[11px] text-muted-foreground/70 text-center">
          {isAr
            ? "هل تريد إضافة عنصر مرئي للمتجر؟ استخدم وضع «الأقسام» لإضافة قسم أو عنصر مخصص."
            : "Need to add a visible storefront element today? Use Sections mode to add a section or custom block."}
        </div>
      </div>
    </div>
  );
}

export default AppEmbedsPanel;
