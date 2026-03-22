import { useEffect, useState, useRef } from "react";
import { Bug, MessageSquare, Plus, TerminalIcon, X } from "lucide-react";
import { DEFAULT_MODEL } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";

function TabName({ name }: { name: string }) {
  const [display, setDisplay] = useState(name);
  const [opacity, setOpacity] = useState(1);
  const prevName = useRef(name);

  useEffect(() => {
    if (name === prevName.current) return;
    prevName.current = name;
    // Fade out, swap text, fade in
    setOpacity(0);
    const timer = setTimeout(() => {
      setDisplay(name);
      setOpacity(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [name]);

  return (
    <span className="max-w-32 truncate transition-opacity duration-150" style={{ opacity }}>
      {display}
    </span>
  );
}

export function TabBar() {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    selectedWorktreePath,
    debugMode,
    setDebugMode,
  } = useAppStore();

  const worktreeSessions = sessions.filter((s) => s.worktreePath === selectedWorktreePath);

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
    // Inherit model from the active session so new tabs match the user's current choice
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const model = type === "chat" ? (activeSession?.model ?? DEFAULT_MODEL) : undefined;
    sendMessage({
      type: "session.create",
      worktreePath: selectedWorktreePath,
      sessionType: type,
      name: type === "chat" ? "Chat" : "Terminal",
      model,
    });
  };

  const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
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
          className={`group flex h-full cursor-pointer items-center gap-1.5 px-2.5 text-sm transition-colors ${
            activeSessionId === session.id
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground/70"
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
          <TabName name={session.name} />
          {index < 9 && (
            <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
              ^{index + 1}
            </span>
          )}
          <button
            type="button"
            className="cursor-pointer rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={(e) => handleCloseSession(e, session.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="mx-1.5 h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          onClick={() => handleNewSession("chat")}
          disabled={!selectedWorktreePath}
        >
          <Plus className="h-3 w-3" />
          <MessageSquare className="h-3 w-3" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          onClick={() => handleNewSession("terminal")}
          disabled={!selectedWorktreePath}
        >
          <Plus className="h-3 w-3" />
          <TerminalIcon className="h-3 w-3" />
          <span>Terminal</span>
        </button>
      </div>
      <div className="ml-auto flex items-center">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setDebugMode(!debugMode);
            if (!debugMode) sendMessage({ type: "debug.listProcesses" });
          }}
          title="Toggle debug panel"
          className={debugMode ? "text-primary" : ""}
        >
          <Bug className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
