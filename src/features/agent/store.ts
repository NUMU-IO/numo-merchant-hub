/**
 * Zustand store for the Agent panel — conversation messages + streaming state.
 * Mirrors the feature-store pattern used by features/theme-editor-v3.
 */
import { create } from "zustand";

import {
  confirmProposal,
  getConversation,
  listConversations,
  streamAgentChat,
  undoLast,
  type AgentEvent,
  type ChatAttachment,
  type ConversationSummary,
} from "./api";

/** Remember the active thread per store so a refresh resumes it. */
const convKey = (storeId: string) => `numu-agent-conv-${storeId}`;

export interface AgentProposal {
  proposal_id: string;
  summary?: string;
  diff?: Record<string, unknown>;
  status: "pending" | "applying" | "applied" | "declined" | "error";
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  status?: "streaming" | "working" | "done" | "error";
  proposal?: AgentProposal;
  /** Image URLs attached to a sent message, shown as thumbnails. */
  images?: string[];
  /**
   * Tool names the agent ran for this reply, in order. Shown above the answer
   * so the merchant can see what it actually looked at before answering —
   * "Searched knowledge", "Read orders" — rather than a blank wait.
   */
  tools?: string[];
}

interface AgentState {
  isOpen: boolean;
  isStreaming: boolean;
  conversationId: string | null;
  messages: AgentMessage[];
  view: "chat" | "history";
  history: ConversationSummary[];
  isLoadingHistory: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  reset: () => void;
  sendMessage: (
    storeId: string,
    text: string,
    locale: "ar" | "en",
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  confirmProposal: (storeId: string, messageId: string) => Promise<void>;
  declineProposal: (storeId: string, messageId: string) => Promise<void>;
  undo: (storeId: string) => Promise<void>;
  showHistory: (storeId: string) => Promise<void>;
  backToChat: () => void;
  openConversation: (storeId: string, conversationId: string) => Promise<void>;
  newChat: (storeId: string) => void;
  restoreLastConversation: (storeId: string) => Promise<void>;
}

let _seq = 0;
const nextId = () => `m${Date.now()}_${_seq++}`;

export const useAgentStore = create<AgentState>((set, get) => ({
  isOpen: false,
  isStreaming: false,
  conversationId: null,
  messages: [],
  view: "chat",
  history: [],
  isLoadingHistory: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  reset: () => set({ messages: [], conversationId: null, isStreaming: false }),

  showHistory: async (storeId) => {
    set({ view: "history", isLoadingHistory: true });
    try {
      const history = await listConversations(storeId);
      set({ history, isLoadingHistory: false });
    } catch {
      set({ history: [], isLoadingHistory: false });
    }
  },

  backToChat: () => set({ view: "chat" }),

  openConversation: async (storeId, conversationId) => {
    set({ view: "chat", isStreaming: false });
    try {
      const conv = await getConversation(storeId, conversationId);
      const messages: AgentMessage[] = conv.turns.map((t) => ({
        id: nextId(),
        role: t.role,
        text: t.content,
        status: "done" as const,
      }));
      set({ conversationId: conv.id, messages });
      localStorage.setItem(convKey(storeId), conv.id);
    } catch {
      /* thread gone (or forbidden) — stay on the current chat */
    }
  },

  newChat: (storeId) => {
    localStorage.removeItem(convKey(storeId));
    set({ messages: [], conversationId: null, view: "chat", isStreaming: false });
  },

  restoreLastConversation: async (storeId) => {
    // Called once when the panel first opens: resume where the merchant left off.
    if (get().conversationId || get().messages.length > 0) return;
    const saved = localStorage.getItem(convKey(storeId));
    if (saved) await get().openConversation(storeId, saved);
  },

  sendMessage: async (storeId, text, locale, attachments) => {
    const trimmed = text.trim();
    if (!trimmed || get().isStreaming) return;

    const userMsg: AgentMessage = {
      id: nextId(),
      role: "user",
      text: trimmed,
      images: (attachments || []).map((a) => a.url),
    };
    const agentMsg: AgentMessage = { id: nextId(), role: "agent", text: "", status: "working" };
    set((s) => ({ messages: [...s.messages, userMsg, agentMsg], isStreaming: true }));

    const patchAgent = (patch: Partial<AgentMessage>) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === agentMsg.id ? { ...m, ...patch } : m)),
      }));

    const onEvent = (ev: AgentEvent) => {
      switch (ev.type) {
        case "meta":
          if (typeof ev.data.conversation_id === "string") {
            set({ conversationId: ev.data.conversation_id });
            localStorage.setItem(convKey(storeId), ev.data.conversation_id);
          }
          break;
        case "tool_call":
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === agentMsg.id
                ? {
                    ...m,
                    status: "working",
                    tools: [...(m.tools ?? []), String(ev.data.name ?? "")],
                  }
                : m,
            ),
          }));
          break;
        case "token":
          // The reply arriving a fragment at a time. A turn takes 15-30s
          // against production and the model time is mostly irreducible —
          // what this removes is the part where the merchant watches a
          // motionless spinner for all of it.
          //
          // Appended, never replaced: each event carries only the new text.
          if (typeof ev.data.text === "string") {
            const delta = ev.data.text;
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === agentMsg.id
                  ? { ...m, text: m.text + delta, status: "streaming" }
                  : m,
              ),
            }));
          }
          break;
        case "message":
          // Only sent when the reply was NOT streamed (the first model call,
          // or a provider without streaming). Replacing rather than appending
          // is right here: this event carries the whole text.
          if (typeof ev.data.text === "string")
            patchAgent({ text: ev.data.text, status: "streaming" });
          break;
        case "proposal":
          patchAgent({
            proposal: {
              proposal_id: ev.data.proposal_id as string,
              summary: ev.data.summary as string | undefined,
              diff: ev.data.diff as Record<string, unknown> | undefined,
              status: "pending",
            },
          });
          break;
        case "done":
          patchAgent({ status: "done" });
          break;
        case "error":
          patchAgent({
            text:
              (ev.data.message as string) ||
              "The assistant is unavailable right now.",
            status: "error",
          });
          break;
      }
    };

    try {
      await streamAgentChat(
        storeId,
        {
          message: trimmed,
          conversation_id: get().conversationId,
          locale,
          ...(attachments?.length ? { attachments } : {}),
        },
        onEvent,
      );
    } catch {
      patchAgent({
        text: "Something went wrong. Please try again.",
        status: "error",
      });
    } finally {
      set({ isStreaming: false });
    }
  },

  confirmProposal: async (storeId, messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    const proposal = msg?.proposal;
    if (!proposal || proposal.status !== "pending") return;

    const patchProposal = (status: AgentProposal["status"]) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId && m.proposal
            ? { ...m, proposal: { ...m.proposal, status } }
            : m,
        ),
      }));

    patchProposal("applying");
    try {
      await confirmProposal(storeId, proposal.proposal_id, "confirm");
      patchProposal("applied");
    } catch {
      patchProposal("error");
    }
  },

  declineProposal: async (storeId, messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    const proposal = msg?.proposal;
    if (!proposal || proposal.status !== "pending") return;
    try {
      await confirmProposal(storeId, proposal.proposal_id, "decline");
    } catch {
      /* declining is best-effort */
    }
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId && m.proposal
          ? { ...m, proposal: { ...m.proposal, status: "declined" } }
          : m,
      ),
    }));
  },

  undo: async (storeId) => {
    const conversationId = get().conversationId;
    if (!conversationId) return;
    await undoLast(storeId, conversationId).catch(() => undefined);
  },
}));
