import { build } from "esbuild";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Bundle entry-server.tsx for Node.js using esbuild
await build({
  entryPoints: [resolve(__dirname, "src/entry-server.tsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: resolve(__dirname, "dist/server/entry-server.mjs"),
  packages: "external",
  jsx: "automatic",
  jsxImportSource: "react",
});

// 2. Import the SSR module and render the app to HTML
const { render } = await import("./dist/server/entry-server.mjs");
const appHtml = render();

// 3. Inject rendered HTML into the client build's index.html
const indexPath = resolve(__dirname, "dist/index.html");
const template = readFileSync(indexPath, "utf-8");
const html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
writeFileSync(indexPath, html);

// 4. Remove SSR build artifacts
rmSync(resolve(__dirname, "dist/server"), { recursive: true });

console.log("Pre-rendered index.html with static content");
