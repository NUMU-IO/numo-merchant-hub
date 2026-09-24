import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAppReviews } from "@/services/partnersApi";

export function AppReviewTimeline({ appId }: { appId: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const reviews = useQuery({ queryKey: ["partners", "apps", appId, "reviews"], queryFn: () => getAppReviews(appId) });
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const r = reviews.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("partnerReview.title")}</CardTitle>
        {r && <CardDescription>{t("partnerReview.sla", { days: r.sla_business_days })}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!r ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {r.open && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="font-medium">
                  {t("partnerReview.position", { position: r.open.position, total: r.open.queue_length })}
                </p>
                <p className="text-muted-foreground">{t("partnerReview.expectedBy", { date: date(r.open.expected_by) })}</p>
              </div>
            )}
            {r.rounds.length === 0 && <p className="text-sm text-muted-foreground">{t("partnerReview.none")}</p>}
            <ol className="space-y-3 border-s ps-4">
              {r.rounds.map((round) => (
                <li key={round.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{t("partnerReview.round", { n: round.round })}</span>
                    <span className="text-muted-foreground">
                      {t(`partnerReview.subject_${round.subject}`)}
                      {round.version && (
                        <>
                          {" "}
                          <bdi dir="ltr">v{round.version}</bdi>
                        </>
                      )}
                    </span>
                    <Badge variant={round.status === "approved" ? "default" : "secondary"}>
                      {t(`partnerApps.st_${round.status}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("partnerReview.submittedOn", { date: date(round.submitted_at) })}
                    {round.decided_at && ` · ${t("partnerReview.decidedOn", { date: date(round.decided_at) })}`}
                  </p>
                  {round.notes && (
                    <div className="rounded-md border border-dashed p-2 text-sm">
                      <div className="text-xs font-medium text-muted-foreground">{t("partnerApps.reviewNotes")}</div>
                      <p className="whitespace-pre-line">{round.notes[language as "ar" | "en"] ?? round.notes.en}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}
