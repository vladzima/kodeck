import { useState, memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  TerminalSquare,
  Search,
  Loader2,
  Check,
  XCircle,
} from "lucide-react";
import type { ToolCallInfo } from "@kodeck/shared";

const TOOL_ICONS: Record<string, typeof FileText> = {
  Read: FileText,
  Write: FileText,
  Edit: FileText,
  Bash: TerminalSquare,
  Grep: Search,
  Glob: Search,
};

function toolSummary(tool: ToolCallInfo): string {
  const input = tool.input;
  if (tool.name === "Bash" && input.command)
    return `$ ${String(input.command).slice(0, 80)}`;
  if (tool.name === "Read" && input.file_path) return String(input.file_path);
  if (tool.name === "Edit" && input.file_path)
    return `Edit ${String(input.file_path)}`;
  if (tool.name === "Write" && input.file_path)
    return `Write ${String(input.file_path)}`;
  if (tool.name === "Grep" && input.pattern)
    return `/${String(input.pattern)}/`;
  if (tool.name === "Glob" && input.pattern) return String(input.pattern);
  return tool.name;
}

export const ToolCallCard = memo(function ToolCallCard({
  toolCall,
}: {
  toolCall: ToolCallInfo;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? FileText;
  const StatusIcon =
    toolCall.status === "running"
      ? Loader2
      : toolCall.status === "error"
        ? XCircle
        : Check;

  return (
    <div className="rounded-md border border-border bg-card text-card-foreground">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-xs">
          {toolSummary(toolCall)}
        </span>
        <StatusIcon
          className={`h-3.5 w-3.5 shrink-0 ${
            toolCall.status === "running"
              ? "animate-spin text-muted-foreground"
              : toolCall.status === "error"
                ? "text-destructive"
                : "text-green-500"
          }`}
        />
      </button>
      {expanded && toolCall.result != null && (
        <div className="border-t border-border px-3 py-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  );
});
