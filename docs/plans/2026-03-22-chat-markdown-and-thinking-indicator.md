# Chat Markdown Rendering & Thinking Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render assistant messages as formatted markdown using streamdown, and show a spinner + elapsed timer while waiting for Claude to respond.

**Architecture:** Two independent features. (1) Replace `<pre>` plaintext rendering in `AssistantMessage` with the `<Streamdown>` React component from Vercel's streamdown library, including `@streamdown/code` for syntax highlighting. (2) Add a `ThinkingIndicator` component that shows a cli-spinners animation + elapsed time (e.g. "1.32s") at the bottom of the message list when the chat state is "streaming" but no assistant message is streaming yet (the gap between user send and first token).

**Tech Stack:** streamdown + @streamdown/code (markdown), cli-spinners (spinner frame data), React (setInterval-based animation)

---

### Task 1: Install dependencies

**Files:**

- Modify: `apps/client/package.json`

**Step 1: Install streamdown + code plugin + cli-spinners**

Run:

```bash
cd /Users/vladvarbatov/Projects/kodeck && pnpm add streamdown @streamdown/code cli-spinners -F client
```

**Step 2: Install cli-spinners types (it has built-in types, verify)**

Check if `node_modules/cli-spinners/index.d.ts` exists. If not:

```bash
pnpm add -D @types/cli-spinners -F client
```

**Step 3: Add streamdown Tailwind source directive**

Modify: `apps/client/src/index.css` (or wherever Tailwind is configured)

Add this line near the top with other `@source` directives:

```css
@source "../node_modules/streamdown/dist/*.js";
```

This tells Tailwind to scan streamdown's output for class names so they aren't purged.

**Step 4: Commit**

```bash
git add apps/client/package.json pnpm-lock.yaml apps/client/src/index.css
git commit -m "feat: add streamdown and cli-spinners dependencies"
```

---

### Task 2: Render assistant messages with streamdown

**Files:**

- Modify: `apps/client/src/components/chat/assistant-message.tsx`

**Step 1: Replace pre with Streamdown component**

Replace the entire `assistant-message.tsx` with:

```tsx
import type { ChatAssistantMessage } from "@kodeck/shared";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { ToolCallCard } from "./tool-call-card.tsx";

const plugins = { code };

export function AssistantMessage({ message }: { message: ChatAssistantMessage }) {
  return (
    <div className="flex flex-col gap-2">
      {message.text && (
        <div className="max-w-[80%] text-sm">
          <Streamdown animated isAnimating={message.isStreaming} plugins={plugins}>
            {message.text}
          </Streamdown>
        </div>
      )}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}
```

Key changes:

- Import `Streamdown` from `"streamdown"` and `code` from `"@streamdown/code"`
- Replace `<pre className="whitespace-pre-wrap font-sans">` with `<Streamdown>` component
- Pass `animated` and `isAnimating={message.isStreaming}` for streaming animation
- Pass `plugins={{ code }}` for syntax highlighting
- Remove the blinking cursor span (streamdown handles streaming indication)
- Hoist `plugins` object outside component to avoid re-creating on every render

**Step 2: Verify it renders**

Restart dev server, open a chat, send a message. Assistant responses should render with formatted markdown (bold, code blocks with syntax highlighting, lists, etc.) instead of raw plaintext.

**Step 3: Commit**

```bash
git add apps/client/src/components/chat/assistant-message.tsx
git commit -m "feat: render assistant messages with streamdown markdown"
```

---

### Task 3: Build the ThinkingIndicator component

**Files:**

- Create: `apps/client/src/components/chat/thinking-indicator.tsx`

**Step 1: Create the ThinkingIndicator component**

This component shows a spinner animation from cli-spinners and an elapsed timer that counts up in seconds with centiseconds (e.g., "1.32s").

```tsx
import { useState, useEffect, useRef } from "react";
import spinners from "cli-spinners";

const spinner = spinners.dots;

export function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();

    const spinnerTimer = setInterval(() => {
      setFrame((f) => (f + 1) % spinner.frames.length);
    }, spinner.interval);

    const elapsedTimer = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 10);

    return () => {
      clearInterval(spinnerTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const seconds = (elapsed / 1000).toFixed(2);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="inline-block w-4 text-center font-mono">{spinner.frames[frame]}</span>
      <span className="tabular-nums">{seconds}s</span>
    </div>
  );
}
```

