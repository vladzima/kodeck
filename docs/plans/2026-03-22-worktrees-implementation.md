# Worktrees Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full worktree management — create from branches/PRs with file copy setup, remove with session cleanup, display branch sync + PR metadata in sidebar, 30s status polling.

**Architecture:** Extend shared types with rich `WorktreeInfo` (ahead/behind/PR). Server gets new git helpers (`getWorktreeStatus`, `getBranches`, `searchPRs`, `copyWorktreeFiles`), a 30s polling loop, and expanded message handlers. Client gets a creation modal with 3 tabs and an enriched sidebar `WorktreeItem` with hover overlay.

**Tech Stack:** TypeScript, React, Radix Dialog, Tailwind, `git` CLI, `gh` CLI, node `child_process`.

---

### Task 1: Extend Shared Types

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Update `WorktreeInfo` with status and PR fields**

Add after the existing `WorktreeInfo` interface (replace it):

```typescript
export interface WorktreePRInfo {
  number: number;
  title: string;
  url: string;
  status: "open" | "closed" | "merged";
  ciStatus?: "pending" | "success" | "failure";
  reviewStatus?: "pending" | "approved" | "changes_requested";
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  ahead: number;
  behind: number;
  pr?: WorktreePRInfo;
}
```

**Step 2: Add `worktreeCopyPaths` to `ProjectConfig`**

```typescript
export interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  worktreeCopyPaths?: string[];
}
```

**Step 3: Add new client→server message types**

Replace the existing `WorktreeCreateMessage` and `WorktreeRemoveMessage`, and add new ones:

```typescript
export interface WorktreeCreateMessage {
  type: "worktree.create";
  projectId: string;
  source:
    | { type: "new-branch"; name: string; base: string }
    | { type: "existing-branch"; name: string }
    | { type: "pr"; number: number };
  copyFromPath: string;
  copyPaths: string[];
  saveCopyConfig: boolean;
}

export interface WorktreeRemoveMessage {
  type: "worktree.remove";
  projectId: string;
  worktreePath: string;
}

export interface WorktreePullMessage {
  type: "worktree.pull";
  worktreePath: string;
}

export interface WorktreePushMessage {
  type: "worktree.push";
  worktreePath: string;
}

export interface WorktreeListBranchesMessage {
  type: "worktree.listBranches";
  projectId: string;
}

export interface WorktreeSearchPRsMessage {
  type: "worktree.searchPRs";
  projectId: string;
  query: string;
}

export interface WorktreeScanCopyPathsMessage {
  type: "worktree.scanCopyPaths";
  worktreePath: string;
}
```

**Step 4: Add new server→client message types**

```typescript
export interface BranchInfo {
  name: string;
  lastCommitDate: string;
  author: string;
}

export interface PRSearchResult {
  number: number;
  title: string;
  author: string;
  headBranch: string;
  status: "open" | "closed" | "merged";
}

export interface WorktreeStatusEvent {
  type: "worktree.status";
  projectId: string;
  worktrees: WorktreeInfo[];
}

export interface WorktreeBranchListEvent {
  type: "worktree.branchList";
  projectId: string;
  branches: BranchInfo[];
}

export interface WorktreePRListEvent {
  type: "worktree.prList";
  projectId: string;
  prs: PRSearchResult[];
}

export interface WorktreeCopyPathsEvent {
  type: "worktree.copyPaths";
  worktreePath: string;
  paths: string[];
}

export interface WorktreeOperationResultEvent {
  type: "worktree.operationResult";
  operation: "pull" | "push" | "create" | "remove";
  success: boolean;
  message?: string;
}
```

**Step 5: Add all new types to `ClientMessage` and `ServerMessage` unions**

Add `WorktreePullMessage`, `WorktreePushMessage`, `WorktreeListBranchesMessage`, `WorktreeSearchPRsMessage`, `WorktreeScanCopyPathsMessage` to `ClientMessage`.

Add `WorktreeStatusEvent`, `WorktreeBranchListEvent`, `WorktreePRListEvent`, `WorktreeCopyPathsEvent`, `WorktreeOperationResultEvent` to `ServerMessage`.

**Step 6: Verify types compile**

Run: `cd /Users/vladvarbatov/Projects/kodeck && npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: No errors.

**Step 7: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: extend shared types for worktree management"
```

---

### Task 2: Server Git Helpers

