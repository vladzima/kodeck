import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import type { WebSocket } from "ws";
import type {
  ClientMessage,
  ServerMessage,
  SessionInfo,
  ChatMessage,
} from "@kodeck/shared";
import { ClaudeSession } from "./claude-session.ts";
import { TerminalSession } from "./terminal-session.ts";
import {
  getProjects,
  addProject,
  removeProject,
  createWorktree,
  removeWorktree,
} from "./projects.ts";
import { loadConfig } from "./config.ts";
import {
  loadPersistedSessions,
  persistSession,
  removePersistedSession,
  updateSessionMessages,
} from "./session-store.ts";

type Session = ClaudeSession | TerminalSession;
const sessions = new Map<string, Session>();
const sessionMessages = new Map<string, ChatMessage[]>();
const sessionInfos = new Map<string, SessionInfo>();

function pickFolder(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (process.platform === "darwin") {
      execFile("osascript", [
        "-e",
        'POSIX path of (choose folder with prompt "Select a project folder")',
      ], (err, stdout) => {
        if (err) {
          // User cancelled or error
          resolve(null);
          return;
        }
        const path = stdout.trim().replace(/\/$/, "");
        resolve(path || null);
      });
    } else if (process.platform === "linux") {
      execFile("zenity", ["--file-selection", "--directory", "--title=Select a project folder"], (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(stdout.trim() || null);
      });
    } else {
      reject(new Error("Folder picker not supported on this platform"));
    }
  });
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function wireClaudeSession(ws: WebSocket, sessionId: string, session: ClaudeSession): void {
  // Initialize message tracking if not already present
  if (!sessionMessages.has(sessionId)) {
    sessionMessages.set(sessionId, []);
  }

  session.on("text", (text, messageId) => {
    send(ws, { type: "chat.text", sessionId, text, messageId });
    // Track message
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.isStreaming) {
      last.text += text;
    } else {
      messages.push({ role: "assistant", text, toolCalls: [], isStreaming: true });
    }
  });
  session.on("thinking", (thinking, messageId) => {
    send(ws, { type: "chat.thinking", sessionId, thinking, messageId });
  });
  session.on("tool_call", (toolCall, messageId) => {
    send(ws, { type: "chat.tool_call", sessionId, toolCall, messageId });
    // Track tool call
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.isStreaming) {
      last.toolCalls.push(toolCall);
    }
  });
  session.on("tool_result", (toolUseId, result, isError) => {
    send(ws, { type: "chat.tool_result", sessionId, toolUseId, result, isError });
    // Track tool result
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant") {
      const tc = last.toolCalls.find((t) => t.id === toolUseId);
      if (tc) {
        tc.result = result;
        tc.isError = isError;
        tc.status = isError ? "error" : "done";
      }
    }
  });
  session.on("permission_request", (permission) => {
    send(ws, { type: "chat.permission_request", sessionId, permission });
  });
  session.on("state", (state) => {
    send(ws, { type: "chat.state", sessionId, state });
  });
  session.on("end", (messageId) => {
    send(ws, { type: "chat.end", sessionId, messageId });
    // Finalize and persist
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant") {
      last.isStreaming = false;
    }
    updateSessionMessages(sessionId, messages).catch(console.error);
  });
  session.on("error", (error) => {
    send(ws, { type: "chat.error", sessionId, error });
  });
  session.on("exit", () => {
    sessions.delete(sessionId);
    send(ws, { type: "session.closed", sessionId });
  });
}

function wireTerminalSession(ws: WebSocket, sessionId: string, session: TerminalSession): void {
  session.on("output", (data) => {
    send(ws, { type: "terminal.output", sessionId, data });
  });
  session.on("exit", (exitCode) => {
    sessions.delete(sessionId);
    send(ws, { type: "terminal.exit", sessionId, exitCode });
    send(ws, { type: "session.closed", sessionId });
  });
}

async function handleSessionCreate(ws: WebSocket, msg: ClientMessage & { type: "session.create" }): Promise<void> {
  console.log(`creating ${msg.sessionType} session in ${msg.worktreePath}`);
  const sessionId = randomUUID();
  const info: SessionInfo = {
    id: sessionId,
    type: msg.sessionType,
    worktreePath: msg.worktreePath,
    name: msg.name ?? (msg.sessionType === "chat" ? "Chat" : "Terminal"),
    createdAt: Date.now(),
  };

  if (msg.sessionType === "chat") {
    const session = new ClaudeSession();
    sessions.set(sessionId, session);
    wireClaudeSession(ws, sessionId, session);
    session.spawn(msg.worktreePath);
    // Persist chat session
    sessionInfos.set(sessionId, info);
    persistSession(info).catch(console.error);
  } else {
    const session = new TerminalSession();
    sessions.set(sessionId, session);
    wireTerminalSession(ws, sessionId, session);
    await session.spawn(msg.worktreePath);
    // Don't persist terminal sessions — they're ephemeral
  }

  send(ws, { type: "session.created", session: info });
}

