import { execFile as execFileCb } from "node:child_process";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, stat, cp } from "node:fs/promises";
import type {
  ProjectWithWorktrees,
  WorktreeInfo,
  WorktreePRInfo,
  BranchInfo,
  PRSearchResult,
} from "@kodeck/shared";
import { loadConfig, saveConfig } from "./config.ts";

const execFile = promisify(execFileCb);

// ── Git helper: worktree status (ahead/behind + PR info) ─────────────

export async function getWorktreeStatus(
  worktreePath: string,
  branch: string,
): Promise<{ ahead: number; behind: number; pr?: WorktreePRInfo }> {
  // ahead/behind
  let ahead = 0;
  let behind = 0;
  try {
    const { stdout } = await execFile(
      "git",
      ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
      { cwd: worktreePath },
    );
    const parts = stdout.trim().split(/\s+/);
    ahead = Number.parseInt(parts[0] ?? "0", 10) || 0;
    behind = Number.parseInt(parts[1] ?? "0", 10) || 0;
  } catch {
    // no upstream or other error — keep 0/0
  }

  // PR info
  let pr: WorktreePRInfo | undefined;
  try {
    const { stdout } = await execFile(
      "gh",
      ["pr", "view", branch, "--json", "number,title,url,state,statusCheckRollup,reviewDecision"],
      { cwd: worktreePath },
    );
    const data = JSON.parse(stdout);

    // Map state
    const stateMap: Record<string, WorktreePRInfo["status"]> = {
      OPEN: "open",
      CLOSED: "closed",
      MERGED: "merged",
    };
    const status: WorktreePRInfo["status"] = stateMap[data.state] ?? "open";

    // Map CI status
    let ciStatus: WorktreePRInfo["ciStatus"] = "pending";
    const checks: Array<{ status?: string; conclusion?: string }> = data.statusCheckRollup ?? [];
    if (checks.length > 0) {
      if (checks.some((c) => c.conclusion === "FAILURE")) {
        ciStatus = "failure";
      } else if (checks.every((c) => c.conclusion === "SUCCESS")) {
        ciStatus = "success";
      }
    }

    // Map review status
    let reviewStatus: WorktreePRInfo["reviewStatus"] = "pending";
    if (data.reviewDecision === "APPROVED") {
      reviewStatus = "approved";
    } else if (data.reviewDecision === "CHANGES_REQUESTED") {
      reviewStatus = "changes_requested";
    }

    pr = {
      number: data.number,
      title: data.title,
      url: data.url,
      status,
      ciStatus,
      reviewStatus,
    };
  } catch {
    // No PR or gh not available
  }

  return { ahead, behind, pr };
}

// ── List worktrees ───────────────────────────────────────────────────

export async function listWorktrees(
  repoPath: string,
  opts?: { includeStatus?: boolean },
): Promise<WorktreeInfo[]> {
  const { stdout } = await execFile("git", ["worktree", "list", "--porcelain"], {
    cwd: repoPath,
  });

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      // branch refs/heads/main → main
      current.branch = line.slice("branch ".length).replace("refs/heads/", "");
    } else if (line === "bare") {
      // skip bare repos worktree entry
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

  // Optionally enrich with status info
  if (opts?.includeStatus) {
    await Promise.all(
      worktrees.map(async (wt) => {
        const status = await getWorktreeStatus(wt.path, wt.branch);
        wt.ahead = status.ahead;
        wt.behind = status.behind;
        wt.pr = status.pr;
      }),
    );
  }

  return worktrees;
}

// ── Projects CRUD ────────────────────────────────────────────────────

export async function getProjects(): Promise<ProjectWithWorktrees[]> {
  const config = await loadConfig();
  const results: ProjectWithWorktrees[] = [];

  for (const project of config.projects) {
    try {
      const worktrees = await listWorktrees(project.repoPath);
      results.push({ ...project, worktrees });
    } catch {
      // If we can't list worktrees, include project with empty list
      results.push({ ...project, worktrees: [] });
    }
  }

  return results;
}

export async function addProject(repoPath: string, name?: string): Promise<ProjectWithWorktrees[]> {
  const config = await loadConfig();

  // Check if already added
  if (config.projects.some((p) => p.repoPath === repoPath)) {
    return getProjects();
  }

  config.projects.push({
    id: randomUUID(),
    name: name ?? basename(repoPath),
    repoPath,
  });

  await saveConfig(config);
  return getProjects();
}

export async function removeProject(projectId: string): Promise<ProjectWithWorktrees[]> {
  const config = await loadConfig();
  config.projects = config.projects.filter((p) => p.id !== projectId);
  await saveConfig(config);
  return getProjects();
}

// ── List remote branches ─────────────────────────────────────────────

export async function listRemoteBranches(repoPath: string): Promise<BranchInfo[]> {
  // Fetch latest
  try {
    await execFile("git", ["fetch", "--prune"], { cwd: repoPath });
  } catch {
    // fetch failed — continue with stale data
  }

  try {
    const { stdout } = await execFile(
      "git",
      [
        "branch",
        "-r",
        "--sort=-committerdate",
        "--format=%(refname:short)|%(committerdate:relative)|%(authorname)",
      ],
      { cwd: repoPath },
    );

    const branches: BranchInfo[] = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      // Skip HEAD pointer entries
      if (line.includes("HEAD")) continue;

      const [rawName, lastCommitDate, author] = line.split("|");
      if (!rawName) continue;

      // Strip "origin/" prefix
      const name = rawName.replace(/^origin\//, "");

      branches.push({
        name,
        lastCommitDate: lastCommitDate ?? "",
        author: author ?? "",
      });
    }

    return branches;
  } catch {
    return [];
  }
}

