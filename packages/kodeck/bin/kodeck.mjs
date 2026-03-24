#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execSync, spawn } from "node:child_process";
import { readFileSync, openSync, writeSync, closeSync } from "node:fs";

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

let ttyFd = null;
let animationTimer = null;

function openTTY() {
  try {
    return openSync("/dev/tty", "w");
  } catch {
    return null;
  }
}

function chevronLine(bright1, bright2) {
  const c1 = bright1 ? amber("❯") : amberDim("❯");
  const c2 = bright2 ? amber("❯") : amberDim("❯");
  return `  ${c1}${c2} ${boldCyan("kodeck")} ${dim(`v${pkg.version}`)}`;
}

// Chevron line is 4 rows above final cursor position
function redrawChevrons(bright1, bright2) {
  if (!ttyFd) return;
  writeSync(ttyFd, `\x1b[s\x1b[4A\x1b[2K\r${chevronLine(bright1, bright2)}\x1b[u`);
}

function startAnimation() {
  if (!ttyFd) return;
  let frame = 0;
  animationTimer = setInterval(() => {
    const f = frame % 2;
    redrawChevrons(f === 0, f === 1);
    frame++;
  }, 800);
}

function stopAnimation() {
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
  if (ttyFd) {
    redrawChevrons(true, true); // final state: both bright
    writeSync(ttyFd, dim("\n  Shutting down...\n") + "\n");
    closeSync(ttyFd);
    ttyFd = null;
  }
}

async function printBanner(url) {
  ttyFd = openTTY();

  if (!ttyFd) {
    console.log(`\n  ❯❯ kodeck v${pkg.version}\n\n  ➜  Local:   ${url}\n`);
    return;
  }

  const w = (s) => writeSync(ttyFd, s);
  const cl = "\x1b[2K\r";

  w("\n");
  await sleep(400);

  // First chevron fades in dim
  w(`  ${amberDim("❯")}`);
  await sleep(350);

  // First chevron lights up bright
  w(`${cl}  ${amber("❯")}`);
  await sleep(400);

  // Second chevron fades in dim
  w(`${cl}  ${amber("❯")}${amberDim("❯")}`);
  await sleep(350);

  // Both bright + title appears
  w(`${cl}${chevronLine(true, true)}\n`);
  await sleep(250);

  w(`\n  ${green("➜")}  ${bold("Local:")}   ${cyan(url)}\n\n`);

  // Start continuous chevron animation
  startAnimation();
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
    stopAnimation();
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
      stdio: ["inherit", "pipe", "inherit"],
      env: { ...process.env, KODECK_LIB_MODE: "1", KODECK_CLIENT_DIR: clientDir },
    },
  );
  // Suppress portless verbose stdout (banner uses /dev/tty instead)
  child.stdout.resume();
  child.on("close", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
}
