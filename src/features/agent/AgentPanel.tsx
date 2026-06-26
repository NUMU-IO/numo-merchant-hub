/**
 * AgentPanel — the NUMU merchant copilot chat surface (US1, read-only).
 *
 * A slide-over (shadcn Sheet) that streams the agent's reply over SSE, is fully
 * RTL-aware, and renders in the merchant's language (English / Egyptian Arabic).
 * Mount once inside the dashboard layout; a floating launcher toggles it open.
 */
import { Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";

import { MascotSprite, type MascotState } from "./MascotSprite";
import { ProposalCard } from "./ProposalCard";
import { useAgentStore } from "./store";

function currentStoreId(): string | null {
  return localStorage.getItem("numu-current-store");
}

export function AgentPanel() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const locale = language === "ar" ? "ar" : "en";

  const { isOpen, isStreaming, messages, open, close, sendMessage } = useAgentStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const storeId = currentStoreId();
    if (!storeId || !input.trim() || isStreaming) return;
    void sendMessage(storeId, input, locale);
    setInput("");
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
            <div className="min-w-0">
              <SheetTitle>{t("agent.title")}</SheetTitle>
              <p className="text-xs text-muted-foreground">{t("agent.subtitle")}</p>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <MascotSprite state="wave" size={96} className="mb-3" />
                <p className="font-medium">{t("agent.emptyTitle")}</p>
                <p className="mt-1 text-xs">{t("agent.emptyHint")}</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.text ||
                        (m.status === "working" ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("agent.thinking")}
                          </span>
                        ) : null)}
                    </div>
                  </div>
                  {m.role === "agent" && m.proposal && (
                    <ProposalCard messageId={m.id} proposal={m.proposal} />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("agent.placeholder")}
                dir={isRTL ? "rtl" : "ltr"}
                rows={1}
                className="max-h-32 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="icon" onClick={handleSend} disabled={isStreaming || !input.trim()}>
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default AgentPanel;