export async function handleMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  try {
    switch (msg.type) {
      case "session.create": {
        await handleSessionCreate(ws, msg);
        break;
      }

      case "session.close": {
        const session = sessions.get(msg.sessionId);
        if (session) {
          session.close();
          sessions.delete(msg.sessionId);
        }
        // Clean up persistence for chat sessions
        sessionInfos.delete(msg.sessionId);
        sessionMessages.delete(msg.sessionId);
        removePersistedSession(msg.sessionId).catch(console.error);
        send(ws, { type: "session.closed", sessionId: msg.sessionId });
        break;
      }

      case "chat.send": {
        let session = sessions.get(msg.sessionId);
        if (!session && sessionInfos.has(msg.sessionId)) {
          // Lazy spawn for restored session
          const info = sessionInfos.get(msg.sessionId)!;
          const claude = new ClaudeSession();
          sessions.set(msg.sessionId, claude);
          wireClaudeSession(ws, msg.sessionId, claude);
          claude.spawn(info.worktreePath);
          session = claude;
        }
        if (session instanceof ClaudeSession) {
          // Track user message
          const messages = sessionMessages.get(msg.sessionId) ?? [];
          messages.push({ role: "user", content: msg.text, timestamp: Date.now() });
          sessionMessages.set(msg.sessionId, messages);
          session.send(msg.text);
        }
        break;
      }

      case "chat.interrupt": {
        const session = sessions.get(msg.sessionId);
        if (session instanceof ClaudeSession) {
          session.interrupt();
        }
        break;
      }

      case "chat.permission": {
        // Permission handling will be expanded later
        break;
      }

      case "terminal.input": {
        const session = sessions.get(msg.sessionId);
        if (session instanceof TerminalSession) {
          session.write(msg.data);
        }
        break;
      }

      case "terminal.resize": {
        const session = sessions.get(msg.sessionId);
        if (session instanceof TerminalSession) {
          session.resize(msg.cols, msg.rows);
        }
        break;
      }

      case "project.add": {
        const projects = await addProject(msg.repoPath, msg.name);
        send(ws, { type: "project.list", projects });
        break;
      }

      case "project.remove": {
        const projects = await removeProject(msg.projectId);
        send(ws, { type: "project.list", projects });
        break;
      }

      case "worktree.create": {
        const config = await loadConfig();
        const project = config.projects.find((p) => p.id === msg.projectId);
        if (!project) {
          send(ws, { type: "error", message: "Project not found", requestType: msg.type });
          break;
        }
        await createWorktree(project.repoPath, msg.branch, msg.path);
        const projects = await getProjects();
        send(ws, { type: "project.list", projects });
        break;
      }

      case "worktree.remove": {
        const config = await loadConfig();
        const project = config.projects.find((p) => p.id === msg.projectId);
        if (!project) {
          send(ws, { type: "error", message: "Project not found", requestType: msg.type });
          break;
        }
        await removeWorktree(project.repoPath, msg.worktreePath);
        const projects = await getProjects();
        send(ws, { type: "project.list", projects });
        break;
      }

      case "project.list": {
        const projects = await getProjects();
        send(ws, { type: "project.list", projects });
        break;
      }

      case "session.list": {
        // Load persisted sessions from disk
        const persisted = await loadPersistedSessions();
        const restoredSessions: SessionInfo[] = [];
        const chatHistories: Record<string, ChatMessage[]> = {};

        for (const p of persisted) {
          // Only restore chat sessions, skip terminal sessions
          if (p.info.type !== "chat") continue;

          restoredSessions.push(p.info);
          chatHistories[p.info.id] = p.messages;

          // Register in memory maps so lazy spawn works
          sessionInfos.set(p.info.id, p.info);
          sessionMessages.set(p.info.id, [...p.messages]);
        }

        send(ws, { type: "session.list", sessions: restoredSessions, chatHistories });
        break;
      }

      case "dialog.pickFolder": {
        pickFolder()
          .then((folderPath) => {
            send(ws, { type: "dialog.folderPicked", path: folderPath });
          })
          .catch(() => {
            send(ws, { type: "dialog.folderPicked", path: null });
          });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error handling ${msg.type}:`, message);
    send(ws, { type: "error", message, requestType: msg.type });
  }
}

export function cleanupAllSessions(): void {
  for (const [id, session] of sessions) {
    session.close();
    sessions.delete(id);
  }
}
