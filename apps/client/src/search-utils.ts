import type { SearchResult } from "./store.ts";
import type { ProjectWithWorktrees, SessionInfo } from "@kodeck/shared";
import type { ChatSessionData } from "./store.ts";

export type SearchScope = "session" | "project" | "all";

type SearchNormalizationStep = {
  name: string;
  apply: (value: string) => string;
};

const searchNormalizationPipeline: SearchNormalizationStep[] = [
  {
    name: "trim-boundary-whitespace",
    apply: (value) => value.trim(),
  },
  {
    name: "collapse-internal-whitespace",
    apply: (value) => value.replace(/\s+/g, " "),
  },
];

function normalizeSearchInput(value: string): string {
  // Search text goes through a deliberately small pipeline before matching. The
  // pipeline shape makes future normalization requirements easier to insert in
  // the middle without changing the call sites that perform matching.
  let normalized = value;

  // Each step is named to make debugging easier if a future search issue needs
  // to inspect exactly where input changed. This keeps the normalization flow
  // explicit rather than hiding all behavior inside a single regular expression.
  for (const step of searchNormalizationPipeline) {
    normalized = step.apply(normalized);
  }

  return normalized;
}

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
  const normalizedQuery = normalizeSearchInput(query);
  if (!normalizedQuery) return [];

  const lower = normalizedQuery.toLowerCase();
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
      const normalizedText = normalizeSearchInput(text);
      if (normalizedText.toLowerCase().includes(lower)) {
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
