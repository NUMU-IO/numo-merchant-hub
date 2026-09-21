import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Send,
  Check,
  CheckCheck,
  Clock,
  Archive,
  RefreshCw,
  MessageSquare,
  User,
  AlertCircle,
} from "lucide-react";
import {
  listConversations,
  getMessages,
  sendMessage,
  updateConversation,
} from "@/services/whatsappApi";

const POLL_MS = 10_000;

export default function WhatsAppInbox() {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // refetchInterval pauses while the tab is hidden.
  const conversationsKey = ["whatsapp-inbox", storeId, "conversations"];
  const conversationsQuery = useQuery({
    queryKey: [...conversationsKey, filter, debouncedSearch],
    queryFn: () =>
      listConversations(storeId!, {
        status: filter === "archived" ? "archived" : "active",
        unread_only: filter === "unread",
        search: debouncedSearch || undefined,
      }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  });
  const conversations = conversationsQuery.data?.conversations ?? [];
  const loading = conversationsQuery.isPending;

  const messagesKey = ["whatsapp-inbox", storeId, "messages", selectedId];
  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => getMessages(storeId!, selectedId!, { limit: 100 }),
    enabled: !!storeId && !!selectedId,
    refetchInterval: POLL_MS,
  });
  const messages = messagesQuery.data?.messages ?? [];
  const windowOpen = messagesQuery.data?.window_open ?? false;

  useEffect(() => {
    if (messagesQuery.error) toast.error(isAr ? "فشل تحميل الرسائل" : "Failed to load messages");
  }, [messagesQuery.error, isAr]);

  useEffect(() => {
    if (storeId && selectedId) {
      updateConversation(storeId, selectedId, { mark_read: true }).catch(() => {});
    }
  }, [selectedId, storeId]);

  // Only a new last message (or another thread) scrolls — a poll that
  // returns the same thread must not yank the merchant away from history.
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  const handleSend = async () => {
    if (!storeId || !selectedId || !messageText.trim()) return;
    setSending(true);
    try {
      const sent = await sendMessage(storeId, selectedId, { text: messageText.trim() });
      queryClient.setQueryData<Awaited<ReturnType<typeof getMessages>>>(messagesKey, (old) =>
        old && { ...old, messages: [...old.messages, sent] },
      );
      setMessageText("");
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    } catch (err) {
      const detail = (err as { message?: string })?.message || "";
      if (detail.includes("24-hour")) {
        toast.error(
          isAr
            ? "انتهت نافذة الـ 24 ساعة. استخدم قالب رسالة"
            : "24h window expired. Use a template message."
        );
      } else {
        toast.error(isAr ? "فشل إرسال الرسالة" : "Failed to send message");
      }
    } finally {
      setSending(false);
    }
  };

  const handleArchive = async (convId: string) => {
    if (!storeId) return;
    try {
      await updateConversation(storeId, convId, { status: "archived" });
      toast.success(isAr ? "تم الأرشفة" : "Archived");
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
      if (selectedId === convId) setSelectedId(null);
    } catch {
      toast.error(isAr ? "فشلت الأرشفة" : "Failed to archive");
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  const statusIcon = (s: string) => {
    switch (s) {
      case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read": return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "failed": return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return formatTime(iso);
    if (diff < 172800000) return isAr ? "أمس" : "Yesterday";
    return d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "صندوق الوارد" : "Inbox"}</h1>
      </div>

      <div className="flex gap-4 h-[calc(100%-3rem)]">
        {/* Conversation List */}
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0 flex-col border rounded-lg bg-card`}>
          {/* Search + Filters */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث..." : "Search..."}
                className="ps-9 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "unread", "archived"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 flex-1"
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? isAr ? "الكل" : "All"
                    : f === "unread"
                    ? isAr ? "غير مقروء" : "Unread"
                    : isAr ? "أرشيف" : "Archived"}
                </Button>
              ))}
            </div>
          </div>

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{isAr ? "لا توجد محادثات" : "No conversations"}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer border-b hover:bg-muted/50 transition-colors ${
                    selectedId === conv.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {conv.customer_name || conv.customer_phone}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatDate(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message_preview || "..."}
                      </p>
                      {conv.unread_count > 0 && (
                        <Badge className="h-5 min-w-5 text-[10px] bg-green-600 ms-1 flex-shrink-0">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col border rounded-lg bg-card`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{isAr ? "اختر محادثة" : "Select a conversation"}</p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 md:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label={isAr ? "رجوع للمحادثات" : "Back to conversations"}
                  >
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  <div className="w-8 h-8 shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selected.customer_name || selected.customer_phone}</p>
                    <p className="text-[10px] text-muted-foreground">{selected.customer_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {windowOpen ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">
                      <Clock className="h-3 w-3 me-1" />
                      {isAr ? "نافذة مفتوحة" : "Window Open"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-200 text-[10px]">
                      {isAr ? "قوالب فقط" : "Templates Only"}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchive(selected.id)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        msg.direction === "outbound"
                          ? "bg-[#dcf8c6] text-gray-900"
                          : "bg-white text-gray-900 shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content || `[${msg.template_name || "Message"}]`}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                        {msg.direction === "outbound" && statusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className="p-3 border-t">
                {windowOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={isAr ? "اكتب رسالة..." : "Type a message..."}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSend}
                      disabled={sending || !messageText.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      {isAr
                        ? "نافذة الـ 24 ساعة انتهت. يمكنك إرسال رسالة قالب فقط."
                        : "24h window expired. You can only send a template message."}
                    </p>
                    <Button variant="outline" size="sm" disabled>
                      {isAr ? "اختر قالب" : "Select Template"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
