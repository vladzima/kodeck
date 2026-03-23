import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  GitBranch,
  GitCommitHorizontal,
  FolderGit2,
  Plus,
  RefreshCw,
  Skull,
  ArrowDown,
  ArrowUp,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { ProjectWithWorktrees, WorktreeInfo, WorktreeFileChange } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog.tsx";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function AsciiSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[10px] text-muted-foreground/40">{SPINNER_FRAMES[frame]}</span>;
}

function CiStatusDot({ status }: { status?: "pending" | "success" | "failure" }) {
  if (status === "success")
    return <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-green-400" />;
  if (status === "failure")
    return <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-red-400" />;
  if (status === "pending")
    return <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-yellow-400" />;
  return null;
}

function ReviewStatusIcon({ status }: { status?: "pending" | "approved" | "changes_requested" }) {
  if (status === "approved") return <span className="text-green-400">✓</span>;
  if (status === "changes_requested") return <span className="text-red-400">✗</span>;
  if (status === "pending") return <span className="text-yellow-400">○</span>;
  return null;
}

// ── File tree helpers ─────────────────────────────────────────────────

interface FileTreeNode {
  name: string;
  status?: WorktreeFileChange["status"];
  children: FileTreeNode[];
}

function buildFileTree(files: WorktreeFileChange[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      let child = current.children.find((c) => c.name === part && !c.status);
      if (isLeaf) {
        current.children.push({ name: part, status: file.status, children: [] });
      } else {
        if (!child) {
          child = { name: part, children: [] };
          current.children.push(child);
        }
        current = child;
      }
    }
  }

  // Compact single-child directories (apps/client/src → apps/client/src)
  function compact(node: FileTreeNode): FileTreeNode {
    node.children = node.children.map(compact);
    if (!node.status && node.children.length === 1 && !node.children[0].status) {
      return { name: `${node.name}/${node.children[0].name}`, children: node.children[0].children };
    }
    return node;
  }

  return root.children.map(compact);
}

function FileTree({ files, prefix }: { files: WorktreeFileChange[]; prefix: string }) {
  const tree = buildFileTree(files);
  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <FileTreeNode key={`${prefix}-${node.name}`} node={node} prefix={prefix} />
      ))}
    </div>
  );
}

