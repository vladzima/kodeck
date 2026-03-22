import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  ChatSessionState,
  ToolCallInfo,
  PermissionRequest,
} from "@kodeck/shared";

interface ClaudeSessionEvents {
  text: [text: string, messageId: string];
  thinking: [thinking: string, messageId: string];
  tool_call: [toolCall: ToolCallInfo, messageId: string];
  tool_result: [toolUseId: string, result: string, isError: boolean];
  permission_request: [permission: PermissionRequest];
  state: [state: ChatSessionState];
  end: [messageId: string];
  error: [error: string];
  exit: [code: number | null];
}

export class ClaudeSession extends EventEmitter<ClaudeSessionEvents> {
  private proc: ChildProcess | null = null;
  private currentMessageId: string = "";
  private _state: ChatSessionState = "idle";

  get state(): ChatSessionState {
    return this._state;
  }

  private setState(state: ChatSessionState): void {
    this._state = state;
    this.emit("state", state);
  }

  spawn(cwd: string): void {
    this.proc = spawn("claude", [
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const rl = createInterface({ input: this.proc.stdout! });
    rl.on("line", (line) => this.handleLine(line));

    this.proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        this.emit("error", msg);
      }
    });

    this.proc.on("exit", (code) => {
      this.setState("idle");
      this.emit("exit", code);
    });

    this.proc.on("error", (err) => {
      this.emit("error", err.message);
    });
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;

    let event: ClaudeStreamEvent;
    try {
      event = JSON.parse(line) as ClaudeStreamEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "system":
        // System init events — ignore
        break;

      case "assistant": {
        this.currentMessageId = randomUUID();
        this.setState("streaming");

        const content = event.message?.content;
        if (!Array.isArray(content)) break;

        for (const block of content) {
          if (block.type === "text") {
            this.emit("text", block.text, this.currentMessageId);
          } else if (block.type === "thinking") {
            this.emit("thinking", block.thinking, this.currentMessageId);
          } else if (block.type === "tool_use") {
            const toolCall: ToolCallInfo = {
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
              status: "running",
            };
            this.emit("tool_call", toolCall, this.currentMessageId);
          }
        }
        break;
      }

      case "user": {
        const content = event.message?.content;
        if (!Array.isArray(content)) break;

        for (const block of content) {
          if (block.type === "tool_result") {
            this.emit(
              "tool_result",
              block.tool_use_id,
              typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content),
              block.is_error ?? false,
            );
          }
        }
        break;
      }

      case "result": {
        this.setState("idle");
        this.emit("end", this.currentMessageId);
        break;
      }

      case "rate_limit_event":
        // Ignore
        break;
    }
  }

  send(text: string): void {
    if (!this.proc?.stdin?.writable) {
      this.emit("error", "Claude process not running");
      return;
    }

    this.currentMessageId = randomUUID();
    this.setState("streaming");

    const payload = JSON.stringify({
      type: "user",
      message: { role: "user", content: text },
    });

    this.proc.stdin.write(payload + "\n");
  }

  interrupt(): void {
    if (this.proc) {
      this.proc.kill("SIGINT");
    }
  }

  close(): void {
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }
}

// Types for Claude stream-json events
interface ClaudeStreamEvent {
  type: "system" | "assistant" | "user" | "result" | "rate_limit_event";
  message?: {
    content: ClaudeContentBlock[];
  };
}

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

interface ClaudeThinkingBlock {
  type: "thinking";
  thinking: string;
}

interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface ClaudeToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown;
  is_error?: boolean;
}

type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeThinkingBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;
