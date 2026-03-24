import { cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appBundleMacOS = resolve(
  __dirname,
  "../apps/desktop/src-tauri/target/release/bundle/macos/Kodeck.app/Contents/MacOS",
);
const binariesNodeModules = resolve(
  __dirname,
  "../apps/desktop/src-tauri/binaries/node_modules",
);

if (!existsSync(appBundleMacOS)) {
  console.error("App bundle not found at:", appBundleMacOS);
  process.exit(1);
}

if (existsSync(binariesNodeModules)) {
  const dest = resolve(appBundleMacOS, "node_modules");
  cpSync(binariesNodeModules, dest, { recursive: true });
  console.log(`Copied node_modules to ${dest}`);
} else {
  console.warn("No node_modules to copy from binaries/");
}
