import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".webp": "image/webp",
};

export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.includes("..")) {
    res.writeHead(403);
    res.end();
    return;
  }

  let filePath = join(root, pathname === "/" ? "index.html" : pathname);

  const exists = existsSync(filePath);
  const isDir = exists && statSync(filePath).isDirectory();

  if (!exists || isDir) {
    if (extname(pathname)) {
      res.writeHead(404);
      res.end();
      return;
    }
    // SPA fallback
    filePath = join(root, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}
