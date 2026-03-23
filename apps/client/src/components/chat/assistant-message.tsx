import type { ChatAssistantMessage, MessageMeta } from "@kodeck/shared";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { ToolCallCard } from "./tool-call-card.tsx";
import { MessageTime } from "./message-time.tsx";

const plugins = { code };

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function MetaBadge({ meta }: { meta: MessageMeta }) {
  const parts: string[] = [];
  if (meta.model) {
    // Shorten model name: "claude-sonnet-4-6" → "sonnet-4-6"
    parts.push(meta.model.replace("claude-", ""));
  }
  if (meta.effort && meta.effort !== "high") {
    parts.push(meta.effort);
  }
  const input = meta.inputTokens ?? 0;
  const output = meta.outputTokens ?? 0;
  if (input || output) {
    parts.push(`${formatTokens(input)} → ${formatTokens(output)}`);
  }
  if (meta.costUsd != null) {
    parts.push(`$${meta.costUsd.toFixed(4)}`);
  }
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mr-1.5">·</span>}
          {part}
        </span>
      ))}
    </div>
  );
}

export function AssistantMessage({ message }: { message: ChatAssistantMessage }) {
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
              <Streamdown animated isAnimating={message.isStreaming} plugins={plugins}>
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
              <Streamdown animated isAnimating={message.isStreaming} plugins={plugins}>
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
      {!message.isStreaming && message.meta && <MetaBadge meta={message.meta} />}
    </div>
  );
}
