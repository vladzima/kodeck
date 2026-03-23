import type { WorktreeFileChange, WorktreeCommit, WorktreeInfo } from "@kodeck/shared";

/** Parse `git status --porcelain` output into staged and unstaged file lists. */
export function parseGitStatus(stdout: string): {
  staged: WorktreeFileChange[];
  unstaged: WorktreeFileChange[];
} {
  const staged: WorktreeFileChange[] = [];
  const unstaged: WorktreeFileChange[] = [];

  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const x = line[0]; // index (staged)
    const y = line[1]; // worktree (unstaged)
    const filePath = line.slice(3).split(" -> ").pop()!; // handle renames
    if (x && x !== " " && x !== "?") {
      staged.push({ path: filePath, status: x as WorktreeFileChange["status"] });
    }
    if (y && y !== " ") {
      unstaged.push({
        path: filePath,
        status: x === "?" ? "?" : (y as WorktreeFileChange["status"]),
      });
    }
  }

  return { staged, unstaged };
}

/** Parse `git log --format="%h %s"` output into commit list. */
export function parseGitLog(stdout: string): WorktreeCommit[] {
  const commits: WorktreeCommit[] = [];
  for (const line of stdout.trim().split("\n")) {
    if (!line) continue;
    const spaceIdx = line.indexOf(" ");
    commits.push({
      hash: line.slice(0, spaceIdx),
      message: line.slice(spaceIdx + 1),
    });
  }
  return commits;
}

/** Parse `git worktree list --porcelain` output into worktree list. */
export function parseWorktreeList(stdout: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace("refs/heads/", "");
    } else if (line === "bare") {
      current = {};
    } else if (line === "") {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? "(detached)",
          isMain: worktrees.length === 0,
          ahead: 0,
          behind: 0,
        });
      }
      current = {};
    }
  }

  return worktrees;
}
