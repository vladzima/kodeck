import type { ChatAssistantMessage } from "@kodeck/shared";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { ToolCallCard } from "./tool-call-card.tsx";
import { MessageTime } from "./message-time.tsx";

const plugins = { code };

const EDIT_TOOL_NAMES = new Set(["Edit", "Write", "NotebookEdit", "edit_file"]);

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function AssistantMessage({ message }: { message: ChatAssistantMessage }) {
  const blocks = message.contentBlocks;
  const hasBlocks = blocks && blocks.length > 0;
  const meta = !message.isStreaming ? message.meta : undefined;

  // Compute stats
  const toolCallCount = message.toolCalls.length;
  const filesChanged = new Set(
    message.toolCalls
      .filter((tc) => EDIT_TOOL_NAMES.has(tc.name))
      .map(
        (tc) =>
          (tc.input as Record<string, unknown>).file_path ??
          (tc.input as Record<string, unknown>).path,
      )
      .filter(Boolean),
  ).size;

  // Build meta parts for the header line
  const metaParts: string[] = [];
  if (meta) {
    if (meta.model) metaParts.push(meta.model.replace("claude-", ""));
    if (meta.effort && meta.effort !== "high") metaParts.push(meta.effort);
    const input = meta.inputTokens ?? 0;
    const output = meta.outputTokens ?? 0;
    if (input || output) metaParts.push(`${formatTokens(input)} → ${formatTokens(output)}`);
  }
  if (toolCallCount > 0) metaParts.push(`${toolCallCount} tool${toolCallCount !== 1 ? "s" : ""}`);
  if (filesChanged > 0) metaParts.push(`${filesChanged} file${filesChanged !== 1 ? "s" : ""}`);
  if (meta?.costUsd != null) metaParts.push(`$${meta.costUsd.toFixed(4)}`);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground/60">claude</span>
        <MessageTime timestamp={message.timestamp} />
        {metaParts.length > 0 && (
          <span className="text-[10px] text-muted-foreground/30">{metaParts.join(" · ")}</span>
        )}
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
    </div>
  );
}
