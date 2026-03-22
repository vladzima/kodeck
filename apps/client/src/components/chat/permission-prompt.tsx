import { ShieldAlert, Check, X } from "lucide-react";
import { Button } from "../ui/button.tsx";
import type { PermissionRequest } from "@kodeck/shared";

function str(val: unknown): string {
  return typeof val === "string" ? val : JSON.stringify(val);
}

function formatInput(permission: PermissionRequest): string {
  if (permission.toolName === "Bash" && permission.input.command) {
    return `$ ${str(permission.input.command)}`;
  }
  if (permission.input.file_path) {
    return str(permission.input.file_path);
  }
  if (permission.input.command) {
    return str(permission.input.command);
  }
  return JSON.stringify(permission.input, null, 2);
}

export function PermissionPrompt({
  permission,
  onAllow,
  onDeny,
  onAllowAll,
}: {
  permission: PermissionRequest;
  onAllow: () => void;
  onDeny: () => void;
  onAllowAll: () => void;
}) {
  return (
    <div className="mb-3 rounded-lg border border-yellow-500/30 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-foreground">
            {permission.toolName} requires approval
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            {formatInput(permission)}
          </pre>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={onAllow}
            >
              <Check className="h-3.5 w-3.5" />
              Allow
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={onDeny}
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </Button>
            <button
              type="button"
              className="ml-1 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              onClick={onAllowAll}
            >
              Allow all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
