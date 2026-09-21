/**
 * The Partner App consent screen (apps plan, Phase 4): full page, RTL-first.
 *
 * Opened with `client_id, store_id, scope, redirect_uri, state`. It shows the
 * app, its partner, and every permission as a plain Egyptian-Arabic sentence
 * (a re-consent highlights only what is new). Approve sends the merchant on
 * to the app with a signed single-use code; cancel returns them to the app
 * with `error=access_denied`, as OAuth expects.
 */

import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { scopeSentence } from "@/lib/appScopes";
import { approveConsent, getConsent } from "@/services/appsApi";

export default function OAuthAuthorize() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const consent = useQuery({
    queryKey: ["oauth-consent", search],
    queryFn: () => getConsent(query.toString()),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const c = consent.data;
  const lang = language === "en" ? "en" : "ar";

  const approve = async () => {
    if (!c) return;
    setBusy(true);
    try {
      const { redirect_url } = await approveConsent({
        client_id: query.get("client_id") ?? "",
        store_id: c.store_id,
        scope: c.scopes.join(" "),
        redirect_uri: c.redirect_uri,
        state: c.state,
      });
      window.location.assign(redirect_url);
    } catch (err) {
      showError(err, language);
      setBusy(false);
    }
  };

  const cancel = () => {
    const redirect = query.get("redirect_uri");
    if (!c || !redirect) return window.history.back();
    const params = new URLSearchParams({ error: "access_denied", state: c.state });
    window.location.assign(`${redirect}?${params.toString()}`);
  };

  const fresh = c ? c.scopes.filter((s) => !c.granted_scopes.includes(s)) : [];
  const isReconsent = !!c && c.granted_scopes.length > 0;
  const shown = isReconsent ? fresh : (c?.scopes ?? []);
  const price = c?.app.pricing?.locales?.[lang]?.label ?? c?.app.pricing?.locales?.en?.label;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          {consent.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
          {consent.isError && (
            <p className="text-center text-sm text-destructive">{t("consent.loadFailed")}</p>
          )}
          {c && (
            <>
              <div className="flex items-center gap-3">
                {c.app.icon ? (
                  <img src={c.app.icon} alt="" className="h-14 w-14 rounded-xl" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-muted" />
                )}
                <div className="min-w-0">
                  <h1 className="text-lg font-bold leading-tight">
                    {t("consent.title", { name: c.app.name[lang] ?? c.app.name.en })}
                  </h1>
                  {c.app.partner && (
                    <p className="text-xs text-muted-foreground">
                      {t("consent.by", { partner: c.app.partner })}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("consent.store", { store: c.store_name })}
              </p>

              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {isReconsent ? t("consent.newScopes") : t("consent.wants")}
                </p>
                <ul className="space-y-1.5">
                  {shown.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{scopeSentence(t, s)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {price && (
                <p className="text-sm">
                  <span className="font-semibold">{t("consent.price")}: </span>
                  {price}
                </p>
              )}
              <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("consent.notice")}</span>
              </p>
              {c.app.privacy_policy_url && (
                <a
                  href={c.app.privacy_policy_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs underline underline-offset-2"
                >
                  {t("consent.privacy")}
                </a>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={approve}>
                  {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("consent.approve")}
                </Button>
                <Button variant="outline" disabled={busy} onClick={cancel}>
                  {t("consent.cancel")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
