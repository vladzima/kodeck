import { useAppStore } from "../store.ts";
import { ChatView } from "./chat/chat-view.tsx";
import { TerminalView } from "./terminal/terminal-view.tsx";
import { SearchResultsView } from "./search-results.tsx";
import { ConfigFileView } from "./config-view.tsx";

export function MainPanel() {
  const { sessions, activeSessionId, selectedWorktreePath } = useAppStore();
  const searchTabSelected = useAppStore((s) => s.searchTabSelected);
  const configTabSelected = useAppStore((s) => s.configTabSelected);

  const worktreeSessions = sessions.filter((s) => s.worktreePath === selectedWorktreePath);

  if (!selectedWorktreePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a worktree to get started</p>
      </div>
    );
  }

  if (worktreeSessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Open a new chat or terminal session using the + buttons above</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {searchTabSelected && (
        <div className="absolute inset-0">
          <SearchResultsView />
        </div>
      )}
      {configTabSelected && (
        <div className="absolute inset-0">
          <ConfigFileView />
        </div>
      )}
      {worktreeSessions.map((session) => {
        const isActive = session.id === activeSessionId && !searchTabSelected && !configTabSelected;
        if (session.type === "chat") {
          return (
            <div key={session.id} className={`absolute inset-0 ${isActive ? "" : "hidden"}`}>
              <ChatView sessionId={session.id} />
            </div>
          );
        }
        return <TerminalView key={session.id} sessionId={session.id} isActive={isActive} />;
      })}
    </div>
  );
}
