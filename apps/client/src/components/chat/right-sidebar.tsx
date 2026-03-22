import { useState, useRef, useEffect } from "react";
import { Radio, Shield } from "lucide-react";
import spinners from "cli-spinners";
import type { ChatSessionState, SessionMeta } from "@kodeck/shared";

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

  return (
    <span className="font-mono">{agentSpinner.frames[frame]}</span>
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

function ModelSelector({ currentModel, onSelect }: { currentModel: string; onSelect: (model: string) => void }) {
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
              className={`cursor-pointer rounded-md px-2 py-1.5 text-[11px] ${
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

export function RightSidebar({
  meta,
  state,
  model,
  streaming,
  skipPermissions,
  userTurns,
  assistantTurns,
  visibleMessages,
  onModelChange,
  onStreamingChange,
  onSkipPermissionsChange,
}: {
  meta?: SessionMeta;
  state: ChatSessionState;
  model: string;
  streaming: boolean;
  skipPermissions: boolean;
  userTurns: number;
  assistantTurns: number;
  visibleMessages?: number;
  onModelChange: (model: string) => void;
  onStreamingChange: (streaming: boolean) => void;
  onSkipPermissionsChange: (skip: boolean) => void;
}) {
  return (
    <div className="flex w-44 shrink-0 flex-col gap-4 border-l border-border px-4 py-4 text-[11px] font-mono text-muted-foreground">
      {/* Model */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Model</span>
        <ModelSelector currentModel={model} onSelect={onModelChange} />
      </div>

      {/* Context */}
      {meta?.contextTokens != null && meta?.contextWindow != null && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Context</span>
          <span className={tokenColorClass(meta.contextTokens, meta.contextWindow)}>
            {formatTokens(meta.contextTokens)} / {formatTokens(meta.contextWindow)}
          </span>
        </div>
      )}

      {/* Cost */}
      {meta?.costUsd != null && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Cost</span>
          <span>${meta.costUsd.toFixed(2)}</span>
        </div>
      )}

      {/* Messages */}
      {(userTurns > 0 || assistantTurns > 0) && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Messages</span>
          <span>{userTurns} user · {assistantTurns} claude</span>
          {visibleMessages != null && (
            <span className="text-muted-foreground/50">{visibleMessages} visible</span>
          )}
        </div>
      )}

      {/* Compactions */}
      {(meta?.compactions ?? 0) > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Compactions</span>
          <span>{meta!.compactions}</span>
        </div>
      )}

      {/* Streaming mode */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Streaming</span>
        <button
          type="button"
          className="flex w-fit cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onStreamingChange(!streaming)}
        >
          <Radio className="h-3 w-3" />
          {streaming ? "live" : "batch"}
        </button>
      </div>

      {/* Permissions */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Permissions</span>
        <button
          type="button"
          className="flex w-fit cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onSkipPermissionsChange(!skipPermissions)}
        >
          <Shield className="h-3 w-3" />
          {skipPermissions ? "Allow all" : "Restricted"}
        </button>
      </div>

      {/* Activity */}
      {state === "streaming" && ((meta?.activeShells ?? 0) > 0 || (meta?.activeAgents ?? 0) > 0) && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Activity</span>
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
        </div>
      )}
    </div>
  );
}
