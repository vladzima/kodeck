import { useState, useEffect } from "react";
import type { PRSearchResult } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog.tsx";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";

type TabId = "new-branch" | "existing-branch" | "pr";

function isValidBranchName(name: string): boolean {
  if (!name.trim()) return true; // Empty is fine (button is disabled)
  if (/[\s~^:?*[\]\\]/.test(name)) return false;
  if (name.includes("..")) return false;
  if (name.includes("@{")) return false;
  if (name.startsWith(".") || name.endsWith(".")) return false;
  if (name.startsWith("/") || name.endsWith("/")) return false;
  if (name.endsWith(".lock")) return false;
  return true;
}

export function WorktreeCreateModal() {
  const open = useAppStore((s) => s.worktreeCreateModalOpen);
  const projectId = useAppStore((s) => s.worktreeCreateProjectId);
  const setOpen = useAppStore((s) => s.setWorktreeCreateModalOpen);
  const projects = useAppStore((s) => s.projects);
  const selectedWorktreePath = useAppStore((s) => s.selectedWorktreePath);
  const branches = useAppStore((s) => s.branches);
  const setBranches = useAppStore((s) => s.setBranches);
  const prSearchResults = useAppStore((s) => s.prSearchResults);
  const setPRSearchResults = useAppStore((s) => s.setPRSearchResults);
  const scannedCopyPaths = useAppStore((s) => s.scannedCopyPaths);
  const setScannedCopyPaths = useAppStore((s) => s.setScannedCopyPaths);
  const lastResult = useAppStore((s) => s.lastOperationResult);
  const setLastResult = useAppStore((s) => s.setLastOperationResult);

  const project = projects.find((p) => p.id === projectId);

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>("new-branch");
  const [branchName, setBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedPR, setSelectedPR] = useState<PRSearchResult | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [prQuery, setPrQuery] = useState("");
  const [copyFromPath, setCopyFromPath] = useState("");
  const [copyPaths, setCopyPaths] = useState<string[]>([]);
  const [saveCopyConfig, setSaveCopyConfig] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab("new-branch");
      setBranchName("");
      setBaseBranch(project?.worktrees.find((w) => w.isMain)?.branch ?? "main");
      setSelectedBranch(null);
      setSelectedPR(null);
      setBranchFilter("");
      setPrQuery("");
      setCopyFromPath(selectedWorktreePath ?? project?.worktrees[0]?.path ?? "");
      setCopyPaths(project?.worktreeCopyPaths ?? []);
      setSaveCopyConfig(false);
      setIsCreating(false);
      setCreateError(null);
      // Clear stale data from previous project
      setBranches([]);
      setPRSearchResults([]);
      setScannedCopyPaths([]);
    }
  }, [open, project, selectedWorktreePath]);

  // Watch for operation result to close modal or show error
  useEffect(() => {
    if (!isCreating || !lastResult) return;
    if (lastResult.operation === "create") {
      if (lastResult.success) {
        setOpen(false);
      } else {
        setCreateError(lastResult.message ?? "Creation failed");
      }
      setIsCreating(false);
      setLastResult(null);
    }
  }, [lastResult, isCreating]);

  // Load branches when "new-branch" or "existing-branch" tab is selected
  useEffect(() => {
    if ((activeTab === "new-branch" || activeTab === "existing-branch") && projectId) {
      sendMessage({ type: "worktree.listBranches", projectId });
    }
  }, [activeTab, projectId]);

  // Debounced PR search
  useEffect(() => {
    if (activeTab !== "pr" || !projectId) return;
    const timer = setTimeout(
      () => {
        sendMessage({ type: "worktree.searchPRs", projectId, query: prQuery });
      },
      prQuery ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [activeTab, projectId, prQuery]);

  // Scan copy paths when copyFromPath changes and no saved config
  useEffect(() => {
    if (!project?.worktreeCopyPaths && copyFromPath) {
      sendMessage({ type: "worktree.scanCopyPaths", worktreePath: copyFromPath });
    }
  }, [copyFromPath, project?.worktreeCopyPaths]);

  // Determine available copy paths
  const availableCopyPaths = project?.worktreeCopyPaths ?? scannedCopyPaths;

  // Filter branches client-side
  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchFilter.toLowerCase()),
  );

  // Can create logic
  const canCreate =
    activeTab === "new-branch"
      ? branchName.trim().length > 0 && isValidBranchName(branchName)
      : activeTab === "existing-branch"
        ? selectedBranch !== null
        : selectedPR !== null;

  const handleCreate = () => {
    if (!projectId || !canCreate) return;
    setIsCreating(true);

    let source: { type: "new-branch"; name: string; base: string } | { type: "existing-branch"; name: string } | { type: "pr"; number: number };
    if (activeTab === "new-branch") {
      source = { type: "new-branch", name: branchName.trim(), base: baseBranch };
    } else if (activeTab === "existing-branch") {
      source = { type: "existing-branch", name: selectedBranch! };
    } else {
      source = { type: "pr", number: selectedPR!.number };
    }

    setCreateError(null);
    sendMessage({
      type: "worktree.create",
      projectId,
      source,
      copyFromPath,
      copyPaths,
      saveCopyConfig,
    });
  };

  const tabLabel = (tab: TabId) =>
    tab === "new-branch" ? "New Branch" : tab === "existing-branch" ? "Existing Branch" : "Pull Request";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create worktree</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["new-branch", "existing-branch", "pr"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "new-branch" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Branch name
              </label>
              <Input
                placeholder="feature/my-feature"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              {branchName && !isValidBranchName(branchName) && (
                <span className="text-xs text-destructive">Invalid branch name</span>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Based on
              </label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
              >
                {[
                  ...new Set([
                    ...(project?.worktrees.map((wt) => wt.branch) ?? []),
                    ...branches.map((b) => b.name),
                  ]),
                ].map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === "existing-branch" && (
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Filter branches..."
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            />
            <ScrollArea className="max-h-48">
              <div className="flex flex-col gap-0.5">
                {filteredBranches.map((branch) => (
                  <button
                    key={branch.name}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selectedBranch === branch.name
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedBranch(branch.name)}
                  >
                    <span className="truncate">{branch.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {branch.lastCommitDate} · {branch.author}
                    </span>
                  </button>
                ))}
                {filteredBranches.length === 0 && (
                  <span className="px-2 py-4 text-center text-xs text-muted-foreground">
                    {branches.length === 0 ? "Loading branches..." : "No matching branches"}
                  </span>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {activeTab === "pr" && (
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Search by title, number, or paste URL..."
              value={prQuery}
              onChange={(e) => setPrQuery(e.target.value)}
            />
            <ScrollArea className="max-h-48">
              <div className="flex flex-col gap-0.5">
                {prSearchResults.map((pr) => (
                  <button
                    key={pr.number}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selectedPR?.number === pr.number
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedPR(pr)}
                  >
                    <span className="shrink-0 text-muted-foreground">#{pr.number}</span>
                    <span className="truncate">{pr.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {pr.author}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        pr.status === "open"
                          ? "bg-green-500/10 text-green-400"
                          : pr.status === "merged"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {pr.status}
                    </span>
                  </button>
                ))}
                {prSearchResults.length === 0 && (
                  <span className="px-2 py-4 text-center text-xs text-muted-foreground">
                    {prQuery ? "No matching PRs" : "Loading PRs..."}
                  </span>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Copy config section */}
        <div className="border-t border-border pt-3">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Copy files from
              </label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={copyFromPath}
                onChange={(e) => setCopyFromPath(e.target.value)}
              >
                {project?.worktrees.map((wt) => (
                  <option key={wt.path} value={wt.path}>
                    {wt.branch} {wt.isMain ? "(main)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {availableCopyPaths.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Files to copy
                </label>
                <div className="flex flex-col gap-1">
                  {availableCopyPaths.map((path) => (
                    <label key={path} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={copyPaths.includes(path)}
                        onChange={(e) => {
                          if (e.target.checked) setCopyPaths([...copyPaths, path]);
                          else setCopyPaths(copyPaths.filter((p) => p !== path));
                        }}
                        className="rounded"
                      />
                      <span className="font-mono text-xs">{path}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!project?.worktreeCopyPaths && availableCopyPaths.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveCopyConfig}
                  onChange={(e) => setSaveCopyConfig(e.target.checked)}
                  className="rounded"
                />
                Save selection for future worktrees
              </label>
            )}
          </div>
        </div>

        {createError && (
          <div className="text-xs text-destructive">{createError}</div>
        )}

        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating || !canCreate}>
            {isCreating ? "Creating..." : "Create worktree"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
