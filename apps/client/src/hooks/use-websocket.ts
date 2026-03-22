import { useEffect } from "react";
import type { ClientMessage, ServerMessage } from "@kodeck/shared";
import { useAppStore } from "../store.ts";

let wsInstance: WebSocket | null = null;

export function sendMessage(msg: ClientMessage): void {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify(msg));
  }
}

export function useWebSocket(): void {
  const store = useAppStore;

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsInstance = ws;

      ws.addEventListener("open", () => {
        store.getState().setConnected(true);
        sendMessage({ type: "project.list" });
      });

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        const state = store.getState();

        switch (msg.type) {
          case "session.created":
            state.addSession(msg.session);
            state.setActiveSession(msg.session.id);
            break;

          case "session.closed":
            state.removeSession(msg.sessionId);
            break;

          case "chat.text":
            state.appendChatText(msg.sessionId, msg.messageId, msg.text);
            break;

          case "chat.thinking":
            // Thinking events could be handled separately in the future
            break;

          case "chat.tool_call":
            state.appendToolCall(msg.sessionId, msg.messageId, msg.toolCall);
            break;

          case "chat.tool_result":
            state.updateToolResult(msg.sessionId, msg.toolUseId, msg.result, msg.isError);
            break;

          case "chat.permission_request":
            // Permission request handling will be implemented in UI components
            break;

          case "chat.state":
            state.setChatState(msg.sessionId, msg.state);
            break;

          case "chat.error":
            // Error handling will be implemented in UI components
            break;

          case "chat.end":
            state.finishAssistantMessage(msg.sessionId, msg.messageId);
            break;

          case "terminal.output":
            window.dispatchEvent(
              new CustomEvent("kodeck:terminal-output", {
                detail: { sessionId: msg.sessionId, data: msg.data },
              }),
            );
            break;

          case "terminal.exit":
            // Terminal exit handling will be implemented in UI components
            break;

          case "project.list":
            state.setProjects(msg.projects);
            break;

          case "error":
            console.error("[kodeck] Server error:", msg.message);
            break;
        }
      });

      ws.addEventListener("close", () => {
        store.getState().setConnected(false);
        wsInstance = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      });

      ws.addEventListener("error", () => {
        // Error will trigger close event, which handles reconnection
      });
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsInstance) {
        wsInstance.close();
        wsInstance = null;
      }
    };
  }, [store]);
}
