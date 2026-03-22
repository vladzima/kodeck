import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
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
  updateSessionName,
  updateSessionSlashCommands,
  updateSessionMeta,
} from "./session-store.ts";

function generateSessionTitle(text: string): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (title: string) => {
      if (resolved) return;
      resolved = true;
      resolve(title);
    };

    const proc = spawn("claude", [
      "-p",
      "--model", "haiku",
      `Generate a very short title (2-5 words, no quotes, no punctuation) for a chat session that starts with this message:\n\n${text}`,
    ], {
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env },
    });

    let output = "";
    proc.stdout!.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    proc.on("close", () => {
      const title = output.trim().slice(0, 40);
      done(title || "Chat");
    });
    proc.on("error", () => { done("Chat"); });

    // Safety timeout — don't hang forever
    setTimeout(() => { proc.kill(); done("Chat"); }, 15_000);
  });
}

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
      const lastBlock = last.contentBlocks[last.contentBlocks.length - 1];
      if (lastBlock?.type === "text") {
        lastBlock.text += text;
      } else {
        last.contentBlocks.push({ type: "text", text });
      }
    } else {
      messages.push({ role: "assistant", text, toolCalls: [], contentBlocks: [{ type: "text", text }], isStreaming: true, timestamp: Date.now() });
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
      // Check if this is an update to an existing tool call (streaming partial updates)
      const existing = last.toolCalls.find((tc) => tc.id === toolCall.id);
      if (existing) {
        existing.input = toolCall.input;
        const block = last.contentBlocks.find((b) => b.type === "tool_call" && b.toolCall.id === toolCall.id);
        if (block && block.type === "tool_call") block.toolCall.input = toolCall.input;
      } else {
        last.toolCalls.push(toolCall);
        last.contentBlocks.push({ type: "tool_call", toolCall });
      }
    } else {
      // Claude started with tool use before any text
      messages.push({ role: "assistant", text: "", toolCalls: [toolCall], contentBlocks: [{ type: "tool_call", toolCall }], isStreaming: true, timestamp: Date.now() });
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
      const block = last.contentBlocks.find((b) => b.type === "tool_call" && b.toolCall.id === toolUseId);
      if (block && block.type === "tool_call") {
        block.toolCall.result = result;
        block.toolCall.isError = isError;
        block.toolCall.status = isError ? "error" : "done";
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
  session.on("slash_commands", (commands) => {
    send(ws, { type: "chat.slash_commands", sessionId, commands });
    updateSessionSlashCommands(sessionId, commands).catch(console.error);
  });
  session.on("meta", (meta) => {
    send(ws, { type: "session.meta", sessionId, meta });
    updateSessionMeta(sessionId, meta).catch(console.error);
    // Persist claudeSessionId for resume
    if (session.claudeSessionId) {
      const info = sessionInfos.get(sessionId);
      if (info && !info.claudeSessionId) {
        info.claudeSessionId = session.claudeSessionId;
        persistSession(info).catch(console.error);
      }
    }
  });
  session.on("error", (error) => {
    send(ws, { type: "chat.error", sessionId, error });
  });
  session.on("exit", () => {
    sessions.delete(sessionId);
    // Don't send session.closed — the session info remains in sessionInfos
    // so it can be lazy-respawned on next message. Just reset state to idle.
    send(ws, { type: "chat.state", sessionId, state: "idle" });
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

function respawnSession(ws: WebSocket, sessionId: string): void {
  const info = sessionInfos.get(sessionId);
  if (!info) return;

  const oldSession = sessions.get(sessionId);
  if (oldSession instanceof ClaudeSession) {
    oldSession.removeAllListeners();
    oldSession.close();
    sessions.delete(sessionId);
  }

  const claude = new ClaudeSession();
  sessions.set(sessionId, claude);
  wireClaudeSession(ws, sessionId, claude);
  claude.spawn(info.worktreePath, {
    resumeSessionId: info.claudeSessionId ?? undefined,
    model: info.model ?? undefined,
    skipPermissions: info.skipPermissions ?? undefined,
    streaming: info.streaming ?? undefined,
  });
}

const pendingRespawns = new Set<string>();

function respawnWhenIdle(ws: WebSocket, sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session || !(session instanceof ClaudeSession)) {
    // Not spawned yet — nothing to restart, new settings apply on next spawn
    return;
  }

  if (session.state === "idle") {
    pendingRespawns.delete(sessionId);
    respawnSession(ws, sessionId);
  } else {
    if (pendingRespawns.has(sessionId)) return;
    pendingRespawns.add(sessionId);
    session.once("end", () => {
      pendingRespawns.delete(sessionId);
      respawnSession(ws, sessionId);
    });
  }
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
    model: msg.model,
  };

  if (msg.sessionType === "chat") {
    const session = new ClaudeSession();
    sessions.set(sessionId, session);
    wireClaudeSession(ws, sessionId, session);
    session.spawn(msg.worktreePath, { model: msg.model });
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
          // Lazy spawn for restored session — resume Claude's own session
          const info = sessionInfos.get(msg.sessionId)!;
          const claude = new ClaudeSession();
          sessions.set(msg.sessionId, claude);
          wireClaudeSession(ws, msg.sessionId, claude);
          claude.spawn(info.worktreePath, {
            resumeSessionId: info.claudeSessionId ?? undefined,
            model: info.model ?? undefined,
            skipPermissions: info.skipPermissions ?? undefined,
            streaming: info.streaming ?? undefined,
          });
          session = claude;
        }
        if (session instanceof ClaudeSession) {
          // Track user message
          const messages = sessionMessages.get(msg.sessionId) ?? [];
          messages.push({ role: "user", content: msg.text, timestamp: Date.now() });
          sessionMessages.set(msg.sessionId, messages);

          // Auto-rename on first user message (non-blocking)
          const info = sessionInfos.get(msg.sessionId);
          const userMessages = messages.filter((m) => m.role === "user");
          if (info && userMessages.length === 1 && info.name === "Chat") {
            generateSessionTitle(msg.text).then((title) => {
              info.name = title;
              send(ws, { type: "session.renamed", sessionId: msg.sessionId, name: title });
              updateSessionName(msg.sessionId, title).catch(console.error);
            });
          }

          await session.send(msg.text);
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
        const session = sessions.get(msg.sessionId);
        if (session instanceof ClaudeSession) {
          session.respondPermission(msg.requestId, msg.allow);
        }
        break;
      }

      case "chat.model": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.model = msg.model;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(ws, msg.sessionId);
        break;
      }

      case "chat.skipPermissions": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.skipPermissions = msg.skip;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(ws, msg.sessionId);
        break;
      }

      case "chat.streaming": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.streaming = msg.streaming;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(ws, msg.sessionId);
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
        const slashCommands: Record<string, string[]> = {};
        const sessionMetas: Record<string, import("@kodeck/shared").SessionMeta> = {};

        for (const p of persisted) {
          // Only restore chat sessions, skip terminal sessions
          if (p.info.type !== "chat") continue;

          restoredSessions.push(p.info);
          chatHistories[p.info.id] = p.messages;
          if (p.slashCommands) slashCommands[p.info.id] = p.slashCommands;
          if (p.meta) sessionMetas[p.info.id] = p.meta;

          // Register in memory maps so lazy spawn works
          sessionInfos.set(p.info.id, p.info);
          sessionMessages.set(p.info.id, [...p.messages]);
        }

        send(ws, { type: "session.list", sessions: restoredSessions, chatHistories, slashCommands, sessionMetas });
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

/** Kill all live processes and clear the sessions map (server shutdown). */
export function cleanupAllSessions(): void {
  for (const [id, session] of sessions) {
    session.close();
    sessions.delete(id);
  }
}

/** Detach live sessions when a WebSocket disconnects.
 *  Kills Claude processes so they get lazy-respawned on the next connection. */
export function detachSessions(): void {
  for (const [id, session] of sessions) {
    if (session instanceof ClaudeSession) {
      session.removeAllListeners();
      session.close();
    }
    sessions.delete(id);
  }
  pendingRespawns.clear();
}
