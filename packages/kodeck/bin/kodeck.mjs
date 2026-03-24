#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.KODECK_LIB_MODE = "1";
process.env.KODECK_CLIENT_DIR ||= resolve(__dirname, "..", "dist", "client");

const { startServer } = await import("../dist/server.mjs");
const server = await startServer();

// Open browser
const url = `http://localhost:${server.port}`;
console.log(`\nOpen ${url} in your browser to get started.\n`);

const open =
  process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";
exec(`${open} ${url}`);

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  server.close();
  process.exit(0);
});
