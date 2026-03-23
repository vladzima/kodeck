import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
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
    const el = containerRef.current;
    if (autoScroll && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isThinking, autoScroll, permissionPrompt]);

  // Handle scroll-to-message from search navigation
  useEffect(() => {
    if (!scrollToMessage || scrollToMessage.sessionId !== sessionId) return;
    const target = scrollToMessage.messageIndex;
    // Clear immediately so it doesn't re-fire on remount or tab switch
    setScrollToMessage(null);
    // Wait for DOM to be ready (tab may have just become visible)
    requestAnimationFrame(() => {
      const el = messageRefs.current.get(target);
      if (!el) return;
      setAutoScroll(false);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("search-highlight");
      setTimeout(() => el.classList.remove("search-highlight"), 2000);
    });
  }, [scrollToMessage, sessionId, setScrollToMessage]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} className="h-full overflow-y-auto px-6 py-6" onScroll={handleScroll}>
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
          <div />
        </div>
      </div>
      {!autoScroll && (
        <button
          type="button"
          className="absolute right-[23px] bottom-3 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
