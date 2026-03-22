import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import type { WebSocket } from "ws";
import type {
  ClientMessage,
  ClaudeProcessInfo,
  PermissionRequest,
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
  listRemoteBranches,
  searchPRs,
  scanCopyPaths,
  copyWorktreeFiles,
  pullWorktree,
  pushWorktree,
  listWorktrees,
} from "./projects.ts";
import { loadConfig, updateProjectCopyPaths } from "./config.ts";
import type { SessionMeta } from "@kodeck/shared";
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

    const proc = spawn(
      "claude",
      [
        "-p",
        "--model",
        "haiku",
        `Generate a very short title (2-5 words, no quotes, no punctuation) for a chat session that starts with this message:\n\n${text}`,
      ],
      {
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env },
      },
    );

    let output = "";
    proc.stdout!.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.on("close", () => {
      const title = output.trim().slice(0, 40);
      done(title || "Chat");
    });
    proc.on("error", () => {
      done("Chat");
    });

    // Safety timeout — don't hang forever
    setTimeout(() => {
      proc.kill();
      done("Chat");
    }, 15_000);
  });
}

// ── Session state (lives independently of WebSocket connections) ─────
type Session = ClaudeSession | TerminalSession;
const sessions = new Map<string, Session>();
const sessionMessages = new Map<string, ChatMessage[]>();
const sessionInfos = new Map<string, SessionInfo>();
const sessionMetas = new Map<string, SessionMeta>();
const sessionSlashCommands = new Map<string, string[]>();
const sessionPendingPermissions = new Map<string, PermissionRequest>();

// ── Client tracking ─────────────────────────────────────────────────
const connectedClients = new Set<WebSocket>();

/** Send a message to all connected clients. */
function broadcast(msg: ServerMessage): void {
  const json = JSON.stringify(msg);
  for (const ws of connectedClients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(json);
    }
  }
}

/** Send a message to a specific client (for request-response patterns). */
function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Worktree status polling ──────────────────────────────────────────
let statusPollInterval: ReturnType<typeof setInterval> | null = null;

export function startWorktreeStatusPolling(): void {
  if (statusPollInterval) return;
  statusPollInterval = setInterval(async () => {
    if (connectedClients.size === 0) return;
    try {
      const config = await loadConfig();
      for (const project of config.projects) {
        try {
          const worktrees = await listWorktrees(project.repoPath, { includeStatus: true });
          broadcast({ type: "worktree.status", projectId: project.id, worktrees });
        } catch { /* skip */ }
      }
    } catch { /* skip cycle */ }
  }, 30_000);
}

export function stopWorktreeStatusPolling(): void {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

/** Register a WebSocket client. */
export function registerClient(ws: WebSocket): void {
  connectedClients.add(ws);
  startWorktreeStatusPolling();
}

/** Unregister a WebSocket client. Terminal sessions are killed (ephemeral),
 *  but chat sessions and their Claude processes survive for reconnection. */
export function unregisterClient(ws: WebSocket): void {
  connectedClients.delete(ws);
  // Kill terminal sessions (ephemeral, no persistence)
  for (const [id, session] of sessions) {
    if (session instanceof TerminalSession) {
      session.close();
      sessions.delete(id);
    }
  }
}

async function listClaudeProcesses(): Promise<ClaudeProcessInfo[]> {
  return new Promise((resolve) => {
    execFile("ps", ["-eo", "pid,lstart,command"], (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }

      const results: ClaudeProcessInfo[] = [];
      // Collect known PIDs from active sessions
      const pidToSession = new Map<number, string>();
      for (const [sessionId, session] of sessions) {
        if (session instanceof ClaudeSession && session.pid) {
          pidToSession.set(session.pid, sessionId);
        }
      }

      for (const line of stdout.split("\n")) {
        if (!line.includes("stream-json") || !line.includes("claude")) continue;
        // Skip the ps command itself
        if (line.includes("ps -eo")) continue;

        const pidMatch = line.match(/^\s*(\d+)/);
        if (!pidMatch) continue;
        const pid = Number(pidMatch[1]);

        // Extract lstart (e.g. "Mon Mar 22 19:00:00 2026")
        const lstartMatch = line.match(/^\s*\d+\s+((?:\w+ ){4}\d+)/);
        const startTime = lstartMatch ? new Date(lstartMatch[1]).getTime() : Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);


        // Try to match to a known session
        const sessionId = pidToSession.get(pid);

        // Find worktree path from sessionInfos if we have a match
        let worktreePath = "";
        if (sessionId) {
          const info = sessionInfos.get(sessionId);
          if (info) worktreePath = info.worktreePath;
        }

        results.push({ pid, cwd: worktreePath || "unknown", sessionId, uptime });
      }

      resolve(results);
    });
  });
}

