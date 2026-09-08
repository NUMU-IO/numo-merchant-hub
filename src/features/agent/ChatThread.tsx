/**
 * ChatThread — the agent's message list.
 *
 * Extracted from AgentPanel so the slide-over and the full-page Assistant
 * render a turn identically: same bubbles, same attachment thumbnails, same
 * proposal card. One renderer means the two surfaces cannot drift.
 */
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ProposalCard } from "./ProposalCard";
import type { AgentMessage } from "./store";

export function ChatThread({
  messages,
  className = "",
  bubbleMaxWidth = "max-w-[85%]",
}: {
  messages: AgentMessage[];
  className?: string;
  /** Wider on the page, narrower in the slide-over. */
  bubbleMaxWidth?: string;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div ref={scrollRef} className={`space-y-3 overflow-y-auto ${className}`}>
      {messages.map((m) => (
        <div key={m.id} className="space-y-1">
          {/* Thumbnails of what the merchant attached, so the sent message
              reads the way they composed it. */}
          {m.images && m.images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {m.images.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-16 w-16 rounded-lg border object-cover"
                />
              ))}
            </div>
          )}
          <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`${bubbleMaxWidth} whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
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
      ))}
    </div>
  );
}

export default ChatThread;
