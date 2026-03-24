import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const npmPkgDir = resolve(root, "packages/kodeck");
const distDir = resolve(npmPkgDir, "dist");

// Clean previous build
if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(resolve(distDir, "client"), { recursive: true });

// Step 1: Build client
console.log("Step 1: Building client...");
execSync("pnpm --filter client build", { cwd: root, stdio: "inherit" });

// Step 2: Bundle server (ESM, node-pty + ws external)
console.log("Step 2: Bundling server...");
execSync(
  [
    "npx esbuild src/index.ts",
    "--bundle",
    "--platform=node",
    "--target=node22",
    "--format=esm",
    `--outfile=${resolve(distDir, "server.mjs")}`,
    "--external:node-pty",
    "--external:ws",
  ].join(" "),
  { cwd: resolve(root, "apps/server"), stdio: "inherit" },
);

// Step 3: Copy client dist
console.log("Step 3: Copying client dist...");
cpSync(resolve(root, "apps/client/dist"), resolve(distDir, "client"), {
  recursive: true,
});

console.log("\nBuild complete. Package ready at packages/kodeck/");
console.log("To publish: cd packages/kodeck && npm publish");