// ── Search PRs ───────────────────────────────────────────────────────

export async function searchPRs(repoPath: string, query: string): Promise<PRSearchResult[]> {
  try {
    const args = ["pr", "list", "--json", "number,title,author,headRefName,state", "--limit", "20"];
    if (query.trim()) {
      args.push("--search", query);
    }

    const { stdout } = await execFile("gh", args, { cwd: repoPath });
    const data: Array<{
      number: number;
      title: string;
      author: { login: string };
      headRefName: string;
      state: string;
    }> = JSON.parse(stdout);

    return data.map((pr) => {
      const stateMap: Record<string, PRSearchResult["status"]> = {
        OPEN: "open",
        CLOSED: "closed",
        MERGED: "merged",
      };
      return {
        number: pr.number,
        title: pr.title,
        author: pr.author?.login ?? "",
        headBranch: pr.headRefName,
        status: stateMap[pr.state] ?? "open",
      };
    });
  } catch {
    return [];
  }
}

// ── Scan copy paths from .gitignore ──────────────────────────────────

export async function scanCopyPaths(worktreePath: string): Promise<string[]> {
  let content: string;
  try {
    content = await readFile(join(worktreePath, ".gitignore"), "utf-8");
  } catch {
    return [];
  }

  const candidates: string[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    // Skip comments, blank lines, negations
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;

    let pattern = line;
    // Strip **/ prefixes
    pattern = pattern.replace(/^\*\*\//, "");
    // Strip leading /
    pattern = pattern.replace(/^\//, "");

    // Skip glob-only patterns (contain * or ? after stripping)
    if (pattern.includes("*") || pattern.includes("?")) continue;
    // Strip trailing /
    pattern = pattern.replace(/\/$/, "");

    if (pattern) candidates.push(pattern);
  }

  // Check which paths actually exist
  const existing: string[] = [];
  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await stat(join(worktreePath, candidate));
        existing.push(candidate);
      } catch {
        // does not exist
      }
    }),
  );

  return existing;
}

// ── Copy worktree files ──────────────────────────────────────────────

export async function copyWorktreeFiles(
  sourcePath: string,
  targetPath: string,
  patterns: string[],
): Promise<{ copied: string[]; failed: string[] }> {
  const copied: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    patterns.map(async (pattern) => {
      const src = join(sourcePath, pattern);
      const dest = join(targetPath, pattern);
      try {
        const info = await stat(src);
        if (info.isDirectory()) {
          await cp(src, dest, { recursive: true });
        } else {
          await cp(src, dest);
        }
        copied.push(pattern);
      } catch {
        failed.push(pattern);
      }
    }),
  );

  return { copied, failed };
}

// ── Get default branch ───────────────────────────────────────────────

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFile(
      "git",
      ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
      { cwd: repoPath },
    );
    // stdout is like "origin/main" — strip the prefix
    return stdout.trim().replace(/^origin\//, "");
  } catch {
    return "main";
  }
}

// ── Create worktree ──────────────────────────────────────────────────

export async function createWorktree(
  repoPath: string,
  source:
    | { type: "new-branch"; name: string; base: string }
    | { type: "existing-branch"; name: string }
    | { type: "pr"; number: number; branch: string },
): Promise<{ worktrees: WorktreeInfo[]; newWorktreePath: string }> {
  const branch =
    source.type === "new-branch"
      ? source.name
      : source.type === "existing-branch"
        ? source.name
        : source.branch;
  const dest = join(repoPath, "..", `${basename(repoPath)}-${branch}`);

  if (source.type === "new-branch") {
    // Fetch latest before branching
    try {
      await execFile("git", ["fetch"], { cwd: repoPath });
    } catch {
      // continue anyway
    }
    await execFile("git", ["worktree", "add", "-b", source.name, dest, source.base], {
      cwd: repoPath,
    });
  } else {
    // existing-branch or pr — try checking out existing, fallback to tracking
    const branchName = source.type === "existing-branch" ? source.name : source.branch;
    try {
      await execFile("git", ["worktree", "add", dest, branchName], { cwd: repoPath });
    } catch {
      await execFile(
        "git",
        ["worktree", "add", "--track", "-b", branchName, dest, `origin/${branchName}`],
        { cwd: repoPath },
      );
    }
  }

  const worktrees = await listWorktrees(repoPath);
  return { worktrees, newWorktreePath: dest };
}

// ── Remove worktree ──────────────────────────────────────────────────

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<WorktreeInfo[]> {
  await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
    cwd: repoPath,
  });
  return listWorktrees(repoPath);
}

// ── Pull worktree ────────────────────────────────────────────────────

export async function pullWorktree(worktreePath: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", ["pull", "--ff-only"], { cwd: worktreePath });
    return stdout;
  } catch (err) {
    const message =
      err instanceof Error
        ? ((err as Error & { stderr?: string }).stderr ?? err.message)
        : String(err);
    return message;
  }
}

// ── Push worktree ────────────────────────────────────────────────────

export async function pushWorktree(worktreePath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFile("git", ["push"], { cwd: worktreePath });
    return stdout + stderr;
  } catch (err) {
    const message =
      err instanceof Error
        ? ((err as Error & { stderr?: string }).stderr ?? err.message)
        : String(err);
    return message;
  }
}
