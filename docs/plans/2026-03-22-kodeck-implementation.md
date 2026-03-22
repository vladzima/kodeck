# kodeck Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based multi-project multi-worktree Claude Code client with IDE-style layout, chat sessions, and embedded terminals.

**Architecture:** Monorepo with three packages — `packages/shared` (protocol types), `apps/server` (Node.js WebSocket backend managing claude CLI + PTY processes), `apps/client` (React SPA with chat UI + xterm.js terminals). Client connects to server via WebSocket on localhost.

**Tech Stack:** React 19, Vite+, Tailwind CSS v4, shadcn/ui (radix-nova), Zustand, xterm.js, node-pty, ws (WebSocket), Geist font

---

## Phase 1: Foundation — Shared Protocol Types

### Task 1.1: Create packages/shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vite.config.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@kodeck/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "lib": ["ES2023"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src"]
}
```

**Step 3: Create vite.config.ts**

```ts
import { defineConfig } from "vite-plus";
export default defineConfig({});
```

**Step 4: Create src/index.ts with all protocol types**

```ts
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
  | ProjectListMessage;

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
  | ServerErrorEvent;
```

**Step 5: Install dependencies**

Run: `cd /Users/vladvarbatov/Projects/kodeck && vp install`

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared protocol types package"
```

---

## Phase 2: Server Foundation

### Task 2.1: Create apps/server package skeleton

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/config.ts`

**Step 1: Create package.json**

```json
{
  "name": "@kodeck/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --import tsx/esm src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@kodeck/shared": "workspace:*",
    "ws": "^8.18.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/ws": "^8.18.0",
    "tsx": "^4.19.0",
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2023"],
    "skipLibCheck": true,
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src"]
}
```

**Step 3: Create src/config.ts — project config persistence**

```ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "@kodeck/shared";

const CONFIG_DIR = join(homedir(), ".kodeck");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface KodeckConfig {
  projects: ProjectConfig[];
}

function defaultConfig(): KodeckConfig {
  return { projects: [] };
}

export async function loadConfig(): Promise<KodeckConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as KodeckConfig;
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: KodeckConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}
```

**Step 4: Create src/index.ts — server entry point (minimal)**

```ts
import { WebSocketServer } from "ws";

const PORT = Number(process.env.KODECK_PORT) || 3001;

const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`kodeck server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("client connected");
  ws.on("close", () => console.log("client disconnected"));
});
```

**Step 5: Install dependencies**

Run: `cd /Users/vladvarbatov/Projects/kodeck && vp install`

**Step 6: Test the server starts**

Run: `cd /Users/vladvarbatov/Projects/kodeck/apps/server && timeout 3 node --import tsx/esm src/index.ts || true`
Expected: "kodeck server listening on ws://localhost:3001"

**Step 7: Commit**

```bash
git add apps/server/
git commit -m "feat: add server package with WebSocket skeleton"
```

### Task 2.2: Server — project & worktree management

**Files:**
- Create: `apps/server/src/projects.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Create src/projects.ts**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ProjectConfig,
  ProjectWithWorktrees,
  WorktreeInfo,
} from "@kodeck/shared";
import { loadConfig, saveConfig } from "./config.ts";

const execFileAsync = promisify(execFile);

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const { stdout } = await execFileAsync("git", [
    "-C", repoPath, "worktree", "list", "--porcelain",
  ]);

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice(9);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.branch = "(bare)";
    } else if (line === "") {
      if (current.path && current.branch) {
        worktrees.push({
          path: current.path,
          branch: current.branch,
          isMain: worktrees.length === 0,
        });
      }
      current = {};
    }
  }

  return worktrees;
}

export async function getProjects(): Promise<ProjectWithWorktrees[]> {
  const config = await loadConfig();
  const results: ProjectWithWorktrees[] = [];

  for (const project of config.projects) {
    try {
      const worktrees = await listWorktrees(project.repoPath);
      results.push({ ...project, worktrees });
    } catch {
      results.push({ ...project, worktrees: [] });
    }
  }

  return results;
}

export async function addProject(
  repoPath: string,
  name?: string,
): Promise<ProjectConfig> {
  const config = await loadConfig();
  const project: ProjectConfig = {
    id: randomUUID(),
    name: name ?? basename(repoPath),
    repoPath,
  };
  config.projects.push(project);
  await saveConfig(config);
  return project;
}

export async function removeProject(projectId: string): Promise<void> {
  const config = await loadConfig();
  config.projects = config.projects.filter((p) => p.id !== projectId);
  await saveConfig(config);
}

export async function createWorktree(
  repoPath: string,
  branch: string,
  targetPath?: string,
): Promise<WorktreeInfo> {
  const path = targetPath ?? `${repoPath}-${branch}`;
  await execFileAsync("git", [
    "-C", repoPath, "worktree", "add", path, "-b", branch,
  ]);
  return { path, branch, isMain: false };
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  await execFileAsync("git", [
    "-C", repoPath, "worktree", "remove", worktreePath,
  ]);
}
```

**Step 2: Commit**

```bash
git add apps/server/src/projects.ts
git commit -m "feat: add project and worktree management"
```

### Task 2.3: Server — Claude Code session manager

**Files:**
- Create: `apps/server/src/claude-session.ts`

**Step 1: Create src/claude-session.ts**

This manages spawning `claude` CLI processes and parsing their stream-json output.

