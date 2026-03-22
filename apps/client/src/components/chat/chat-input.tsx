import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "../ui/button.tsx";
import type { ChatSessionState } from "@kodeck/shared";

interface ChatInputProps {
  onSend: (text: string) => void;
  onInterrupt: () => void;
  state: ChatSessionState;
  inputHistory: string[];
}

export function ChatInput({
  onSend,
  onInterrupt,
  state,
  inputHistory,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndex = useRef(-1);
  const lastEscapeTime = useRef(0);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || state === "streaming") return;
    onSend(trimmed);
    setText("");
    historyIndex.current = -1;
  }, [text, state, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    [send, state, onInterrupt, inputHistory],
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
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
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
      <div className="mx-auto mt-1 max-w-3xl">
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
