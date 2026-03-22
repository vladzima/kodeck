import { WebSocketServer } from "ws";
import { handleMessage, cleanupAllSessions } from "./router.ts";

const PORT = Number(process.env.KODECK_PORT) || 3001;
const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`kodeck server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  console.log("client connected");
  ws.on("message", (data) => {
    handleMessage(ws, data.toString()).catch((err) => {
      console.error("Error handling message:", err);
    });
  });
  ws.on("close", () => console.log("client disconnected"));
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  cleanupAllSessions();
  wss.close();
  process.exit(0);
});