```ts
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import type {
  SessionInfo,
  ChatSessionState,
  ToolCallInfo,
  PermissionRequest,
} from "@kodeck/shared";

export interface ClaudeSessionEvents {
  text: (messageId: string, text: string) => void;
  thinking: (messageId: string, thinking: string) => void;
  tool_call: (messageId: string, toolCall: ToolCallInfo) => void;
  tool_result: (toolUseId: string, result: string, isError: boolean) => void;
  permission_request: (permission: PermissionRequest) => void;
  state: (state: ChatSessionState) => void;
  end: (messageId: string) => void;
  error: (error: string) => void;
  exit: () => void;
}

export class ClaudeSession extends EventEmitter<ClaudeSessionEvents> {
  readonly info: SessionInfo;
  private process: ChildProcess | null = null;
  private currentMessageId: string = "";
  private state: ChatSessionState = "idle";

  constructor(worktreePath: string, name?: string) {
    super();
    this.info = {
      id: randomUUID(),
      type: "chat",
      worktreePath,
      name: name ?? "Chat",
      createdAt: Date.now(),
    };
  }

  start(): void {
    this.process = spawn("claude", [
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ], {
      cwd: this.info.worktreePath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => this.handleLine(line));

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[claude:${this.info.id}] stderr:`, data.toString());
    });

    this.process.on("exit", () => {
      this.process = null;
      this.emit("exit");
    });

    this.process.on("error", (err) => {
      this.emit("error", err.message);
    });
  }

  send(text: string): void {
    if (!this.process?.stdin?.writable) {
      this.emit("error", "Session not running");
      return;
    }
    const msg = JSON.stringify({
      type: "user",
      message: { role: "user", content: text },
    });
    this.process.stdin.write(msg + "\n");
    this.setState("streaming");
  }

  interrupt(): void {
    if (this.process) {
      this.process.kill("SIGINT");
      this.setState("idle");
    }
  }

  close(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  private setState(state: ChatSessionState): void {
    this.state = state;
    this.emit("state", state);
  }

  private handleLine(line: string): void {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    const type = event.type as string;

    switch (type) {
      case "system":
        // system/init — session initialized, ignore for now
        break;

      case "assistant":
        this.handleAssistant(event);
        break;

      case "user":
        this.handleUserEvent(event);
        break;

      case "result":
        this.setState("idle");
        if (this.currentMessageId) {
          this.emit("end", this.currentMessageId);
        }
        break;

      case "rate_limit_event":
        // ignore
        break;
    }
  }

  private handleAssistant(event: Record<string, unknown>): void {
    const message = event.message as Record<string, unknown>;
    const messageId = (message.id as string) ?? randomUUID();
    this.currentMessageId = messageId;

    const content = message.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      switch (block.type) {
        case "text":
          this.emit("text", messageId, block.text as string);
          break;

        case "thinking":
          this.emit("thinking", messageId, block.thinking as string);
          break;

        case "tool_use":
          this.emit("tool_call", messageId, {
            id: block.id as string,
            name: block.name as string,
            input: block.input as Record<string, unknown>,
            status: "running",
          });
          break;
      }
    }
  }

  private handleUserEvent(event: Record<string, unknown>): void {
    const message = event.message as Record<string, unknown>;
    const content = message.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (block.type === "tool_result") {
        this.emit(
          "tool_result",
          block.tool_use_id as string,
          (block.content as string) ?? "",
          (block.is_error as boolean) ?? false,
        );
      }
    }

    const toolResult = event.tool_use_result as Record<string, unknown> | undefined;
    if (toolResult) {
      // Additional structured result info available via toolResult.stdout, etc.
    }
  }
}
```

**Step 2: Commit**

```bash
git add apps/server/src/claude-session.ts
git commit -m "feat: add Claude Code session manager with stream-json parsing"
```

### Task 2.4: Server — terminal session manager

**Files:**
- Create: `apps/server/src/terminal-session.ts`

**Step 1: Create src/terminal-session.ts**

```ts
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { SessionInfo } from "@kodeck/shared";

// node-pty is a native module, dynamic import for safety
let ptyModule: typeof import("node-pty");

async function getPty() {
  if (!ptyModule) {
    ptyModule = await import("node-pty");
  }
  return ptyModule;
}

export interface TerminalSessionEvents {
  output: (data: string) => void;
  exit: (exitCode: number) => void;
}

export class TerminalSession extends EventEmitter<TerminalSessionEvents> {
  readonly info: SessionInfo;
  private pty: import("node-pty").IPty | null = null;
  private outputBuffer: string = "";
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_INTERVAL = 16; // ~1 frame

  constructor(worktreePath: string, name?: string) {
    super();
    this.info = {
      id: randomUUID(),
      type: "terminal",
      worktreePath,
      name: name ?? "Terminal",
      createdAt: Date.now(),
    };
  }

