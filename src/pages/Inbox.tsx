import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listThreads,
  getThread,
  listMessages,
  sendMessage,
  markThreadRead,
  resolveThread,
  type ThreadDTO,
  type MessageDTO,
} from "@/services/inboxApi";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { createInboxSocket, type InboxSocket } from "@/services/inboxSocket";
import { format, formatDistanceToNow, isSameDay, isToday, isYesterday } from "date-fns";
import { ar } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Search,
  Send,
  Image,
  FileText,
  Paperclip,
  Check,
  CheckCheck,
  ChevronRight,
  X,
  Loader2,
  FileImage,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const channelIcons = {
  facebook: Facebook,
  instagram: Instagram,
  whatsapp: MessageCircle,
};

const channelColors = {
  facebook: "bg-[#1877F2]",
  instagram: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
  whatsapp: "bg-[#25D366]",
};

// Deterministic avatar tint per participant so a nameless thread still
// reads as a distinct person rather than an anonymous grey circle.
const avatarTints = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarTints[Math.abs(hash) % avatarTints.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ThreadListItemProps {
  thread: ThreadDTO;
  isActive: boolean;
  onClick: () => void;
  language: "ar" | "en";
}

const ParticipantAvatar = ({
  name,
  avatarUrl,
  seed,
  channel,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  seed: string;
  channel?: ThreadDTO["channel"];
  size?: "md" | "lg";
}) => {
  const Icon = channel ? channelIcons[channel] : null;
  const box = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const badge = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const glyph = size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <div className="relative shrink-0">
      <Avatar className={box}>
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className={`${tintFor(seed)} text-xs font-semibold`}>
          {initialsFor(name)}
        </AvatarFallback>
      </Avatar>
      {Icon && (
        <span
          className={`absolute -bottom-0.5 -end-0.5 ${badge} rounded-full grid place-items-center ring-2 ring-background ${channelColors[channel!]}`}
        >
          <Icon className={`${glyph} text-white`} />
        </span>
      )}
    </div>
  );
};

const ThreadListItem = ({ thread, isActive, onClick, language }: ThreadListItemProps) => {
  const locale = language === "ar" ? ar : enUS;
  const unread = thread.unread_count > 0;

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={`relative w-full px-3 py-3 flex items-start gap-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
        isActive ? "bg-muted/70" : "hover:bg-muted/40"
      }`}
    >
      {isActive && (
        <span className="absolute inset-y-0 start-0 w-0.5 bg-primary" aria-hidden />
      )}
      <ParticipantAvatar
        name={thread.participant.name}
        avatarUrl={thread.participant.avatar_url}
        seed={thread.participant.id || thread.id}
        channel={thread.channel}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}
          >
            {thread.participant.name}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
            {formatDistanceToNow(new Date(thread.last_message_at), {
              addSuffix: true,
              locale,
            })}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p
            className={`text-xs truncate flex-1 ${
              unread ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {thread.last_message_preview}
          </p>
          {unread && (
            <Badge
              variant="default"
              className="h-4 min-w-4 px-1 text-[10px] leading-none shrink-0"
            >
              {thread.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
};

interface MessageBubbleProps {
  message: MessageDTO;
  isRTL: boolean;
}

const MessageBubble = ({ message, isRTL }: MessageBubbleProps) => {
  const { t } = useTranslation();
  const [previewFailed, setPreviewFailed] = useState(false);
  const isInbound = message.direction === "inbound";
  const statusIcon = !isInbound ? (
    message.status === "sent" ? (
      <Check className="h-3 w-3 opacity-70" />
    ) : message.status === "delivered" ? (
      <CheckCheck className="h-3 w-3 opacity-70" />
    ) : message.status === "read" ? (
      <CheckCheck className="h-3 w-3 text-blue-500" />
    ) : message.status === "failed" ? (
      <X className="h-3 w-3 text-red-500" />
    ) : null
  ) : null;

  const locale = isRTL ? ar : enUS;

  const isPending = message.id.startsWith("temp-");

  return (
    <div
      className={`flex ${isInbound ? "justify-start" : "justify-end"} ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <div
        className={`max-w-[68%] px-3.5 py-2 shadow-sm ${
          isInbound
            ? "bg-muted text-foreground rounded-2xl rounded-ss-sm"
            : "bg-primary text-primary-foreground rounded-2xl rounded-se-sm"
        }`}
      >
        {message.attachment_url ? (
          // Shared posts and reels arrive typed as documents even though
          // the asset itself is an image, so try to preview anything with
          // a URL and fall back to a link when the browser can't load it
          // (video, audio, files, or an expired Meta CDN signature).
          previewFailed ? (
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm underline underline-offset-2 mb-1"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              {t("omnichannel.open_attachment")}
            </a>
          ) : (
            <a href={message.attachment_url} target="_blank" rel="noreferrer">
              <img
                src={message.attachment_url}
                alt=""
                loading="lazy"
                onError={() => setPreviewFailed(true)}
                className="max-h-64 max-w-full rounded-lg mb-1 object-cover"
              />
            </a>
          )
        ) : null}
        {message.body && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        )}
        {!message.body && !message.attachment_url && (
          <p className="text-sm italic opacity-70">
            {t("omnichannel.unsupported_message")}
          </p>
        )}
        {message.type === "template" && message.template_name && (
          <p className="text-sm italic">{message.template_name}</p>
        )}
        <div className="flex items-center gap-1 mt-1 justify-end">
          <span className="text-[10px] opacity-70 tabular-nums">
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
              locale,
            })}
          </span>
          {statusIcon}
        </div>
      </div>
    </div>
  );
};

