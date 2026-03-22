import { execFile as execFileCb } from "node:child_process";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { ProjectWithWorktrees, WorktreeInfo } from "@kodeck/shared";
import { loadConfig, saveConfig } from "./config.ts";

const execFile = promisify(execFileCb);

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
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
        });
      }
      current = {};
    }
  }

  return worktrees;
}

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

export async function addProject(
  repoPath: string,
  name?: string,
): Promise<ProjectWithWorktrees[]> {
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

export async function removeProject(
  projectId: string,
): Promise<ProjectWithWorktrees[]> {
  const config = await loadConfig();
  config.projects = config.projects.filter((p) => p.id !== projectId);
  await saveConfig(config);
  return getProjects();
}

export async function createWorktree(
  repoPath: string,
  branch: string,
  targetPath?: string,
): Promise<WorktreeInfo[]> {
  const dest = targetPath ?? join(repoPath, "..", `${basename(repoPath)}-${branch}`);

  try {
    // Try to create from existing branch first
    await execFile("git", ["worktree", "add", dest, branch], { cwd: repoPath });
  } catch {
    // Branch doesn't exist — create a new one
    await execFile("git", ["worktree", "add", "-b", branch, dest], { cwd: repoPath });
  }

  return listWorktrees(repoPath);
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<WorktreeInfo[]> {
  await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
    cwd: repoPath,
  });
  return listWorktrees(repoPath);
}
