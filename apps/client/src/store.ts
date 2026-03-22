import { create } from "zustand";
import type {
  BranchInfo,
  ChatAttachment,
  ChatAssistantMessage,
  ChatMessage,
  ChatSessionState,
  ChatUserMessage,
  ClaudeProcessInfo,
  EffortLevel,
  PRSearchResult,
  PermissionRequest,
  ProjectWithWorktrees,
  SessionInfo,
  SessionMeta,
  ToolCallInfo,
  WorktreeInfo,
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
  renameSession: (sessionId: string, name: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  setSessionModel: (sessionId: string, model: string) => void;
  setSessionEffort: (sessionId: string, effort: EffortLevel) => void;
  setSessionSkipPermissions: (sessionId: string, skip: boolean) => void;
  setSessionStreaming: (sessionId: string, streaming: boolean) => void;
  loadSessions: (
    sessions: SessionInfo[],
    chatHistories: Record<string, ChatMessage[]>,
    slashCommands?: Record<string, string[]>,
    metas?: Record<string, SessionMeta>,
    sessionStates?: Record<string, ChatSessionState>,
    pendingPermissions?: Record<string, PermissionRequest>,
  ) => void;

  // Chat data
  chatData: Map<string, ChatSessionData>;
  appendChatText: (sessionId: string, messageId: string, text: string) => void;
  appendToolCall: (sessionId: string, messageId: string, toolCall: ToolCallInfo) => void;
  updateToolResult: (
    sessionId: string,
    toolUseId: string,
    result: string,
    isError: boolean,
  ) => void;
  addUserMessage: (sessionId: string, text: string, attachments?: ChatAttachment[]) => void;
  setChatState: (sessionId: string, state: ChatSessionState) => void;
  finishAssistantMessage: (sessionId: string, messageId: string) => void;

  // Slash commands
  slashCommands: Map<string, string[]>;
  setSlashCommands: (sessionId: string, commands: string[]) => void;

  // Session metadata
  sessionMeta: Map<string, SessionMeta>;
  setSessionMeta: (sessionId: string, meta: SessionMeta) => void;

  // Permission requests
  pendingPermission: Map<string, PermissionRequest>;
  setPendingPermission: (sessionId: string, permission: PermissionRequest) => void;
  clearPendingPermission: (sessionId: string) => void;

  // Chat cleanup (visual only)
  cleanedAtIndex: Map<string, number>;
  cleanChat: (sessionId: string) => void;
  restoreChat: (sessionId: string) => void;

  // Debug
  debugMode: boolean;
  setDebugMode: (on: boolean) => void;
  debugProcesses: ClaudeProcessInfo[];
  setDebugProcesses: (processes: ClaudeProcessInfo[]) => void;

  // Worktree creation modal
  branches: BranchInfo[];
  setBranches: (branches: BranchInfo[]) => void;
  prSearchResults: PRSearchResult[];
  setPRSearchResults: (prs: PRSearchResult[]) => void;
  scannedCopyPaths: string[];
  setScannedCopyPaths: (paths: string[]) => void;
  worktreeCreateModalOpen: boolean;
  setWorktreeCreateModalOpen: (open: boolean) => void;
  worktreeCreateProjectId: string | null;
  setWorktreeCreateProjectId: (id: string | null) => void;

  // Worktree operation result (for modal feedback)
  lastOperationResult: { operation: string; success: boolean; message?: string } | null;
  setLastOperationResult: (
    result: { operation: string; success: boolean; message?: string } | null,
  ) => void;

  // Notifications
  notifications: Array<{ id: string; message: string; type: "success" | "error" }>;
  addNotification: (message: string, type: "success" | "error") => void;
  removeNotification: (id: string) => void;

  // Worktree status updates
  updateWorktreeStatus: (projectId: string, worktrees: WorktreeInfo[]) => void;
}

function getOrCreateChatData(
  chatData: Map<string, ChatSessionData>,
  sessionId: string,
): ChatSessionData {
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
    set((state) => {
      // Prevent duplicates
      if (state.sessions.some((s) => s.id === session.id)) return state;
      return { sessions: [...state.sessions, session] };
    }),
  removeSession: (sessionId) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.id === sessionId);
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === sessionId) {
        // Switch to previous tab, or next, or null
        const neighbor = sessions[Math.min(idx, sessions.length - 1)];
        activeSessionId = neighbor?.id ?? null;
      }
      return { sessions, activeSessionId };
    }),
  renameSession: (sessionId, name) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, name } : s)),
    })),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setSessionModel: (sessionId, model) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, model } : s)),
    })),
  setSessionEffort: (sessionId, effort) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, effort } : s)),
    })),
  setSessionSkipPermissions: (sessionId, skip) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, skipPermissions: skip } : s,
      ),
    })),
  setSessionStreaming: (sessionId, streaming) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, streaming } : s)),
    })),

  loadSessions: (
    sessions,
    chatHistories,
    restoredSlashCommands,
    restoredMetas,
    sessionStates,
    restoredPermissions,
  ) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      for (const [sessionId, messages] of Object.entries(chatHistories)) {
        chatData.set(sessionId, {
          messages,
          state: sessionStates?.[sessionId] ?? "idle",
          inputHistory: messages
            .filter((m): m is ChatUserMessage => m.role === "user")
            .map((m) => m.content),
        });
      }
      const slashCommands = new Map(state.slashCommands);
      if (restoredSlashCommands) {
        for (const [sessionId, commands] of Object.entries(restoredSlashCommands)) {
          slashCommands.set(sessionId, commands);
        }
      }
      const sessionMeta = new Map(state.sessionMeta);
      if (restoredMetas) {
        for (const [sessionId, meta] of Object.entries(restoredMetas)) {
          sessionMeta.set(sessionId, meta);
        }
      }
      const pendingPermission = new Map(state.pendingPermission);
      if (restoredPermissions) {
        for (const [sessionId, perm] of Object.entries(restoredPermissions)) {
          pendingPermission.set(sessionId, perm);
        }
      }
      const activeSessionId = state.activeSessionId ?? sessions[0]?.id ?? null;
      const activeSession = sessions.find((s) => s.id === activeSessionId);
      const selectedWorktreePath =
        state.selectedWorktreePath ?? activeSession?.worktreePath ?? null;
      return {
        sessions,
        chatData,
        slashCommands,
        sessionMeta,
        pendingPermission,
        activeSessionId,
        selectedWorktreePath,
      };
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
        const blocks = [...(last.contentBlocks ?? [])];
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock?.type === "text") {
          blocks[blocks.length - 1] = { type: "text", text: lastBlock.text + text };
        } else {
          blocks.push({ type: "text", text });
        }
        messages[messages.length - 1] = { ...last, text: last.text + text, contentBlocks: blocks };
      } else {
        const newMsg: ChatAssistantMessage = {
          role: "assistant",
          text,
          toolCalls: [],
          contentBlocks: [{ type: "text", text }],
          isStreaming: true,
          timestamp: Date.now(),
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
        // Check if tool call already exists (streaming mode sends updates with more complete input)
        const existingIdx = last.toolCalls.findIndex((tc) => tc.id === toolCall.id);
        const blocks = [...(last.contentBlocks ?? [])];
        if (existingIdx >= 0) {
          const updated = [...last.toolCalls];
          updated[existingIdx] = { ...updated[existingIdx], input: toolCall.input };
          // Update the matching block too
          const blockIdx = blocks.findIndex(
            (b) => b.type === "tool_call" && b.toolCall.id === toolCall.id,
          );
          if (blockIdx >= 0) {
            blocks[blockIdx] = { type: "tool_call", toolCall: updated[existingIdx] };
          }
          messages[messages.length - 1] = { ...last, toolCalls: updated, contentBlocks: blocks };
        } else {
          blocks.push({ type: "tool_call", toolCall });
          messages[messages.length - 1] = {
            ...last,
            toolCalls: [...last.toolCalls, toolCall],
            contentBlocks: blocks,
          };
        }
      } else {
        // No streaming assistant message yet — create one (Claude started with tool use, no text)
        const newMsg: ChatAssistantMessage = {
          role: "assistant",
          text: "",
          toolCalls: [toolCall],
          contentBlocks: [{ type: "tool_call", toolCall }],
          isStreaming: true,
          timestamp: Date.now(),
        };
        messages.push(newMsg);
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
            ? { ...tc, result, isError, status: isError ? ("error" as const) : ("done" as const) }
            : tc,
        );
        if (updatedToolCalls === msg.toolCalls) return msg;
        // Also update contentBlocks
        const updatedBlocks = msg.contentBlocks.map((block) => {
          if (block.type !== "tool_call" || block.toolCall.id !== toolUseId) return block;
          return {
            ...block,
            toolCall: {
              ...block.toolCall,
              result,
              isError,
              status: isError ? ("error" as const) : ("done" as const),
            },
          };
        });
        return { ...msg, toolCalls: updatedToolCalls, contentBlocks: updatedBlocks };
      });

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  addUserMessage: (sessionId, text, attachments) =>
    set((state) => {
      const chatData = new Map(state.chatData);
      const data = getOrCreateChatData(chatData, sessionId);
      const userMsg: ChatUserMessage = { role: "user", content: text, timestamp: Date.now() };
      if (attachments?.length) userMsg.attachments = attachments;
      const messages: ChatMessage[] = [...data.messages, userMsg];
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

  // Slash commands
  slashCommands: new Map(),
  setSlashCommands: (sessionId, commands) =>
    set((state) => {
      const slashCommands = new Map(state.slashCommands);
      slashCommands.set(sessionId, commands);
      return { slashCommands };
    }),

  // Session metadata
  sessionMeta: new Map(),
  setSessionMeta: (sessionId, meta) =>
    set((state) => {
      const sessionMeta = new Map(state.sessionMeta);
      sessionMeta.set(sessionId, meta);
      return { sessionMeta };
    }),

  // Permission requests
  pendingPermission: new Map(),
  setPendingPermission: (sessionId, permission) =>
    set((state) => {
      const pendingPermission = new Map(state.pendingPermission);
      pendingPermission.set(sessionId, permission);
      return { pendingPermission };
    }),
  clearPendingPermission: (sessionId) =>
    set((state) => {
      const pendingPermission = new Map(state.pendingPermission);
      pendingPermission.delete(sessionId);
      return { pendingPermission };
    }),

  // Chat cleanup (visual only)
  cleanedAtIndex: new Map(),
  cleanChat: (sessionId) =>
    set((state) => {
      const data = state.chatData.get(sessionId);
      if (!data || data.messages.length <= 1) return state;
      const cleanedAtIndex = new Map(state.cleanedAtIndex);
      cleanedAtIndex.set(sessionId, data.messages.length - 1);
      return { cleanedAtIndex };
    }),
  restoreChat: (sessionId) =>
    set((state) => {
      const cleanedAtIndex = new Map(state.cleanedAtIndex);
      cleanedAtIndex.delete(sessionId);
      return { cleanedAtIndex };
    }),
  // Debug
  debugMode: false,
  setDebugMode: (on) => set({ debugMode: on }),
  debugProcesses: [],
  setDebugProcesses: (processes) => set({ debugProcesses: processes }),

  // Worktree creation modal
  branches: [],
  setBranches: (branches) => set({ branches }),
  prSearchResults: [],
  setPRSearchResults: (prs) => set({ prSearchResults: prs }),
  scannedCopyPaths: [],
  setScannedCopyPaths: (paths) => set({ scannedCopyPaths: paths }),
  worktreeCreateModalOpen: false,
  setWorktreeCreateModalOpen: (open) => set({ worktreeCreateModalOpen: open }),
  worktreeCreateProjectId: null,
  setWorktreeCreateProjectId: (id) => set({ worktreeCreateProjectId: id }),

  // Worktree operation result
  lastOperationResult: null,
  setLastOperationResult: (result) => set({ lastOperationResult: result }),

  // Notifications
  notifications: [],
  addNotification: (message, type) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: crypto.randomUUID(), message, type },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // Worktree status updates
  updateWorktreeStatus: (projectId, worktrees) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, worktrees } : p,
      ),
    })),
}));
