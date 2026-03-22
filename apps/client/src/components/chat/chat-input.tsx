import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRight, Square, BrushCleaning, X, FileText } from "lucide-react";
import { CommandPalette } from "./command-palette.tsx";
import type { ChatAttachment, ChatSessionState } from "@kodeck/shared";

interface ChatInputProps {
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onInterrupt: () => void;
  onCleanChat: () => void;
  state: ChatSessionState;
  inputHistory: string[];
  slashCommands: string[];
  canClean: boolean;
}

function fileToAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve({
        filename: file.name,
        mediaType: file.type || "application/octet-stream",
        data: base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndex = useRef(-1);
  const lastEscapeTime = useRef(0);
  const dragCounter = useRef(0);

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
    if ((!trimmed && attachments.length === 0) || state === "streaming") return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText("");
    setAttachments([]);
    historyIndex.current = -1;
  }, [text, state, onSend, attachments]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const newAttachments = await Promise.all(files.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...newAttachments]);
    textareaRef.current?.focus();
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
          setText(newIndex >= 0 ? (inputHistory[inputHistory.length - 1 - newIndex] ?? "") : "");
        }
      }
    },
    [
      send,
      state,
      onInterrupt,
      inputHistory,
      paletteOpen,
      filteredCommands,
      selectCommand,
      paletteIndex,
    ],
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
    <div
      className={`border-t border-border bg-background px-5 py-4 transition-colors ${isDragOver ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Attachment previews — above the input row */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {attachments.map((att, i) =>
            att.mediaType.startsWith("image/") ? (
              <div key={i} className="group relative">
                <img
                  src={`data:${att.mediaType};base64,${att.data}`}
                  alt={att.filename}
                  className="h-14 w-14 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => removeAttachment(i)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <div
                key={i}
                className="group flex items-center gap-1 text-xs text-muted-foreground"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[120px] truncate">{att.filename}</span>
                <button
                  type="button"
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  onClick={() => removeAttachment(i)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/* Input row */}
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
            style={
              matchedCommand
                ? { WebkitTextFillColor: "transparent", caretColor: "var(--color-foreground)" }
                : undefined
            }
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
            <span className="pointer-events-none mr-2 flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/50">
              <kbd className="rounded border border-border px-1 py-0.5 font-mono leading-none">
                ^F
              </kbd>
              <span>to focus</span>
            </span>
          )}
          {state === "streaming" ? (
            <button
              type="button"
              className="z-10 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              onClick={(e) => {
                e.stopPropagation();
                onInterrupt();
              }}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              className="z-10 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
              disabled={!text.trim() && attachments.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                send();
              }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-2 flex items-center justify-between">
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
  );
}