Key details:

- `spinners.dots` has 10 braille frames at 80ms intervals — smooth and unobtrusive
- Elapsed timer updates every 10ms for smooth centisecond display
- `tabular-nums` prevents width jitter as digits change
- `startTime` is a ref so it doesn't reset on re-render
- Both intervals are cleaned up on unmount

**Step 2: Commit**

```bash
git add apps/client/src/components/chat/thinking-indicator.tsx
git commit -m "feat: add ThinkingIndicator with spinner and elapsed timer"
```

---

### Task 4: Wire ThinkingIndicator into ChatView

**Files:**

- Modify: `apps/client/src/components/chat/chat-view.tsx`
- Modify: `apps/client/src/components/chat/message-list.tsx`
- Modify: `apps/client/src/store.ts`

**Step 1: Set chat state to "streaming" optimistically on send**

In `apps/client/src/store.ts`, modify `addUserMessage` to also set state to `"streaming"`:

In the `addUserMessage` action, after building the new `messages` and `inputHistory`, also set `state: "streaming"`:

```ts
chatData.set(sessionId, { ...data, messages, inputHistory, state: "streaming" });
```

This eliminates the gap between user pressing Enter and the server's `chat.state` event arriving. The user sees the thinking indicator immediately.

**Step 2: Add isThinking prop to MessageList**

Modify `apps/client/src/components/chat/message-list.tsx`:

```tsx
import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatMessage } from "@kodeck/shared";
import { UserMessage } from "./user-message.tsx";
import { AssistantMessage } from "./assistant-message.tsx";
import { ThinkingIndicator } from "./thinking-indicator.tsx";

export function MessageList({
  messages,
  isThinking,
}: {
  messages: ChatMessage[];
  isThinking: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, isThinking, autoScroll]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4" onScroll={handleScroll}>
      <div className="flex flex-col gap-4">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage key={i} message={msg} />
          ) : (
            <AssistantMessage key={i} message={msg} />
          ),
        )}
        {isThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

Key changes:

- Import `ThinkingIndicator`
- Add `isThinking` prop
- Render `<ThinkingIndicator />` after messages when `isThinking` is true
- Add `isThinking` to scrollIntoView dependency so it auto-scrolls when indicator appears

**Step 3: Pass isThinking from ChatView**

Modify `apps/client/src/components/chat/chat-view.tsx`:

The thinking indicator should show when:

- State is "streaming" AND
- There's no assistant message currently streaming (i.e., the last message is NOT an assistant message with `isStreaming: true`)

```tsx
import { useAppStore } from "../../store.ts";
import { sendMessage } from "../../hooks/use-websocket.ts";
import { MessageList } from "./message-list.tsx";
import { ChatInput } from "./chat-input.tsx";

export function ChatView({ sessionId }: { sessionId: string }) {
  const chatData = useAppStore((s) => s.chatData.get(sessionId));
  const addUserMessage = useAppStore((s) => s.addUserMessage);

  const messages = chatData?.messages ?? [];
  const state = chatData?.state ?? "idle";
  const inputHistory = chatData?.inputHistory ?? [];

  const lastMessage = messages[messages.length - 1];
  const isThinking =
    state === "streaming" && !(lastMessage?.role === "assistant" && lastMessage.isStreaming);

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
      />
    </div>
  );
}
```

The `isThinking` logic: Show the indicator when state is "streaming" (set optimistically on send) but no assistant message has started streaming yet. As soon as the first `chat.text` event arrives and creates a streaming assistant message, `isThinking` becomes false and the actual message content takes over.

**Step 4: Verify end-to-end**

1. Send a message in chat
2. Immediately see spinner + "0.00s" counting up
3. When Claude starts responding, spinner disappears and markdown-formatted text streams in
4. After response completes, text is fully rendered with syntax highlighting

**Step 5: Commit**

```bash
git add apps/client/src/store.ts apps/client/src/components/chat/chat-view.tsx apps/client/src/components/chat/message-list.tsx
git commit -m "feat: show thinking indicator with spinner and elapsed time while waiting for response"
```
