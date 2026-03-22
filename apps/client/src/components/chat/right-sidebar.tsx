import { useState, useRef, useEffect } from "react";
import { ChevronDown, Gauge, Radio, Shield } from "lucide-react";
import spinners from "cli-spinners";
import type { ChatSessionState, EffortLevel, SessionMeta } from "@kodeck/shared";

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

  return (
    <div className="flex w-44 shrink-0 flex-col gap-4 border-l border-border px-4 py-4 text-xs font-mono text-muted-foreground">
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
            {streaming ? "live" : "batch"}
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
    </div>
  );
}
