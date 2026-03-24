#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, "..", "dist", "client");
const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf8"));

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const boldCyan = (s) => `\x1b[1;36m${s}\x1b[0m`;
const amber = (s) => `\x1b[1;38;2;196;162;97m${s}\x1b[0m`;
const amberDim = (s) => `\x1b[2;38;2;196;162;97m${s}\x1b[0m`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function printBanner(url) {
  if (!process.stdout.isTTY) {
    console.log(`\n  kodeck v${pkg.version}\n\n  Local:   ${url}\n`);
    return;
  }

  process.stdout.write("\n  ");
  await sleep(300);
  process.stdout.write(amberDim("❯"));
  await sleep(200);
  process.stdout.write("\x1b[1D");
  process.stdout.write(amber("❯"));
  await sleep(400);
  process.stdout.write(amberDim("❯"));
  await sleep(200);
  process.stdout.write(`  ${boldCyan("kodeck")} ${dim(`v${pkg.version}`)}\n`);
  await sleep(200);
  console.log("");
  console.log(`  ${green("➜")}  ${bold("Local:")}   ${cyan(url)}`);
  console.log("");
}

// Second invocation — portless has set PORT and PORTLESS_URL
if (process.env.PORTLESS_URL) {
  process.env.KODECK_LIB_MODE = "1";
  process.env.KODECK_CLIENT_DIR ||= clientDir;

  const { startServer } = await import("../dist/server.mjs");
  const server = await startServer();

  const url = process.env.PORTLESS_URL;
  await printBanner(url);

  const openCmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${openCmd} ${url}`);

  process.on("SIGINT", () => {
    console.log(dim("\n  Shutting down...\n"));
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
