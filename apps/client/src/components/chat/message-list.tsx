import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import type { ChatMessage } from "@kodeck/shared";
import { useAppStore } from "../../store.ts";
import { UserMessage } from "./user-message.tsx";
import { AssistantMessage } from "./assistant-message.tsx";
import { ThinkingIndicator } from "./thinking-indicator.tsx";

export function MessageList({
  sessionId,
  messages,
  isThinking,
  permissionPrompt,
  isCleaned,
  onRestore,
  slashCommands,
}: {
  sessionId: string;
  messages: ChatMessage[];
  isThinking: boolean;
  permissionPrompt?: ReactNode;
  isCleaned?: boolean;
  onRestore?: () => void;
  slashCommands: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToMessage = useAppStore((s) => s.scrollToMessage);
  const setScrollToMessage = useAppStore((s) => s.setScrollToMessage);

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

  // Handle scroll-to-message from search navigation
  useEffect(() => {
    if (!scrollToMessage || scrollToMessage.sessionId !== sessionId) return;
    const el = messageRefs.current.get(scrollToMessage.messageIndex);
    if (el) {
      setAutoScroll(false);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash highlight
      el.classList.add("search-highlight");
      const timer = setTimeout(() => el.classList.remove("search-highlight"), 2000);
      setScrollToMessage(null);
      return () => clearTimeout(timer);
    }
    setScrollToMessage(null);
  }, [scrollToMessage, sessionId, setScrollToMessage]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6" onScroll={handleScroll}>
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
        {messages.map((msg, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) messageRefs.current.set(i, el);
            }}
          >
            {msg.role === "user" ? (
              <UserMessage message={msg} slashCommands={slashCommands} />
            ) : (
              <AssistantMessage message={msg} />
            )}
          </div>
        ))}
        {isThinking && (
          <ThinkingIndicator
            label={
              messages
                .findLast((m) => m.role === "user")
                ?.content.trim()
                .toLowerCase() === "/compact"
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