  async start(): Promise<void> {
    const pty = await getPty();
    const shell = process.env.SHELL || "zsh";

    this.pty = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: this.info.worktreePath,
      env: process.env as Record<string, string>,
    });

    this.pty.onData((data) => {
      this.outputBuffer += data;
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.emit("output", this.outputBuffer);
          this.outputBuffer = "";
          this.flushTimer = null;
        }, this.BATCH_INTERVAL);
      }
    });

    this.pty.onExit(({ exitCode }) => {
      this.emit("exit", exitCode);
    });
  }

  write(data: string): void {
    this.pty?.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty?.resize(cols, rows);
  }

  close(): void {
    this.pty?.kill();
    this.pty = null;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
```

**Step 2: Commit**

```bash
git add apps/server/src/terminal-session.ts
git commit -m "feat: add terminal session manager with PTY and output batching"
```

### Task 2.5: Server — WebSocket message router

**Files:**
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/router.ts`

**Step 1: Create src/router.ts — routes client messages to session managers**

```ts
import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@kodeck/shared";
import { ClaudeSession } from "./claude-session.ts";
import { TerminalSession } from "./terminal-session.ts";
import {
  getProjects,
  addProject,
  removeProject,
  createWorktree,
  removeWorktree,
} from "./projects.ts";

const sessions = new Map<string, ClaudeSession | TerminalSession>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export async function handleMessage(
  ws: WebSocket,
  raw: string,
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  switch (msg.type) {
    case "session.create":
      await handleSessionCreate(ws, msg);
      break;
    case "session.close":
      handleSessionClose(ws, msg.sessionId);
      break;
    case "chat.send":
      handleChatSend(ws, msg.sessionId, msg.text);
      break;
    case "chat.interrupt":
      handleChatInterrupt(msg.sessionId);
      break;
    case "terminal.input":
      handleTerminalInput(msg.sessionId, msg.data);
      break;
    case "terminal.resize":
      handleTerminalResize(msg.sessionId, msg.cols, msg.rows);
      break;
    case "project.add":
      await handleProjectAdd(ws, msg.repoPath, msg.name);
      break;
    case "project.remove":
      await handleProjectRemove(ws, msg.projectId);
      break;
    case "worktree.create":
      await handleWorktreeCreate(ws, msg.projectId, msg.branch, msg.path);
      break;
    case "worktree.remove":
      await handleWorktreeRemove(ws, msg.projectId, msg.worktreePath);
      break;
    case "project.list":
      await handleProjectList(ws);
      break;
    default:
      send(ws, {
        type: "error",
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
  }
}

async function handleSessionCreate(
  ws: WebSocket,
  msg: { worktreePath: string; sessionType: "chat" | "terminal"; name?: string },
): Promise<void> {
  if (msg.sessionType === "chat") {
    const session = new ClaudeSession(msg.worktreePath, msg.name);

    session.on("text", (messageId, text) => {
      send(ws, { type: "chat.text", sessionId: session.info.id, text, messageId });
    });
    session.on("thinking", (messageId, thinking) => {
      send(ws, { type: "chat.thinking", sessionId: session.info.id, thinking, messageId });
    });
    session.on("tool_call", (messageId, toolCall) => {
      send(ws, { type: "chat.tool_call", sessionId: session.info.id, toolCall, messageId });
    });
    session.on("tool_result", (toolUseId, result, isError) => {
      send(ws, { type: "chat.tool_result", sessionId: session.info.id, toolUseId, result, isError });
    });
    session.on("state", (state) => {
      send(ws, { type: "chat.state", sessionId: session.info.id, state });
    });
    session.on("end", (messageId) => {
      send(ws, { type: "chat.end", sessionId: session.info.id, messageId });
    });
    session.on("error", (error) => {
      send(ws, { type: "chat.error", sessionId: session.info.id, error });
    });
    session.on("exit", () => {
      sessions.delete(session.info.id);
      send(ws, { type: "session.closed", sessionId: session.info.id });
    });

    session.start();
    sessions.set(session.info.id, session);
    send(ws, { type: "session.created", session: session.info });
  } else {
    const session = new TerminalSession(msg.worktreePath, msg.name);

    session.on("output", (data) => {
      send(ws, { type: "terminal.output", sessionId: session.info.id, data });
    });
    session.on("exit", (exitCode) => {
      sessions.delete(session.info.id);
      send(ws, { type: "terminal.exit", sessionId: session.info.id, exitCode });
    });

    await session.start();
    sessions.set(session.info.id, session);
    send(ws, { type: "session.created", session: session.info });
  }
}

function handleSessionClose(ws: WebSocket, sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.close();
    sessions.delete(sessionId);
    send(ws, { type: "session.closed", sessionId });
  }
}

function handleChatSend(
  ws: WebSocket,
  sessionId: string,
  text: string,
): void {
  const session = sessions.get(sessionId);
  if (session instanceof ClaudeSession) {
    session.send(text);
  } else {
    send(ws, { type: "error", message: "Not a chat session", requestType: "chat.send" });
  }
}

function handleChatInterrupt(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session instanceof ClaudeSession) {
    session.interrupt();
  }
}

function handleTerminalInput(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (session instanceof TerminalSession) {
    session.write(data);
  }
}

function handleTerminalResize(
  sessionId: string,
  cols: number,
  rows: number,
): void {
  const session = sessions.get(sessionId);
  if (session instanceof TerminalSession) {
    session.resize(cols, rows);
  }
}

async function handleProjectAdd(
  ws: WebSocket,
  repoPath: string,
  name?: string,
): Promise<void> {
  await addProject(repoPath, name);
  await handleProjectList(ws);
}

async function handleProjectRemove(
  ws: WebSocket,
  projectId: string,
): Promise<void> {
  await removeProject(projectId);
  await handleProjectList(ws);
}

async function handleWorktreeCreate(
  ws: WebSocket,
  projectId: string,
  branch: string,
  path?: string,
): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    await createWorktree(project.repoPath, branch, path);
    await handleProjectList(ws);
  }
}

async function handleWorktreeRemove(
  ws: WebSocket,
  projectId: string,
  worktreePath: string,
): Promise<void> {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    await removeWorktree(project.repoPath, worktreePath);
    await handleProjectList(ws);
  }
}

async function handleProjectList(ws: WebSocket): Promise<void> {
  const projects = await getProjects();
  send(ws, { type: "project.list", projects });
}

export function cleanupAllSessions(): void {
  for (const session of sessions.values()) {
    session.close();
  }
  sessions.clear();
}
```

**Step 2: Update src/index.ts to use router**

```ts
import { WebSocketServer } from "ws";
import { handleMessage, cleanupAllSessions } from "./router.ts";

const PORT = Number(process.env.KODECK_PORT) || 3001;

const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`kodeck server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("client connected");

  ws.on("message", (data) => {
    handleMessage(ws, data.toString()).catch((err) => {
      console.error("Error handling message:", err);
    });
  });

  ws.on("close", () => {
    console.log("client disconnected");
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  cleanupAllSessions();
  wss.close();
  process.exit(0);
});
```

**Step 3: Commit**

```bash
git add apps/server/src/
git commit -m "feat: add WebSocket message router wiring sessions to handlers"
```

---

## Phase 3: Client — React Setup & Shell

### Task 3.1: Convert client to React

**Files:**
- Modify: `apps/client/package.json` — add react, react-dom, zustand, @xterm/xterm, @xterm/addon-fit
- Modify: `apps/client/tsconfig.json` — add jsx config
- Modify: `apps/client/vite.config.ts` — add react plugin
- Modify: `apps/client/index.html` — clean up title
- Delete: `apps/client/src/counter.ts`
- Delete: `apps/client/src/assets/hero.png`, `apps/client/src/assets/typescript.svg`, `apps/client/src/assets/vite.svg`
- Rewrite: `apps/client/src/main.ts` → `apps/client/src/main.tsx`
- Rewrite: `apps/client/src/style.css` — keep shadcn theme tokens, remove template styles
- Create: `apps/client/src/app.tsx`

**Step 1: Add dependencies**

Run:
```bash
cd /Users/vladvarbatov/Projects/kodeck
vp add -F client react react-dom zustand @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
vp add -F client -D @types/react @types/react-dom @vitejs/plugin-react
```

**Step 2: Update tsconfig.json — add JSX support**

Add to compilerOptions:
```json
"jsx": "react-jsx"
```

**Step 3: Update vite.config.ts — add React plugin**

```ts
import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
```

**Step 4: Update index.html title**

Change `<title>website</title>` to `<title>kodeck</title>`

**Step 5: Delete template files**

```bash
rm apps/client/src/counter.ts apps/client/src/assets/hero.png apps/client/src/assets/typescript.svg apps/client/src/assets/vite.svg
```

**Step 6: Rewrite style.css — keep only shadcn theme + base reset**

Keep everything from `@import "tailwindcss"` through the `@theme inline` block and the `.dark` class and `@layer base`. Remove all the template-specific styles (h1, h2, p, code, .counter, .hero, #app, #center, #next-steps, #docs, #social, #spacer, .ticks sections).

**Step 7: Rename main.ts to main.tsx and rewrite**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import "./style.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 8: Create src/app.tsx**

```tsx
export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="w-60 border-r border-border bg-sidebar p-4 text-sidebar-foreground">
        Sidebar
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-10 border-b border-border px-2 flex items-center gap-1">
          Tabs
        </div>
        <div className="flex-1 overflow-hidden">
          Main
        </div>
      </div>
    </div>
  );
}
```

**Step 9: Update index.html script src**

Change `src="/src/main.ts"` to `src="/src/main.tsx"`

**Step 10: Run lint/check**

Run: `cd /Users/vladvarbatov/Projects/kodeck && vp check`

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: convert client to React with IDE shell layout"
```