**Files:**
- Modify: `apps/server/src/projects.ts`

**Step 1: Add `getWorktreeStatus` — ahead/behind + PR info for each worktree**

```typescript
export async function getWorktreeStatus(worktreePath: string, branch: string): Promise<{
  ahead: number;
  behind: number;
  pr?: WorktreePRInfo;
}> {
  let ahead = 0;
  let behind = 0;

  // Get ahead/behind counts
  try {
    const { stdout } = await execFile(
      "git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
      { cwd: worktreePath },
    );
    const [a, b] = stdout.trim().split(/\s+/);
    ahead = Number(a) || 0;
    behind = Number(b) || 0;
  } catch {
    // No upstream or other error — leave as 0/0
  }

  // Check for PR via gh CLI
  let pr: WorktreePRInfo | undefined;
  try {
    const { stdout } = await execFile(
      "gh", ["pr", "view", branch, "--json", "number,title,url,state,statusCheckRollup,reviewDecision"],
      { cwd: worktreePath },
    );
    const data = JSON.parse(stdout);
    if (data.number) {
      const ciChecks = data.statusCheckRollup ?? [];
      let ciStatus: WorktreePRInfo["ciStatus"];
      if (ciChecks.length > 0) {
        const hasFailure = ciChecks.some((c: { conclusion?: string }) => c.conclusion === "FAILURE");
        const allSuccess = ciChecks.every((c: { conclusion?: string }) => c.conclusion === "SUCCESS");
        ciStatus = hasFailure ? "failure" : allSuccess ? "success" : "pending";
      }

      let reviewStatus: WorktreePRInfo["reviewStatus"];
      if (data.reviewDecision === "APPROVED") reviewStatus = "approved";
      else if (data.reviewDecision === "CHANGES_REQUESTED") reviewStatus = "changes_requested";
      else if (data.reviewDecision) reviewStatus = "pending";

      const stateMap: Record<string, WorktreePRInfo["status"]> = {
        OPEN: "open", CLOSED: "closed", MERGED: "merged",
      };

      pr = {
        number: data.number,
        title: data.title,
        url: data.url,
        status: stateMap[data.state] ?? "open",
        ciStatus,
        reviewStatus,
      };
    }
  } catch {
    // gh not installed or not a GitHub repo — no PR info
  }

  return { ahead, behind, pr };
}
```

**Step 2: Update `listWorktrees` to include status**

Change `listWorktrees` to return enriched `WorktreeInfo` with ahead/behind/pr by calling `getWorktreeStatus` for each worktree. Add a `quick` parameter — when `true`, skip status (used for fast listing during creation).

```typescript
export async function listWorktrees(
  repoPath: string,
  opts?: { includeStatus?: boolean },
): Promise<WorktreeInfo[]> {
  // ... existing porcelain parsing ...
  // After building basic worktrees array:

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
```

**Step 3: Add `listRemoteBranches`**

```typescript
export async function listRemoteBranches(repoPath: string): Promise<BranchInfo[]> {
  // Fetch latest
  try {
    await execFile("git", ["fetch", "--prune"], { cwd: repoPath });
  } catch { /* ignore fetch errors */ }

  const { stdout } = await execFile(
    "git",
    ["branch", "-r", "--sort=-committerdate", "--format=%(refname:short)|%(committerdate:relative)|%(authorname)"],
    { cwd: repoPath },
  );

  return stdout
    .trim()
    .split("\n")
    .filter((line) => line && !line.includes("HEAD"))
    .map((line) => {
      const [raw, lastCommitDate, author] = line.split("|");
      // Strip "origin/" prefix
      const name = raw.replace(/^origin\//, "");
      return { name, lastCommitDate: lastCommitDate ?? "", author: author ?? "" };
    });
}
```

**Step 4: Add `searchPRs`**

```typescript
export async function searchPRs(repoPath: string, query: string): Promise<PRSearchResult[]> {
  const args = ["pr", "list", "--json", "number,title,author,headRefName,state", "--limit", "20"];
  if (query) args.push("--search", query);

  const { stdout } = await execFile("gh", args, { cwd: repoPath });
  const prs = JSON.parse(stdout) as Array<{
    number: number;
    title: string;
    author: { login: string };
    headRefName: string;
    state: string;
  }>;

  const stateMap: Record<string, PRSearchResult["status"]> = {
    OPEN: "open", CLOSED: "closed", MERGED: "merged",
  };

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    headBranch: pr.headRefName,
    status: stateMap[pr.state] ?? "open",
  }));
}
```

