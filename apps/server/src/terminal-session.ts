import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";

interface TerminalSessionEvents {
  output: [data: string];
  exit: [exitCode: number];
}

// Dynamic import type for node-pty
type IPty = {
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

export class TerminalSession extends EventEmitter<TerminalSessionEvents> {
  private pty: IPty | null = null;
  private outputBuffer: string = "";
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async spawn(cwd: string, cols = 80, rows = 24): Promise<void> {
    let nodePty: typeof import("node-pty");
    try {
      nodePty = await import("node-pty");
    } catch {
      throw new Error("node-pty is not available");
    }

    let shell = process.env.SHELL || "/bin/zsh";
    // Ensure we have an absolute path — node-pty needs it
    if (!shell.startsWith("/")) {
      try {
        shell = execFileSync("which", [shell], { encoding: "utf-8" }).trim();
      } catch {
        shell = "/bin/zsh";
      }
    }

    this.pty = nodePty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    });

    this.pty.onData((data) => {
      this.outputBuffer += data;
    });

    this.pty.onExit((e) => {
      this.stopFlushing();
      this.flush();
      this.emit("exit", e.exitCode);
    });

    // Flush output at ~60fps
    this.flushTimer = setInterval(() => this.flush(), 16);
  }

  private flush(): void {
    if (this.outputBuffer.length > 0) {
      this.emit("output", this.outputBuffer);
      this.outputBuffer = "";
    }
  }

  private stopFlushing(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  write(data: string): void {
    this.pty?.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty?.resize(cols, rows);
  }

  close(): void {
    this.stopFlushing();
    this.flush();
    this.pty?.kill();
    this.pty = null;
  }
}
