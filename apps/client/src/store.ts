import { create } from "zustand";
import type {
  ChatAssistantMessage,
  ChatMessage,
  ChatSessionState,
  ChatUserMessage,
  ProjectWithWorktrees,
  SessionInfo,
  ToolCallInfo,
} from "@kodeck/shared";

export interface ChatSessionData {
  messages: ChatMessage[];
  state: ChatSessionState;
  inputHistory: string[];
}

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Projects
  projects: ProjectWithWorktrees[];
  setProjects: (projects: ProjectWithWorktrees[]) => void;

  // Worktree selection
  selectedWorktreePath: string | null;
  selectWorktree: (path: string | null) => void;

  // Sessions
  sessions: SessionInfo[];
  activeSessionId: string | null;
  addSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  loadSessions: (sessions: SessionInfo[], chatHistories: Record<string, ChatMessage[]>) => void;

  // Chat data
  chatData: Map<string, ChatSessionData>;
  appendChatText: (sessionId: string, messageId: string, text: string) => void;
  appendToolCall: (sessionId: string, messageId: string, toolCall: ToolCallInfo) => void;
  updateToolResult: (sessionId: string, toolUseId: string, result: string, isError: boolean) => void;
  addUserMessage: (sessionId: string, text: string) => void;
  setChatState: (sessionId: string, state: ChatSessionState) => void;
  finishAssistantMessage: (sessionId: string, messageId: string) => void;
}

function getOrCreateChatData(chatData: Map<string, ChatSessionData>, sessionId: string): ChatSessionData {
  const existing = chatData.get(sessionId);
  if (existing) return existing;
  return { messages: [], state: "idle", inputHistory: [] };
}

export const useAppStore = create<AppState>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Projects
  projects: [],
  setProjects: (projects) => set({ projects }),

  // Worktree selection
  selectedWorktreePath: null,
  selectWorktree: (path) => set({ selectedWorktreePath: path }),

  // Sessions
  sessions: [],
  activeSessionId: null,
  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
    })),
  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    })),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  loadSessions: (sessions, chatHistories) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      for (const [sessionId, messages] of Object.entries(chatHistories)) {
        chatData.set(sessionId, {
          messages,
          state: "idle",
          inputHistory: messages
            .filter((m): m is ChatUserMessage => m.role === "user")
            .map((m) => m.content),
        });
      }
      const activeSessionId = state.activeSessionId ?? sessions[0]?.id ?? null;
      return { sessions, chatData, activeSessionId };
    }),

  // Chat data
  chatData: new Map(),

  appendChatText: (sessionId, _messageId, text) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const messages = [...data.messages];
      const last = messages[messages.length - 1];

      if (last && last.role === "assistant" && last.isStreaming) {
        messages[messages.length - 1] = { ...last, text: last.text + text };
      } else {
        const newMsg: ChatAssistantMessage = {
          role: "assistant",
          text,
          toolCalls: [],
          isStreaming: true,
        };
        messages.push(newMsg);
      }

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  appendToolCall: (sessionId, _messageId, toolCall) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const messages = [...data.messages];
      const last = messages[messages.length - 1];

      if (last && last.role === "assistant" && last.isStreaming) {
        messages[messages.length - 1] = {
          ...last,
          toolCalls: [...last.toolCalls, toolCall],
        };
      }

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  updateToolResult: (sessionId, toolUseId, result, isError) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const messages = data.messages.map((msg) => {
        if (msg.role !== "assistant") return msg;
        const updatedToolCalls = msg.toolCalls.map((tc) =>
          tc.id === toolUseId
            ? { ...tc, result, isError, status: isError ? "error" as const : "done" as const }
            : tc,
        );
        if (updatedToolCalls === msg.toolCalls) return msg;
        return { ...msg, toolCalls: updatedToolCalls };
      });

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  addUserMessage: (sessionId, text) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const messages: ChatMessage[] = [
        ...data.messages,
        { role: "user", content: text, timestamp: Date.now() },
      ];
      const inputHistory = [...data.inputHistory, text];

      chatData.set(sessionId, { ...data, messages, inputHistory, state: "streaming" });
      return { chatData };
    }),

  setChatState: (sessionId, chatState) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      chatData.set(sessionId, { ...data, state: chatState });
      return { chatData };
    }),

  finishAssistantMessage: (sessionId, _messageId) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const messages = data.messages.map((msg) => {
        if (msg.role === "assistant" && msg.isStreaming) {
          return { ...msg, isStreaming: false };
        }
        return msg;
      });

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),
}));
