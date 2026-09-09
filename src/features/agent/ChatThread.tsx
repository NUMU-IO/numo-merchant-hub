/**
 * ChatThread — the agent's message list.
 *
 * Shared by the slide-over and the full-page Assistant so a turn renders
 * identically on both. One renderer means the two surfaces cannot drift.
 *
 * Both roles get the same card: hairline border, card ground, `rounded-lg`.
 * What separates them is side and width — the merchant's message sits right at
 * four-fifths width, the agent's sits left and takes the column. A coloured
 * bubble on one side turns a working transcript into a messaging app; a long
 * answer with headings and a table has to read as a document.
 */
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "./Markdown";
import { ProposalCard } from "./ProposalCard";
import { ToolTrace } from "./ToolTrace";
import type { AgentMessage } from "./store";

export function ChatThread({
  messages,
  className = "",
  /** The slide-over is narrow enough that the merchant's turn can be wider. */
  userMaxWidth = "max-w-[80%]",
}: {
  messages: AgentMessage[];
  className?: string;
  userMaxWidth?: string;
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
    <div ref={scrollRef} className={`flex flex-col gap-1.5 overflow-y-auto ${className}`}>
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex flex-col items-end gap-1 ms-4 md:ms-10">
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
            <div
              // A merchant on the Arabic hub types English half the time
              // ("Which products are low on stock?"). Inheriting the page's
              // RTL direction ran that sentence through the bidi algorithm and
              // threw the question mark to the front — "?Which products are
              // low on stock". `auto` takes the direction from the text's own
              // first strong character, so each message reads in its own.
              dir="auto"
              className={`${userMaxWidth} whitespace-pre-wrap rounded-lg border bg-card px-3 py-2 text-sm font-medium leading-relaxed`}
            >
              {m.text}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex flex-col items-start gap-1.5 me-4 md:me-10">
            <ToolTrace tools={m.tools} running={m.status === "working"} />
            {(m.text || m.status !== "working") && (
              <div
                dir="auto"
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm leading-relaxed"
              >
                {m.text ? (
                  <Markdown text={m.text} />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("agent.thinking")}
                  </span>
                )}
              </div>
            )}
            {m.proposal && <ProposalCard messageId={m.id} proposal={m.proposal} />}
          </div>
        ),
      )}
    </div>
  );
}

export default ChatThread;