**Step 5: Add `scanCopyPaths` — parse .gitignore and find existing paths**

```typescript
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { glob } from "node:fs/promises";

export async function scanCopyPaths(worktreePath: string): Promise<string[]> {
  // Read .gitignore
  let gitignoreContent = "";
  try {
    gitignoreContent = await readFile(join(worktreePath, ".gitignore"), "utf-8");
  } catch {
    return [];
  }

  const candidates = gitignoreContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    // Only keep top-level patterns (not deeply nested like **/foo)
    .filter((line) => !line.startsWith("**/"))
    // Strip leading /
    .map((line) => line.replace(/^\//, ""));

  // Check which patterns actually have files on disk
  const existing: string[] = [];
  for (const pattern of candidates) {
    const fullPath = join(worktreePath, pattern.replace(/\*.*$/, "").replace(/\/$/, ""));
    try {
      await stat(fullPath);
      existing.push(pattern);
    } catch {
      // Doesn't exist — skip
    }
  }

  return existing;
}
```

**Step 6: Add `copyWorktreeFiles` — copy selected paths from source to target**

```typescript
import { cp } from "node:fs/promises";

export async function copyWorktreeFiles(
  sourcePath: string,
  targetPath: string,
  patterns: string[],
): Promise<{ copied: string[]; failed: string[] }> {
  const copied: string[] = [];
  const failed: string[] = [];

  for (const pattern of patterns) {
    // Handle glob patterns (e.g. ".env*")
    const cleanPattern = pattern.replace(/\/$/, "");
    const sourceFull = join(sourcePath, cleanPattern);

    try {
      const s = await stat(sourceFull);
      const targetFull = join(targetPath, cleanPattern);
      await cp(sourceFull, targetFull, { recursive: s.isDirectory() });
      copied.push(pattern);
    } catch {
      failed.push(pattern);
    }
  }

  return { copied, failed };
}
```

**Step 7: Add `getDefaultBranch`**

```typescript
export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFile(
      "git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
      { cwd: repoPath },
    );
    return stdout.trim().replace(/^origin\//, "");
  } catch {
    return "main"; // Fallback
  }
}
```

**Step 8: Update `createWorktree` to handle the new source types**

```typescript
export async function createWorktree(
  repoPath: string,
  source:
    | { type: "new-branch"; name: string; base: string }
    | { type: "existing-branch"; name: string }
    | { type: "pr"; number: number; branch: string },
): Promise<{ worktrees: WorktreeInfo[]; newWorktreePath: string }> {
  let branch: string;

  if (source.type === "new-branch") {
    branch = source.name;
  } else if (source.type === "existing-branch") {
    branch = source.name;
  } else {
    branch = source.branch;
  }

  const dest = join(repoPath, "..", `${basename(repoPath)}-${branch}`);

  if (source.type === "new-branch") {
    // Fetch to make sure base is up to date
    try { await execFile("git", ["fetch"], { cwd: repoPath }); } catch { /* */ }
    await execFile("git", ["worktree", "add", "-b", branch, dest, source.base], { cwd: repoPath });
  } else {
    // existing-branch or pr — checkout existing remote branch
    try { await execFile("git", ["fetch"], { cwd: repoPath }); } catch { /* */ }
    try {
      await execFile("git", ["worktree", "add", dest, branch], { cwd: repoPath });
    } catch {
      // If the branch only exists on remote, track it
      await execFile("git", ["worktree", "add", "--track", "-b", branch, dest, `origin/${branch}`], { cwd: repoPath });
    }
  }

  const worktrees = await listWorktrees(repoPath);
  return { worktrees, newWorktreePath: dest };
}
```

**Step 9: Add `pullWorktree` and `pushWorktree`**

```typescript
export async function pullWorktree(worktreePath: string): Promise<string> {
  const { stdout } = await execFile("git", ["pull", "--ff-only"], { cwd: worktreePath });
  return stdout.trim();
}

export async function pushWorktree(worktreePath: string): Promise<string> {
  const { stdout, stderr } = await execFile("git", ["push"], { cwd: worktreePath });
  return (stdout + stderr).trim();
}
```

**Step 10: Verify server compiles**

