import { execSync } from "node:child_process";
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, "..");
const desktopBinDir = resolve(__dirname, "../../desktop/src-tauri/binaries");

const targetTriple = execSync("rustc --print host-tuple").toString().trim();
const platform = process.platform;
const arch = process.arch === "arm64" ? "arm64" : "x64";

console.log(`Building sidecar for ${targetTriple} (${platform}-${arch})...`);

// Step 1: Bundle TypeScript to single CJS file with esbuild
// node-pty is external because it has native .node binaries that can't be bundled
console.log("Step 1: Bundling with esbuild...");
execSync(
  `npx esbuild src/index.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/server-bundle.cjs --external:node-pty`,
  { cwd: serverRoot, stdio: "inherit" },
);

// Step 2: Compile to standalone binary with pkg
console.log("Step 2: Compiling with pkg...");
const nodeTarget = `node22-${platform === "darwin" ? "macos" : platform}-${arch === "arm64" ? "arm64" : "x64"}`;
execSync(
  `npx @yao-pkg/pkg dist/server-bundle.cjs --target ${nodeTarget} --output dist/kodeck-server --compress GZip`,
  { cwd: serverRoot, stdio: "inherit" },
);

// Step 3: Copy binary to Tauri binaries directory with target triple suffix
console.log("Step 3: Copying to Tauri binaries...");
mkdirSync(desktopBinDir, { recursive: true });

const srcBinary = resolve(serverRoot, "dist/kodeck-server");
const destBinary = resolve(desktopBinDir, `kodeck-server-${targetTriple}`);
cpSync(srcBinary, destBinary);
console.log(`  ${destBinary}`);

// Step 4: Copy full node-pty package alongside the binary
// The pkg binary resolves node-pty at runtime via Node.js module resolution
// starting from the binary's directory, so we need node_modules/node-pty/ next to it
const nodePtyDir = resolve(serverRoot, "node_modules/node-pty");
if (existsSync(nodePtyDir)) {
  const destNodePtyDir = resolve(desktopBinDir, "node_modules/node-pty");
  if (existsSync(destNodePtyDir)) rmSync(destNodePtyDir, { recursive: true });
  cpSync(nodePtyDir, destNodePtyDir, { recursive: true, dereference: true });
  console.log(`  Copied node-pty to ${destNodePtyDir}`);
}

console.log("Sidecar build complete.");
