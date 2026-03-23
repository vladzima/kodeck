// ============================================
// Session types
// ============================================

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export type SessionType = "chat" | "terminal";

export type EffortLevel = "low" | "medium" | "high" | "max" | "auto";

export interface SessionInfo {
  id: string;
  type: SessionType;
  worktreePath: string;
  name: string;
  createdAt: number;
  claudeSessionId?: string;
  model?: string;
  effort?: EffortLevel;
  skipPermissions?: boolean;
  streaming?: boolean;
}

// ============================================
// Project / Worktree types
// ============================================

export interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  worktreeCopyPaths?: string[];
}

export interface WorktreePRInfo {
  number: number;
  title: string;
  url: string;
  status: "open" | "closed" | "merged";
  ciStatus?: "pending" | "success" | "failure";
  reviewStatus?: "pending" | "approved" | "changes_requested";
}

export interface WorktreeFileChange {
  path: string;
  status: "M" | "A" | "D" | "R" | "?" | "U";
}

export interface WorktreeCommit {
  hash: string;
  message: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  ahead: number;
  behind: number;
  pr?: WorktreePRInfo;
  staged?: WorktreeFileChange[];
  unstaged?: WorktreeFileChange[];
  unpushed?: WorktreeCommit[];
}

export interface ProjectWithWorktrees extends ProjectConfig {
  worktrees: WorktreeInfo[];
}

// ============================================
// Chat message types (for UI rendering)
// ============================================

export type ChatMessageRole = "user" | "assistant";

export interface ChatAttachment {
  /** Original file name */
  filename: string;
  /** MIME type (e.g. "image/png", "text/markdown") */
  mediaType: string;
  /** Base64-encoded file content */
  data: string;
}

export interface ChatUserMessage {
  role: "user";
  content: string;
  timestamp: number;
  attachments?: ChatAttachment[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: string;
  isError?: boolean;
}

export type AssistantContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolCall: ToolCallInfo };

export interface ChatAssistantMessage {
  role: "assistant";
  text: string;
  toolCalls: ToolCallInfo[];
  contentBlocks: AssistantContentBlock[];
  thinking?: string;
  isStreaming: boolean;
  timestamp?: number;
}

export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

export type ChatSessionState = "idle" | "streaming" | "awaiting_permission";

// ============================================
// Session metadata (context stats)
// ============================================

export interface SessionMeta {
  model?: string;
  permissionMode?: string;
  contextTokens?: number;
  contextWindow?: number;
  costUsd?: number;
  activeShells?: number;
  activeAgents?: number;
  compactions?: number;
}

// ============================================
// Permission types
// ============================================

export interface PermissionRequest {
  requestId: string;
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
  model?: string;
}

export interface SessionCloseMessage {
  type: "session.close";
  sessionId: string;
}

export interface ChatSendMessage {
  type: "chat.send";
  sessionId: string;
  text: string;
  attachments?: ChatAttachment[];
}

export interface ChatInterruptMessage {
  type: "chat.interrupt";
  sessionId: string;
}

export interface ChatPermissionMessage {
  type: "chat.permission";
  sessionId: string;
  requestId: string;
  toolUseId: string;
  allow: boolean;
}

export interface ChatModelMessage {
  type: "chat.model";
  sessionId: string;
  model: string;
}

export interface ChatSkipPermissionsMessage {
  type: "chat.skipPermissions";
  sessionId: string;
  skip: boolean;
}

export interface ChatEffortMessage {
  type: "chat.effort";
  sessionId: string;
  effort: EffortLevel;
}

export interface ChatStreamingMessage {
  type: "chat.streaming";
  sessionId: string;
  streaming: boolean;
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
  source:
    | { type: "new-branch"; name: string; base: string }
    | { type: "existing-branch"; name: string }
    | { type: "pr"; number: number };
  copyFromPath: string;
  copyPaths: string[];
  saveCopyConfig: boolean;
}

