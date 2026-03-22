import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  GitBranch,
  FolderGit2,
  Plus,
} from "lucide-react";
import type { ProjectWithWorktrees, WorktreeInfo } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import { Button } from "./ui/button.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";

function WorktreeItem({
  worktree,
  isSelected,
  onSelect,
}: {
  worktree: WorktreeInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
        isSelected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
      }`}
      onClick={onSelect}
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{worktree.branch}</span>
    </button>
  );
}

function ProjectItem({ project }: { project: ProjectWithWorktrees }) {
  const [expanded, setExpanded] = useState(true);
  const { selectedWorktreePath, selectWorktree } = useAppStore();

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
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
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {project.worktrees.map((wt) => (
            <WorktreeItem
              key={wt.path}
              worktree={wt}
              isSelected={selectedWorktreePath === wt.path}
              onSelect={() => selectWorktree(wt.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { projects } = useAppStore();

  const handleAddProject = () => {
    sendMessage({ type: "dialog.pickFolder" });
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex h-10 items-center justify-between border-b border-sidebar-border px-3">
        <span className="text-sm font-semibold text-sidebar-foreground">
          Projects
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </div>
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
