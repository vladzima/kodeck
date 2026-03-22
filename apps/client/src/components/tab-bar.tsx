import { MessageSquare, TerminalIcon, X } from "lucide-react";
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
            <TerminalIcon className="h-3.5 w-3.5 shrink-0" />
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
          size="icon-xs"
          onClick={() => handleNewSession("chat")}
          disabled={!selectedWorktreePath}
          title="New chat session"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => handleNewSession("terminal")}
          disabled={!selectedWorktreePath}
          title="New terminal session"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
