import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import {
  type AppReview,
  type SupportThread,
  type TicketStatus,
  closeAppTicket,
  deleteAppReview,
  getAppTicket,
  listAppReviews,
  listAppTickets,
  openAppTicket,
  replyAppTicket,
  reportAppReview,
  saveAppReview,
  supportForm,
} from "@/services/appsApi";

const MAX_FILES = 3;

function useDateTime() {
  const { language } = useLanguage();
  return (iso: string) =>
    new Date(iso).toLocaleString(language === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("appFeedback.ratingLabel", { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

export function RatingBadge({ rating, count }: { rating?: number | null; count?: number }) {
  const { t } = useTranslation();
  if (!count || rating == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <bdi dir="ltr" className="font-semibold text-foreground">{rating.toFixed(1)}</bdi>
      <span>({t("appFeedback.reviewsCount", { count })})</span>
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t("appFeedback.yourRating")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("appFeedback.ratingLabel", { n })}
          onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={`h-6 w-6 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"}`} />
        </button>
      ))}
    </div>
  );
}

export function ReviewItem({ review, actions }: { review: AppReview; actions?: ReactNode }) {
  const { t } = useTranslation();
  const date = useDateTime();
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm font-medium">{review.store_name ?? "—"}</span>
        {review.app_name && <Badge variant="outline"><bdi>{review.app_name}</bdi></Badge>}
        {review.is_hidden && <Badge variant="secondary">{t("appFeedback.hidden")}</Badge>}
        <span className="text-xs text-muted-foreground"><bdi dir="ltr">{date(review.created_at)}</bdi></span>
        <div className="ms-auto flex gap-2">{actions}</div>
      </div>
      {review.body && <p className="whitespace-pre-wrap text-sm">{review.body}</p>}
      {review.reply_body && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("appFeedback.developerReply")}</p>
          <p className="whitespace-pre-wrap">{review.reply_body}</p>
        </div>
      )}
    </div>
  );
}

export function AppReviews({ storeId, slug }: { storeId: string; slug: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const key = ["apps", "reviews", storeId, slug];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => listAppReviews(storeId, slug) });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const onError = (err: unknown) => showError(err, language);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["apps", "catalog"] });
  };
  const save = useMutation({
    mutationFn: () => saveAppReview(storeId, slug, { rating, body: body.trim() || null }),
    onSuccess: () => {
      toast.success(t("appFeedback.reviewSaved"));
      setEditing(false);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => deleteAppReview(storeId, slug),
    onSuccess: () => {
      toast.success(t("appFeedback.reviewDeleted"));
      setRating(0);
      setBody("");
      refresh();
    },
    onError,
  });
  const report = useMutation({
    mutationFn: (v: { id: string; reason: string }) => reportAppReview(storeId, slug, v.id, v.reason),
    onSuccess: () => toast.success(t("appFeedback.reported")),
    onError,
  });
  const mine = data?.mine;
  const showForm = data?.can_review && (!mine || editing);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">{t("appFeedback.reviews")}</h2>
          {data && data.summary.count > 0 && (
            <>
              <Stars value={data.summary.average ?? 0} />
              <RatingBadge rating={data.summary.average} count={data.summary.count} />
            </>
          )}
        </div>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

        {mine && !editing && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("appFeedback.yourReview")}</p>
            <ReviewItem
              review={mine}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRating(mine.rating);
                      setBody(mine.body ?? "");
                      setEditing(true);
                    }}
                  >
                    {t("appFeedback.editReview")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(t("appFeedback.deleteReviewConfirm")) && remove.mutate()}
                  >
                    {t("appFeedback.deleteReview")}
                  </Button>
                </>
              }
            />
            {mine.is_hidden && <p className="text-xs text-muted-foreground">{t("appFeedback.hiddenNotice")}</p>}
          </div>
        )}

        {showForm && (
          <form
            className="space-y-3 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <p className="text-sm font-semibold">{mine ? t("appFeedback.editReview") : t("appFeedback.writeReview")}</p>
            <StarInput value={rating} onChange={setRating} />
            <Textarea
              aria-label={t("appFeedback.reviewPlaceholder")}
              placeholder={t("appFeedback.reviewPlaceholder")}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!rating || save.isPending}>
                {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("appFeedback.submitReview")}
              </Button>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </form>
        )}
        {data && !data.can_review && <p className="text-xs text-muted-foreground">{t("appFeedback.reviewLocked")}</p>}

        {data && data.items.filter((r) => r.id !== mine?.id).length === 0 && !mine && (
          <p className="text-sm text-muted-foreground">{t("appFeedback.noReviews")}</p>
        )}
        <div className="space-y-3">
          {(data?.items ?? [])
            .filter((r) => r.id !== mine?.id)
            .map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      const reason = window.prompt(t("appFeedback.reportReason"))?.trim();
                      if (reason && reason.length >= 3) report.mutate({ id: r.id, reason });
                    }}
                  >
                    {t("appFeedback.report")}
                  </Button>
                }
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length > MAX_FILES) toast.error(t("appFeedback.tooManyFiles"));
          onChange(picked.slice(0, MAX_FILES));
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()}>
        <Paperclip className="me-1 h-4 w-4" />
        {t("appFeedback.attach")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {files.length ? files.map((f) => f.name).join(", ") : t("appFeedback.attachHint")}
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === "answered" ? "default" : status === "open" ? "secondary" : "outline"}>
      {t(`appFeedback.status_${status}`)}
    </Badge>
  );
}

