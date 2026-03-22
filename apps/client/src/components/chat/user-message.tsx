import { FileText } from "lucide-react";
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

export function UserMessage({
  message,
  slashCommands,
}: {
  message: ChatUserMessage;
  slashCommands: string[];
}) {
  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-primary/60">you</span>
        <MessageTime timestamp={message.timestamp} />
      </div>
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {message.attachments.map((att, i) =>
            att.mediaType.startsWith("image/") ? (
              <img
                key={i}
                src={`data:${att.mediaType};base64,${att.data}`}
                alt={att.filename}
                className="h-32 max-w-[240px] rounded-md border border-border object-cover"
              />
            ) : (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {att.filename}
              </span>
            ),
          )}
        </div>
      )}
      {message.content && (
        <pre className="mt-0.5 whitespace-pre-wrap font-sans text-muted-foreground">
          {highlightCommand(message.content, slashCommands)}
        </pre>
      )}
    </div>
  );
}
