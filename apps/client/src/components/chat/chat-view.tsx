import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";
import { MessageList } from "./message-list.tsx";
import { ChatInput } from "./chat-input.tsx";

const EMPTY_COMMANDS: string[] = [];

export function ChatView({ sessionId }: { sessionId: string }) {
  const chatData = useAppStore((s) => s.chatData.get(sessionId));
  const addUserMessage = useAppStore((s) => s.addUserMessage);
  const slashCommands = useAppStore((s) => s.slashCommands.get(sessionId)) ?? EMPTY_COMMANDS;

  const messages = chatData?.messages ?? [];
  const state = chatData?.state ?? "idle";
  const inputHistory = chatData?.inputHistory ?? [];

  const lastMessage = messages[messages.length - 1];
  const isThinking =
    state === "streaming" &&
    !(lastMessage?.role === "assistant" && lastMessage.isStreaming);

  const handleSend = (text: string) => {
    addUserMessage(sessionId, text);
    sendMessage({ type: "chat.send", sessionId, text });
  };

  const handleInterrupt = () => {
    sendMessage({ type: "chat.interrupt", sessionId });
  };

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isThinking={isThinking} />
      <ChatInput
        onSend={handleSend}
        onInterrupt={handleInterrupt}
        state={state}
        inputHistory={inputHistory}
        slashCommands={slashCommands}
      />
    </div>
  );
}
