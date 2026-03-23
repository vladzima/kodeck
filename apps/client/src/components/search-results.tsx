import { useAppStore } from "../store.ts";
import { ScrollArea } from "./ui/scroll-area.tsx";

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text.slice(0, 200)}</span>;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text.slice(0, 200)}</span>;

  const contextChars = 80;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);

  return (
    <span>
      {start > 0 && "..."}
      {text.slice(start, idx)}
      <span className="rounded-sm bg-primary/20 text-primary">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length, end)}
      {end < text.length && "..."}
    </span>
  );
}

export function SearchResultsView() {
  const searchResults = useAppStore((s) => s.searchResults);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const { setActiveSession, setSearchTabSelected, setScrollToMessage, restoreChat } = useAppStore();

  const handleNavigate = (sessionId: string, messageIndex: number) => {
    restoreChat(sessionId);
    setSearchTabSelected(false);
    setActiveSession(sessionId);
    // Defer scroll to next frame so the DOM updates first
    requestAnimationFrame(() => {
      setScrollToMessage({ sessionId, messageIndex });
    });
  };

  if (searchResults.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">No results found</p>
      </div>
    );
  }

  // Group results by session
  const grouped = new Map<string, typeof searchResults>();
  for (const result of searchResults) {
    const existing = grouped.get(result.sessionId) ?? [];
    existing.push(result);
    grouped.set(result.sessionId, existing);
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 px-6 py-6">
        <div className="text-xs text-muted-foreground/50">
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} in {grouped.size}{" "}
          session{grouped.size !== 1 ? "s" : ""}
        </div>
        {[...grouped.entries()].map(([sessionId, results]) => (
          <div key={sessionId} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-muted-foreground">{results[0].sessionName}</span>
              <span className="text-muted-foreground/30">
                {results[0].projectName}
                {results[0].worktreeBranch ? ` / ${results[0].worktreeBranch}` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {results.map((result) => (
                <button
                  key={`${result.sessionId}-${result.messageIndex}`}
                  type="button"
                  className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
                  onClick={() => handleNavigate(result.sessionId, result.messageIndex)}
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={
                        result.role === "user" ? "text-primary/70" : "text-muted-foreground/60"
                      }
                    >
                      {result.role === "user" ? "you" : "claude"}
                    </span>
                    <span className="text-muted-foreground/30">{formatTime(result.timestamp)}</span>
                  </div>
                  <div className="line-clamp-2 text-xs text-foreground/80">
                    <HighlightedSnippet text={result.text} query={searchQuery} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
