import { useAppStore } from "../store.ts";
import { ScrollArea } from "./ui/scroll-area.tsx";

export function ConfigFileView() {
  const configViewFile = useAppStore((s) => s.configViewFile);

  if (!configViewFile) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a config file to view</p>
      </div>
    );
  }

  const fileName = configViewFile.path.split("/").pop() ?? configViewFile.path;
  const isJson = fileName.endsWith(".json");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground/50">
        <span className="truncate font-mono">{configViewFile.path}</span>
      </div>
      <ScrollArea className="flex-1">
        <pre className="whitespace-pre-wrap break-words px-4 py-4 text-xs font-mono text-foreground/80 leading-relaxed">
          {isJson ? formatJson(configViewFile.content) : configViewFile.content}
        </pre>
      </ScrollArea>
    </div>
  );
}

function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
