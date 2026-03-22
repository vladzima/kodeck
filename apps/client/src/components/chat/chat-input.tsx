import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { CommandPalette } from "./command-palette.tsx";
import type { ChatSessionState } from "@kodeck/shared";

interface ChatInputProps {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  state: ChatSessionState;
  inputHistory: string[];
  slashCommands: string[];
}

export function ChatInput({
  onSend,
  onInterrupt,
  state,
  inputHistory,
  slashCommands,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndex = useRef(-1);
  const lastEscapeTime = useRef(0);

  const showPalette = text.startsWith("/") && state !== "streaming";
  const query = text.slice(1).toLowerCase(); // strip leading "/"
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
      // Command palette navigation
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [text]);

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <CommandPalette
            commands={filteredCommands}
            selectedIndex={paletteIndex}
            onSelect={selectCommand}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {state === "streaming" ? (
          <Button variant="destructive" size="icon" onClick={onInterrupt}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={send} disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="mt-1">
        <span className="text-xs text-muted-foreground">
          {state === "streaming"
            ? "Claude is responding... (Esc to stop)"
            : state === "awaiting_permission"
              ? "Waiting for permission..."
              : "Enter to send · Shift+Enter for newline · Esc×2 to clear"}
        </span>
      </div>
    </div>
  );
}
