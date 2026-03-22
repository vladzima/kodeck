import type { ChatUserMessage } from "@kodeck/shared";
import { MessageTime } from "./message-time.tsx";

function highlightCommand(text: string, slashCommands: string[]) {
  if (!text.startsWith("/")) return text;
  const word = text.slice(1).split(/\s/)[0]?.toLowerCase();
  if (!word) return text;
  const match = slashCommands.find((cmd) => cmd.toLowerCase() === word);
  if (!match) return text;
  const cmd = `/${match}`;
  return (
    <>
      <span className="text-primary">{cmd}</span>
      {text.slice(cmd.length)}
    </>
  );
}

export function UserMessage({ message, slashCommands }: { message: ChatUserMessage; slashCommands: string[] }) {
  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-primary/60">you</span>
        <MessageTime timestamp={message.timestamp} />
      </div>
      <pre className="mt-0.5 whitespace-pre-wrap font-sans text-muted-foreground">
        {highlightCommand(message.content, slashCommands)}
      </pre>
    </div>
  );
}
