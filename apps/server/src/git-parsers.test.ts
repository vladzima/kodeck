import { describe, it, expect } from "vitest";
import { parseGitStatus, parseGitLog, parseWorktreeList } from "./git-parsers.ts";

describe("parseGitStatus", () => {
  it("parses staged modified files", () => {
    const { staged, unstaged } = parseGitStatus("M  src/index.ts\n");
    expect(staged).toEqual([{ path: "src/index.ts", status: "M" }]);
    expect(unstaged).toEqual([]);
  });

  it("parses unstaged modified files", () => {
    const { staged, unstaged } = parseGitStatus(" M src/index.ts\n");
    expect(staged).toEqual([]);
    expect(unstaged).toEqual([{ path: "src/index.ts", status: "M" }]);
  });

  it("parses both staged and unstaged on same file", () => {
    const { staged, unstaged } = parseGitStatus("MM src/index.ts\n");
    expect(staged).toEqual([{ path: "src/index.ts", status: "M" }]);
    expect(unstaged).toEqual([{ path: "src/index.ts", status: "M" }]);
  });

  it("parses untracked files", () => {
    const { staged, unstaged } = parseGitStatus("?? new-file.txt\n");
    expect(staged).toEqual([]);
    expect(unstaged).toEqual([{ path: "new-file.txt", status: "?" }]);
  });

  it("parses added files", () => {
    const { staged, unstaged } = parseGitStatus("A  src/new.ts\n");
    expect(staged).toEqual([{ path: "src/new.ts", status: "A" }]);
    expect(unstaged).toEqual([]);
  });

  it("parses deleted files", () => {
    const { staged, unstaged } = parseGitStatus("D  old-file.ts\n");
    expect(staged).toEqual([{ path: "old-file.ts", status: "D" }]);
    expect(unstaged).toEqual([]);
  });

  it("handles renames (arrow notation)", () => {
    const { staged } = parseGitStatus("R  old-name.ts -> new-name.ts\n");
    expect(staged).toEqual([{ path: "new-name.ts", status: "R" }]);
  });

  it("handles multiple files", () => {
    const output = ["M  src/a.ts", " M src/b.ts", "A  src/c.ts", "?? src/d.ts", ""].join("\n");
    const { staged, unstaged } = parseGitStatus(output);
    expect(staged).toHaveLength(2);
    expect(unstaged).toHaveLength(2);
    expect(staged[0].path).toBe("src/a.ts");
    expect(staged[1].path).toBe("src/c.ts");
    expect(unstaged[0].path).toBe("src/b.ts");
    expect(unstaged[1].path).toBe("src/d.ts");
  });

  it("returns empty arrays for empty input", () => {
    const { staged, unstaged } = parseGitStatus("");
    expect(staged).toEqual([]);
    expect(unstaged).toEqual([]);
  });
});

describe("parseGitLog", () => {
  it("parses single commit", () => {
    const commits = parseGitLog("abc1234 fix: resolve bug\n");
    expect(commits).toEqual([{ hash: "abc1234", message: "fix: resolve bug" }]);
  });

  it("parses multiple commits", () => {
    const output = "abc1234 first commit\ndef5678 second commit\n";
    const commits = parseGitLog(output);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({ hash: "abc1234", message: "first commit" });
    expect(commits[1]).toEqual({ hash: "def5678", message: "second commit" });
  });

  it("handles commit messages with spaces", () => {
    const commits = parseGitLog("abc1234 feat: add multiple word message here\n");
    expect(commits[0].message).toBe("feat: add multiple word message here");
  });

  it("returns empty array for empty input", () => {
    expect(parseGitLog("")).toEqual([]);
  });
});

describe("parseWorktreeList", () => {
  it("parses single worktree", () => {
    const output = ["worktree /home/user/project", "branch refs/heads/main", ""].join("\n");
    const worktrees = parseWorktreeList(output);
    expect(worktrees).toEqual([
      { path: "/home/user/project", branch: "main", isMain: true, ahead: 0, behind: 0 },
    ]);
  });

  it("parses multiple worktrees, first is main", () => {
    const output = [
      "worktree /home/user/project",
      "branch refs/heads/main",
      "",
      "worktree /home/user/project-feature",
      "branch refs/heads/feature/login",
      "",
    ].join("\n");
    const worktrees = parseWorktreeList(output);
    expect(worktrees).toHaveLength(2);
    expect(worktrees[0].isMain).toBe(true);
    expect(worktrees[0].branch).toBe("main");
    expect(worktrees[1].isMain).toBe(false);
    expect(worktrees[1].branch).toBe("feature/login");
  });

  it("handles detached HEAD (no branch line)", () => {
    const output = ["worktree /home/user/project", "HEAD abc1234", "detached", ""].join("\n");
    const worktrees = parseWorktreeList(output);
    expect(worktrees[0].branch).toBe("(detached)");
  });

  it("skips bare repo entries", () => {
    const output = [
      "worktree /home/user/project.git",
      "bare",
      "",
      "worktree /home/user/project",
      "branch refs/heads/main",
      "",
    ].join("\n");
    const worktrees = parseWorktreeList(output);
    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].path).toBe("/home/user/project");
  });

  it("returns empty array for empty input", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });
});