Run: `cd /Users/vladvarbatov/Projects/kodeck && npx tsc --noEmit -p apps/server/tsconfig.json`
Expected: No errors (may need to adjust imports).

**Step 11: Commit**

```bash
git add apps/server/src/projects.ts
git commit -m "feat: add git helpers for worktree status, branches, PRs, and file copy"
```

---

### Task 3: Server Config — `worktreeCopyPaths` Persistence

**Files:**
- Modify: `apps/server/src/config.ts`

**Step 1: Update config type and add helper to update project copy paths**

```typescript
export async function updateProjectCopyPaths(
  projectId: string,
  copyPaths: string[],
): Promise<void> {
  const config = await loadConfig();
  const project = config.projects.find((p) => p.id === projectId);
  if (project) {
    project.worktreeCopyPaths = copyPaths;
    await saveConfig(config);
  }
}
```

**Step 2: Commit**

```bash
git add apps/server/src/config.ts
git commit -m "feat: add worktreeCopyPaths persistence to project config"
```

---

### Task 4: Server Router — Worktree Message Handlers + Status Polling

**Files:**
- Modify: `apps/server/src/router.ts`

**Step 1: Add imports for new functions**

Add to the imports from `./projects.ts`:
`listRemoteBranches`, `searchPRs`, `scanCopyPaths`, `copyWorktreeFiles`, `getDefaultBranch`, `pullWorktree`, `pushWorktree`

Add import from `./config.ts`:
`updateProjectCopyPaths`

**Step 2: Rewrite `worktree.create` handler**

The new handler:
1. Resolves the branch name (for PR source, look up headBranch via `gh pr view`)
2. Calls the new `createWorktree` with the source object
3. Copies files from `copyFromPath` to new worktree path using `copyWorktreeFiles`
4. If `saveCopyConfig`, calls `updateProjectCopyPaths`
5. Broadcasts updated project list
6. Sends operation result with success/failure message

**Step 3: Rewrite `worktree.remove` handler**

The new handler:
1. Kills all sessions whose `worktreePath` matches
2. Cleans up session state maps (sessionInfos, sessionMessages, etc.)
3. Removes persisted sessions
4. Calls `removeWorktree`
5. Broadcasts updated project list + session closures
6. Sends operation result

**Step 4: Add `worktree.pull` handler**

Calls `pullWorktree(msg.worktreePath)`. Broadcasts result. On error, sends error message.

**Step 5: Add `worktree.push` handler**

Calls `pushWorktree(msg.worktreePath)`. Broadcasts result. On error, sends error message.

**Step 6: Add `worktree.listBranches` handler**

Calls `listRemoteBranches(project.repoPath)`. Sends `WorktreeBranchListEvent` back to requesting client.

**Step 7: Add `worktree.searchPRs` handler**

Calls `searchPRs(project.repoPath, msg.query)`. Sends `WorktreePRListEvent` back to requesting client.

**Step 8: Add `worktree.scanCopyPaths` handler**

Calls `scanCopyPaths(msg.worktreePath)`. Sends `WorktreeCopyPathsEvent` back.

**Step 9: Add 30s status polling loop**

```typescript
let statusPollInterval: ReturnType<typeof setInterval> | null = null;

export function startWorktreeStatusPolling(): void {
  if (statusPollInterval) return;
  statusPollInterval = setInterval(async () => {
    if (connectedClients.size === 0) return; // No clients, skip

    try {
      const config = await loadConfig();
      for (const project of config.projects) {
        try {
          const worktrees = await listWorktrees(project.repoPath, { includeStatus: true });
          broadcast({ type: "worktree.status", projectId: project.id, worktrees });
        } catch { /* skip project on error */ }
      }
    } catch { /* skip cycle on error */ }
  }, 30_000);
}

export function stopWorktreeStatusPolling(): void {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}
```

Call `startWorktreeStatusPolling()` from `registerClient` (only starts once). Call `stopWorktreeStatusPolling()` from server shutdown.

**Step 10: Also trigger a status refresh after create/remove/pull/push operations**

After any of these operations succeed, do a quick status poll for that project and broadcast.

**Step 11: Verify server compiles**

Run: `cd /Users/vladvarbatov/Projects/kodeck && npx tsc --noEmit -p apps/server/tsconfig.json`

**Step 12: Commit**

