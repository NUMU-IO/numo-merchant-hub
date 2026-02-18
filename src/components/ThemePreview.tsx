/**
 * ThemePreview — embeds the storefront in an iframe and sends
 * live theme updates via postMessage.
 */

import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone } from "lucide-react";

const STOREFRONT_BASE =
  import.meta.env.VITE_STOREFRONT_URL || "http://localhost:8081";

interface ThemePreviewProps {
  storeSubdomain?: string;
  settings: Record<string, any>;
}

const VIEWPORTS = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  mobile: { width: "375px", icon: Smartphone, label: "Mobile" },
} as const;

type Viewport = keyof typeof VIEWPORTS;

export function ThemePreview({ storeSubdomain, settings }: ThemePreviewProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [loaded, setLoaded] = useState(false);

  const storefrontOrigin = storeSubdomain
    ? `${new URL(STOREFRONT_BASE).protocol}//${storeSubdomain}.${new URL(STOREFRONT_BASE).host}`
    : STOREFRONT_BASE;
  const storefrontUrl = `${storefrontOrigin}?preview=true`;

  // Send settings to iframe whenever they change (scoped to storefront origin)
  useEffect(() => {
    if (!loaded || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "NUMU_THEME_UPDATE", settings },
      storefrontOrigin
    );
  }, [settings, loaded, storefrontOrigin]);

  const vp = VIEWPORTS[viewport];

  return (
    <div className="flex flex-col h-full">
      {/* Viewport toggles */}
      <div className="flex items-center justify-center gap-1 py-2 border-b">
        {(Object.entries(VIEWPORTS) as [Viewport, (typeof VIEWPORTS)[Viewport]][]).map(
          ([key, { icon: Icon, label }]) => (
            <Button
              key={key}
              variant={viewport === key ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewport(key)}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        )}
      </div>

      {/* Iframe container */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-muted/30 p-4">
        <div
          className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
          style={{
            width: vp.width,
            maxWidth: "100%",
            height: viewport === "desktop" ? "100%" : "85vh",
          }}
        >
          <iframe
            ref={iframeRef}
            src={storefrontUrl}
            className="w-full h-full border-0"
            onLoad={() => setLoaded(true)}
            title={t("store.preview")}
          />
        </div>
      </div>
    </div>
  );
}