### Task 3.2: Client — Zustand store

**Files:**
- Create: `apps/client/src/store.ts`

**Step 1: Create the store**

```ts
import { create } from "zustand";
import type {
  ProjectWithWorktrees,
  SessionInfo,
  ChatMessage,
  ChatSessionState,
} from "@kodeck/shared";

interface ChatSessionData {
  messages: ChatMessage[];
  state: ChatSessionState;
  inputHistory: string[];
}

interface TerminalSessionData {
  // Terminal state is managed by xterm.js, we only track metadata here
}

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Projects
  projects: ProjectWithWorktrees[];
  setProjects: (projects: ProjectWithWorktrees[]) => void;

  // Selection
  selectedWorktreePath: string | null;
  selectWorktree: (path: string) => void;

  // Sessions
  sessions: SessionInfo[];
  activeSessionId: string | null;
  addSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;

  // Chat data (per session)
  chatData: Map<string, ChatSessionData>;
  appendChatText: (sessionId: string, messageId: string, text: string) => void;
  appendToolCall: (
    sessionId: string,
    messageId: string,
    toolCall: { id: string; name: string; input: Record<string, unknown>; status: "running" | "done" | "error" },
  ) => void;
  updateToolResult: (
    sessionId: string,
    toolUseId: string,
    result: string,
    isError: boolean,
  ) => void;
  addUserMessage: (sessionId: string, text: string) => void;
  setChatState: (sessionId: string, state: ChatSessionState) => void;
  finishAssistantMessage: (sessionId: string, messageId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  projects: [],
  setProjects: (projects) => set({ projects }),

  selectedWorktreePath: null,
  selectWorktree: (path) => set({ selectedWorktreePath: path }),

  sessions: [],
  activeSessionId: null,
  addSession: (session) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      if (session.type === "chat") {
        chatData.set(session.id, { messages: [], state: "idle", inputHistory: [] });
      }
      return {
        sessions: [...s.sessions, session],
        activeSessionId: session.id,
        chatData,
      };
    }),
  removeSession: (sessionId) =>
    set((s) => {
      const sessions = s.sessions.filter((ses) => ses.id !== sessionId);
      const chatData = new Map(s.chatData);
      chatData.delete(sessionId);
      return {
        sessions,
        chatData,
        activeSessionId:
          s.activeSessionId === sessionId
            ? (sessions[sessions.length - 1]?.id ?? null)
            : s.activeSessionId,
      };
    }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  chatData: new Map(),

  appendChatText: (sessionId, messageId, text) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;

      const messages = [...data.messages];
      const last = messages[messages.length - 1];

      if (last && last.role === "assistant" && last.isStreaming) {
        messages[messages.length - 1] = { ...last, text };
      } else {
        messages.push({
          role: "assistant",
          text,
          toolCalls: [],
          isStreaming: true,
        });
      }

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  appendToolCall: (sessionId, _messageId, toolCall) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;

      const messages = [...data.messages];
      const last = messages[messages.length - 1];

      if (last && last.role === "assistant" && last.isStreaming) {
        const existing = last.toolCalls.find((tc) => tc.id === toolCall.id);
        if (!existing) {
          messages[messages.length - 1] = {
            ...last,
            toolCalls: [...last.toolCalls, toolCall],
          };
        }
      }

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  updateToolResult: (sessionId, toolUseId, result, isError) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;

      const messages = data.messages.map((msg) => {
        if (msg.role !== "assistant") return msg;
        const toolCalls = msg.toolCalls.map((tc) =>
          tc.id === toolUseId
            ? { ...tc, result, isError, status: isError ? "error" as const : "done" as const }
            : tc,
        );
        return { ...msg, toolCalls };
      });

      chatData.set(sessionId, { ...data, messages });
      return { chatData };
    }),

  addUserMessage: (sessionId, text) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;

      const messages = [
        ...data.messages,
        { role: "user" as const, content: text, timestamp: Date.now() },
      ];
      const inputHistory = [...data.inputHistory, text];

      chatData.set(sessionId, { ...data, messages, inputHistory });
      return { chatData };
    }),

  setChatState: (sessionId, state) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;
      chatData.set(sessionId, { ...data, state });
      return { chatData };
    }),

  finishAssistantMessage: (sessionId, _messageId) =>
    set((s) => {
      const chatData = new Map(s.chatData);
      const data = chatData.get(sessionId);
      if (!data) return s;

      const messages = data.messages.map((msg) =>
        msg.role === "assistant" && msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg,
      );

      chatData.set(sessionId, { ...data, messages, state: "idle" });
      return { chatData };
    }),
}));
```

