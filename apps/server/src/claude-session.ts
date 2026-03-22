import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  ChatSessionState,
  SessionMeta,
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
  slash_commands: [commands: string[]];
  meta: [meta: SessionMeta];
}

export class ClaudeSession extends EventEmitter<ClaudeSessionEvents> {
  private proc: ChildProcess | null = null;
  private currentMessageId: string = "";
  private _state: ChatSessionState = "idle";
  private _meta: SessionMeta = {};
  private activeToolCalls = new Map<string, string>(); // id → tool name
  private pendingPermissions = new Map<string, Record<string, unknown>>(); // requestId → original input
  private streaming = false; // true = use stream_event deltas, false = use assistant events
  private readyResolve: (() => void) | null = null;
  private ready: Promise<void>;
  private lastUserMessageWasCompact = false;
  private userHasSentMessage = false; // suppress replayed events on resume
  claudeSessionId: string | null = null;

  constructor() {
    super();
    this.ready = new Promise((resolve) => { this.readyResolve = resolve; });
  }

  get state(): ChatSessionState {
    return this._state;
  }

  /** Restore cumulative meta values (e.g. compactions) from persisted state. */
  restoreMeta(meta: SessionMeta): void {
    if (meta.compactions) this._meta.compactions = meta.compactions;
  }

  private setState(state: ChatSessionState): void {
    this._state = state;
    this.emit("state", state);
  }

  spawn(cwd: string, opts?: { resumeSessionId?: string; model?: string; skipPermissions?: boolean; streaming?: boolean }): void {
    this.streaming = opts?.streaming ?? false;

    const args = [
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ];
    if (this.streaming) {
      args.push("--include-partial-messages");
    }
    if (opts?.resumeSessionId) {
      args.push("--resume", opts.resumeSessionId);
    }
    if (opts?.model) {
      args.push("--model", opts.model);
    }
    if (opts?.skipPermissions) {
      args.push("--dangerously-skip-permissions");
    } else {
      args.push("--permission-prompt-tool", "stdio");
    }
    this.proc = spawn("claude", args, {
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
      // Resolve ready in case process exits before init (avoids hanging send())
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }
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
        // Any system event means the CLI is alive — resolve the ready gate
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
        }
        if (event.subtype === "init") {
          if (event.session_id) {
            this.claudeSessionId = event.session_id;
          }
          if (Array.isArray(event.slash_commands)) {
            this.emit("slash_commands", event.slash_commands);
          }
          if (event.model || event.permissionMode) {
            this._meta.model = event.model;
            this._meta.permissionMode = event.permissionMode;
            if (event.contextWindow) {
              this._meta.contextWindow = event.contextWindow;
            }
            this.emit("meta", { ...this._meta });
          }
        }
        break;

      case "stream_event": {
        // Token-level streaming (only when --include-partial-messages is used)
        if (!this.userHasSentMessage) break; // suppress replayed events on resume
        const inner = event.event;
        if (!inner) break;

        if (inner.type === "message_start") {
          this.setState("streaming");
        } else if (inner.type === "content_block_delta") {
          const delta = inner.delta;
          if (delta?.type === "text_delta" && delta.text) {
            this.emit("text", delta.text, this.currentMessageId);
          }
          // thinking deltas are ignored for now — they come in many tiny chunks
        }
        break;
      }

      case "assistant": {
        if (!this.userHasSentMessage) break; // suppress replayed events on resume
        this.setState("streaming");

        const content = event.message?.content;
        if (!Array.isArray(content)) break;

        for (const block of content) {
          if (block.type === "text") {
            // In streaming mode, text was already emitted via stream_event deltas — skip
            if (!this.streaming) {
              this.emit("text", block.text, this.currentMessageId);
            }
          } else if (block.type === "thinking") {
            this.emit("thinking", block.thinking, this.currentMessageId);
          } else if (block.type === "tool_use") {
            const input = block.input as Record<string, unknown>;
            const hasInput = Object.keys(input).length > 0;
            const alreadyEmitted = this.activeToolCalls.has(block.id);

            if (!alreadyEmitted) {
              // First time seeing this tool — emit immediately
              const toolCall: ToolCallInfo = {
                id: block.id,
                name: block.name,
                input,
                status: "running",
              };
              this.activeToolCalls.set(block.id, block.name);
              this.emit("tool_call", toolCall, this.currentMessageId);
              this.emitActivityMeta();
            } else if (hasInput) {
              // Already emitted but now we have input data (streaming partial update)
              // Re-emit so client can update the tool call's input
              const toolCall: ToolCallInfo = {
                id: block.id,
                name: block.name,
                input,
                status: "running",
              };
              this.emit("tool_call", toolCall, this.currentMessageId);
            }
          }
        }
        break;
      }

      case "user": {
        if (!this.userHasSentMessage) break; // suppress replayed events on resume
        const content = event.message?.content;
        if (!Array.isArray(content)) break;

        for (const block of content) {
          if (block.type === "tool_result") {
            this.activeToolCalls.delete(block.tool_use_id);
            this.emit(
              "tool_result",
              block.tool_use_id,
              typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content),
              block.is_error ?? false,
            );
            this.emitActivityMeta();
          }
        }
        break;
      }

