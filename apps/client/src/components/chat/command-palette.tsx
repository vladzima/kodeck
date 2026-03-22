import { useRef, useEffect } from "react";

interface CommandPaletteProps {
  commands: string[];
  selectedIndex: number;
  onSelect: (command: string) => void;
}

export function CommandPalette({ commands, selectedIndex, onSelect }: CommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (commands.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {commands.map((cmd, i) => (
        <div
          key={cmd}
          className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${
            i === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "text-popover-foreground hover:bg-accent/50"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
        >
          <span className="font-mono text-xs">/{cmd}</span>
        </div>
      ))}
    </div>
  );
}
