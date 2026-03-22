import { useEffect } from "react";
import type { ClientMessage, ServerMessage } from "@kodeck/shared";
import { useAppStore } from "../store.ts";

let wsInstance: WebSocket | null = null;
let initialized = false;

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
      break;

    case "chat.state":
      state.setChatState(msg.sessionId, msg.state);
      if (msg.state !== "awaiting_permission") {
        state.clearPendingPermission(msg.sessionId);
      }
      break;

    case "chat.error":
      break;

    case "chat.end":
      state.finishAssistantMessage(msg.sessionId, msg.messageId);
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
      break;

    case "session.list":
      state.loadSessions(msg.sessions, msg.chatHistories, msg.slashCommands, msg.sessionMetas);
      break;

    case "dialog.folderPicked":
      if (msg.path) {
        sendMessage({ type: "project.add", repoPath: msg.path });
      }
      break;

    case "debug.processList":
      state.setDebugProcesses(msg.processes);
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
