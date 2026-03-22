import { useEffect } from "react";
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

  // Ctrl+1-9 to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        const index = Number(e.key) - 1;
        if (index < worktreeSessions.length) {
          e.preventDefault();
          setActiveSession(worktreeSessions[index].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [worktreeSessions, setActiveSession]);

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
      {worktreeSessions.map((session, index) => (
        <div
          key={session.id}
          role="tab"
          tabIndex={0}
          className={`group flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors ${
            activeSessionId === session.id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setActiveSession(session.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setActiveSession(session.id);
          }}
        >
          {session.type === "chat" ? (
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <TerminalIcon className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="max-w-24 truncate">{session.name}</span>
          {index < 9 && (
            <span className="rounded bg-foreground/10 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
              ^{index + 1}
            </span>
          )}
          <button
            type="button"
            className="rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={(e) => handleCloseSession(e, session.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
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
