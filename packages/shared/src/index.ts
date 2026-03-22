// ============================================
// Session types
// ============================================

export type SessionType = "chat" | "terminal";

export interface SessionInfo {
  id: string;
  type: SessionType;
  worktreePath: string;
  name: string;
  createdAt: number;
}

// ============================================
// Project / Worktree types
// ============================================

export interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
}

export interface ProjectWithWorktrees extends ProjectConfig {
  worktrees: WorktreeInfo[];
}

// ============================================
// Chat message types (for UI rendering)
// ============================================

export type ChatMessageRole = "user" | "assistant";

export interface ChatUserMessage {
  role: "user";
  content: string;
  timestamp: number;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: string;
  isError?: boolean;
}

export interface ChatAssistantMessage {
  role: "assistant";
  text: string;
  toolCalls: ToolCallInfo[];
  thinking?: string;
  isStreaming: boolean;
}

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

export type ChatSessionState = "idle" | "streaming" | "awaiting_permission";

// ============================================
// Permission types
// ============================================

export interface PermissionRequest {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
}

// ============================================
// Client → Server messages
// ============================================

export interface SessionCreateMessage {
  type: "session.create";
  worktreePath: string;
  sessionType: SessionType;
  name?: string;
}

export interface SessionCloseMessage {
  type: "session.close";
  sessionId: string;
}

export interface ChatSendMessage {
  type: "chat.send";
  sessionId: string;
  text: string;
}

export interface ChatInterruptMessage {
  type: "chat.interrupt";
  sessionId: string;
}

export interface ChatPermissionMessage {
  type: "chat.permission";
  sessionId: string;
  toolUseId: string;
  allow: boolean;
}

export interface TerminalInputMessage {
  type: "terminal.input";
  sessionId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: "terminal.resize";
  sessionId: string;
  cols: number;
  rows: number;
}

export interface ProjectAddMessage {
  type: "project.add";
  repoPath: string;
  name?: string;
}

export interface ProjectRemoveMessage {
  type: "project.remove";
  projectId: string;
}

export interface WorktreeCreateMessage {
  type: "worktree.create";
  projectId: string;
  branch: string;
  path?: string;
}

export interface WorktreeRemoveMessage {
  type: "worktree.remove";
  projectId: string;
  worktreePath: string;
}

export interface ProjectListMessage {
  type: "project.list";
}

export interface DialogPickFolderMessage {
  type: "dialog.pickFolder";
}

export interface SessionListMessage {
  type: "session.list";
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionCloseMessage
  | ChatSendMessage
  | ChatInterruptMessage
  | ChatPermissionMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | ProjectAddMessage
  | ProjectRemoveMessage
  | WorktreeCreateMessage
  | WorktreeRemoveMessage
  | ProjectListMessage
  | DialogPickFolderMessage
  | SessionListMessage;

// ============================================
// Server → Client messages
// ============================================

export interface SessionCreatedEvent {
  type: "session.created";
  session: SessionInfo;
}

export interface SessionClosedEvent {
  type: "session.closed";
  sessionId: string;
}

export interface ChatTextEvent {
  type: "chat.text";
  sessionId: string;
  text: string;
  messageId: string;
}

export interface ChatThinkingEvent {
  type: "chat.thinking";
  sessionId: string;
  thinking: string;
  messageId: string;
}

export interface ChatToolCallEvent {
  type: "chat.tool_call";
  sessionId: string;
  toolCall: ToolCallInfo;
  messageId: string;
}

export interface ChatToolResultEvent {
  type: "chat.tool_result";
  sessionId: string;
  toolUseId: string;
  result: string;
  isError: boolean;
}

export interface ChatPermissionRequestEvent {
  type: "chat.permission_request";
  sessionId: string;
  permission: PermissionRequest;
}

export interface ChatStateEvent {
  type: "chat.state";
  sessionId: string;
  state: ChatSessionState;
}

export interface ChatErrorEvent {
  type: "chat.error";
  sessionId: string;
  error: string;
}

export interface ChatEndEvent {
  type: "chat.end";
  sessionId: string;
  messageId: string;
}

export interface TerminalOutputEvent {
  type: "terminal.output";
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  type: "terminal.exit";
  sessionId: string;
  exitCode: number;
}

export interface ProjectListEvent {
  type: "project.list";
  projects: ProjectWithWorktrees[];
}

export interface DialogFolderPickedEvent {
  type: "dialog.folderPicked";
  path: string | null;
}

export interface SessionListEvent {
  type: "session.list";
  sessions: SessionInfo[];
  chatHistories: Record<string, ChatMessage[]>;
}

export interface ServerErrorEvent {
  type: "error";
  message: string;
  requestType?: string;
}

export type ServerMessage =
  | SessionCreatedEvent
  | SessionClosedEvent
  | ChatTextEvent
  | ChatThinkingEvent
  | ChatToolCallEvent
  | ChatToolResultEvent
  | ChatPermissionRequestEvent
  | ChatStateEvent
  | ChatErrorEvent
  | ChatEndEvent
  | TerminalOutputEvent
  | TerminalExitEvent
  | ProjectListEvent
  | DialogFolderPickedEvent
  | SessionListEvent
  | ServerErrorEvent;
