import type { SearchResult } from "./store.ts";
import type { ProjectWithWorktrees, SessionInfo } from "@kodeck/shared";
import type { ChatSessionData } from "./store.ts";

export type SearchScope = "session" | "project" | "all";

export function performSearch(
  query: string,
  scope: SearchScope,
  opts: {
    activeSessionId: string | null;
    selectedWorktreePath: string | null;
    projects: ProjectWithWorktrees[];
    sessions: SessionInfo[];
    chatData: Map<string, ChatSessionData>;
  },
): SearchResult[] {
  if (!query.trim()) return [];

  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  // Determine which sessions to search
  let sessionIds: string[];
  if (scope === "session") {
    sessionIds = opts.activeSessionId ? [opts.activeSessionId] : [];
  } else if (scope === "project") {
    const selectedProject = opts.projects.find((p) =>
      p.worktrees.some((wt) => wt.path === opts.selectedWorktreePath),
    );
    const projectPaths = new Set(selectedProject?.worktrees.map((wt) => wt.path) ?? []);
    sessionIds = opts.sessions
      .filter((s) => s.type === "chat" && projectPaths.has(s.worktreePath))
      .map((s) => s.id);
  } else {
    sessionIds = opts.sessions.filter((s) => s.type === "chat").map((s) => s.id);
  }

  // Build a lookup: worktreePath → { projectName, branch }
  const worktreeInfo = new Map<string, { projectName: string; branch: string }>();
  for (const project of opts.projects) {
    for (const wt of project.worktrees) {
      worktreeInfo.set(wt.path, { projectName: project.name, branch: wt.branch });
    }
  }

  for (const sessionId of sessionIds) {
    const data = opts.chatData.get(sessionId);
    if (!data) continue;
    const session = opts.sessions.find((s) => s.id === sessionId);
    const sessionName = session?.name ?? "Chat";
    const wtInfo = session ? worktreeInfo.get(session.worktreePath) : undefined;

    for (let i = 0; i < data.messages.length; i++) {
      const msg = data.messages[i];
      const text = msg.role === "user" ? msg.content : msg.text;
      if (text.toLowerCase().includes(lower)) {
        results.push({
          sessionId,
          sessionName,
          projectName: wtInfo?.projectName ?? "",
          worktreeBranch: wtInfo?.branch ?? "",
          messageIndex: i,
          role: msg.role,
          text,
          timestamp: msg.timestamp ?? 0,
        });
      }
    }
  }

  return results;
}
