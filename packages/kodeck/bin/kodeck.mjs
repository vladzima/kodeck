#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execSync, spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, "..", "dist", "client");

// Second invocation — portless has set PORT and PORTLESS_URL
if (process.env.PORTLESS_URL) {
  process.env.KODECK_LIB_MODE = "1";
  process.env.KODECK_CLIENT_DIR ||= clientDir;

  const { startServer } = await import("../dist/server.mjs");
  const server = await startServer();

  const url = process.env.PORTLESS_URL;
  console.log(`\nkodeck running at ${url}\n`);

  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${openCmd} ${url}`);

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.close();
    process.exit(0);
  });
} else {
  // First invocation — start proxy and re-exec through portless
  try {
    execSync("portless proxy start", { stdio: "ignore" });
  } catch {
    // Proxy may already be running
  }

  const child = spawn(
    "portless",
    ["run", "--name", "kodeck", process.execPath, fileURLToPath(import.meta.url)],
    {
      stdio: "inherit",
      env: { ...process.env, KODECK_LIB_MODE: "1", KODECK_CLIENT_DIR: clientDir },
    },
  );
  child.on("close", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
}
