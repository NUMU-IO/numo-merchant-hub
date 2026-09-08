/**
 * AgentPanel — the NUMU merchant copilot slide-over.
 *
 * A shadcn Sheet that streams the agent's reply over SSE, is fully RTL-aware,
 * and renders in the merchant's language (English / Egyptian Arabic). Mount
 * once inside the dashboard layout; a floating launcher toggles it open.
 *
 * The thread and the composer are shared with the full-page Assistant
 * (`pages/Assistant.tsx`) — this file owns only the slide-over chrome.
 */
import { ArrowLeft, History, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";

import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { DigestCard } from "./DigestCard";
import { MascotSprite, type MascotState } from "./MascotSprite";
import { useAgentStore } from "./store";

function currentStoreId(): string | null {
  return localStorage.getItem("numu-current-store");
}

export function AgentPanel() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const locale = language === "ar" ? "ar" : "en";

  const {
    isOpen,
    isStreaming,
    messages,
    view,
    history,
    isLoadingHistory,
    open,
    close,
    sendMessage,
    showHistory,
    backToChat,
    openConversation,
    newChat,
    restoreLastConversation,
  } = useAgentStore();

  // Resume the last thread once per panel-open so a refresh doesn't wipe context.
  useEffect(() => {
    const storeId = currentStoreId();
    if (isOpen && storeId) void restoreLastConversation(storeId);
  }, [isOpen, restoreLastConversation]);

  // Drive the mascot from conversation state: think before the first token,
  // talk while streaming, get excited on a proposed change, smile when a reply
  // just landed, and idle at rest.
  const mascotState: MascotState = useMemo(() => {
    const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
    if (isStreaming) return lastAgent?.text ? "talking" : "thinking";
    if (lastAgent?.proposal?.status === "pending") return "excited";
    if (lastAgent?.status === "done") return "happy";
    return "idle";
  }, [messages, isStreaming]);

  const send = (text: string, attachments: { type: "image"; url: string }[]) => {
    const storeId = currentStoreId();
    if (!storeId) return;
    void sendMessage(storeId, text, locale, attachments);
  };

  // A digest chip sends its follow-up prompt straight into the chat.
  const handlePrompt = (prompt: string) => {
    const storeId = currentStoreId();
    if (!storeId || isStreaming) return;
    void sendMessage(storeId, prompt, locale);
  };

  return (
    <>
      {/* Floating launcher — the idle mascot peeks out and waves you over. */}
      {!isOpen && (
        <Button
          onClick={open}
          className={`fixed bottom-6 z-40 h-12 gap-1.5 rounded-full pl-1.5 pr-4 shadow-lg ${
            isRTL ? "left-6" : "right-6"
          }`}
          aria-label={t("agent.open")}
        >
          <MascotSprite state="idle" size={36} />
          {t("agent.open")}
        </Button>
      )}

      <Sheet open={isOpen} onOpenChange={(o) => (o ? open() : close())}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className="flex w-full max-w-md flex-col p-0"
        >
          <SheetHeader className="flex-row items-center gap-2 border-b px-4 py-3 space-y-0">
            <MascotSprite state={mascotState} size={40} />
            <div className="min-w-0 flex-1">
              <SheetTitle>{t("agent.title")}</SheetTitle>
              <p className="text-xs text-muted-foreground">{t("agent.subtitle")}</p>
            </div>
            <div className="me-6 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t("agent.newChat")}
                title={t("agent.newChat")}
                onClick={() => {
                  const storeId = currentStoreId();
                  if (storeId) newChat(storeId);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t("agent.history")}
                title={t("agent.history")}
                onClick={() => {
                  const storeId = currentStoreId();
                  if (!storeId) return;
                  if (view === "history") backToChat();
                  else void showHistory(storeId);
                }}
              >
                {view === "history" ? (
                  <ArrowLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                ) : (
                  <History className="h-4 w-4" />
                )}
              </Button>
            </div>
          </SheetHeader>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <History className="mb-2 h-6 w-6 opacity-50" />
                  <p>{t("agent.noHistory")}</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {history.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-start text-sm hover:bg-muted"
                        onClick={() => {
                          const storeId = currentStoreId();
                          if (storeId) void openConversation(storeId, c.id);
                        }}
                      >
                        <span className="block truncate font-medium">
                          {c.title || t("agent.untitled")}
                        </span>
                        {c.updated_at && (
                          <span className="block text-xs text-muted-foreground">
                            {new Date(c.updated_at).toLocaleString(
                              locale === "ar" ? "ar-EG" : undefined,
                              { dateStyle: "medium", timeStyle: "short" },
                            )}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
              <DigestCard
                storeId={currentStoreId()}
                isOpen={isOpen}
                onPrompt={handlePrompt}
              />
              <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <MascotSprite state="wave" size={96} className="mb-3" />
                <p className="font-medium">{t("agent.emptyTitle")}</p>
                <p className="mt-1 text-xs">{t("agent.emptyHint")}</p>
              </div>
            </div>
          ) : (
            <ChatThread messages={messages} className="flex-1 px-4 py-4" />
          )}

          <Composer
            storeId={currentStoreId()}
            disabled={isStreaming}
            onSend={send}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default AgentPanel;