export interface WorktreeRemoveMessage {
  type: "worktree.remove";
  projectId: string;
  worktreePath: string;
}

export interface WorktreePullMessage {
  type: "worktree.pull";
  worktreePath: string;
}

export interface WorktreePushMessage {
  type: "worktree.push";
  worktreePath: string;
}

export interface WorktreeListBranchesMessage {
  type: "worktree.listBranches";
  projectId: string;
}

export interface WorktreeSearchPRsMessage {
  type: "worktree.searchPRs";
  projectId: string;
  query: string;
}

export interface WorktreeScanCopyPathsMessage {
  type: "worktree.scanCopyPaths";
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

export interface DebugListProcessesMessage {
  type: "debug.listProcesses";
}

export interface DebugKillProcessMessage {
  type: "debug.killProcess";
  pid: number;
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionCloseMessage
  | ChatSendMessage
  | ChatInterruptMessage
  | ChatPermissionMessage
  | ChatModelMessage
  | ChatSkipPermissionsMessage
  | ChatEffortMessage
  | ChatStreamingMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | ProjectAddMessage
  | ProjectRemoveMessage
  | WorktreeCreateMessage
  | WorktreeRemoveMessage
  | WorktreePullMessage
  | WorktreePushMessage
  | WorktreeListBranchesMessage
  | WorktreeSearchPRsMessage
  | WorktreeScanCopyPathsMessage
  | ProjectListMessage
  | DialogPickFolderMessage
  | SessionListMessage
  | DebugListProcessesMessage
  | DebugKillProcessMessage;

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

export interface SessionRenamedEvent {
  type: "session.renamed";
  sessionId: string;
  name: string;
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
  slashCommands: Record<string, string[]>;
  sessionMetas: Record<string, SessionMeta>;
  sessionStates?: Record<string, ChatSessionState>;
  pendingPermissions?: Record<string, PermissionRequest>;
}

export interface ChatSlashCommandsEvent {
  type: "chat.slash_commands";
  sessionId: string;
  commands: string[];
}

export interface SessionMetaEvent {
  type: "session.meta";
  sessionId: string;
  meta: SessionMeta;
}

export interface ClaudeProcessInfo {
  pid: number;
  cwd: string;
  sessionId?: string;
  uptime: number;
}

export interface DebugProcessListEvent {
  type: "debug.processList";
  processes: ClaudeProcessInfo[];
}

export interface ServerErrorEvent {
  type: "error";
  message: string;
  requestType?: string;
}

export interface BranchInfo {
  name: string;
  lastCommitDate: string;
  author: string;
}

export interface PRSearchResult {
  number: number;
  title: string;
  author: string;
  headBranch: string;
  status: "open" | "closed" | "merged";
}

export interface WorktreeStatusEvent {
  type: "worktree.status";
  projectId: string;
  worktrees: WorktreeInfo[];
}

export interface WorktreeBranchListEvent {
  type: "worktree.branchList";
  projectId: string;
  branches: BranchInfo[];
}

export interface WorktreePRListEvent {
  type: "worktree.prList";
  projectId: string;
  prs: PRSearchResult[];
}

export interface WorktreeCopyPathsEvent {
  type: "worktree.copyPaths";
  worktreePath: string;
  paths: string[];
}

export interface WorktreeOperationResultEvent {
  type: "worktree.operationResult";
  operation: "pull" | "push" | "create" | "remove";
  success: boolean;
  message?: string;
}

export type ServerMessage =
  | SessionCreatedEvent
  | SessionClosedEvent
  | SessionRenamedEvent
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
  | ChatSlashCommandsEvent
  | SessionMetaEvent
  | SessionListEvent
  | DebugProcessListEvent
  | ServerErrorEvent
  | WorktreeStatusEvent
  | WorktreeBranchListEvent
  | WorktreePRListEvent
  | WorktreeCopyPathsEvent
  | WorktreeOperationResultEvent;
