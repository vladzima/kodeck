import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRight, Square, BrushCleaning } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { CommandPalette } from "./command-palette.tsx";
import type { ChatSessionState } from "@kodeck/shared";

interface ChatInputProps {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  onCleanChat: () => void;
  state: ChatSessionState;
  inputHistory: string[];
  slashCommands: string[];
  canClean: boolean;
}

export function ChatInput({
  onSend,
  onInterrupt,
  onCleanChat,
  state,
  inputHistory,
  slashCommands,
  canClean,
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

  // Detect if text starts with a known slash command
  const matchedCommand = (() => {
    if (!text.startsWith("/")) return null;
    const word = text.slice(1).split(/\s/)[0]?.toLowerCase();
    if (!word) return null;
    const match = slashCommands.find((cmd) => cmd.toLowerCase() === word);
    return match ? `/${match}` : null;
  })();
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
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <div className="relative">
            <CommandPalette
              commands={filteredCommands}
              selectedIndex={paletteIndex}
              onSelect={selectCommand}
            />
            <div
              className="relative flex min-h-[36px] items-center rounded-lg border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring"
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
                className={`relative z-10 min-h-[36px] flex-1 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none ${matchedCommand ? "[&::selection]:bg-primary/20" : ""}`}
                style={matchedCommand ? { WebkitTextFillColor: "transparent", caretColor: "var(--color-foreground)" } : undefined}
              />
              {/* Overlay — renders styled text visible through the transparent textarea */}
              {matchedCommand && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 flex items-start overflow-hidden px-3 py-2 text-sm leading-5"
                >
                  <span className="whitespace-pre-wrap break-words">
                    <span className="text-primary">{matchedCommand}</span>
                    <span className="text-foreground">{text.slice(matchedCommand.length)}</span>
                  </span>
                </div>
              )}
              {!text && (
                <span className="pointer-events-none mr-2.5 flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/50">
                  <kbd className="rounded border border-border px-1 py-0.5 font-mono leading-none">^F</kbd>
                  <span>to focus</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {state === "streaming"
                ? "Claude is responding... (Esc to stop)"
                : state === "awaiting_permission"
                  ? "Waiting for permission..."
                  : "Enter to send · Shift+Enter for newline · Esc×2 to clear"}
            </span>
            {canClean && (
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1 border-b border-muted-foreground/60 pb-px text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={onCleanChat}
              >
                <BrushCleaning className="h-3 w-3" />
                Clean chat
              </button>
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
    </div>
  );
}
