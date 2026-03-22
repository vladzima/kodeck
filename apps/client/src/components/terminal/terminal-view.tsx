import { useEffect, useRef, memo } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sendMessage } from "../../hooks/use-websocket.ts";
import "@xterm/xterm/css/xterm.css";

export const TerminalView = memo(function TerminalView({
  sessionId,
  isActive,
}: {
  sessionId: string;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Read resolved CSS colors so terminal matches the app theme
    const bodyStyles = getComputedStyle(document.body);
    const bg = bodyStyles.backgroundColor;
    const fg = bodyStyles.color;

    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: "'Geist Mono Variable', 'GeistMono', ui-monospace, monospace",
      theme: {
        background: bg,
        foreground: fg,
        cursor: fg,
        selectionBackground: "rgba(255,255,255,0.2)",
      },
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL not supported, fallback to canvas
    }

    fitAddon.fit();

    sendMessage({
      type: "terminal.resize",
      sessionId,
      cols: terminal.cols,
      rows: terminal.rows,
    });

    terminal.onData((data) => {
      sendMessage({ type: "terminal.input", sessionId, data });
    });

    terminal.onResize(({ cols, rows }) => {
      sendMessage({ type: "terminal.resize", sessionId, cols, rows });
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleOutput = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        sessionId: string;
        data: string;
      };
      if (detail.sessionId === sessionId) {
        terminal.write(detail.data);
      }
    };

    window.addEventListener("kodeck:terminal-output", handleOutput);

    return () => {
      window.removeEventListener("kodeck:terminal-output", handleOutput);
      terminal.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
    }
  }, [isActive]);

  useEffect(() => {
    const handleResize = () => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive]);

  return (
    <div
      className="h-full w-full pl-4 pt-2"
      style={{ display: isActive ? "block" : "none" }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});