function FileTreeNode({ node, prefix }: { node: FileTreeNode; prefix: string }) {
  const [open, setOpen] = useState(true);

  if (node.status) {
    return (
      <div className="flex items-center gap-1 pl-1">
        <span className={`w-3 shrink-0 text-center font-bold ${fileStatusColor(node.status)}`}>
          {fileStatusLabel(node.status)}
        </span>
        <span className="min-w-0 truncate text-muted-foreground/70">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <div className="ml-[5px] border-l border-border pl-[5px]">
          {node.children.map((child) => (
            <FileTreeNode
              key={`${prefix}-${node.name}/${child.name}`}
              node={child}
              prefix={prefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function fileStatusColor(status: WorktreeFileChange["status"]): string {
  switch (status) {
    case "M":
      return "text-yellow-400";
    case "A":
    case "?":
      return "text-green-400";
    case "D":
      return "text-red-400";
    case "R":
      return "text-blue-400";
    case "U":
      return "text-orange-400";
    default:
      return "text-muted-foreground/50";
  }
}

function fileStatusLabel(status: WorktreeFileChange["status"]): string {
  switch (status) {
    case "M":
      return "M";
    case "A":
      return "A";
    case "D":
      return "D";
    case "R":
      return "R";
    case "?":
      return "?";
    case "U":
      return "U";
    default:
      return status;
  }
}

function WorktreeItem({
  worktree,
  isSelected,
  isStatusFresh,
  onSelect,
  onRemove,
}: {
  worktree: WorktreeInfo;
  isSelected: boolean;
  isStatusFresh: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasAhead = worktree.ahead > 0;
  const hasBehind = worktree.behind > 0;
  const hasPr = !!worktree.pr;
  const hasChanges =
    (worktree.staged?.length ?? 0) > 0 ||
    (worktree.unstaged?.length ?? 0) > 0 ||
    (worktree.unpushed?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-start">
        {/* Expand chevron — always accessible, outside hover overlay */}
        {hasChanges ? (
          <button
            type="button"
            className="shrink-0 px-0.5 py-1 text-muted-foreground/50 transition-colors hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <div className="shrink-0 px-0.5 py-1">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        )}

        {/* Main worktree button with hover overlay */}
        <button
          type="button"
          className={`relative flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1.5 py-1 text-left text-xs font-mono transition-colors ${
            isSelected
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Line 1: Branch + sync indicators */}
          <div className={`flex w-full items-center gap-1.5 ${hovered ? "invisible" : ""}`}>
            <span className="min-w-0 flex-1 truncate">{worktree.branch}</span>
            {hasAhead && (
              <span className="flex shrink-0 items-center gap-1 text-[11px]">
                <span className="text-green-400">↑{worktree.ahead}</span>
              </span>
            )}
          </div>

          {/* Line 2: PR metadata */}
          {hasPr && worktree.pr && (
            <div
              className={`flex w-full items-center gap-0 text-[11px] text-muted-foreground/50 ${hovered ? "invisible" : ""}`}
            >
              <span>#{worktree.pr.number}</span>
              {worktree.pr.status !== "open" && (
                <>
                  <span className="mx-1">·</span>
                  <span
                    className={
                      worktree.pr.status === "merged"
                        ? "text-purple-400"
                        : "text-muted-foreground/40"
                    }
                  >
                    {worktree.pr.status}
                  </span>
                </>
              )}
              {!isStatusFresh && (
                <>
                  <span className="mx-1">·</span>
                  <AsciiSpinner />
                </>
              )}
              {isStatusFresh && worktree.pr.ciStatus && (
                <>
                  <span className="mx-1">·</span>
                  <CiStatusDot status={worktree.pr.ciStatus} />
                </>
              )}
              {isStatusFresh && worktree.pr.reviewStatus && (
                <>
                  <span className="mx-1">·</span>
                  <ReviewStatusIcon status={worktree.pr.reviewStatus} />
                </>
              )}
            </div>
          )}

          {/* Behind nudge */}
          {!hovered && hasBehind && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2">
              <span className="animate-pulse rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                pull
              </span>
            </div>
          )}

          {/* Hover overlay with action icons */}
          {hovered && (
            <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-accent/90">
              <button
                type="button"
                className="rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage({ type: "worktree.pull", worktreePath: worktree.path });
                }}
                title="Pull"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage({ type: "worktree.push", worktreePath: worktree.path });
                }}
                title="Push"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              {worktree.pr && (
                <button
                  type="button"
                  className="rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(worktree.pr!.url, "_blank");
                  }}
                  title={`PR #${worktree.pr.number}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              {!worktree.isMain && (
                <button
                  type="button"
                  className="rounded-sm p-1 text-red-400/60 transition-colors hover:bg-red-400/10 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  title="Remove worktree"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Expandable git details */}
      {expanded && hasChanges && (
        <div className="ml-4 mt-0.5 flex flex-col gap-1 border-l border-border pl-2 text-[10px]">
          {worktree.staged && worktree.staged.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground/40 uppercase tracking-wider">staged</span>
              <FileTree files={worktree.staged} prefix="s" />
            </div>
          )}
          {worktree.unstaged && worktree.unstaged.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground/40 uppercase tracking-wider">unstaged</span>
              <FileTree files={worktree.unstaged} prefix="u" />
            </div>
          )}
          {worktree.unpushed && worktree.unpushed.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground/40 uppercase tracking-wider">unpushed</span>
              {worktree.unpushed.map((c) => (
                <div key={c.hash} className="flex items-center gap-1.5 pl-1">
                  <GitCommitHorizontal className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                  <span className="text-muted-foreground/40">{c.hash}</span>
                  <span className="min-w-0 truncate text-muted-foreground/70">{c.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectItem({ project }: { project: ProjectWithWorktrees }) {
  const [expanded, setExpanded] = useState(true);
  const [removeWorktree, setRemoveWorktree] = useState<WorktreeInfo | null>(null);
  const { selectedWorktreePath, selectWorktree, sessions } = useAppStore();
  const isStatusFresh = useAppStore((s) => s.worktreeStatusFresh.has(project.id));
  const { setWorktreeCreateModalOpen, setWorktreeCreateProjectId } = useAppStore();

  const sessionsInWorktree = removeWorktree
    ? sessions.filter((s) => s.worktreePath === removeWorktree.path).length
    : 0;

  const handleConfirmRemove = () => {
    if (!removeWorktree) return;
    sendMessage({
      type: "worktree.remove",
      projectId: project.id,
      worktreePath: removeWorktree.path,
    });
    // If we're removing the selected worktree, switch to main
    if (selectedWorktreePath === removeWorktree.path) {
      const main = project.worktrees.find((w) => w.isMain);
      if (main) selectWorktree(main.path);
    }
    setRemoveWorktree(null);
  };

  return (
    <div>
      <div className="flex w-full items-center gap-0">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] uppercase tracking-wider text-foreground transition-colors hover:text-foreground/80"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          )}
          <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project.name}</span>
        </button>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-accent/50 hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setWorktreeCreateProjectId(project.id);
            setWorktreeCreateModalOpen(true);
          }}
          title="Add worktree"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {project.worktrees.map((wt) => (
            <WorktreeItem
              key={wt.path}
              worktree={wt}
              isSelected={selectedWorktreePath === wt.path}
              isStatusFresh={isStatusFresh}
              onSelect={() => selectWorktree(wt.path)}
              onRemove={() => setRemoveWorktree(wt)}
            />
          ))}
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeWorktree} onOpenChange={(open) => !open && setRemoveWorktree(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove worktree</DialogTitle>
            <DialogDescription>
              Remove worktree{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                {removeWorktree?.branch}
              </code>
              ?
              {sessionsInWorktree > 0 && (
                <>
                  {" "}
                  This will kill {sessionsInWorktree} active session
                  {sessionsInWorktree > 1 ? "s" : ""} and
                </>
              )}{" "}
              {sessionsInWorktree > 0 ? "delete" : "Delete"} the directory from disk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveWorktree(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
}

function DebugPanel() {
  const debugProcesses = useAppStore((s) => s.debugProcesses);

  // Auto-refresh every 5s
  useEffect(() => {
    const id = setInterval(() => {
      sendMessage({ type: "debug.listProcesses" });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/40">
          Claude Processes ({debugProcesses.length})
        </span>
        <button
          type="button"
          className="cursor-pointer text-muted-foreground/50 transition-colors hover:text-foreground"
          onClick={() => sendMessage({ type: "debug.listProcesses" })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {debugProcesses.length === 0 ? (
        <span className="text-[11px] text-muted-foreground/30">No active processes</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {debugProcesses.map((proc) => (
            <div
              key={proc.pid}
              className="flex items-center justify-between rounded-md bg-accent/30 px-2 py-1 text-xs"
            >
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-foreground">PID {proc.pid}</span>
                <span className="truncate text-muted-foreground/50">
                  {proc.sessionId ? `session: ${proc.sessionId.slice(0, 8)}…` : proc.cwd}
                </span>
                <span className="text-muted-foreground/40">{formatUptime(proc.uptime)}</span>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-sm p-1 text-red-400/60 transition-colors hover:bg-red-400/10 hover:text-red-400"
                onClick={() => sendMessage({ type: "debug.killProcess", pid: proc.pid })}
                title="Kill process"
              >
                <Skull className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;
const STORAGE_KEY = "kodeck-sidebar-width";

export function Sidebar() {
  const { projects } = useAppStore();
  const debugMode = useAppStore((s) => s.debugMode);
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(stored))) : DEFAULT_WIDTH;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
    setWidth(newWidth);
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleAddProject = () => {
    sendMessage({ type: "dialog.pickFolder" });
  };

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar text-xs font-mono text-muted-foreground"
      style={{ width }}
    >
      <div className="flex h-10 items-center border-b border-border pl-9 pr-4">
        <span
          className="text-sm font-medium uppercase tracking-[0.25em] text-foreground"
          style={{ fontFamily: "'Space Grotesk Variable', sans-serif" }}
        >
          kodeck
        </span>
      </div>
      <div className="px-2 pt-3 pb-2">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono text-muted-foreground/60 transition-colors hover:text-foreground"
          onClick={handleAddProject}
        >
          <Plus className="h-3.5 w-3.5" />
          Add project
        </button>
      </div>
      <div className="border-t border-border" />
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="flex flex-col gap-4">
          {projects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </div>
        {debugMode && (
          <div className="mt-4 border-t border-border pt-3">
            <DebugPanel />
          </div>
        )}
      </ScrollArea>
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
        onMouseDown={handleDragStart}
      />
    </div>
  );
}
