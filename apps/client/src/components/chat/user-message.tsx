import type { ChatUserMessage } from "@kodeck/shared";

export function UserMessage({ message }: { message: ChatUserMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
      </div>
    </div>
  );
}