function pickFolder(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (process.platform === "darwin") {
      execFile(
        "osascript",
        ["-e", 'POSIX path of (choose folder with prompt "Select a project folder")'],
        (err, stdout) => {
          if (err) {
            // User cancelled or error
            resolve(null);
            return;
          }
          const path = stdout.trim().replace(/\/$/, "");
          resolve(path || null);
        },
      );
    } else if (process.platform === "linux") {
      execFile(
        "zenity",
        ["--file-selection", "--directory", "--title=Select a project folder"],
        (err, stdout) => {
          if (err) {
            resolve(null);
            return;
          }
          resolve(stdout.trim() || null);
        },
      );
    } else {
      reject(new Error("Folder picker not supported on this platform"));
    }
  });
}

/** Wire Claude session events to broadcast + in-memory tracking.
 *  Events go to all connected clients — sessions are independent of any single WebSocket. */
function wireClaudeSession(sessionId: string, session: ClaudeSession): void {
  // Initialize message tracking if not already present
  if (!sessionMessages.has(sessionId)) {
    sessionMessages.set(sessionId, []);
  }

  session.on("text", (text, messageId) => {
    broadcast({ type: "chat.text", sessionId, text, messageId });
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
      messages.push({
        role: "assistant",
        text,
        toolCalls: [],
        contentBlocks: [{ type: "text", text }],
        isStreaming: true,
        timestamp: Date.now(),
      });
    }
  });
  session.on("thinking", (thinking, messageId) => {
    broadcast({ type: "chat.thinking", sessionId, thinking, messageId });
  });
  session.on("tool_call", (toolCall, messageId) => {
    broadcast({ type: "chat.tool_call", sessionId, toolCall, messageId });
    // Track tool call
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.isStreaming) {
      // Check if this is an update to an existing tool call (streaming partial updates)
      const existing = last.toolCalls.find((tc) => tc.id === toolCall.id);
      if (existing) {
        existing.input = toolCall.input;
        const block = last.contentBlocks.find(
          (b) => b.type === "tool_call" && b.toolCall.id === toolCall.id,
        );
        if (block && block.type === "tool_call") block.toolCall.input = toolCall.input;
      } else {
        last.toolCalls.push(toolCall);
        last.contentBlocks.push({ type: "tool_call", toolCall });
      }
    } else {
      // Claude started with tool use before any text
      messages.push({
        role: "assistant",
        text: "",
        toolCalls: [toolCall],
        contentBlocks: [{ type: "tool_call", toolCall }],
        isStreaming: true,
        timestamp: Date.now(),
      });
    }
  });
  session.on("tool_result", (toolUseId, result, isError) => {
    broadcast({ type: "chat.tool_result", sessionId, toolUseId, result, isError });
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
      const block = last.contentBlocks.find(
        (b) => b.type === "tool_call" && b.toolCall.id === toolUseId,
      );
      if (block && block.type === "tool_call") {
        block.toolCall.result = result;
        block.toolCall.isError = isError;
        block.toolCall.status = isError ? "error" : "done";
      }
    }
  });
  session.on("permission_request", (permission) => {
    sessionPendingPermissions.set(sessionId, permission);
    broadcast({ type: "chat.permission_request", sessionId, permission });
  });
  session.on("state", (state) => {
    if (state !== "awaiting_permission") {
      sessionPendingPermissions.delete(sessionId);
    }
    broadcast({ type: "chat.state", sessionId, state });
  });
  session.on("end", (messageId) => {
    broadcast({ type: "chat.end", sessionId, messageId });
    sessionPendingPermissions.delete(sessionId);
    // Finalize and persist
    const messages = sessionMessages.get(sessionId)!;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant") {
      last.isStreaming = false;
    }
    updateSessionMessages(sessionId, messages).catch(console.error);
  });
  session.on("slash_commands", (commands) => {
    sessionSlashCommands.set(sessionId, commands);
    broadcast({ type: "chat.slash_commands", sessionId, commands });
    updateSessionSlashCommands(sessionId, commands).catch(console.error);
  });
  session.on("meta", (meta) => {
    sessionMetas.set(sessionId, meta);
    broadcast({ type: "session.meta", sessionId, meta });
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
    broadcast({ type: "chat.error", sessionId, error });
  });
  session.on("exit", () => {
    sessions.delete(sessionId);
    sessionPendingPermissions.delete(sessionId);
    // Don't send session.closed — the session info remains in sessionInfos
    // so it can be lazy-respawned on next message. Just reset state to idle.
    broadcast({ type: "chat.state", sessionId, state: "idle" });
  });
}

