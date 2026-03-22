import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import type { ChatMessage } from "@kodeck/shared";
import { UserMessage } from "./user-message.tsx";
import { AssistantMessage } from "./assistant-message.tsx";
import { ThinkingIndicator } from "./thinking-indicator.tsx";

export function MessageList({
  messages,
  isThinking,
  permissionPrompt,
  isCleaned,
  onRestore,
  slashCommands,
}: {
  messages: ChatMessage[];
  isThinking: boolean;
  permissionPrompt?: ReactNode;
  isCleaned?: boolean;
  onRestore?: () => void;
  slashCommands: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, isThinking, autoScroll, permissionPrompt]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-6"
      onScroll={handleScroll}
    >
      <div className="flex flex-col gap-10">
        {isCleaned && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
            <div className="flex-1 border-t border-border" />
            <span>Earlier messages hidden</span>
            <button
              type="button"
              className="cursor-pointer underline underline-offset-2 transition-colors hover:text-foreground"
              onClick={onRestore}
            >
              Show all
            </button>
            <div className="flex-1 border-t border-border" />
          </div>
        )}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage key={i} message={msg} slashCommands={slashCommands} />
          ) : (
            <AssistantMessage key={i} message={msg} />
          ),
        )}
        {isThinking && (
          <ThinkingIndicator
            label={
              messages.findLast((m) => m.role === "user")?.content.trim().toLowerCase() === "/compact"
                ? "Compacting conversation…"
                : undefined
            }
          />
        )}
        {permissionPrompt}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
