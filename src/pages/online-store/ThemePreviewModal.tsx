/**
 * Fullscreen live theme preview.
 *
 * Embeds the theme's hosted demo storefront in an iframe. Mobile/desktop
 * viewport toggles let the merchant see what each breakpoint looks like
 * before activating.
 *
 * Graceful fallback: if ``demo_url`` isn't populated yet (the demo store
 * for this theme hasn't been deployed), we show the static screenshot
 * with a "Live preview coming soon" message instead of a broken iframe.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AvailableTheme } from "@/services/themeApi";
import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  theme: AvailableTheme | null;
  isOpen: boolean;
  onClose: () => void;
  isRTL: boolean;
}

type Viewport = "desktop" | "mobile";

export function ThemePreviewModal({ theme, isOpen, onClose, isRTL }: Props) {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  // Reset to desktop each time a new theme opens — we don't want the
  // previous theme's mobile-toggle state leaking into the next preview.
  useEffect(() => {
    if (isOpen) setViewport("desktop");
  }, [isOpen, theme?.id]);

  if (!theme) return null;

  const hasDemo = !!theme.demo_url;
  const title = isRTL ? theme.nameAr : theme.name;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between gap-4 space-y-0">
          <DialogTitle className="text-base font-semibold truncate">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-1 bg-muted rounded-md p-1">
            <Button
              type="button"
              variant={viewport === "desktop" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewport("desktop")}
              className="gap-1.5 h-7"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-xs">
                {isRTL ? "سطح المكتب" : "Desktop"}
              </span>
            </Button>
            <Button
              type="button"
              variant={viewport === "mobile" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewport("mobile")}
              className="gap-1.5 h-7"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-xs">
                {isRTL ? "هاتف" : "Mobile"}
              </span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/40 overflow-auto flex items-start justify-center p-4 sm:p-6">
          <div
            className="w-full bg-background shadow-lg rounded-md overflow-hidden transition-all"
            style={{
              maxWidth: viewport === "mobile" ? "414px" : "100%",
              height: "100%",
            }}
          >
            {hasDemo ? (
              <iframe
                key={`${theme.id}-${viewport}`}
                src={theme.demo_url ?? undefined}
                title={`${title} preview`}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
                loading="lazy"
              />
            ) : (
              <ComingSoonFallback theme={theme} isRTL={isRTL} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComingSoonFallback({
  theme,
  isRTL,
}: {
  theme: AvailableTheme;
  isRTL: boolean;
}) {
  return (
    <div className="relative w-full h-full">
      {theme.preview_image_url ? (
        <img
          src={theme.preview_image_url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-foreground/40" />
      <div className="relative w-full h-full flex items-center justify-center p-6">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-xl px-6 py-5 max-w-md text-center">
          <p className="text-sm font-semibold mb-1">
            {isRTL ? "المعاينة المباشرة قريبًا" : "Live preview coming soon"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isRTL
              ? "متجر العرض التوضيحي لهذا الثيم لم يُنشر بعد. جرّب الثيم بتفعيله ثم استعراض متجرك."
              : "The demo store for this theme isn't live yet. Activate the theme to see it on your own store."}
          </p>
        </div>
      </div>
    </div>
  );
}
