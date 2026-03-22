import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRight, Square, SkipForward, Radio } from "lucide-react";
import spinners from "cli-spinners";
import { Button } from "../ui/button.tsx";
import { CommandPalette } from "./command-palette.tsx";
import type { ChatSessionState, SessionMeta } from "@kodeck/shared";

const agentSpinner = spinners.dots8Bit;

interface ChatInputProps {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  onModelChange: (model: string) => void;
  onSkipPermissionsChange: (skip: boolean) => void;
  onStreamingChange: (streaming: boolean) => void;
  state: ChatSessionState;
  inputHistory: string[];
  slashCommands: string[];
  meta?: SessionMeta;
  model: string;
  skipPermissions: boolean;
  streaming: boolean;
}

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

  const shortName = shortenModelName(currentModel);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="cursor-pointer border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {shortName}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg">
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

function ContextSidebar({ meta, state, model, streaming, onModelChange, onStreamingChange }: {
  meta?: SessionMeta;
  state: ChatSessionState;
  model: string;
  streaming: boolean;
  onModelChange: (model: string) => void;
  onStreamingChange: (streaming: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-[11px] font-mono text-muted-foreground">
      {state === "streaming" && (meta?.activeShells ?? 0) > 0 && (
        <span className="flex items-center gap-1">
          <ActivitySpinner />
          {meta!.activeShells} shell{meta!.activeShells! > 1 ? "s" : ""}
        </span>
      )}
      {state === "streaming" && (meta?.activeAgents ?? 0) > 0 && (
        <span className="flex items-center gap-1">
          <ActivitySpinner />
          {meta!.activeAgents} agent{meta!.activeAgents! > 1 ? "s" : ""}
        </span>
      )}
      {meta?.contextTokens != null && meta?.contextWindow != null && (
        <span className={tokenColorClass(meta.contextTokens, meta.contextWindow)}>
          {formatTokens(meta.contextTokens)} context
        </span>
      )}
      <ModelSelector currentModel={model} onSelect={onModelChange} />
      {meta?.costUsd != null && (
        <span>${meta.costUsd.toFixed(2)}</span>
      )}
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onStreamingChange(!streaming)}
      >
        <Radio className="h-3 w-3" />
        {streaming ? "live" : "batch"}
      </button>
    </div>
  );
}

export function ChatInput({
  onSend,
  onInterrupt,
  onModelChange,
  onSkipPermissionsChange,
  onStreamingChange,
  state,
  inputHistory,
  slashCommands,
  meta,
  model,
  skipPermissions,
  streaming,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndex = useRef(-1);
  const lastEscapeTime = useRef(0);

  const showPalette = text.startsWith("/") && state !== "streaming";
  const query = text.slice(1).toLowerCase();
  const filteredCommands = showPalette
    ? slashCommands.filter((cmd) => cmd.toLowerCase().startsWith(query))
    : [];
  const paletteOpen = filteredCommands.length > 0;

  useEffect(() => {
    setPaletteIndex(0);
  }, [text]);

  const selectCommand = useCallback((cmd: string) => {
    setText("/" + cmd + " ");
    textareaRef.current?.focus();
  }, []);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || state === "streaming") return;
    onSend(trimmed);
    setText("");
    historyIndex.current = -1;
  }, [text, state, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (paletteOpen) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setPaletteIndex((i) => (i > 0 ? i - 1 : filteredCommands.length - 1));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPaletteIndex((i) => (i < filteredCommands.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          selectCommand(filteredCommands[paletteIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setText("");
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
        return;
      }

      if (e.key === "Escape") {
        if (state === "streaming") {
          onInterrupt();
          return;
        }
        const now = Date.now();
        if (now - lastEscapeTime.current < 500) {
          setText("");
          lastEscapeTime.current = 0;
        } else {
          lastEscapeTime.current = now;
        }
        return;
      }

      if (e.key === "ArrowUp" && inputHistory.length > 0) {
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart === 0) {
          e.preventDefault();
          const newIndex =
            historyIndex.current < inputHistory.length - 1
              ? historyIndex.current + 1
              : historyIndex.current;
          historyIndex.current = newIndex;
          setText(inputHistory[inputHistory.length - 1 - newIndex] ?? "");
        }
        return;
      }

      if (e.key === "ArrowDown" && historyIndex.current >= 0) {
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionEnd === textarea.value.length) {
          e.preventDefault();
          const newIndex = historyIndex.current - 1;
          historyIndex.current = newIndex;
          setText(
            newIndex >= 0
              ? (inputHistory[inputHistory.length - 1 - newIndex] ?? "")
              : "",
          );
        }
      }
    },
    [send, state, onInterrupt, inputHistory, paletteOpen, filteredCommands, selectCommand, paletteIndex],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const height = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
    }
  }, [text]);

  // Ctrl+F to focus input
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  return (
    <div className="border-t border-border bg-background px-5 py-6">
      <div className="flex items-stretch gap-3">
        {/* Left: input + hints */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <CommandPalette
                commands={filteredCommands}
                selectedIndex={paletteIndex}
                onSelect={selectCommand}
              />
              <div
                className="flex min-h-[36px] items-center rounded-lg border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring"
                onClick={() => textareaRef.current?.focus()}
              >
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send message"
                  rows={1}
                  className="min-h-[36px] flex-1 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none"
                />
                {!text && (
                  <span className="pointer-events-none mr-2.5 flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/50">
                    <kbd className="rounded border border-border px-1 py-0.5 font-mono leading-none">^F</kbd>
                    <span>to focus</span>
                  </span>
                )}
              </div>
            </div>
            {state === "streaming" ? (
              <Button variant="destructive" className="h-[36px] w-[36px] shrink-0 p-0" onClick={onInterrupt}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="h-[36px] w-[36px] shrink-0 p-0" onClick={send} disabled={!text.trim()}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {state === "streaming"
                ? "Claude is responding... (Esc to stop)"
                : state === "awaiting_permission"
                  ? "Waiting for permission..."
                  : "Enter to send · Shift+Enter for newline · Esc×2 to clear"}
            </span>
            <button
              type="button"
              className="mr-[46px] flex cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-xs text-muted-foreground"
              onClick={() => onSkipPermissionsChange(!skipPermissions)}
            >
              <SkipForward className="h-3 w-3" />
              Skip permissions is {skipPermissions ? "ON" : "OFF"}
            </button>
          </div>
        </div>
        {/* Right: context sidebar */}
        <>
          <div className="-my-6 w-px bg-border" />
          <ContextSidebar meta={meta} state={state} model={model} streaming={streaming} onModelChange={onModelChange} onStreamingChange={onStreamingChange} />
        </>
      </div>
    </div>
  );
}
