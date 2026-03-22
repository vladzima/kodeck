import type { ChatUserMessage } from "@kodeck/shared";
import { MessageTime } from "./message-time.tsx";

export function UserMessage({ message }: { message: ChatUserMessage }) {
  return (
    <div className="border-l-2 border-primary/40 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-primary/60">you</span>
        <MessageTime timestamp={message.timestamp} />
      </div>
      <pre className="mt-0.5 whitespace-pre-wrap font-sans text-muted-foreground">
        {message.content}
      </pre>
    </div>
  );
}