function wireTerminalSession(sessionId: string, session: TerminalSession): void {
  session.on("output", (data) => {
    broadcast({ type: "terminal.output", sessionId, data });
  });
  session.on("exit", (exitCode) => {
    sessions.delete(sessionId);
    broadcast({ type: "terminal.exit", sessionId, exitCode });
    broadcast({ type: "session.closed", sessionId });
  });
}

function respawnSession(sessionId: string): void {
  const info = sessionInfos.get(sessionId);
  if (!info) return;

  const oldSession = sessions.get(sessionId);
  if (oldSession instanceof ClaudeSession) {
    oldSession.removeAllListeners();
    oldSession.close();
    sessions.delete(sessionId);
  }

  const claude = new ClaudeSession();
  const cachedMeta = sessionMetas.get(sessionId);
  if (cachedMeta) claude.restoreMeta(cachedMeta);
  sessions.set(sessionId, claude);
  wireClaudeSession(sessionId, claude);
  claude.spawn(info.worktreePath, {
    resumeSessionId: info.claudeSessionId ?? undefined,
    model: info.model ?? undefined,
    effort: info.effort ?? undefined,
    skipPermissions: info.skipPermissions ?? undefined,
    streaming: info.streaming ?? undefined,
  });
}

const pendingRespawns = new Set<string>();

function respawnWhenIdle(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session || !(session instanceof ClaudeSession)) {
    // Not spawned yet — nothing to restart, new settings apply on next spawn
    return;
  }

  if (session.state === "idle") {
    pendingRespawns.delete(sessionId);
    respawnSession(sessionId);
  } else {
    if (pendingRespawns.has(sessionId)) return;
    pendingRespawns.add(sessionId);
    session.once("end", () => {
      pendingRespawns.delete(sessionId);
      respawnSession(sessionId);
    });
  }
}

