import { DEFAULT_MODEL } from "@kodeck/shared";
import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";
import { MessageList } from "./message-list.tsx";
import { ChatInput } from "./chat-input.tsx";
import { PermissionPrompt } from "./permission-prompt.tsx";

const EMPTY_COMMANDS: string[] = [];

export function ChatView({ sessionId }: { sessionId: string }) {
  const chatData = useAppStore((s) => s.chatData.get(sessionId));
  const addUserMessage = useAppStore((s) => s.addUserMessage);
  const slashCommands = useAppStore((s) => s.slashCommands.get(sessionId)) ?? EMPTY_COMMANDS;
  const meta = useAppStore((s) => s.sessionMeta.get(sessionId));
  const session = useAppStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const setSessionModel = useAppStore((s) => s.setSessionModel);
  const setSessionSkipPermissions = useAppStore((s) => s.setSessionSkipPermissions);
  const setSessionStreaming = useAppStore((s) => s.setSessionStreaming);
  const pendingPermission = useAppStore((s) => s.pendingPermission.get(sessionId));
  const clearPendingPermission = useAppStore((s) => s.clearPendingPermission);

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

  const handleModelChange = (model: string) => {
    setSessionModel(sessionId, model);
    sendMessage({ type: "chat.model", sessionId, model });
  };

  const handleSkipPermissionsChange = (skip: boolean) => {
    setSessionSkipPermissions(sessionId, skip);
    sendMessage({ type: "chat.skipPermissions", sessionId, skip });
  };

  const handleStreamingChange = (streaming: boolean) => {
    setSessionStreaming(sessionId, streaming);
    sendMessage({ type: "chat.streaming", sessionId, streaming });
  };

  const handlePermissionAllow = () => {
    if (!pendingPermission) return;
    sendMessage({ type: "chat.permission", sessionId, requestId: pendingPermission.requestId, toolUseId: pendingPermission.toolUseId, allow: true });
    clearPendingPermission(sessionId);
  };

  const handlePermissionDeny = () => {
    if (!pendingPermission) return;
    sendMessage({ type: "chat.permission", sessionId, requestId: pendingPermission.requestId, toolUseId: pendingPermission.toolUseId, allow: false });
    clearPendingPermission(sessionId);
  };

  const handlePermissionAllowAll = () => {
    handleSkipPermissionsChange(true);
    handlePermissionAllow();
  };

  const permissionPrompt = pendingPermission ? (
    <PermissionPrompt
      permission={pendingPermission}
      onAllow={handlePermissionAllow}
      onDeny={handlePermissionDeny}
      onAllowAll={handlePermissionAllowAll}
    />
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isThinking={isThinking} permissionPrompt={permissionPrompt} />
      <ChatInput
        onSend={handleSend}
        onInterrupt={handleInterrupt}
        onModelChange={handleModelChange}
        onSkipPermissionsChange={handleSkipPermissionsChange}
        onStreamingChange={handleStreamingChange}
        state={state}
        inputHistory={inputHistory}
        slashCommands={slashCommands}
        meta={meta}
        model={session?.model ?? DEFAULT_MODEL}
        skipPermissions={session?.skipPermissions ?? false}
        streaming={session?.streaming ?? false}
      />
    </div>
  );
}
