import type { ChatAssistantMessage } from "@kodeck/shared";
import { ToolCallCard } from "./tool-call-card.tsx";

export function AssistantMessage({
  message,
}: {
  message: ChatAssistantMessage;
}) {
  return (
    <div className="flex flex-col gap-2">
      {message.text && (
        <div className="max-w-[80%] text-sm">
          <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
          {message.isStreaming && (
            <span className="inline-block h-4 w-1.5 animate-pulse bg-foreground" />
          )}
        </div>
      )}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}
