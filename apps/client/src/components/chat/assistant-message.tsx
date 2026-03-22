import type { ChatAssistantMessage } from "@kodeck/shared";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { ToolCallCard } from "./tool-call-card.tsx";
import { MessageTime } from "./message-time.tsx";

const plugins = { code };

export function AssistantMessage({
  message,
}: {
  message: ChatAssistantMessage;
}) {
  const blocks = message.contentBlocks;
  const hasBlocks = blocks && blocks.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground/60">claude</span>
        <MessageTime timestamp={message.timestamp} />
      </div>
      {hasBlocks ? (
        blocks.map((block, i) =>
          block.type === "text" ? (
            <div key={i} className="text-foreground">
              <Streamdown
                animated
                isAnimating={message.isStreaming}
                plugins={plugins}
              >
                {block.text}
              </Streamdown>
            </div>
          ) : (
            <div key={block.toolCall.id} className="flex flex-col">
              <ToolCallCard toolCall={block.toolCall} />
            </div>
          ),
        )
      ) : (
        <>
          {message.text && (
            <div className="text-foreground">
              <Streamdown
                animated
                isAnimating={message.isStreaming}
                plugins={plugins}
              >
                {message.text}
              </Streamdown>
            </div>
          )}
          {message.toolCalls.length > 0 && (
            <div className="flex flex-col">
              {message.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
