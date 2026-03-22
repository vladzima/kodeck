import { useState, memo } from "react";
import { FileText, TerminalSquare, Search, Loader2, Check, XCircle } from "lucide-react";
import type { ToolCallInfo } from "@kodeck/shared";

const TOOL_ICONS: Record<string, typeof FileText> = {
  Read: FileText,
  Write: FileText,
  Edit: FileText,
  Bash: TerminalSquare,
  Grep: Search,
  Glob: Search,
};

function str(val: unknown): string {
  return typeof val === "string" ? val : JSON.stringify(val);
}

function toolSummary(tool: ToolCallInfo): string {
  const input = tool.input;
  if (tool.name === "Bash" && input.command) return `$ ${str(input.command).slice(0, 80)}`;
  if (tool.name === "Read" && input.file_path) return str(input.file_path);
  if (tool.name === "Edit" && input.file_path) return `Edit ${str(input.file_path)}`;
  if (tool.name === "Write" && input.file_path) return `Write ${str(input.file_path)}`;
  if (tool.name === "Grep" && input.pattern) return `/${str(input.pattern)}/`;
  if (tool.name === "Glob" && input.pattern) return str(input.pattern);
  return tool.name;
}

function resultBrief(tool: ToolCallInfo): string | null {
  if (!tool.result || tool.status === "running") return null;
  if (tool.name === "Read") {
    const lines = tool.result.split("\n").length;
    return `${lines} line${lines !== 1 ? "s" : ""}`;
  }
  if (tool.name === "Grep" || tool.name === "Glob") {
    const lines = tool.result.trim().split("\n").filter(Boolean).length;
    return `${lines} result${lines !== 1 ? "s" : ""}`;
  }
  return null;
}

export const ToolCallCard = memo(function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? FileText;
  const StatusIcon =
    toolCall.status === "running" ? Loader2 : toolCall.status === "error" ? XCircle : Check;
  const brief = resultBrief(toolCall);

  return (
    <div className="border-l border-border pl-2.5 py-2">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1.5 text-left text-[12px] text-muted-foreground hover:text-foreground/70"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="border-b border-muted-foreground/60 pb-px font-mono">
          {toolSummary(toolCall)}
        </span>
        {brief && <span className="text-muted-foreground/50">{brief}</span>}
        <StatusIcon
          className={`h-3 w-3 shrink-0 ${
            toolCall.status === "running"
              ? "animate-spin text-muted-foreground"
              : toolCall.status === "error"
                ? "text-destructive"
                : "text-green-500"
          }`}
        />
      </button>
      {expanded && toolCall.result != null && (
        <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground/70">
          {toolCall.result}
        </pre>
      )}
    </div>
  );
});
