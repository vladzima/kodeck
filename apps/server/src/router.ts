import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type {
  ClientMessage,
  ServerMessage,
  SessionInfo,
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

type Session = ClaudeSession | TerminalSession;
const sessions = new Map<string, Session>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function wireClaudeSession(ws: WebSocket, sessionId: string, session: ClaudeSession): void {
  session.on("text", (text, messageId) => {
    send(ws, { type: "chat.text", sessionId, text, messageId });
  });
  session.on("thinking", (thinking, messageId) => {
    send(ws, { type: "chat.thinking", sessionId, thinking, messageId });
  });
  session.on("tool_call", (toolCall, messageId) => {
    send(ws, { type: "chat.tool_call", sessionId, toolCall, messageId });
  });
  session.on("tool_result", (toolUseId, result, isError) => {
    send(ws, { type: "chat.tool_result", sessionId, toolUseId, result, isError });
  });
  session.on("permission_request", (permission) => {
    send(ws, { type: "chat.permission_request", sessionId, permission });
  });
  session.on("state", (state) => {
    send(ws, { type: "chat.state", sessionId, state });
  });
  session.on("end", (messageId) => {
    send(ws, { type: "chat.end", sessionId, messageId });
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
  } else {
    const session = new TerminalSession();
    sessions.set(sessionId, session);
    wireTerminalSession(ws, sessionId, session);
    await session.spawn(msg.worktreePath);
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
          send(ws, { type: "session.closed", sessionId: msg.sessionId });
        }
        break;
      }

      case "chat.send": {
        const session = sessions.get(msg.sessionId);
        if (session instanceof ClaudeSession) {
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
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(ws, { type: "error", message, requestType: msg.type });
  }
}

export function cleanupAllSessions(): void {
  for (const [id, session] of sessions) {
    session.close();
    sessions.delete(id);
  }
}