async function handleSessionCreate(
  ws: WebSocket,
  msg: ClientMessage & { type: "session.create" },
): Promise<void> {
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
    wireClaudeSession(sessionId, session);
    session.spawn(msg.worktreePath, { model: msg.model });
    // Persist chat session
    sessionInfos.set(sessionId, info);
    persistSession(info).catch(console.error);
  } else {
    const session = new TerminalSession();
    sessions.set(sessionId, session);
    wireTerminalSession(sessionId, session);
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
        // Clean up all state
        sessionInfos.delete(msg.sessionId);
        sessionMessages.delete(msg.sessionId);
        sessionMetas.delete(msg.sessionId);
        sessionSlashCommands.delete(msg.sessionId);
        sessionPendingPermissions.delete(msg.sessionId);
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
          // Restore cumulative meta (compactions etc.) from cached or persisted state
          const cachedMeta = sessionMetas.get(msg.sessionId);
          if (cachedMeta) claude.restoreMeta(cachedMeta);
          sessions.set(msg.sessionId, claude);
          wireClaudeSession(msg.sessionId, claude);
          claude.spawn(info.worktreePath, {
            resumeSessionId: info.claudeSessionId ?? undefined,
            model: info.model ?? undefined,
            effort: info.effort ?? undefined,
            skipPermissions: info.skipPermissions ?? undefined,
            streaming: info.streaming ?? undefined,
          });
          session = claude;
        }
        if (session instanceof ClaudeSession) {
          // Track user message
          const messages = sessionMessages.get(msg.sessionId) ?? [];
          messages.push({
            role: "user",
            content: msg.text,
            timestamp: Date.now(),
            attachments: msg.attachments,
          });
          sessionMessages.set(msg.sessionId, messages);

          // Auto-rename on first user message (non-blocking)
          const info = sessionInfos.get(msg.sessionId);
          const userMessages = messages.filter((m) => m.role === "user");
          if (info && userMessages.length === 1 && info.name === "Chat") {
            void generateSessionTitle(msg.text).then((title) => {
              info.name = title;
              broadcast({ type: "session.renamed", sessionId: msg.sessionId, name: title });
              updateSessionName(msg.sessionId, title).catch(console.error);
            });
          }

          await session.send(msg.text, msg.attachments);
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
        respawnWhenIdle(msg.sessionId);
        break;
      }

      case "chat.effort": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.effort = msg.effort;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(msg.sessionId);
        break;
      }

      case "chat.skipPermissions": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.skipPermissions = msg.skip;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(msg.sessionId);
        break;
      }

      case "chat.streaming": {
        const info = sessionInfos.get(msg.sessionId);
        if (info) {
          info.streaming = msg.streaming;
          persistSession(info).catch(console.error);
        }
        respawnWhenIdle(msg.sessionId);
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

        // Resolve source — for PR type, look up the branch name via gh
        let source: Parameters<typeof createWorktree>[1];
        if (msg.source.type === "pr") {
          const prBranch = await new Promise<string>((resolve, reject) => {
            execFile(
              "gh",
              ["pr", "view", String(msg.source.type === "pr" ? msg.source.number : 0), "--json", "headRefName", "-q", ".headRefName"],
              { cwd: project.repoPath },
              (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout.trim());
              },
            );
          });
          source = { type: "pr", number: msg.source.number, branch: prBranch };
        } else {
          source = msg.source;
        }

        const result = await createWorktree(project.repoPath, source);

        // Copy files if requested
        let copyMessage = "";
        if (msg.copyPaths.length > 0) {
          const copyResult = await copyWorktreeFiles(msg.copyFromPath, result.newWorktreePath, msg.copyPaths);
          if (copyResult.failed.length > 0) {
            copyMessage = `Copied ${copyResult.copied.length} path(s), failed: ${copyResult.failed.join(", ")}`;
          } else {
            copyMessage = `Copied ${copyResult.copied.length} path(s)`;
          }
        }

        // Save copy config if requested
        if (msg.saveCopyConfig) {
          await updateProjectCopyPaths(msg.projectId, msg.copyPaths);
        }

        // Broadcast updated project list
        const projects = await getProjects();
        broadcast({ type: "project.list", projects });

        // Broadcast operation result
        const successMsg = copyMessage ? `Worktree created. ${copyMessage}` : "Worktree created";
        broadcast({ type: "worktree.operationResult", operation: "create", success: true, message: successMsg });

        // Refresh worktree status
        try {
          const worktrees = await listWorktrees(project.repoPath, { includeStatus: true });
          broadcast({ type: "worktree.status", projectId: msg.projectId, worktrees });
        } catch { /* skip */ }

        break;
      }

      case "worktree.remove": {
        const config = await loadConfig();
        const project = config.projects.find((p) => p.id === msg.projectId);
        if (!project) {
          send(ws, { type: "error", message: "Project not found", requestType: msg.type });
          break;
        }

        // Close all sessions whose worktreePath matches
        for (const [sessionId, info] of sessionInfos) {
          if (info.worktreePath === msg.worktreePath) {
            const session = sessions.get(sessionId);
            if (session) {
              session.close();
              sessions.delete(sessionId);
            }
            sessionInfos.delete(sessionId);
            sessionMessages.delete(sessionId);
            sessionMetas.delete(sessionId);
            sessionSlashCommands.delete(sessionId);
            sessionPendingPermissions.delete(sessionId);
            removePersistedSession(sessionId).catch(console.error);
            broadcast({ type: "session.closed", sessionId });
          }
        }

        await removeWorktree(project.repoPath, msg.worktreePath);

        // Broadcast updated project list
        const projects = await getProjects();
        broadcast({ type: "project.list", projects });

        // Broadcast operation result
        broadcast({ type: "worktree.operationResult", operation: "remove", success: true, message: "Worktree removed" });

        // Refresh worktree status
        try {
          const worktrees = await listWorktrees(project.repoPath, { includeStatus: true });
          broadcast({ type: "worktree.status", projectId: msg.projectId, worktrees });
        } catch { /* skip */ }

        break;
      }

      case "worktree.pull": {
        try {
          const result = await pullWorktree(msg.worktreePath);
          broadcast({ type: "worktree.operationResult", operation: "pull", success: true, message: result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          broadcast({ type: "worktree.operationResult", operation: "pull", success: false, message });
        }
        // Refresh project list after pull
        const pullProjects = await getProjects();
        broadcast({ type: "project.list", projects: pullProjects });
        // Refresh worktree status for all projects that contain this path
        try {
          const pullConfig = await loadConfig();
          for (const proj of pullConfig.projects) {
            const wts = await listWorktrees(proj.repoPath);
            if (wts.some((wt) => wt.path === msg.worktreePath)) {
              const enriched = await listWorktrees(proj.repoPath, { includeStatus: true });
              broadcast({ type: "worktree.status", projectId: proj.id, worktrees: enriched });
            }
          }
        } catch { /* skip */ }
        break;
      }

      case "worktree.push": {
        try {
          const result = await pushWorktree(msg.worktreePath);
          broadcast({ type: "worktree.operationResult", operation: "push", success: true, message: result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          broadcast({ type: "worktree.operationResult", operation: "push", success: false, message });
        }
        // Refresh project list after push
        const pushProjects = await getProjects();
        broadcast({ type: "project.list", projects: pushProjects });
        // Refresh worktree status for all projects that contain this path
        try {
          const pushConfig = await loadConfig();
          for (const proj of pushConfig.projects) {
            const wts = await listWorktrees(proj.repoPath);
            if (wts.some((wt) => wt.path === msg.worktreePath)) {
              const enriched = await listWorktrees(proj.repoPath, { includeStatus: true });
              broadcast({ type: "worktree.status", projectId: proj.id, worktrees: enriched });
            }
          }
        } catch { /* skip */ }
        break;
      }

      case "worktree.listBranches": {
        const branchConfig = await loadConfig();
        const branchProject = branchConfig.projects.find((p) => p.id === msg.projectId);
        if (!branchProject) {
          send(ws, { type: "error", message: "Project not found", requestType: msg.type });
          break;
        }
        const branches = await listRemoteBranches(branchProject.repoPath);
        send(ws, { type: "worktree.branchList", projectId: msg.projectId, branches });
        break;
      }

      case "worktree.searchPRs": {
        const prConfig = await loadConfig();
        const prProject = prConfig.projects.find((p) => p.id === msg.projectId);
        if (!prProject) {
          send(ws, { type: "error", message: "Project not found", requestType: msg.type });
          break;
        }
        const prs = await searchPRs(prProject.repoPath, msg.query);
        send(ws, { type: "worktree.prList", projectId: msg.projectId, prs });
        break;
      }

      case "worktree.scanCopyPaths": {
        const paths = await scanCopyPaths(msg.worktreePath);
        send(ws, { type: "worktree.copyPaths", worktreePath: msg.worktreePath, paths });
        break;
      }

      case "project.list": {
        const projects = await getProjects();
        send(ws, { type: "project.list", projects });
        break;
      }

      case "session.list": {
        // On first connect (server just started), load from disk.
        // On reconnect, use in-memory state which has the latest data
        // (including mid-stream messages that haven't been persisted yet).
        if (sessionInfos.size === 0) {
          const persisted = await loadPersistedSessions();
          for (const p of persisted) {
            if (p.info.type !== "chat") continue;
            sessionInfos.set(p.info.id, p.info);
            sessionMessages.set(p.info.id, [...p.messages]);
            if (p.slashCommands) sessionSlashCommands.set(p.info.id, p.slashCommands);
            if (p.meta) sessionMetas.set(p.info.id, p.meta);
          }
          console.log(`[session.list] loaded ${persisted.length} sessions from disk`);
        }

        // Build response from in-memory state
        const restoredSessions: SessionInfo[] = [];
        const chatHistories: Record<string, ChatMessage[]> = {};
        const slashCmds: Record<string, string[]> = {};
        const metas: Record<string, SessionMeta> = {};
        const states: Record<string, import("@kodeck/shared").ChatSessionState> = {};
        const permissions: Record<string, PermissionRequest> = {};

        for (const [id, info] of sessionInfos) {
          if (info.type !== "chat") continue;
          restoredSessions.push(info);
          chatHistories[id] = sessionMessages.get(id) ?? [];
          const sc = sessionSlashCommands.get(id);
          if (sc) slashCmds[id] = sc;
          const meta = sessionMetas.get(id);
          if (meta) metas[id] = meta;
          // Include live session state
          const session = sessions.get(id);
          if (session instanceof ClaudeSession) {
            states[id] = session.state;
          }
          // Include pending permissions
          const perm = sessionPendingPermissions.get(id);
          if (perm) permissions[id] = perm;
        }

        console.log(
          `[session.list] sending ${restoredSessions.length} sessions (${Object.values(states).filter((s) => s !== "idle").length} active)`,
        );
        send(ws, {
          type: "session.list",
          sessions: restoredSessions,
          chatHistories,
          slashCommands: slashCmds,
          sessionMetas: metas,
          sessionStates: states,
          pendingPermissions: permissions,
        });
        break;
      }

      case "debug.listProcesses": {
        // Find all claude processes spawned with stream-json
        const processes = await listClaudeProcesses();
        send(ws, { type: "debug.processList", processes });
        break;
      }

      case "debug.killProcess": {
        try {
          process.kill(msg.pid, "SIGTERM");
        } catch {
          // Process may already be dead
        }
        // Refresh list after kill
        const updated = await listClaudeProcesses();
        send(ws, { type: "debug.processList", processes: updated });
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
