# Worktrees Feature Design

Inspired by [Superset Workspaces](https://docs.superset.sh/workspaces), adapted to Kodeck's architecture.

## Data Model

### Extended `WorktreeInfo`

```typescript
interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  ahead: number;              // commits ahead of remote
  behind: number;             // commits behind remote
  pr?: {
    number: number;
    title: string;
    url: string;
    status: "open" | "closed" | "merged";
    ciStatus?: "pending" | "success" | "failure";
    reviewStatus?: "pending" | "approved" | "changes_requested";
  };
}
```

### Extended `ProjectConfig`

```typescript
interface ProjectConfig {
  id: string;
  name: string;
  repoPath: string;
  worktreeCopyPaths?: string[]; // e.g. [".env*", ".claude/"]
}
```

### New Messages

```typescript
// Client → Server
interface WorktreeCreateMessage {
  type: "worktree.create";
  projectId: string;
  source:
    | { type: "new-branch"; name: string; base: string }
    | { type: "existing-branch"; name: string }
    | { type: "pr"; number: number };
  copyFromPath: string;       // worktree path to copy untracked files from
  copyPaths: string[];        // which paths to copy (e.g. [".env", ".claude/"])
  saveCopyConfig: boolean;    // persist copyPaths to project config
}

interface WorktreeRemoveMessage {
  type: "worktree.remove";
  projectId: string;
  worktreePath: string;
}

interface WorktreePullMessage {
  type: "worktree.pull";
  worktreePath: string;
}

interface WorktreePushMessage {
  type: "worktree.push";
  worktreePath: string;
}

// Server → Client (reuses ProjectListEvent, already exists)
// Worktree status updates via a new polling event:
interface WorktreeStatusEvent {
  type: "worktree.status";
  projectId: string;
  worktrees: WorktreeInfo[];
}
```

## Creation Modal

Triggered by a "+" button next to the project name in the sidebar.

### Three Tabs

**New Branch**
- Text input for branch name
- Base branch dropdown (defaults to main/master, lists local branches)

**Existing Branch**
- Searchable/filterable list of remote branches
- Each item shows: branch name, last commit date, author
- Fetched via `git branch -r --sort=-committerdate`

**Pull Request**
- Search field matching PR title, number, or pasted URL
- Results show: `#123 - PR title - author - status badge`
- Fetched via `gh pr list --json number,title,author,headRefName,state`
- Selecting a PR auto-fills the branch name from `headRefName`

### Common Section (below tabs)

**Copy from:** dropdown listing all existing worktrees in the project. Defaults to the currently selected worktree.

**Files to copy:** checkboxes for untracked paths to copy from source worktree.
- If `worktreeCopyPaths` exists in project config: pre-checked from config
- If no config: scan `.gitignore` files in the source worktree, find which ignored paths actually exist on disk, present as checkboxes
- "Save for future worktrees" checkbox — writes selection to `worktreeCopyPaths` in project config

**Create** button at bottom.

### Creation Flow (server-side)

1. Resolve branch name (from tab selection or PR lookup)
2. Run `git worktree add <path> <branch>` (with `-b` for new branches)
3. For each selected copy path, copy from source worktree to new worktree
   - Glob patterns (`.env*`) expanded against source worktree
   - Directories copied recursively
4. If `saveCopyConfig`, update project config
5. Broadcast updated `ProjectListEvent`

## Sidebar Display

### Worktree Item Layout

```
feature/auth              ↑2 ↓1
#347 · ● passing · ✓ Approved
```

**Line 1:** Branch name (left) + sync indicators (right).
- `↑N` = commits ahead of remote, `↓N` = commits behind
- Dimmed/hidden when 0

**Line 2:** PR metadata (only shown if PR linked).
- PR number (`#347`)
- CI status: colored dot (green=passing, red=failing, yellow=pending)
- Review status: checkmark=approved, X=changes requested, clock=pending

### Hover Overlay

On hover, a full-width overlay appears over the worktree item with action icons:
- **Push** (↑ icon) — `git push`
- **Pull** (↓ icon) — `git pull`
- **Remove** (trash icon) — confirmation, then kill sessions + `git worktree remove`

Not shown for main worktree (cannot remove main).

### Persistent Pull Prompt

When `behind > 0`, the pull indicator shows persistently (without hover) as a visual nudge to sync. This replaces the normal sync indicator with an actionable pull button.

## Worktree Removal Flow

1. User clicks trash icon on worktree hover overlay
2. Confirmation dialog: "Remove worktree `feature/auth`? This will kill N active sessions and delete the directory."
3. On confirm:
   a. Kill all sessions with matching `worktreePath`
   b. Run `git worktree remove <path> --force`
   c. If removed worktree was selected, switch to main worktree
   d. Broadcast updated `ProjectListEvent`

## Status Polling

All worktree metadata refreshes every **30 seconds** via server-side polling:

1. For each project, for each worktree:
   - `git rev-list --left-right --count HEAD...@{upstream}` → ahead/behind
   - If branch has a PR: `gh pr view <branch> --json number,title,url,state,statusCheckRollup,reviewDecision`
2. Server compares with previous state; if changed, broadcasts `WorktreeStatusEvent`
3. Client updates store, UI re-renders

PR association is detected automatically: `gh pr list --head <branch>` returns any PR for that branch.

## Git Operations

### Pull

```bash
cd <worktree-path> && git pull --ff-only
```

If fast-forward fails, notify the user (don't force-merge). They can resolve in terminal.

### Push

```bash
cd <worktree-path> && git push
```

If push fails (e.g. no upstream), notify the user with the error.

### Branch Listing

```bash
# Remote branches for "Existing Branch" tab
git fetch --prune && git branch -r --sort=-committerdate --format='%(refname:short)|%(committerdate:relative)|%(authorname)'

# Local branches for "base branch" dropdown
git branch --sort=-committerdate --format='%(refname:short)'
```

### PR Listing

```bash
gh pr list --json number,title,headRefName,author,state,statusCheckRollup,reviewDecision --limit 50
```

## Error Handling

- **No `gh` CLI:** PR tab disabled with message "Install GitHub CLI (`gh`) to create worktrees from PRs"
- **Not a GitHub repo:** PR tab disabled with message "PR integration requires a GitHub remote"
- **Copy fails:** Non-fatal. Worktree is created, user notified which paths failed to copy
- **Worktree remove fails:** Show error from git (e.g. "has uncommitted changes"), suggest `--force` or manual resolution
- **Push/pull failures:** Show git error message in a toast notification