      case "result": {
        if (!this.userHasSentMessage) break; // suppress replayed result on resume
        // For compaction, synthesize a confirmation message (no assistant text is emitted)
        if (this.lastUserMessageWasCompact) {
          const summary = (event.result && typeof event.result === "string") ? event.result : "Conversation compacted.";
          this.emit("text", summary, this.currentMessageId);
        }
        this.setState("idle");
        this.activeToolCalls.clear();
        this.emit("end", this.currentMessageId);
        // Extract token usage from result
        if (event.modelUsage) {
          const models = Object.values(event.modelUsage) as Array<{
            inputTokens?: number;
            outputTokens?: number;
            cacheReadInputTokens?: number;
            cacheCreationInputTokens?: number;
            contextWindow?: number;
          }>;
          const primary = models[0];
          if (primary) {
            // Context = conversation tokens only (excludes cached system prompt)
            // cacheReadInputTokens is the static system prompt — not the user's conversation
            const contextTokens =
              (primary.inputTokens ?? 0) +
              (primary.cacheCreationInputTokens ?? 0);
            this._meta.contextTokens = contextTokens;
            if (primary.contextWindow) {
              this._meta.contextWindow = primary.contextWindow;
            }
          }
        }
        if (event.total_cost_usd != null) {
          this._meta.costUsd = event.total_cost_usd;
        }
        if (this.lastUserMessageWasCompact) {
          this._meta.compactions = (this._meta.compactions ?? 0) + 1;
          this.lastUserMessageWasCompact = false;
        }
        this._meta.activeShells = 0;
        this._meta.activeAgents = 0;
        this.emit("meta", { ...this._meta });
        break;
      }

      case "control_request": {
        if (event.request?.subtype === "can_use_tool" && event.request_id) {
          this.pendingPermissions.set(event.request_id, event.request.input);
          const permission: PermissionRequest = {
            requestId: event.request_id,
            toolUseId: event.request.tool_use_id,
            toolName: event.request.tool_name,
            input: event.request.input,
          };
          this.setState("awaiting_permission");
          this.emit("permission_request", permission);
        }
        break;
      }

      case "rate_limit_event":
        // Ignore
        break;
    }
  }

  private emitActivityMeta(): void {
    let shells = 0;
    let agents = 0;
    for (const name of this.activeToolCalls.values()) {
      if (name === "Bash") shells++;
      else if (name === "Agent") agents++;
    }
    this._meta.activeShells = shells;
    this._meta.activeAgents = agents;
    this.emit("meta", { ...this._meta });
  }

  async send(text: string): Promise<void> {
    await this.ready;

    if (!this.proc?.stdin?.writable) {
      this.emit("error", "Claude process not running");
      return;
    }

    this.currentMessageId = randomUUID();
    this.userHasSentMessage = true;
    this.lastUserMessageWasCompact = text.trim().toLowerCase() === "/compact";
    this.setState("streaming");

    const payload = JSON.stringify({
      type: "user",
      message: { role: "user", content: text },
    });

    this.proc.stdin.write(payload + "\n");
  }

  respondPermission(requestId: string, allow: boolean): void {
    if (!this.proc?.stdin?.writable) {
      this.emit("error", "Claude process not running");
      return;
    }

    const originalInput = this.pendingPermissions.get(requestId) ?? {};
    this.pendingPermissions.delete(requestId);

    const response = allow
      ? { behavior: "allow", updatedInput: originalInput }
      : { behavior: "deny", message: "User denied this action" };

    const payload = JSON.stringify({
      type: "control_response",
      response: {
        subtype: "success",
        request_id: requestId,
        response,
      },
    });

    this.proc.stdin.write(payload + "\n");
    this.setState("streaming");
  }

  interrupt(): void {
    // If awaiting permission, deny all pending requests instead of killing
    if (this._state === "awaiting_permission" && this.pendingPermissions.size > 0) {
      for (const requestId of this.pendingPermissions.keys()) {
        this.respondPermission(requestId, false);
      }
      return;
    }
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
interface StreamEventDelta {
  type: string;
  text?: string;
}

interface StreamEventInner {
  type: string;
  delta?: StreamEventDelta;
  content_block?: { type: string; id?: string; name?: string; input?: Record<string, unknown> };
}

interface ClaudeStreamEvent {
  type: "system" | "assistant" | "user" | "result" | "rate_limit_event" | "stream_event" | "control_request";
  subtype?: "init" | string;
  session_id?: string;
  slash_commands?: string[];
  model?: string;
  permissionMode?: string;
  contextWindow?: number;
  event?: StreamEventInner;
  result?: string;
  modelUsage?: Record<string, {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    contextWindow?: number;
  }>;
  total_cost_usd?: number;
  message?: {
    content: ClaudeContentBlock[];
  };
  // control_request fields
  request_id?: string;
  request?: {
    subtype: string;
    tool_name: string;
    input: Record<string, unknown>;
    tool_use_id: string;
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
