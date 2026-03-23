import { describe, it, expect } from "vitest";
import { performSearch } from "./search-utils.ts";
import type { ChatSessionData } from "./store.ts";
import type { ProjectWithWorktrees, SessionInfo } from "@kodeck/shared";

function makeSession(id: string, name: string, worktreePath: string): SessionInfo {
  return { id, name, type: "chat", worktreePath, createdAt: Date.now() };
}

function makeChatData(
  messages: Array<{ role: "user"; content: string } | { role: "assistant"; text: string }>,
): ChatSessionData {
  return {
    messages: messages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content, timestamp: Date.now() }
        : {
            role: "assistant" as const,
            text: m.text,
            toolCalls: [],
            contentBlocks: [],
            isStreaming: false,
            timestamp: Date.now(),
          },
    ),
    state: "idle",
    inputHistory: [],
  };
}

function makeProject(id: string, name: string, worktreePaths: string[]): ProjectWithWorktrees {
  return {
    id,
    name,
    repoPath: `/repo/${name}`,
    worktrees: worktreePaths.map((p, i) => ({
      path: p,
      branch: `branch-${i}`,
      isMain: i === 0,
      ahead: 0,
      behind: 0,
    })),
  };
}

describe("performSearch", () => {
  const sessions = [
    makeSession("s1", "Session 1", "/wt/main"),
    makeSession("s2", "Session 2", "/wt/feature"),
    makeSession("s3", "Session 3", "/wt/other-project"),
  ];

  const chatData = new Map<string, ChatSessionData>([
    [
      "s1",
      makeChatData([
        { role: "user", content: "hello world" },
        { role: "assistant", text: "Hi there!" },
      ]),
    ],
    [
      "s2",
      makeChatData([
        { role: "user", content: "fix the model" },
        { role: "assistant", text: "I updated the model configuration." },
      ]),
    ],
    ["s3", makeChatData([{ role: "user", content: "deploy to production" }])],
  ]);

  const projects = [
    makeProject("p1", "kodeck", ["/wt/main", "/wt/feature"]),
    makeProject("p2", "other", ["/wt/other-project"]),
  ];

  it("returns empty for empty query", () => {
    const results = performSearch("", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toEqual([]);
  });

  it("returns empty for whitespace query", () => {
    const results = performSearch("   ", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toEqual([]);
  });

  it("searches all sessions with scope 'all'", () => {
    const results = performSearch("model", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toHaveLength(2); // "fix the model" + "updated the model"
    expect(results.every((r) => r.sessionId === "s2")).toBe(true);
  });

  it("searches only active session with scope 'session'", () => {
    const results = performSearch("hello", "session", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("s1");
    expect(results[0].role).toBe("user");
  });

  it("searches only project sessions with scope 'project'", () => {
    const results = performSearch("the", "project", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    // "fix the model" and "updated the model" are in s2 (same project)
    // "Hi there!" is in s1 (same project)
    const sessionIds = new Set(results.map((r) => r.sessionId));
    expect(sessionIds.has("s3")).toBe(false); // other project excluded
  });

  it("is case insensitive", () => {
    const results = performSearch("HELLO", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("hello world");
  });

  it("includes project and worktree info in results", () => {
    const results = performSearch("hello", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results[0].projectName).toBe("kodeck");
    expect(results[0].worktreeBranch).toBe("branch-0");
    expect(results[0].sessionName).toBe("Session 1");
  });

  it("returns correct messageIndex", () => {
    const results = performSearch("updated", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toHaveLength(1);
    expect(results[0].messageIndex).toBe(1); // second message (assistant)
    expect(results[0].role).toBe("assistant");
  });

  it("returns empty when no active session for scope 'session'", () => {
    const results = performSearch("hello", "session", {
      activeSessionId: null,
      selectedWorktreePath: "/wt/main",
      projects,
      sessions,
      chatData,
    });
    expect(results).toEqual([]);
  });

  it("skips terminal sessions", () => {
    const terminalSession: SessionInfo = {
      id: "t1",
      name: "Terminal",
      type: "terminal",
      worktreePath: "/wt/main",
      createdAt: Date.now(),
    };
    const results = performSearch("hello", "all", {
      activeSessionId: "s1",
      selectedWorktreePath: "/wt/main",
      projects,
      sessions: [...sessions, terminalSession],
      chatData,
    });
    expect(results.every((r) => r.sessionId !== "t1")).toBe(true);
  });
});
