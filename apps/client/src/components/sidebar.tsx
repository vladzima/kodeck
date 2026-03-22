import { useState, useEffect } from "react";
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
} from "lucide-react";
import type { ProjectWithWorktrees, WorktreeInfo } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";

function CiStatusDot({ status }: { status?: "pending" | "success" | "failure" }) {
  if (status === "success") return <span className="text-green-400">●</span>;
  if (status === "failure") return <span className="text-red-400">●</span>;
  if (status === "pending") return <span className="text-yellow-400">●</span>;
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
  projectId,
  isSelected,
  onSelect,
}: {
  worktree: WorktreeInfo;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const hasAhead = worktree.ahead > 0;
  const hasBehind = worktree.behind > 0;
  const hasPr = !!worktree.pr;

  return (
    <button
      type="button"
      className={`relative flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        isSelected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
      }`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Line 1: Branch + sync indicators */}
      <div className="flex w-full items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{worktree.branch}</span>
        {!hovered && (hasAhead || hasBehind) && (
          <span className="flex shrink-0 items-center gap-1 text-xs">
            {hasAhead && <span className="text-green-400">↑{worktree.ahead}</span>}
            {hasBehind && (
              <span
                className="cursor-pointer rounded px-0.5 text-orange-400 transition-colors hover:bg-orange-400/20"
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage({ type: "worktree.pull", worktreePath: worktree.path });
                }}
                title="Pull changes"
              >
                ↓{worktree.behind}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Line 2: PR metadata */}
      {!hovered && hasPr && worktree.pr && (
        <div className="flex w-full items-center gap-0 pl-5 text-xs text-sidebar-foreground/50">
          <span>#{worktree.pr.number}</span>
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
        <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-sidebar-accent/90">
          <button
            type="button"
            className="rounded-sm p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            className="rounded-sm p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={(e) => {
              e.stopPropagation();
              sendMessage({ type: "worktree.push", worktreePath: worktree.path });
            }}
            title="Push"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          {!worktree.isMain && (
            <button
              type="button"
              className="rounded-sm p-1 text-red-400/60 transition-colors hover:bg-red-400/10 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                sendMessage({ type: "worktree.remove", projectId, worktreePath: worktree.path });
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
  const { selectedWorktreePath, selectWorktree } = useAppStore();
  const { setWorktreeCreateModalOpen, setWorktreeCreateProjectId } = useAppStore();

  return (
    <div>
      <div className="flex w-full items-center gap-0">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project.name}</span>
        </button>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setWorktreeCreateProjectId(project.id);
            setWorktreeCreateModalOpen(true);
          }}
          title="Add worktree"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {project.worktrees.map((wt) => (
            <WorktreeItem
              key={wt.path}
              worktree={wt}
              projectId={project.id}
              isSelected={selectedWorktreePath === wt.path}
              onSelect={() => selectWorktree(wt.path)}
            />
          ))}
        </div>
      )}
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
        <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
          Claude Processes ({debugProcesses.length})
        </span>
        <button
          type="button"
          className="cursor-pointer text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          onClick={() => sendMessage({ type: "debug.listProcesses" })}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      {debugProcesses.length === 0 ? (
        <span className="text-xs text-sidebar-foreground/30">No active processes</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {debugProcesses.map((proc) => (
            <div
              key={proc.pid}
              className="flex items-center justify-between rounded-md bg-sidebar-accent/30 px-2 py-1.5 text-xs"
            >
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="font-mono text-sidebar-foreground">PID {proc.pid}</span>
                <span className="truncate text-sidebar-foreground/50">
                  {proc.sessionId ? `session: ${proc.sessionId.slice(0, 8)}…` : proc.cwd}
                </span>
                <span className="text-sidebar-foreground/40">{formatUptime(proc.uptime)}</span>
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

export function Sidebar() {
  const { projects } = useAppStore();
  const debugMode = useAppStore((s) => s.debugMode);

  const handleAddProject = () => {
    sendMessage({ type: "dialog.pickFolder" });
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex h-10 items-center justify-between border-b border-sidebar-border px-3">
        <span className="text-sm font-semibold text-sidebar-foreground">Projects</span>
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </div>
        {debugMode && (
          <div className="mt-4 border-t border-sidebar-border pt-3">
            <DebugPanel />
          </div>
        )}
      </ScrollArea>
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70"
          onClick={handleAddProject}
        >
          <Plus className="h-4 w-4" />
          Add project
        </Button>
      </div>
    </div>
  );
}
