import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { handleAppMessage } from "@/lib/appBridge";
import { type AppSession, getAppSession } from "@/services/appsApi";

export default function EmbeddedApp() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const storeId = useDashboardStore().currentStore?.id;
  const frame = useRef<HTMLIFrameElement>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const Back = language === "ar" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!storeId) return;
    let live = true;
    setSession(null);
    setFailed(false);
    // Right after an install the app's server is still exchanging its code,
    // and until it does NUMU answers 404; a few short retries cover that.
    const attempt = (left: number) =>
      getAppSession(storeId, slug, language).then(
        (s) => {
          if (live) setSession(s);
        },
        () => {
          if (!live) return;
          if (left > 0) setTimeout(() => live && attempt(left - 1), 1500);
          else setFailed(true);
        },
      );
    attempt(3);
    return () => {
      live = false;
    };
  }, [storeId, slug, language]);

  useEffect(() => {
    if (!session || !storeId) return;
    const onMessage = (event: MessageEvent) =>
      void handleAppMessage(event, {
        origin: session.origin,
        source: frame.current?.contentWindow ?? null,
        sessionToken: async () => (await getAppSession(storeId, slug, language)).token,
        navigate: (path) => navigate(path),
        toast: (message, kind) => (kind === "error" ? toast.error(message) : toast.success(message)),
        resize: setHeight,
      });
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session, storeId, slug, language, navigate]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <Button variant="ghost" size="sm" className="-ms-2 self-start" onClick={() => navigate(`/apps/${slug}`)}>
        <Back className="me-2 h-4 w-4" />
        {t("apps.title")}
      </Button>
      {failed ? (
        <p className="text-sm text-muted-foreground">{t("apps.embeddedUnavailable")}</p>
      ) : !session ? (
        <Skeleton className="h-[70vh] w-full" />
      ) : (
        <iframe
          ref={frame}
          src={session.url}
          title={slug}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          className="w-full rounded-lg border bg-background"
          style={{ height: height ?? "calc(100vh - 9rem)" }}
        />
      )}
    </div>
  );
}