export const Inbox = () => {
  const { t } = useTranslation();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const language = isRTL ? "ar" : "en";
  const queryClient = useQueryClient();

  const storeId = currentStore?.id;
  const wsUrl = import.meta.env.VITE_WS_URL || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [socket, setSocket] = useState<InboxSocket | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threadsQuery = useQuery({
    queryKey: ["inbox", "threads", storeId, { channel: selectedChannel || undefined, status: selectedStatus || undefined, search: searchQuery || undefined }],
    queryFn: () =>
      listThreads(storeId!, {
        channel: selectedChannel || undefined,
        status: selectedStatus || undefined,
        search: searchQuery || undefined,
      }),
    enabled: !!storeId,
  });

  // The open thread may not be in the current list (a channel filter or
  // search can exclude it), so fall back to fetching it directly —
  // otherwise the panel renders a nameless conversation.
  const threadInList = threadsQuery.data?.threads.find((t) => t.id === threadId);
  const threadQuery = useQuery({
    queryKey: ["inbox", "thread", storeId, threadId],
    queryFn: () => getThread(storeId!, threadId!),
    enabled: !!storeId && !!threadId && !threadInList,
  });
  const currentThread = threadInList ?? threadQuery.data;

  const isWAWindowClosed = currentThread?.channel === "whatsapp" && currentThread?.last_message_at
    ? Date.now() - new Date(currentThread.last_message_at).getTime() > 24 * 60 * 60 * 1000
    : false;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["inbox", "messages", storeId, threadId],
    queryFn: ({ pageParam }) => listMessages(storeId!, threadId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    enabled: !!storeId && !!threadId,
    initialPageParam: undefined as string | undefined,
  });

  const { data: approvedTemplates = [] } = useQuery({
    queryKey: ["whatsapp-templates", storeId, "approved"],
    queryFn: () => listTemplates(storeId!),
    enabled: !!storeId && showTemplatePicker,
  });

  const markReadMutation = useMutation({
    mutationFn: () => markThreadRead(storeId!, threadId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "threads", storeId] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { type: string; text?: string; template_id?: string }) =>
      sendMessage(storeId!, threadId!, payload),
    // Optimistic: the composer clears and the bubble appears instantly;
    // the server copy replaces it when the roundtrip (our API + Meta's
    // send API) finishes. On failure the bubble is removed and the text
    // restored.
    onMutate: async (payload) => {
      const queryKey = ["inbox", "messages", storeId, threadId];
      const text = payload.text ?? "";
      setMessageText("");
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const tempId = `temp-${Date.now()}`;
      const optimistic: MessageDTO = {
        id: tempId,
        thread_id: threadId!,
        direction: "outbound",
        type: payload.type === "template" ? "template" : "text",
        body: text || null,
        attachment_url: null,
        attachment_mime: null,
        template_name: null,
        product_id: null,
        status: "sent",
        error_code: null,
        created_at: new Date().toISOString(),
        external_timestamp: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!old) return old;
        const oldData = old as { pages: { messages: MessageDTO[] }[] };
        return {
          ...oldData,
          pages: oldData.pages.map((page, idx) =>
            idx === 0
              ? { ...page, messages: [optimistic, ...page.messages] }
              : page
          ),
        };
      });
      return { previous, tempId, text };
    },
    onError: (_err, _payload, ctx) => {
      const queryKey = ["inbox", "messages", storeId, threadId];
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
      if (ctx?.text) setMessageText(ctx.text);
      toast.error(t("omnichannel.send_failed"));
    },
    onSuccess: (newMessage, _payload, ctx) => {
      queryClient.setQueryData(
        ["inbox", "messages", storeId, threadId],
        (old: unknown) => {
          if (!old) return old;
          const oldData = old as { pages: { messages: MessageDTO[] }[] };
          return {
            ...oldData,
            pages: oldData.pages.map((page, idx) =>
              idx === 0
                ? {
                    ...page,
                    messages: page.messages.map((m) =>
                      m.id === ctx?.tempId ? newMessage : m
                    ),
                  }
                : page
            ),
          };
        }
      );
    },
  });

  useEffect(() => {
    if (!storeId || !wsUrl) return;

    const inboxSocket = createInboxSocket();
    inboxSocket.connect({ storeId, wsUrl });

    const unsubMessage = inboxSocket.on("message.created", (event: unknown) => {
      const data = event as { thread_id: string; message: MessageDTO };
      if (data.thread_id === threadId) {
        queryClient.setQueryData(
          ["inbox", "messages", storeId, threadId],
          (old: unknown) => {
            const oldData = old as { pages: { messages: MessageDTO[] }[] };
            if (!oldData) return old;
            return {
              ...oldData,
              pages: oldData.pages.map((page, idx) =>
                idx === 0
                  ? { ...page, messages: [data.message, ...page.messages] }
                  : page
              ),
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["inbox", "threads", storeId] });
    });

    const unsubStatus = inboxSocket.on("message.status", (event: unknown) => {
      const data = event as { thread_id: string; message_id: string; status: string };
      if (data.thread_id === threadId) {
        queryClient.setQueryData(
          ["inbox", "messages", storeId, threadId],
          (old: unknown) => {
            const oldData = old as { pages: { messages: MessageDTO[] }[] };
            if (!oldData) return old;
            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                messages: page.messages.map((msg) =>
                  msg.id === data.message_id
                    ? { ...msg, status: data.status as MessageDTO["status"] }
                    : msg
                ),
              })),
            };
          }
        );
      }
    });

    const unsubThread = inboxSocket.on("thread.updated", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "threads", storeId] });
    });

    setSocket(inboxSocket);

    return () => {
      unsubMessage();
      unsubStatus();
      unsubThread();
      inboxSocket.disconnect();
    };
  }, [storeId, wsUrl, threadId, queryClient]);

  useEffect(() => {
    if (threadId && currentThread?.unread_count && currentThread.unread_count > 0) {
      markReadMutation.mutate();
    }
  }, [threadId, currentThread?.unread_count]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.pages]);

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate({ type: "text", text: messageText });
  };

  const handleTemplateSelect = (template: WhatsAppTemplate) => {
    sendMutation.mutate({ type: "template", template_id: template.id });
    setShowTemplatePicker(false);
  };

  const handleAttachImage = () => {
    toast.info(t("omnichannel.attachments_soon"));
  };

  const handleAttachDocument = () => {
    toast.info(t("omnichannel.attachments_soon"));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!storeId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("omnichannel.inbox")}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  const allMessages = messagesQuery.data?.pages
    .flatMap((page) => page.messages)
    .reverse() || [];

  const dayLabel = (date: Date) => {
    if (isToday(date)) return t("omnichannel.day_today");
    if (isYesterday(date)) return t("omnichannel.day_yesterday");
    return format(date, "d MMM yyyy", { locale: isRTL ? ar : enUS });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Thread List — on mobile this is the whole screen until a thread
          is opened, then the detail pane takes over. */}
      <div
        className={`w-full md:w-[360px] lg:w-[380px] border-e flex-col bg-background ${
          threadId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b space-y-3">
          <h2 className="text-lg font-semibold">{t("omnichannel.inbox")}</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("omnichannel.search_conversations")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div
            className="flex items-center gap-1 rounded-lg bg-muted/60 p-1"
            role="tablist"
            aria-label={t("omnichannel.context_channel")}
          >
            {([
              { key: null, label: t("omnichannel.filter_all"), Icon: null },
              { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
              { key: "facebook", label: "Facebook", Icon: Facebook },
              { key: "instagram", label: "Instagram", Icon: Instagram },
            ] as const).map(({ key, label, Icon }) => {
              const active = selectedChannel === key;
              return (
                <button
                  key={label}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedChannel(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span className={Icon ? "hidden sm:inline" : ""}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threadsQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : threadsQuery.data?.threads.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <div className="mx-auto h-11 w-11 rounded-full bg-muted grid place-items-center">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">
                {t("omnichannel.no_threads_yet")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {threadsQuery.data?.threads.map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === threadId}
                  onClick={() => navigate(`/inbox/${thread.id}`)}
                  language={language}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Thread Detail */}
      <div
        className={`flex-1 flex-col min-w-0 ${threadId ? "flex" : "hidden md:flex"}`}
      >
        {!threadId ? (
          <div className="flex-1 grid place-items-center bg-muted/20">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-background border grid place-items-center">
                <MessageCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t("omnichannel.select_thread")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ms-2 shrink-0"
                  aria-label={t("omnichannel.back_to_list")}
                  onClick={() => navigate("/inbox")}
                >
                  <ChevronRight className={isRTL ? "h-5 w-5" : "h-5 w-5 rotate-180"} />
                </Button>
                <ParticipantAvatar
                  name={currentThread?.participant.name || "—"}
                  avatarUrl={currentThread?.participant.avatar_url}
                  seed={currentThread?.participant.id || threadId}
                  channel={currentThread?.channel}
                />
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {currentThread?.participant.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentThread
                      ? t(`omnichannel.channel_${currentThread.channel}`)
                      : ""}
                    {currentThread?.participant.phone_e164
                      ? ` · ${currentThread.participant.phone_e164}`
                      : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (threadId) {
                    resolveThread(storeId, threadId).then(() => {
                      navigate("/inbox");
                    });
                  }
                }}
              >
                {t("omnichannel.resolve")}
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesQuery.isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton
                      key={i}
                      className={`h-16 ${i % 2 === 0 ? "w-48 ml-auto" : "w-48"}`}
                    />
                  ))}
                </div>
              ) : allMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p>{t("omnichannel.no_messages_yet")}</p>
                </div>
              ) : (
                <div className="space-y-2 pb-2">
                  {allMessages.map((message, idx) => {
                    const sentAt = new Date(message.created_at);
                    const prev = idx > 0 ? allMessages[idx - 1] : null;
                    const startsNewDay =
                      !prev || !isSameDay(new Date(prev.created_at), sentAt);
                    const startsNewGroup =
                      !prev || startsNewDay || prev.direction !== message.direction;

                    return (
                      <div
                        key={message.id}
                        className={startsNewGroup && idx > 0 ? "pt-2" : undefined}
                      >
                        {startsNewDay && (
                          <div className="flex justify-center py-3">
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              {dayLabel(sentAt)}
                            </span>
                          </div>
                        )}
                        <MessageBubble message={message} isRTL={isRTL} />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* 24-hour window warning for WhatsApp */}
            {isWAWindowClosed && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between">
                <p className="text-sm text-amber-800">{t("omnichannel.wa_window_closed")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplatePicker(true)}
                >
                  {t("omnichannel.wa_use_template")}
                </Button>
              </div>
            )}

            {/* Compose */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAttachImage}
                  disabled={isWAWindowClosed || sendMutation.isPending}
                >
                  <Image className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAttachDocument}
                  disabled={isWAWindowClosed || sendMutation.isPending}
                >
                  <FileText className="h-5 w-5" />
                </Button>
                {(isWAWindowClosed || currentThread?.channel === "whatsapp") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowTemplatePicker(true)}
                    disabled={sendMutation.isPending}
                  >
                    <FileImage className="h-5 w-5" />
                  </Button>
                )}
                <Input
                  placeholder={t("omnichannel.compose_placeholder")}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  disabled={isWAWindowClosed}
                />
                {/* Not disabled while a send is in flight — the message is
                    already on screen optimistically, so the composer stays
                    usable for the next one. */}
                <Button
                  onClick={handleSend}
                  aria-label={t("omnichannel.send")}
                  disabled={!messageText.trim() || isWAWindowClosed}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Customer context */}
      {threadId && currentThread && (
        <aside className="hidden xl:flex w-[300px] border-s flex-col bg-muted/20">
          <div className="p-5 flex flex-col items-center text-center border-b">
            <ParticipantAvatar
              name={currentThread.participant.name}
              avatarUrl={currentThread.participant.avatar_url}
              seed={currentThread.participant.id || currentThread.id}
              channel={currentThread.channel}
              size="lg"
            />
            <p className="mt-3 font-semibold">{currentThread.participant.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(`omnichannel.channel_${currentThread.channel}`)}
            </p>
          </div>

          <div className="p-5 space-y-4 text-sm border-b">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("omnichannel.context_conversation")}
            </p>
            <dl className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground text-xs">
                  {t("omnichannel.context_status")}
                </dt>
                <dd>
                  <Badge variant={currentThread.status === "open" ? "default" : "secondary"}>
                    {t(`omnichannel.thread_status_${currentThread.status}`)}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground text-xs">
                  {t("omnichannel.context_last_active")}
                </dt>
                <dd className="text-xs">
                  {formatDistanceToNow(new Date(currentThread.last_message_at), {
                    addSuffix: true,
                    locale: isRTL ? ar : enUS,
                  })}
                </dd>
              </div>
              {currentThread.participant.phone_e164 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground text-xs">
                    {t("omnichannel.context_phone")}
                  </dt>
                  <dd className="text-xs tabular-nums" dir="ltr">
                    {currentThread.participant.phone_e164}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="p-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("omnichannel.context_orders")}
            </p>
            <p className="text-sm">{t("omnichannel.context_no_orders")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("omnichannel.context_no_orders_hint")}
            </p>
          </div>
        </aside>
      )}

      {/* Template Picker Dialog */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("omnichannel.attach_template")}</DialogTitle>
            <DialogDescription>
              {t("omnichannel.template_picker_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {approvedTemplates
              .filter((t) => t.status === "APPROVED")
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full p-3 text-left border rounded-lg hover:bg-muted transition-colors"
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {template.components.find((c) => c.type === "BODY")?.text || ""}
                  </p>
                </button>
              ))}
            {approvedTemplates.filter((t) => t.status === "APPROVED").length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                {t("omnichannel.no_templates")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inbox;