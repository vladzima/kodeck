import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { handleMessage, cleanupAllSessions, registerClient, unregisterClient } from "./router.ts";
import { serveStatic } from "./static.ts";

export interface ServerOptions {
  port?: number;
  clientDir?: string;
}

export function startServer(
  options: ServerOptions = {},
): Promise<{ port: number; close: () => void }> {
  const port =
    options.port ?? (Number(process.env.PORT) || Number(process.env.KODECK_PORT) || 3001);
  const clientDir = options.clientDir ?? process.env.KODECK_CLIENT_DIR;

  const httpServer = createServer((req, res) => {
    if (clientDir) {
      serveStatic(clientDir, req, res);
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("kodeck server");
    }
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("client connected");
    registerClient(ws);
    ws.on("message", (data: { toString(): string }) => {
      handleMessage(ws, data.toString()).catch((err: unknown) => {
        console.error("Error handling message:", err);
      });
    });
    ws.on("close", () => {
      console.log("client disconnected");
      unregisterClient(ws);
    });
  });

  return new Promise((resolve, reject) => {
    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && !options.port && !process.env.PORT && !process.env.KODECK_PORT) {
        // No explicit port requested — try a random free port
        httpServer.listen(0, () => {
          const addr = httpServer.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : 0;
          if (clientDir) {
            if (!process.env.KODECK_LIB_MODE) console.log(`kodeck running at http://localhost:${actualPort}`);
          } else {
            if (!process.env.KODECK_LIB_MODE) console.log(`kodeck server listening on ws://localhost:${actualPort}/ws`);
          }
          resolve({
            port: actualPort,
            close() {
              cleanupAllSessions();
              wss.close();
              httpServer.close();
            },
          });
        });
      } else {
        reject(err);
      }
    });

    httpServer.listen(port, () => {
      if (clientDir) {
        if (!process.env.KODECK_LIB_MODE) console.log(`kodeck running at http://localhost:${port}`);
      } else {
        if (!process.env.KODECK_LIB_MODE) console.log(`kodeck server listening on ws://localhost:${port}/ws`);
      }
      resolve({
        port,
        close() {
          cleanupAllSessions();
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}

// Auto-start when run directly (dev mode / sidecar)
if (!process.env.KODECK_LIB_MODE) {
  void startServer().then((server) => {
    process.on("SIGINT", () => {
      console.log("Shutting down...");
      server.close();
      process.exit(0);
    });
  });
}
