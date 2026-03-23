import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, FileText, Gauge, Radio, Shield } from "lucide-react";
import spinners from "cli-spinners";
import type { ChatSessionState, ConfigEntry, EffortLevel, SessionMeta } from "@kodeck/shared";
import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";

const agentSpinner = spinners.dots8Bit;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function tokenColorClass(tokens: number, window: number): string {
  const ratio = tokens / window;
  if (ratio >= 0.85) return "text-red-400";
  if (ratio >= 0.65) return "text-yellow-400";
  return "text-muted-foreground";
}

function ActivitySpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % agentSpinner.frames.length);
    }, agentSpinner.interval);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono">{agentSpinner.frames[frame]}</span>;
}

function SidebarGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between text-[11px] uppercase tracking-wider text-foreground transition-colors hover:text-foreground/80"
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="mt-2 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

function shortenModelName(model: string): string {
  return model
    .replace(/^claude-/, "")
    .replace(/-(\d+)-(\d+)(?:-\d+)?$/, " $1.$2")
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

function ModelSelector({
  currentModel,
  onSelect,
}: {
  currentModel: string;
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="cursor-pointer border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {shortenModelName(currentModel)}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg">
          {AVAILABLE_MODELS.map((m) => (
            <div
              key={m.id}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-xs ${
                m.id === currentModel
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (m.id !== currentModel) onSelect(m.id);
                setOpen(false);
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EFFORT_LEVELS: { id: EffortLevel; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
  { id: "auto", label: "Auto" },
];

function EffortSelector({
  current,
  onSelect,
}: {
  current: EffortLevel;
  onSelect: (effort: EffortLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex w-fit cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <Gauge className="h-3.5 w-3.5" />
        {EFFORT_LEVELS.find((e) => e.id === current)?.label ?? current}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[100px] rounded-lg border border-border bg-popover p-1 shadow-lg">
          {EFFORT_LEVELS.map((e) => (
            <div
              key={e.id}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-xs ${
                e.id === current
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent/50"
              }`}
              onMouseDown={(ev) => {
                ev.preventDefault();
                if (e.id !== current) onSelect(e.id);
                setOpen(false);
              }}
            >
              {e.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/40">{label}</span>
      {children}
    </div>
  );
}

export function RightSidebar({
  meta,
  state,
  model,
  effort,
  streaming,
  skipPermissions,
  userTurns,
  assistantTurns,
  visibleMessages,
  onModelChange,
  onEffortChange,
  onStreamingChange,
  onSkipPermissionsChange,
}: {
  meta?: SessionMeta;
  state: ChatSessionState;
  model: string;
  effort: EffortLevel;
  streaming: boolean;
  skipPermissions: boolean;
  userTurns: number;
  assistantTurns: number;
  visibleMessages?: number;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: EffortLevel) => void;
  onStreamingChange: (streaming: boolean) => void;
  onSkipPermissionsChange: (skip: boolean) => void;
}) {
  const hasStats =
    (meta?.contextTokens != null && meta?.contextWindow != null) ||
    meta?.costUsd != null ||
    userTurns > 0 ||
    assistantTurns > 0 ||
    (meta?.compactions ?? 0) > 0;

  const MIN_WIDTH = 140;
  const MAX_WIDTH = 360;
  const STORAGE_KEY = "kodeck-right-sidebar-width";
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(stored))) : 176;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    // Drag left = wider (resize handle is on the left edge)
    const delta = startX.current - e.clientX;
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta)));
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

  return (
    <div
      className="relative flex shrink-0 flex-col border-l border-border text-xs font-mono text-muted-foreground"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
        onMouseDown={handleDragStart}
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {/* Parameters — interactive settings */}
        <SidebarGroup title="Parameters">
          <StatRow label="Model">
            <ModelSelector currentModel={model} onSelect={onModelChange} />
          </StatRow>

          <StatRow label="Effort">
            <EffortSelector current={effort} onSelect={onEffortChange} />
          </StatRow>

          <StatRow label="Streaming">
            <button
              type="button"
              className="flex w-fit cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onStreamingChange(!streaming)}
            >
              <Radio className="h-3.5 w-3.5" />
              {streaming ? "Live" : "Batch"}
            </button>
          </StatRow>

          <StatRow label="Permissions">
            <button
              type="button"
              className="flex w-fit cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onSkipPermissionsChange(!skipPermissions)}
            >
              <Shield className="h-3.5 w-3.5" />
              {skipPermissions ? "Allow all" : "Restricted"}
            </button>
          </StatRow>
        </SidebarGroup>

        {/* Stats — read-only info */}
        {hasStats && (
          <>
            <div className="-mx-4 border-t border-border" />
            <SidebarGroup title="Stats">
              {meta?.contextTokens != null && meta?.contextWindow != null && (
                <StatRow label="Context">
                  <span className={tokenColorClass(meta.contextTokens, meta.contextWindow)}>
                    {formatTokens(meta.contextTokens)} / {formatTokens(meta.contextWindow)}
                  </span>
                </StatRow>
              )}

              {meta?.costUsd != null && (
                <StatRow label="Cost">
                  <span>${meta.costUsd.toFixed(2)}</span>
                </StatRow>
              )}

              {(userTurns > 0 || assistantTurns > 0) && (
                <StatRow label="Messages">
                  <span>
                    {userTurns} user · {assistantTurns} claude
                  </span>
                  {visibleMessages != null && (
                    <span className="text-muted-foreground/50">{visibleMessages} visible</span>
                  )}
                </StatRow>
              )}

              {(meta?.compactions ?? 0) > 0 && (
                <StatRow label="Compactions">
                  <span>{meta!.compactions}</span>
                </StatRow>
              )}

              {/* Activity — only while streaming */}
              {state === "streaming" &&
                ((meta?.activeShells ?? 0) > 0 || (meta?.activeAgents ?? 0) > 0) && (
                  <StatRow label="Activity">
                    {(meta?.activeShells ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <ActivitySpinner />
                        {meta!.activeShells} shell{meta!.activeShells! > 1 ? "s" : ""}
                      </span>
                    )}
                    {(meta?.activeAgents ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <ActivitySpinner />
                        {meta!.activeAgents} agent{meta!.activeAgents! > 1 ? "s" : ""}
                      </span>
                    )}
                  </StatRow>
                )}
            </SidebarGroup>
          </>
        )}

        {/* Configs browser */}
        <div className="-mx-4 border-t border-border" />
        <ConfigBrowser />
      </div>
    </div>
  );
}

const CONFIG_TYPE_LABELS: Record<ConfigEntry["type"], string> = {
  "claude-md": "CLAUDE.md",
  skill: "Skills",
  agent: "Agents",
  command: "Commands",
  hook: "Hooks",
  mcp: "MCPs",
  setting: "Settings",
};

const CONFIG_TYPE_ORDER: ConfigEntry["type"][] = [
  "claude-md",
  "skill",
  "command",
  "agent",
  "hook",
  "mcp",
  "setting",
];

function ConfigEntryButton({
  entry,
  isActive,
  onClick,
}: {
  entry: ConfigEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  // Strip prefix (e.g. "gsd/add-phase.md" → "add-phase.md")
  const displayName = entry.name.includes("/") ? entry.name.split("/").pop()! : entry.name;
  return (
    <button
      type="button"
      className={`flex items-center gap-1 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-accent/50 ${
        isActive ? "text-foreground" : "text-muted-foreground/60"
      }`}
      onClick={onClick}
      title={`${entry.path} (${entry.scope})`}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{displayName}</span>
      {entry.scope === "global" && (
        <span className="shrink-0 text-[9px] text-muted-foreground/30">~</span>
      )}
    </button>
  );
}

function ConfigTypeSection({
  type,
  entries,
  configViewFile,
  onOpen,
}: {
  type: ConfigEntry["type"];
  entries: ConfigEntry[];
  configViewFile: { path: string } | null;
  onOpen: (entry: ConfigEntry) => void;
}) {
  const [open, setOpen] = useState(false);

  // Group entries by prefix (e.g. "gsd/" commands)
  const prefixGroups = new Map<string, ConfigEntry[]>();
  const ungrouped: ConfigEntry[] = [];

  for (const entry of entries) {
    const slashIdx = entry.name.indexOf("/");
    if (slashIdx > 0) {
      const prefix = entry.name.slice(0, slashIdx);
      const list = prefixGroups.get(prefix) ?? [];
      list.push(entry);
      prefixGroups.set(prefix, list);
    } else {
      ungrouped.push(entry);
    }
  }

  // Only sub-group if there are 3+ entries with the same prefix
  const subGroups: Array<{ prefix: string; entries: ConfigEntry[] }> = [];
  for (const [prefix, items] of prefixGroups) {
    if (items.length >= 3) {
      subGroups.push({ prefix, entries: items });
    } else {
      ungrouped.push(...items);
    }
  }

  const needsCollapse = entries.length > 5;

  return (
    <div className="flex flex-col gap-0.5">
      {needsCollapse ? (
        <button
          type="button"
          className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDown className="h-2.5 w-2.5" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5" />
          )}
          {CONFIG_TYPE_LABELS[type]} ({entries.length})
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
          {CONFIG_TYPE_LABELS[type]}
        </span>
      )}
      {(!needsCollapse || open) && (
        <div className="flex flex-col gap-0.5">
          {ungrouped.map((entry) => (
            <ConfigEntryButton
              key={entry.path + entry.name}
              entry={entry}
              isActive={configViewFile?.path === entry.path}
              onClick={() => onOpen(entry)}
            />
          ))}
          {subGroups.map((group) => (
            <ConfigSubGroup
              key={group.prefix}
              prefix={group.prefix}
              entries={group.entries}
              configViewFile={configViewFile}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigSubGroup({
  prefix,
  entries,
  configViewFile,
  onOpen,
}: {
  prefix: string;
  entries: ConfigEntry[];
  configViewFile: { path: string } | null;
  onOpen: (entry: ConfigEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        className="flex items-center gap-0.5 pl-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        <span>{prefix}/</span>
        <span className="text-muted-foreground/30">({entries.length})</span>
      </button>
      {open && (
        <div className="pl-2">
          {entries.map((entry) => (
            <ConfigEntryButton
              key={entry.path + entry.name}
              entry={entry}
              isActive={configViewFile?.path === entry.path}
              onClick={() => onOpen(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigBrowser() {
  const selectedWorktreePath = useAppStore((s) => s.selectedWorktreePath);
  const configEntries = useAppStore((s) => s.configEntries);
  const configViewFile = useAppStore((s) => s.configViewFile);

  useEffect(() => {
    if (selectedWorktreePath) {
      sendMessage({ type: "config.scan", worktreePath: selectedWorktreePath });
    }
  }, [selectedWorktreePath]);

  // Group entries by type
  const grouped = new Map<ConfigEntry["type"], ConfigEntry[]>();
  for (const entry of configEntries) {
    const list = grouped.get(entry.type) ?? [];
    list.push(entry);
    grouped.set(entry.type, list);
  }

  return (
    <SidebarGroup title="Configs" defaultOpen={false}>
      {configEntries.length === 0 ? (
        <span className="text-muted-foreground/30">No configs found</span>
      ) : (
        <div className="flex flex-col gap-2">
          {CONFIG_TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => (
            <ConfigTypeSection
              key={type}
              type={type}
              entries={grouped.get(type)!}
              configViewFile={configViewFile}
              onOpen={(entry) => sendMessage({ type: "config.read", filePath: entry.path })}
            />
          ))}
        </div>
      )}
    </SidebarGroup>
  );
}