```bash
git add apps/server/src/router.ts
git commit -m "feat: add worktree handlers for create/remove/pull/push/branches/PRs and status polling"
```

---

### Task 5: Client Store — Worktree State

**Files:**
- Modify: `apps/client/src/store.ts`

**Step 1: Add worktree-related state to AppState**

```typescript
// In AppState interface, add:
branches: BranchInfo[];
setBranches: (branches: BranchInfo[]) => void;
prSearchResults: PRSearchResult[];
setPRSearchResults: (prs: PRSearchResult[]) => void;
scanCopyPaths: string[];
setScanCopyPaths: (paths: string[]) => void;
worktreeCreateModalOpen: boolean;
setWorktreeCreateModalOpen: (open: boolean) => void;
worktreeCreateProjectId: string | null;
setWorktreeCreateProjectId: (id: string | null) => void;
```

**Step 2: Add `updateWorktreeStatus` action**

When a `worktree.status` event arrives, find the project in `projects` and replace its `worktrees` array:

```typescript
updateWorktreeStatus: (projectId: string, worktrees: WorktreeInfo[]) =>
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, worktrees } : p,
    ),
  })),
```

**Step 3: Implement the store actions**

Standard Zustand `set()` implementations for each action.

**Step 4: Commit**

```bash
git add apps/client/src/store.ts
git commit -m "feat: add worktree state management to client store"
```

---

### Task 6: Client WebSocket — Handle New Events

**Files:**
- Modify: `apps/client/src/hooks/use-websocket.ts`

**Step 1: Add handlers for new server events**

Add cases in the message handler switch:

- `worktree.status` → call `updateWorktreeStatus(msg.projectId, msg.worktrees)`
- `worktree.branchList` → call `setBranches(msg.branches)`
- `worktree.prList` → call `setPRSearchResults(msg.prs)`
- `worktree.copyPaths` → call `setScanCopyPaths(msg.paths)`
- `worktree.operationResult` → show toast/notification (or just log for now)

**Step 2: Commit**

```bash
git add apps/client/src/hooks/use-websocket.ts
git commit -m "feat: handle worktree status and modal events in WebSocket"
```

---

### Task 7: Sidebar — Enriched `WorktreeItem` with Hover Overlay

**Files:**
- Modify: `apps/client/src/components/sidebar.tsx`

**Step 1: Rewrite `WorktreeItem` with rich display**

Two lines:
- Line 1: Branch name (left), sync indicators (right) — `↑N ↓N`
- Line 2: PR info if present — `#123 · ● passing · ✓ Approved`

Sync indicators: dimmed when 0, colored when non-zero (green for ahead, orange for behind).

PR metadata line:
- CI dot: green for success, red for failure, yellow for pending
- Review: checkmark for approved, X for changes_requested, clock for pending

**Step 2: Add hover overlay**

On hover, a full-width overlay covers the worktree item with action icons:
- Pull (ArrowDown icon) — sends `worktree.pull`
- Push (ArrowUp icon) — sends `worktree.push`
- Remove (Trash2 icon) — opens confirmation, then sends `worktree.remove`

Not shown for `isMain` worktrees.

**Step 3: Persistent pull nudge**

When `behind > 0`, show the pull button/indicator persistently (not just on hover). Style it with a subtle background or border to draw attention.

**Step 4: Add "+" button next to project name**

In `ProjectItem`, add a Plus icon button next to the project name. On click, set `worktreeCreateModalOpen = true` and `worktreeCreateProjectId = project.id` in the store.

**Step 5: Verify it renders (visual check)**

Run dev server and confirm sidebar shows enriched worktree items.

**Step 6: Commit**

```bash
git add apps/client/src/components/sidebar.tsx
git commit -m "feat: enriched sidebar worktree items with status, hover overlay, and create button"
```

---

### Task 8: Creation Modal — Shell and Tab Navigation

**Files:**
- Create: `apps/client/src/components/worktree-create-modal.tsx`

**Step 1: Create the modal component with 3 tabs**

Uses the existing Dialog component. Tab bar at top: "New Branch" | "Existing Branch" | "Pull Request".

State:
- `activeTab`: "new-branch" | "existing-branch" | "pr"
- `selectedCopyFrom`: worktree path (defaults to `selectedWorktreePath`)
- `copyPaths`: string[] — checked items
- `saveCopyConfig`: boolean

The modal reads `worktreeCreateModalOpen` and `worktreeCreateProjectId` from store.

