import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listThreads,
  listMessages,
  sendMessage,
  markThreadRead,
  resolveThread,
  type ThreadDTO,
  type MessageDTO,
} from "@/services/inboxApi";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { createInboxSocket, type InboxSocket } from "@/services/inboxSocket";
import { formatDistanceToNow } from "date-fns";
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
  facebook: "bg-blue-500",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  whatsapp: "bg-green-500",
};

interface ThreadListItemProps {
  thread: ThreadDTO;
  isActive: boolean;
  onClick: () => void;
  language: "ar" | "en";
}

const ThreadListItem = ({ thread, isActive, onClick, language }: ThreadListItemProps) => {
  const Icon = channelIcons[thread.channel];
  const locale = language === "ar" ? ar : enUS;

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-start ${
        isActive ? "bg-muted" : ""
      }`}
    >
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={thread.participant.avatar_url || undefined} />
          <AvatarFallback>
            {thread.participant.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ${channelColors[thread.channel]}`}
        >
          <Icon className="h-2.5 w-2.5 text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate text-sm">{thread.participant.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true, locale })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {thread.last_message_preview}
        </p>
      </div>
      {thread.unread_count > 0 && (
        <Badge variant="default" className="h-5 min-w-5 px-1.5 shrink-0">
          {thread.unread_count}
        </Badge>
      )}
    </button>
  );
};

interface MessageBubbleProps {
  message: MessageDTO;
  isRTL: boolean;
}

const MessageBubble = ({ message, isRTL }: MessageBubbleProps) => {
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

  return (
    <div className={`flex gap-2 ${isInbound ? "" : "flex-row-reverse"}`}>
      {!isInbound && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">ME</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isInbound
            ? "bg-muted"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {message.attachment_url && message.type === "image" && (
          <img
            src={message.attachment_url}
            alt="Attachment"
            className="max-w-full rounded-lg mb-2"
          />
        )}
        {message.body && <p className="text-sm whitespace-pre-wrap">{message.body}</p>}
        {message.type === "template" && (
          <p className="text-sm italic">Template: {message.template_name}</p>
        )}
        <div className={`flex items-center gap-1 mt-1 ${isRTL ? "justify-start" : "justify-end"}`}>
          <span className="text-[10px] opacity-70">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale })}
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

  const currentThread = threadsQuery.data?.threads.find((t) => t.id === threadId);

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
    onSuccess: (newMessage) => {
      setMessageText("");
      queryClient.setQueryData(
        ["inbox", "messages", storeId, threadId],
        (old: unknown) => {
          if (!old) return old;
          const oldData = old as { pages: { messages: MessageDTO[] }[] };
          return {
            ...oldData,
            pages: oldData.pages.map((page, idx) =>
              idx === 0
                ? { ...page, messages: [newMessage, ...page.messages] }
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
    toast.info("Image attachments coming soon!");
  };

  const handleAttachDocument = () => {
    toast.info("Document attachments coming soon!");
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

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Thread List */}
      <div className="w-[380px] border-r flex flex-col bg-background">
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
          <div className="flex gap-2">
            <Button
              variant={selectedChannel === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChannel(null)}
            >
              {t("omnichannel.filter_all")}
            </Button>
            <Button
              variant={selectedChannel === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChannel(selectedChannel === "whatsapp" ? null : "whatsapp")}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              WA
            </Button>
            <Button
              variant={selectedChannel === "facebook" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChannel(selectedChannel === "facebook" ? null : "facebook")}
            >
              <Facebook className="h-3 w-3 mr-1" />
              FB
            </Button>
            <Button
              variant={selectedChannel === "instagram" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChannel(selectedChannel === "instagram" ? null : "instagram")}
            >
              <Instagram className="h-3 w-3 mr-1" />
              IG
            </Button>
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
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("omnichannel.no_threads_yet")}</p>
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
      <div className="flex-1 flex flex-col">
        {!threadId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">{t("omnichannel.select_thread")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentThread?.participant.avatar_url || undefined} />
                    <AvatarFallback>
                      {currentThread?.participant.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {currentThread && (
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ${channelColors[currentThread.channel]}`}
                    >
                      {React.createElement(channelIcons[currentThread.channel], {
                        className: "h-2.5 w-2.5 text-white",
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{currentThread?.participant.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {t(`omnichannel.channel_${currentThread?.channel}`)}
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
                {t("omnichannel.thread_status_resolved")}
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
                <div className="space-y-4">
                  {allMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} isRTL={isRTL} />
                  ))}
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
                  disabled={isWAWindowClosed || sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={(!messageText.trim() && !isWAWindowClosed) || isWAWindowClosed || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("omnichannel.attach_template")}</DialogTitle>
            <DialogDescription>
              Select a template to send to this conversation
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
              <p className="text-center text-muted-foreground py-4">
                No approved templates available
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inbox;