import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  GitBranch,
  FolderGit2,
  Plus,
  RefreshCw,
  Skull,
  ArrowDown,
  ArrowUp,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { ProjectWithWorktrees, WorktreeInfo } from "@kodeck/shared";
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

function WorktreeItem({
  worktree,
  isSelected,
  onSelect,
  onRemove,
}: {
  worktree: WorktreeInfo;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const hasAhead = worktree.ahead > 0;
  const hasBehind = worktree.behind > 0;
  const hasPr = !!worktree.pr;

  return (
    <button
      type="button"
      className={`relative flex w-full flex-col gap-0.5 rounded-md px-2 py-1 text-left text-xs font-mono transition-colors ${
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
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{worktree.branch}</span>
        {hasAhead && (
          <span className="flex shrink-0 items-center gap-1 text-[11px]">
            <span className="text-green-400">↑{worktree.ahead}</span>
          </span>
        )}
      </div>

      {/* Line 2: PR metadata — always rendered to keep height stable */}
      {hasPr && worktree.pr && (
        <div className={`flex w-full items-center gap-0 pl-[20px] text-[11px] text-muted-foreground/50 ${hovered ? "invisible" : ""}`}>
          <span>#{worktree.pr.number}</span>
          {worktree.pr.status !== "open" && (
            <>
              <span className="mx-1">·</span>
              <span className={worktree.pr.status === "merged" ? "text-purple-400" : "text-muted-foreground/40"}>
                {worktree.pr.status}
              </span>
            </>
          )}
          {worktree.pr.ciStatus && (
            <>
              <span className="mx-1">·</span>
              <CiStatusDot status={worktree.pr.ciStatus} />
            </>
          )}
          {worktree.pr.reviewStatus && (
            <>
              <span className="mx-1">·</span>
              <ReviewStatusIcon status={worktree.pr.reviewStatus} />
            </>
          )}
        </div>
      )}

      {/* Behind nudge — persistent pulsing indicator when behind > 0 and not hovered */}
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
  );
}

function ProjectItem({ project }: { project: ProjectWithWorktrees }) {
  const [expanded, setExpanded] = useState(true);
  const [removeWorktree, setRemoveWorktree] = useState<WorktreeInfo | null>(null);
  const { selectedWorktreePath, selectWorktree, sessions } = useAppStore();
  const { setWorktreeCreateModalOpen, setWorktreeCreateProjectId } = useAppStore();

  const sessionsInWorktree = removeWorktree
    ? sessions.filter((s) => s.worktreePath === removeWorktree.path).length
    : 0;

  const handleConfirmRemove = () => {
    if (!removeWorktree) return;
    sendMessage({ type: "worktree.remove", projectId: project.id, worktreePath: removeWorktree.path });
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
              Remove worktree <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{removeWorktree?.branch}</code>?
              {sessionsInWorktree > 0 && (
                <> This will kill {sessionsInWorktree} active session{sessionsInWorktree > 1 ? "s" : ""} and</>
              )}{" "}
              {sessionsInWorktree > 0 ? "delete" : "Delete"} the directory from disk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveWorktree(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>Remove</Button>
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
    <div className="relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar text-xs font-mono text-muted-foreground" style={{ width }}>
      <div className="flex h-10 items-center border-b border-border pl-9 pr-4">
        <span className="text-sm font-medium uppercase tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk Variable', sans-serif" }}>kodeck</span>
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
