import { build } from "vite";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. SSR build — compile entry-server.tsx to a Node-compatible module
await build({
  configFile: resolve(__dirname, "vite.config.ts"),
  build: {
    ssr: "src/entry-server.tsx",
    outDir: "dist/server",
    emptyOutDir: true,
  },
  logLevel: "warn",
});

// 2. Import the SSR module and render the app to HTML
const { render } = await import("./dist/server/entry-server.js");
const appHtml = render();

// 3. Inject rendered HTML into the client build's index.html
const indexPath = resolve(__dirname, "dist/index.html");
const template = readFileSync(indexPath, "utf-8");
const html = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
writeFileSync(indexPath, html);

// 4. Remove SSR build artifacts
rmSync(resolve(__dirname, "dist/server"), { recursive: true });

console.log("Pre-rendered index.html with static content");
