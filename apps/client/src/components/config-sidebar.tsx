import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { ConfigEntry } from "@kodeck/shared";
import { useAppStore } from "../store.ts";
import { sendMessage } from "../hooks/use-websocket.ts";

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
  stripPrefix,
}: {
  entry: ConfigEntry;
  isActive: boolean;
  onClick: () => void;
  stripPrefix?: string;
}) {
  let displayName = entry.name.includes("/") ? entry.name.split("/").pop()! : entry.name;
  if (stripPrefix && displayName.startsWith(stripPrefix)) {
    displayName = displayName.slice(stripPrefix.length);
  }
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
  activeKey,
  onOpen,
}: {
  type: ConfigEntry["type"];
  entries: ConfigEntry[];
  activeKey: string | null;
  onOpen: (entry: ConfigEntry) => void;
}) {
  const [open, setOpen] = useState(false);

  // Group by directory prefix (gsd/foo.md) or hyphen prefix (gsd-foo.md)
  const prefixGroups = new Map<string, ConfigEntry[]>();
  const flat: ConfigEntry[] = [];

  for (const entry of entries) {
    const slashIdx = entry.name.indexOf("/");
    if (slashIdx > 0) {
      const prefix = entry.name.slice(0, slashIdx);
      const list = prefixGroups.get(prefix + "/") ?? [];
      list.push(entry);
      prefixGroups.set(prefix + "/", list);
    } else {
      flat.push(entry);
    }
  }

  // Detect common hyphen prefixes among flat entries (e.g. gsd-foo.md, gsd-bar.md)
  const hyphenCounts = new Map<string, number>();
  for (const entry of flat) {
    const hyphenIdx = entry.name.indexOf("-");
    if (hyphenIdx > 0) {
      const prefix = entry.name.slice(0, hyphenIdx);
      hyphenCounts.set(prefix, (hyphenCounts.get(prefix) ?? 0) + 1);
    }
  }

  const ungrouped: ConfigEntry[] = [];
  for (const entry of flat) {
    const hyphenIdx = entry.name.indexOf("-");
    const prefix = hyphenIdx > 0 ? entry.name.slice(0, hyphenIdx) : null;
    if (prefix && (hyphenCounts.get(prefix) ?? 0) >= 3) {
      const key = prefix + "-";
      const list = prefixGroups.get(key) ?? [];
      list.push(entry);
      prefixGroups.set(key, list);
    } else {
      ungrouped.push(entry);
    }
  }

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
              isActive={activeKey === `${entry.path}:${entry.name}`}
              onClick={() => onOpen(entry)}
            />
          ))}
          {subGroups.map((group) => (
            <ConfigSubGroup
              key={group.prefix}
              prefix={group.prefix}
              entries={group.entries}
              activeKey={activeKey}
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
  activeKey,
  onOpen,
}: {
  prefix: string;
  entries: ConfigEntry[];
  activeKey: string | null;
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
        <span>{prefix.endsWith("/") ? prefix : `${prefix}*`}</span>
        <span className="text-muted-foreground/30">({entries.length})</span>
      </button>
      {open && (
        <div className="pl-2">
          {entries.map((entry) => (
            <ConfigEntryButton
              key={entry.path + entry.name}
              entry={entry}
              isActive={activeKey === `${entry.path}:${entry.name}`}
              onClick={() => onOpen(entry)}
              stripPrefix={prefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Config list — used in chat right sidebar and config tab sidebar */
export function ConfigList({ alwaysHighlight }: { alwaysHighlight?: boolean } = {}) {
  const selectedWorktreePath = useAppStore((s) => s.selectedWorktreePath);
  const configEntries = useAppStore((s) => s.configEntries);
  const configViewFile = useAppStore((s) => s.configViewFile);
  const configTabSelected = useAppStore((s) => s.configTabSelected);

  useEffect(() => {
    if (selectedWorktreePath) {
      sendMessage({ type: "config.scan", worktreePath: selectedWorktreePath });
    }
  }, [selectedWorktreePath]);

  const grouped = new Map<ConfigEntry["type"], ConfigEntry[]>();
  for (const entry of configEntries) {
    const list = grouped.get(entry.type) ?? [];
    list.push(entry);
    grouped.set(entry.type, list);
  }

  const activeKey =
    alwaysHighlight || configTabSelected
      ? configViewFile
        ? `${configViewFile.path}:${configViewFile.name}`
        : null
      : null;

  if (configEntries.length === 0) {
    return <span className="text-muted-foreground/30">No configs found</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {CONFIG_TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => (
        <ConfigTypeSection
          key={type}
          type={type}
          entries={grouped.get(type)!}
          activeKey={activeKey}
          onOpen={(entry) => {
            useAppStore
              .getState()
              .setConfigViewFile({ path: entry.path, name: entry.name, content: "" });
            sendMessage({ type: "config.read", filePath: entry.path });
          }}
        />
      ))}
    </div>
  );
}

export function ConfigSidebar() {
  const MIN_WIDTH = 140;
  const MAX_WIDTH = 360;
  const STORAGE_KEY = "kodeck-config-sidebar-width";
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(stored))) : 200;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
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
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
        onMouseDown={handleDragStart}
      />
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
          Configs
        </span>
        <div className="mt-2">
          <ConfigList alwaysHighlight />
        </div>
      </div>
    </div>
  );
}
