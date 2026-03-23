import { DEFAULT_MODEL, type ChatAttachment, type EffortLevel } from "@kodeck/shared";
import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";
import { MessageList } from "./message-list.tsx";
import { ChatInput } from "./chat-input.tsx";
import { PermissionPrompt } from "./permission-prompt.tsx";
import { RightSidebar } from "./right-sidebar.tsx";

const EMPTY_COMMANDS: string[] = [];

export function ChatView({ sessionId }: { sessionId: string }) {
  const chatData = useAppStore((s) => s.chatData.get(sessionId));
  const addUserMessage = useAppStore((s) => s.addUserMessage);
  const slashCommands = useAppStore((s) => s.slashCommands.get(sessionId)) ?? EMPTY_COMMANDS;
  const meta = useAppStore((s) => s.sessionMeta.get(sessionId));
  const session = useAppStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const setSessionModel = useAppStore((s) => s.setSessionModel);
  const setSessionEffort = useAppStore((s) => s.setSessionEffort);
  const setSessionSkipPermissions = useAppStore((s) => s.setSessionSkipPermissions);
  const setSessionStreaming = useAppStore((s) => s.setSessionStreaming);
  const pendingPermission = useAppStore((s) => s.pendingPermission.get(sessionId));
  const clearPendingPermission = useAppStore((s) => s.clearPendingPermission);
  const cleanedAtIndex = useAppStore((s) => s.cleanedAtIndex.get(sessionId));
  const cleanChat = useAppStore((s) => s.cleanChat);
  const restoreChat = useAppStore((s) => s.restoreChat);

  const allMessages = chatData?.messages ?? [];
  const state = chatData?.state ?? "idle";
  const inputHistory = chatData?.inputHistory ?? [];

  const isCleaned = cleanedAtIndex != null && cleanedAtIndex < allMessages.length;
  const messages = isCleaned ? allMessages.slice(cleanedAtIndex) : allMessages;

  const userTurns = allMessages.filter((m) => m.role === "user").length;
  const assistantTurns = allMessages.filter((m) => m.role === "assistant").length;
  const visibleMessages = isCleaned ? messages.length : undefined;

  const lastMessage = allMessages[allMessages.length - 1];
  const isThinking =
    state === "streaming" && !(lastMessage?.role === "assistant" && lastMessage.isStreaming);

  const handleSend = (text: string, attachments?: ChatAttachment[]) => {
    addUserMessage(sessionId, text, attachments);
    sendMessage({ type: "chat.send", sessionId, text, attachments });
  };

  const handleInterrupt = () => {
    sendMessage({ type: "chat.interrupt", sessionId });
  };

  const handleModelChange = (model: string) => {
    setSessionModel(sessionId, model);
    sendMessage({ type: "chat.model", sessionId, model });
  };

  const handleEffortChange = (effort: EffortLevel) => {
    setSessionEffort(sessionId, effort);
    sendMessage({ type: "chat.effort", sessionId, effort });
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
    sendMessage({
      type: "chat.permission",
      sessionId,
      requestId: pendingPermission.requestId,
      toolUseId: pendingPermission.toolUseId,
      allow: true,
    });
    clearPendingPermission(sessionId);
  };

  const handlePermissionDeny = () => {
    if (!pendingPermission) return;
    sendMessage({
      type: "chat.permission",
      sessionId,
      requestId: pendingPermission.requestId,
      toolUseId: pendingPermission.toolUseId,
      allow: false,
    });
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
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageList
          sessionId={sessionId}
          messages={messages}
          isThinking={isThinking}
          permissionPrompt={permissionPrompt}
          isCleaned={isCleaned}
          onRestore={() => restoreChat(sessionId)}
          slashCommands={slashCommands}
        />
        <ChatInput
          onSend={handleSend}
          onInterrupt={handleInterrupt}
          onCleanChat={() => cleanChat(sessionId)}
          state={state}
          inputHistory={inputHistory}
          slashCommands={slashCommands}
          canClean={allMessages.length > 1}
        />
      </div>
      <RightSidebar
        meta={meta}
        state={state}
        model={session?.model ?? DEFAULT_MODEL}
        effort={session?.effort ?? "high"}
        streaming={session?.streaming ?? false}
        skipPermissions={session?.skipPermissions ?? false}
        userTurns={userTurns}
        assistantTurns={assistantTurns}
        visibleMessages={visibleMessages}
        onModelChange={handleModelChange}
        onEffortChange={handleEffortChange}
        onStreamingChange={handleStreamingChange}
        onSkipPermissionsChange={handleSkipPermissionsChange}
      />
    </div>
  );
}
