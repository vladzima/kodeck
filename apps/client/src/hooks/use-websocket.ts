import { useEffect } from "react";
import type { ClientMessage, ServerMessage } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { performSearch } from "../search-utils.ts";

let wsInstance: WebSocket | null = null;
let initialized = false;

const notificationSound = new Audio("/notification.mp3");
notificationSound.volume = 0.5;

function playNotification(): void {
  notificationSound.currentTime = 0;
  notificationSound.play().catch(() => {
    // Browser may block autoplay before user interaction — ignore
  });
}

function rerunPersistedSearch(): void {
  const s = useAppStore.getState();
  if (s.searchQuery.trim()) {
    const results = performSearch(s.searchQuery, s.searchScope, s);
    s.setSearchResults(results);
  }
}

export function sendMessage(msg: ClientMessage): void {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(msg));
  }
}

function handleServerMessage(msg: ServerMessage): void {
  const state = useAppStore.getState();

  switch (msg.type) {
    case "session.created":
      state.addSession(msg.session);
      state.setActiveSession(msg.session.id);
      break;

    case "session.closed":
      state.removeSession(msg.sessionId);
      break;

    case "session.renamed":
      state.renameSession(msg.sessionId, msg.name);
      break;

    case "chat.text":
      state.appendChatText(msg.sessionId, msg.messageId, msg.text);
      break;

    case "chat.thinking":
      break;

    case "chat.tool_call":
      state.appendToolCall(msg.sessionId, msg.messageId, msg.toolCall);
      break;

    case "chat.tool_result":
      state.updateToolResult(msg.sessionId, msg.toolUseId, msg.result, msg.isError);
      break;

    case "chat.permission_request":
      state.setPendingPermission(msg.sessionId, msg.permission);
      playNotification();
      break;

    case "chat.state": {
      const prevState = state.chatData.get(msg.sessionId)?.state;
      state.setChatState(msg.sessionId, msg.state);
      if (msg.state !== "awaiting_permission") {
        state.clearPendingPermission(msg.sessionId);
      }
      // Notify when Claude finishes work
      if (msg.state === "idle" && prevState === "streaming") {
        playNotification();
      }
      break;
    }

    case "chat.error":
      break;

    case "chat.end":
      state.finishAssistantMessage(msg.sessionId, msg.messageId, msg.messageMeta);
      break;

    case "chat.slash_commands":
      state.setSlashCommands(msg.sessionId, msg.commands);
      break;

    case "session.meta":
      state.setSessionMeta(msg.sessionId, msg.meta);
      break;

    case "terminal.output":
      window.dispatchEvent(
        new CustomEvent("kodeck:terminal-output", {
          detail: { sessionId: msg.sessionId, data: msg.data },
        }),
      );
      break;

    case "terminal.exit":
      break;

    case "project.list":
      state.setProjects(msg.projects);
      state.markAllWorktreeStatusStale();
      rerunPersistedSearch();
      break;

    case "session.list": {
      console.log(`[kodeck] Loaded ${msg.sessions.length} sessions from server`);
      state.loadSessions(
        msg.sessions,
        msg.chatHistories,
        msg.slashCommands,
        msg.sessionMetas,
        msg.sessionStates,
        msg.pendingPermissions,
      );
      rerunPersistedSearch();
      break;
    }

    case "dialog.folderPicked":
      if (msg.path) {
        sendMessage({ type: "project.add", repoPath: msg.path });
      }
      break;

    case "debug.processList":
      state.setDebugProcesses(msg.processes);
      break;

    case "worktree.status":
      state.updateWorktreeStatus(msg.projectId, msg.worktrees);
      state.markWorktreeStatusFresh(msg.projectId);
      break;

    case "worktree.branchList":
      state.setBranches(msg.branches);
      break;

    case "worktree.prList":
      state.setPRSearchResults(msg.prs);
      break;

    case "worktree.copyPaths":
      state.setScannedCopyPaths(msg.paths);
      break;

    case "worktree.operationResult":
      state.setLastOperationResult({
        operation: msg.operation,
        success: msg.success,
        message: msg.message,
      });
      if (msg.message) {
        state.addNotification(msg.message, msg.success ? "success" : "error");
      }
      if (!msg.success) {
        console.error(`[kodeck] Worktree ${msg.operation} failed:`, msg.message);
      }
      break;

    case "error":
      console.error("[kodeck] Server error:", msg.message);
      break;
  }
}

function connect(): void {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws`;
  const ws = new WebSocket(url);
  wsInstance = ws;

  ws.addEventListener("open", () => {
    useAppStore.getState().setConnected(true);
    sendMessage({ type: "project.list" });
    sendMessage({ type: "session.list" });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data as string) as ServerMessage;
    handleServerMessage(msg);
  });

  ws.addEventListener("close", () => {
    useAppStore.getState().setConnected(false);
    wsInstance = null;
    setTimeout(connect, 2000);
  });

  ws.addEventListener("error", () => {
    // Error will trigger close event, which handles reconnection
  });
}

function initWebSocket(): void {
  if (initialized) return;
  initialized = true;
  connect();
}

/** Call once in the root component to start the WebSocket connection. */
export function useWebSocket(): void {
  useEffect(() => {
    initWebSocket();
  }, []);
}