The Dialog should use `sm:max-w-lg` (override the default `sm:max-w-sm`) to give enough room.

**Step 2: "Copy from" dropdown and file checkboxes section**

Below the tabs, show:
- "Copy from" dropdown listing all worktrees of the current project
- Checkbox list of copy paths (loaded from config or scanned)
- "Save for future worktrees" checkbox

When `selectedCopyFrom` changes, send `worktree.scanCopyPaths` to server (unless project has `worktreeCopyPaths` config).

**Step 3: Create button**

Assembles the `worktree.create` message with the correct source type and sends it. Closes modal on success.

**Step 4: Commit**

```bash
git add apps/client/src/components/worktree-create-modal.tsx
git commit -m "feat: worktree creation modal shell with tabs and copy config"
```

---

### Task 9: Creation Modal — New Branch Tab

**Files:**
- Modify: `apps/client/src/components/worktree-create-modal.tsx`

**Step 1: Implement the New Branch tab content**

- Text input for branch name (with validation — no spaces, valid git ref)
- "Based on" dropdown — lists local branches, defaults to main/master (fetched via `getDefaultBranch` or from worktrees list)

**Step 2: Commit**

```bash
git add apps/client/src/components/worktree-create-modal.tsx
git commit -m "feat: new branch tab in worktree creation modal"
```

---

### Task 10: Creation Modal — Existing Branch Tab

**Files:**
- Modify: `apps/client/src/components/worktree-create-modal.tsx`

**Step 1: Implement the Existing Branch tab**

- On tab activation, send `worktree.listBranches` to server
- Show a search input that filters the returned branches client-side
- Each row: branch name, last commit date, author
- Clicking a row selects it (highlighted)
- Use ScrollArea for the branch list (max height)

**Step 2: Commit**

```bash
git add apps/client/src/components/worktree-create-modal.tsx
git commit -m "feat: existing branch tab in worktree creation modal"
```

---

### Task 11: Creation Modal — Pull Request Tab

**Files:**
- Modify: `apps/client/src/components/worktree-create-modal.tsx`

**Step 1: Implement the PR tab**

- Search input — on typing (debounced 300ms), send `worktree.searchPRs` to server
- Results list: `#123 — PR title — author — status badge`
- Clicking a row selects it
- If `gh` is not available, show a disabled state message

**Step 2: Commit**

```bash
git add apps/client/src/components/worktree-create-modal.tsx
git commit -m "feat: pull request tab in worktree creation modal"
```

---

### Task 12: Wire Modal into App

**Files:**
- Modify: `apps/client/src/App.tsx` (or wherever the root layout is)

**Step 1: Add `WorktreeCreateModal` to the app root**

Import and render `<WorktreeCreateModal />` alongside the existing layout. It reads its open state from the store, so no props needed.

**Step 2: End-to-end test**

- Click "+" on a project in sidebar → modal opens
- Create worktree from new branch → worktree appears in sidebar
- Create worktree from existing branch → works
- Create worktree from PR → works
- File copy options work
- Remove worktree from sidebar → sessions killed, worktree gone

**Step 3: Commit**

```bash
git add apps/client/src/App.tsx apps/client/src/components/worktree-create-modal.tsx
git commit -m "feat: wire worktree creation modal into app root"
```

---

### Task 13: Worktree Remove Confirmation Dialog

**Files:**
- Modify: `apps/client/src/components/sidebar.tsx`

**Step 1: Add confirmation dialog for worktree removal**

When the trash icon is clicked on a worktree hover overlay:
1. Count active sessions in that worktree
2. Show a Dialog: "Remove worktree `branch-name`? This will kill N active sessions and delete the directory."
3. On confirm: send `worktree.remove` message
4. If the removed worktree was selected, auto-select the main worktree

**Step 2: Commit**

```bash
git add apps/client/src/components/sidebar.tsx
git commit -m "feat: worktree removal confirmation dialog"
```

---

### Task 14: Lint and Type Check

**Files:**
- All modified files

**Step 1: Run linter**

Run: `cd /Users/vladvarbatov/Projects/kodeck && npx vp lint`
Fix any issues.

**Step 2: Run type checker**

Run: `cd /Users/vladvarbatov/Projects/kodeck && npx tsc --noEmit`
Fix any type errors.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and type errors from worktree feature"
```
