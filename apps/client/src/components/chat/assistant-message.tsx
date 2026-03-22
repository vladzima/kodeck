import type { ChatAssistantMessage } from "@kodeck/shared";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { ToolCallCard } from "./tool-call-card.tsx";

const plugins = { code };

export function AssistantMessage({
  message,
}: {
  message: ChatAssistantMessage;
}) {
  return (
    <div className="flex flex-col gap-2">
      {message.text && (
        <div className="max-w-[80%] text-sm">
          <Streamdown
            animated
            isAnimating={message.isStreaming}
            plugins={plugins}
          >
            {message.text}
          </Streamdown>
        </div>
      )}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}