**Step 2: Commit**

```bash
git add apps/client/src/store.ts
git commit -m "feat: add Zustand store for app state management"
```

### Task 3.3: Client — WebSocket connection hook

**Files:**
- Create: `apps/client/src/hooks/use-websocket.ts`

**Step 1: Create the WebSocket hook**

```ts
import { useEffect, useRef, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@kodeck/shared";
import { useAppStore } from "../store.ts";

let wsInstance: WebSocket | null = null;

export function sendMessage(msg: ClientMessage): void {
  if (wsInstance?.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(msg));
  }
}

export function useWebSocket(): void {
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const {
    setConnected,
    setProjects,
    addSession,
    removeSession,
    appendChatText,
    appendToolCall,
    updateToolResult,
    setChatState,
    finishAssistantMessage,
  } = useAppStore();

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;

      switch (msg.type) {
        case "session.created":
          addSession(msg.session);
          break;
        case "session.closed":
          removeSession(msg.sessionId);
          break;
        case "chat.text":
          appendChatText(msg.sessionId, msg.messageId, msg.text);
          break;
        case "chat.tool_call":
          appendToolCall(msg.sessionId, msg.messageId, msg.toolCall);
          break;
        case "chat.tool_result":
          updateToolResult(msg.sessionId, msg.toolUseId, msg.result, msg.isError);
          break;
        case "chat.state":
          setChatState(msg.sessionId, msg.state);
          break;
        case "chat.end":
          finishAssistantMessage(msg.sessionId, msg.messageId);
          break;
        case "terminal.output":
          // Handled directly by terminal components via event
          window.dispatchEvent(
            new CustomEvent("kodeck:terminal-output", {
              detail: { sessionId: msg.sessionId, data: msg.data },
            }),
          );
          break;
        case "terminal.exit":
          removeSession(msg.sessionId);
          break;
        case "project.list":
          setProjects(msg.projects);
          break;
        case "error":
          console.error("Server error:", msg.message);
          break;
      }
    },
    [
      setProjects,
      addSession,
      removeSession,
      appendChatText,
      appendToolCall,
      updateToolResult,
      setChatState,
      finishAssistantMessage,
    ],
  );

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setConnected(true);
      wsInstance = ws;
      // Request initial project list
      sendMessage({ type: "project.list" });
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setConnected(false);
      wsInstance = null;
      // Reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setConnected, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsInstance?.close();
      wsInstance = null;
    };
  }, [connect]);
}
```

**Step 2: Commit**

```bash
git add apps/client/src/hooks/
git commit -m "feat: add WebSocket connection hook with auto-reconnect"
```

---

## Phase 4: Client — UI Components

### Task 4.1: Sidebar — project tree

**Files:**
- Create: `apps/client/src/components/sidebar.tsx`