/** One thread, for whichever side is reading it. */
export function TicketThread({
  thread,
  viewer,
  onReply,
  onClose,
  onBack,
}: {
  thread: SupportThread;
  viewer: "merchant" | "partner" | "staff";
  onReply: (form: FormData) => Promise<unknown>;
  onClose: () => Promise<unknown>;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const date = useDateTime();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const reply = useMutation({
    mutationFn: () => onReply(supportForm({ body: body.trim() }, files)),
    onSuccess: () => {
      toast.success(t("appFeedback.replySent"));
      setBody("");
      setFiles([]);
    },
    onError: (err) => showError(err, language),
  });
  const close = useMutation({
    mutationFn: onClose,
    onSuccess: () => toast.success(t("appFeedback.closed")),
    onError: (err) => showError(err, language),
  });
  const { ticket } = thread;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>{t("appFeedback.back")}</Button>
        <h3 className="font-semibold">{ticket.subject}</h3>
        <StatusBadge status={ticket.status} />
        <span className="text-xs text-muted-foreground">
          {[ticket.app_name, ticket.store_name, ticket.kind === "partner" ? ticket.partner_name : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {ticket.status !== "closed" && (
          <Button size="sm" variant="outline" className="ms-auto" disabled={close.isPending} onClick={() => close.mutate()}>
            {t("appFeedback.closeTicket")}
          </Button>
        )}
      </div>
      <ol className="space-y-3">
        {thread.messages.map((m) => (
          <li key={m.id} className={`rounded-lg border p-3 ${m.author_role === viewer ? "bg-muted/40" : ""}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {m.author_role === viewer ? t("appFeedback.you") : t(`appFeedback.role_${m.author_role}`)}
              </span>
              <bdi dir="ltr">{date(m.created_at)}</bdi>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            {m.attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <li key={a.url}>
                    <a className="inline-flex items-center gap-1 text-xs underline" href={a.url} target="_blank" rel="noreferrer noopener">
                      <Paperclip className="h-3 w-3" />
                      <bdi>{a.name}</bdi>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          reply.mutate();
        }}
      >
        <Label htmlFor={`reply-${ticket.id}`}>{t("appFeedback.message")}</Label>
        <Textarea id={`reply-${ticket.id}`} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <FilePicker files={files} onChange={setFiles} />
          <Button type="submit" size="sm" disabled={!body.trim() || reply.isPending}>
            {reply.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("appFeedback.send")}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Subject, message and attachments: a new ticket to whoever answers. */
export function NewTicketForm({ onSubmit, onCancel }: { onSubmit: (form: FormData) => Promise<unknown>; onCancel: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const send = useMutation({
    mutationFn: () => onSubmit(supportForm({ subject: subject.trim(), body: body.trim() }, files)),
    onSuccess: () => toast.success(t("appFeedback.ticketOpened")),
    onError: (err) => showError(err, language),
  });
  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ticket-subject">{t("appFeedback.subject")}</Label>
        <Input id="ticket-subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-body">{t("appFeedback.message")}</Label>
        <Textarea id="ticket-body" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <FilePicker files={files} onChange={setFiles} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={subject.trim().length < 3 || !body.trim() || send.isPending}>
          {send.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("appFeedback.send")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

export function TicketList({
  tickets,
  onOpen,
}: {
  tickets: SupportThread["ticket"][];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const date = useDateTime();
  if (!tickets.length) return <p className="text-sm text-muted-foreground">{t("appFeedback.noTickets")}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {tickets.map((tk) => (
        <li key={tk.id}>
          <button
            type="button"
            className="flex w-full flex-wrap items-center gap-2 p-3 text-start hover:bg-muted/40"
            onClick={() => onOpen(tk.id)}
          >
            <span className="min-w-0 flex-1 truncate font-medium">{tk.subject}</span>
            <span className="text-xs text-muted-foreground">
              {[tk.app_name, tk.store_name].filter(Boolean).join(" · ")}
            </span>
            <StatusBadge status={tk.status} />
            <bdi dir="ltr" className="text-xs text-muted-foreground">{date(tk.last_message_at ?? tk.created_at)}</bdi>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Contact developer" on a Partner App's page: this store's tickets for it. */
export function AppSupport({
  storeId,
  slug,
  initialTicketId,
}: {
  storeId: string;
  slug: string;
  initialTicketId?: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(initialTicketId ?? null);
  const [composing, setComposing] = useState(false);
  const listKey = ["apps", "support", storeId, slug];
  const { data } = useQuery({ queryKey: listKey, queryFn: () => listAppTickets(storeId) });
  const threadKey = ["apps", "support", storeId, "thread", openId];
  const { data: thread } = useQuery({
    queryKey: threadKey,
    queryFn: () => getAppTicket(storeId, openId!),
    enabled: Boolean(openId),
  });
  const settle = (next: SupportThread) => {
    queryClient.setQueryData(["apps", "support", storeId, "thread", next.ticket.id], next);
    void queryClient.invalidateQueries({ queryKey: listKey });
  };
  const tickets = (data?.items ?? []).filter((tk) => tk.app_slug === slug);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{t("appFeedback.supportTitle")}</h2>
          {!composing && !openId && (
            <Button size="sm" className="ms-auto" onClick={() => setComposing(true)}>
              {t("appFeedback.contactDeveloper")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("appFeedback.supportHint")}</p>
        {composing ? (
          <NewTicketForm
            onCancel={() => setComposing(false)}
            onSubmit={async (form) => {
              form.append("app_slug", slug);
              const next = await openAppTicket(storeId, form);
              settle(next);
              setComposing(false);
              setOpenId(next.ticket.id);
            }}
          />
        ) : openId && thread ? (
          <TicketThread
            thread={thread}
            viewer="merchant"
            onBack={() => setOpenId(null)}
            onReply={async (form) => settle(await replyAppTicket(storeId, openId, form))}
            onClose={async () => settle(await closeAppTicket(storeId, openId))}
          />
        ) : (
          <TicketList tickets={tickets} onOpen={setOpenId} />
        )}
      </CardContent>
    </Card>
  );
}