**Step 1: Install shadcn components needed**

Run:
```bash
cd /Users/vladvarbatov/Projects/kodeck/apps/client
vp dlx shadcn@latest add button scroll-area separator tooltip
```

**Step 2: Create sidebar component**

```tsx
import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  GitBranch,
  FolderGit2,
  Plus,
} from "lucide-react";
import type { ProjectWithWorktrees, WorktreeInfo } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";

function WorktreeItem({
  worktree,
  isSelected,
  onSelect,
}: {
  worktree: WorktreeInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
        isSelected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
      }`}
      onClick={onSelect}
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{worktree.branch}</span>
    </button>
  );
}

function ProjectItem({ project }: { project: ProjectWithWorktrees }) {
  const [expanded, setExpanded] = useState(true);
  const { selectedWorktreePath, selectWorktree } = useAppStore();

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{project.name}</span>
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {project.worktrees.map((wt) => (
            <WorktreeItem
              key={wt.path}
              worktree={wt}
              isSelected={selectedWorktreePath === wt.path}
              onSelect={() => selectWorktree(wt.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { projects } = useAppStore();

  const handleAddProject = () => {
    const path = window.prompt("Enter the path to a git repository:");
    if (path) {
      sendMessage({ type: "project.add", repoPath: path });
    }
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2">
        <span className="text-sm font-semibold text-sidebar-foreground">
          Projects
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </div>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70"
          onClick={handleAddProject}
        >
          <Plus className="h-4 w-4" />
          Add project
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/client/src/components/
git commit -m "feat: add sidebar component with project/worktree tree view"
```

### Task 4.2: Tab bar

**Files:**
- Create: `apps/client/src/components/tab-bar.tsx`

**Step 1: Create tab bar component**

```tsx
import { MessageSquare, Terminal, Plus, X } from "lucide-react";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";

export function TabBar() {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    selectedWorktreePath,
  } = useAppStore();

  const worktreeSessions = sessions.filter(
    (s) => s.worktreePath === selectedWorktreePath,
  );

  const handleNewSession = (type: "chat" | "terminal") => {
    if (!selectedWorktreePath) return;
    sendMessage({
      type: "session.create",
      worktreePath: selectedWorktreePath,
      sessionType: type,
      name: type === "chat" ? "Chat" : "Terminal",
    });
  };

  const handleCloseSession = (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation();
    sendMessage({ type: "session.close", sessionId });
  };

  return (
    <div className="flex h-10 items-center gap-0.5 border-b border-border bg-background px-1">
      {worktreeSessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className={`group flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors ${
            activeSessionId === session.id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setActiveSession(session.id)}
        >
          {session.type === "chat" ? (
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Terminal className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="max-w-24 truncate">{session.name}</span>
          <button
            type="button"
            className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
            onClick={(e) => handleCloseSession(e, session.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
      <div className="flex items-center gap-0.5 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleNewSession("chat")}
          disabled={!selectedWorktreePath}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleNewSession("terminal")}
          disabled={!selectedWorktreePath}
        >
          <Terminal className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/components/tab-bar.tsx
git commit -m "feat: add tab bar with session tabs and new session buttons"
```

### Task 4.3: Chat message components

**Files:**
- Create: `apps/client/src/components/chat/message-list.tsx`
- Create: `apps/client/src/components/chat/user-message.tsx`
- Create: `apps/client/src/components/chat/assistant-message.tsx`
- Create: `apps/client/src/components/chat/tool-call-card.tsx`

**Step 1: Create user-message.tsx**

```tsx
import type { ChatUserMessage } from "@kodeck/shared";

export function UserMessage({ message }: { message: ChatUserMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
      </div>
    </div>
  );
}
```

**Step 2: Create tool-call-card.tsx**

```tsx
import { useState, memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  TerminalSquare,
  Search,
  Loader2,
  Check,
  XCircle,
} from "lucide-react";
import type { ToolCallInfo } from "@kodeck/shared";

const TOOL_ICONS: Record<string, typeof FileText> = {
  Read: FileText,
  Write: FileText,
  Edit: FileText,
  Bash: TerminalSquare,
  Grep: Search,
  Glob: Search,
};

function toolSummary(tool: ToolCallInfo): string {
  const input = tool.input;
  if (tool.name === "Bash" && input.command) return `$ ${String(input.command).slice(0, 80)}`;
  if (tool.name === "Read" && input.file_path) return String(input.file_path);
  if (tool.name === "Edit" && input.file_path) return `Edit ${String(input.file_path)}`;
  if (tool.name === "Write" && input.file_path) return `Write ${String(input.file_path)}`;
  if (tool.name === "Grep" && input.pattern) return `/${String(input.pattern)}/`;
  if (tool.name === "Glob" && input.pattern) return String(input.pattern);
  return tool.name;
}

export const ToolCallCard = memo(function ToolCallCard({
  toolCall,
}: {
  toolCall: ToolCallInfo;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? FileText;
  const StatusIcon =
    toolCall.status === "running"
      ? Loader2
      : toolCall.status === "error"
        ? XCircle
        : Check;

  return (
    <div className="rounded-md border border-border bg-card text-card-foreground">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-xs">
          {toolSummary(toolCall)}
        </span>
        <StatusIcon
          className={`h-3.5 w-3.5 shrink-0 ${
            toolCall.status === "running"
              ? "animate-spin text-muted-foreground"
              : toolCall.status === "error"
                ? "text-destructive"
                : "text-green-500"
          }`}
        />
      </button>
      {expanded && toolCall.result != null && (
        <div className="border-t border-border px-3 py-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  );
});
```

**Step 3: Create assistant-message.tsx**

```tsx
import type { ChatAssistantMessage } from "@kodeck/shared";
import { ToolCallCard } from "./tool-call-card.tsx";

export function AssistantMessage({
  message,
}: {
  message: ChatAssistantMessage;
}) {
  return (
    <div className="flex flex-col gap-2">
      {message.text && (
        <div className="max-w-[80%] text-sm">
          <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
          {message.isStreaming && (
            <span className="inline-block h-4 w-1.5 animate-pulse bg-foreground" />
          )}
        </div>
      )}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}
```

**Step 4: Create message-list.tsx**

```tsx
import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatMessage } from "@kodeck/shared";
import { UserMessage } from "./user-message.tsx";
import { AssistantMessage } from "./assistant-message.tsx";
import { ScrollArea } from "../ui/scroll-area.tsx";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, autoScroll]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4"
      onScroll={handleScroll}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage key={i} message={msg} />
          ) : (
            <AssistantMessage key={i} message={msg} />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/client/src/components/chat/
git commit -m "feat: add chat message components with tool call cards"
```

### Task 4.4: Chat input area with keybindings

**Files:**
- Create: `apps/client/src/components/chat/chat-input.tsx`

**Step 1: Create chat input with Claude Code keybindings**

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "../ui/button.tsx";
import type { ChatSessionState } from "@kodeck/shared";

interface ChatInputProps {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  state: ChatSessionState;
  inputHistory: string[];
}

export function ChatInput({
  onSend,
  onInterrupt,
  state,
  inputHistory,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndex = useRef(-1);
  const lastEscapeTime = useRef(0);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || state === "streaming") return;
    onSend(trimmed);
    setText("");
    historyIndex.current = -1;
  }, [text, state, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
        return;
      }

      // Escape: double-tap clears, single tap during streaming interrupts
      if (e.key === "Escape") {
        if (state === "streaming") {
          onInterrupt();
          return;
        }
        const now = Date.now();
        if (now - lastEscapeTime.current < 500) {
          setText("");
          lastEscapeTime.current = 0;
        } else {
          lastEscapeTime.current = now;
        }
        return;
      }

      // Up/Down arrow for input history (only when textarea is empty or cursor at start/end)
      if (e.key === "ArrowUp" && inputHistory.length > 0) {
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart === 0) {
          e.preventDefault();
          const newIndex =
            historyIndex.current < inputHistory.length - 1
              ? historyIndex.current + 1
              : historyIndex.current;
          historyIndex.current = newIndex;
          setText(inputHistory[inputHistory.length - 1 - newIndex] ?? "");
        }
        return;
      }

      if (e.key === "ArrowDown" && historyIndex.current >= 0) {
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionEnd === textarea.value.length) {
          e.preventDefault();
          const newIndex = historyIndex.current - 1;
          historyIndex.current = newIndex;
          setText(
            newIndex >= 0
              ? (inputHistory[inputHistory.length - 1 - newIndex] ?? "")
              : "",
          );
        }
      }
    },
    [send, state, onInterrupt, inputHistory],
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [text]);

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {state === "streaming" ? (
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onInterrupt}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={send}
            disabled={!text.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="mx-auto mt-1 max-w-3xl">
        <span className="text-xs text-muted-foreground">
          {state === "streaming"
            ? "Claude is responding... (Esc to stop)"
            : state === "awaiting_permission"
              ? "Waiting for permission..."
              : "Enter to send, Shift+Enter for newline, Esc×2 to clear"}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/components/chat/chat-input.tsx
git commit -m "feat: add chat input with Claude Code keybindings"
```

### Task 4.5: Chat session view (composite)

**Files:**
- Create: `apps/client/src/components/chat/chat-view.tsx`

**Step 1: Create the composite chat view**

```tsx
import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";
import { MessageList } from "./message-list.tsx";
import { ChatInput } from "./chat-input.tsx";

export function ChatView({ sessionId }: { sessionId: string }) {
  const chatData = useAppStore((s) => s.chatData.get(sessionId));
  const addUserMessage = useAppStore((s) => s.addUserMessage);

  if (!chatData) return null;

  const handleSend = (text: string) => {
    addUserMessage(sessionId, text);
    sendMessage({ type: "chat.send", sessionId, text });
  };

  const handleInterrupt = () => {
    sendMessage({ type: "chat.interrupt", sessionId });
  };

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={chatData.messages} />
      <ChatInput
        onSend={handleSend}
        onInterrupt={handleInterrupt}
        state={chatData.state}
        inputHistory={chatData.inputHistory}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/components/chat/chat-view.tsx
git commit -m "feat: add composite chat view component"
```

### Task 4.6: Terminal view

**Files:**
- Create: `apps/client/src/components/terminal/terminal-view.tsx`

**Step 1: Create terminal component wrapping xterm.js**

```tsx
import { useEffect, useRef, memo } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sendMessage } from "../../hooks/use-websocket.ts";
import "@xterm/xterm/css/xterm.css";

export const TerminalView = memo(function TerminalView({
  sessionId,
  isActive,
}: {
  sessionId: string;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: "'GeistMono', 'Geist Mono', ui-monospace, monospace",
      theme: {
        background: "#16171d",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "rgba(255,255,255,0.2)",
      },
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);

    // Try WebGL addon for performance
    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL not supported, fallback to canvas
    }

    fitAddon.fit();

    // Send initial resize
    sendMessage({
      type: "terminal.resize",
      sessionId,
      cols: terminal.cols,
      rows: terminal.rows,
    });

    // Forward input to server
    terminal.onData((data) => {
      sendMessage({ type: "terminal.input", sessionId, data });
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      sendMessage({ type: "terminal.resize", sessionId, cols, rows });
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Listen for output events
    const handleOutput = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent).detail;
      if (sid === sessionId) {
        terminal.write(data);
      }
    };

    window.addEventListener("kodeck:terminal-output", handleOutput);

    return () => {
      window.removeEventListener("kodeck:terminal-output", handleOutput);
      terminal.dispose();
    };
  }, [sessionId]);

  // Handle visibility + resize
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      // Small delay to let layout settle
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
    }
  }, [isActive]);

  // Window resize handling
  useEffect(() => {
    const handleResize = () => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: isActive ? "block" : "none" }}
    />
  );
});
```

**Step 2: Commit**

```bash
git add apps/client/src/components/terminal/
git commit -m "feat: add terminal view with xterm.js, WebGL, and fit addon"
```

### Task 4.7: Main panel — session router

**Files:**
- Create: `apps/client/src/components/main-panel.tsx`

**Step 1: Create main panel that routes to chat or terminal view**

```tsx
import { useAppStore } from "../store.ts";
import { ChatView } from "./chat/chat-view.tsx";
import { TerminalView } from "./terminal/terminal-view.tsx";

export function MainPanel() {
  const { sessions, activeSessionId, selectedWorktreePath } = useAppStore();

  const worktreeSessions = sessions.filter(
    (s) => s.worktreePath === selectedWorktreePath,
  );

  if (!selectedWorktreePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a worktree to get started</p>
      </div>
    );
  }

  if (worktreeSessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">
          Open a new chat or terminal session using the + buttons above
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {worktreeSessions.map((session) => {
        const isActive = session.id === activeSessionId;
        if (session.type === "chat") {
          return (
            <div
              key={session.id}
              className="absolute inset-0"
              style={{ display: isActive ? "flex" : "none" }}
            >
              <ChatView sessionId={session.id} />
            </div>
          );
        }
        return (
          <TerminalView
            key={session.id}
            sessionId={session.id}
            isActive={isActive}
          />
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/components/main-panel.tsx
git commit -m "feat: add main panel routing between chat and terminal views"
```

### Task 4.8: Wire up App component

**Files:**
- Modify: `apps/client/src/app.tsx`

**Step 1: Update app.tsx to use all components**

```tsx
import { useWebSocket } from "./hooks/use-websocket.ts";
import { useAppStore } from "./store.ts";
import { Sidebar } from "./components/sidebar.tsx";
import { TabBar } from "./components/tab-bar.tsx";
import { MainPanel } from "./components/main-panel.tsx";

export function App() {
  useWebSocket();
  const connected = useAppStore((s) => s.connected);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <MainPanel />
        </div>
        {!connected && (
          <div className="border-t border-destructive bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
            Disconnected from server. Reconnecting...
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run lint/check**

Run: `cd /Users/vladvarbatov/Projects/kodeck && vp check`

**Step 3: Commit**

```bash
git add apps/client/src/app.tsx
git commit -m "feat: wire up App with sidebar, tab bar, main panel, and connection status"
```

---

## Phase 5: Integration & Polish

### Task 5.1: Add dev script to run both client and server

**Files:**
- Modify: `package.json` (root)

**Step 1: Update root dev script**

Add a `dev` script that runs both server and client. Since the root package.json already has `"dev": "vp run website#dev"`, change it to:

```json
{
  "scripts": {
    "ready": "vp fmt && vp lint && vp run test -r && vp run build -r",
    "dev": "vp run dev",
    "dev:server": "cd apps/server && node --import tsx/esm src/index.ts",
    "dev:client": "vp run client#dev"
  }
}
```

Also add a `dev` script to the server's `package.json` and add a `concurrently` or similar approach. Alternatively, the simplest approach: open two terminals — one for server, one for client.

For a cleaner DX, update `apps/server/package.json`:
```json
"scripts": {
  "dev": "node --watch --import tsx/esm src/index.ts"
}
```

**Step 2: Commit**

```bash
git add package.json apps/server/package.json
git commit -m "feat: add dev scripts for running server and client"
```

### Task 5.2: Final verification

**Step 1: Run full check**

Run: `cd /Users/vladvarbatov/Projects/kodeck && vp check`

Fix any lint/type errors.

**Step 2: Test server starts**

Run: `cd /Users/vladvarbatov/Projects/kodeck/apps/server && timeout 3 node --import tsx/esm src/index.ts || true`

**Step 3: Test client builds**

Run: `cd /Users/vladvarbatov/Projects/kodeck/apps/client && vp build`

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and type errors"
```

---

## Dependency Summary

### packages/shared
- No runtime dependencies (types only)

### apps/server
- `ws` — WebSocket server
- `node-pty` — PTY management
- `tsx` — dev-time TypeScript execution
- `@kodeck/shared` — protocol types

### apps/client
- `react`, `react-dom` — UI framework
- `zustand` — state management
- `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl` — terminal
- `@tailwindcss/vite`, `tailwindcss` — styling (already present)
- `shadcn`, `radix-ui` — UI components (already present)
- `lucide-react` — icons (already present)
- `@kodeck/shared` — protocol types
- `@vitejs/plugin-react` — Vite React plugin
