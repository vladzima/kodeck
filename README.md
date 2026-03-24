# kodeck

Open-source IDE for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Multi-project workspace with chat, terminals, and git worktree management — all in your browser.

## Quick Start

```bash
npx kodeck-app
```

Requires Node.js 22+ and an active [Claude Code](https://docs.anthropic.com/en/docs/claude-code) authentication (OAuth).

## Features

- **Multi-project workspace** — manage multiple repos and worktrees in a single UI
- **Chat sessions** — streaming responses, tool call visualization, permission prompts, thinking indicators
- **Terminal sessions** — full PTY terminals powered by xterm.js alongside your chats
- **Git worktree management** — create, switch, pull, push worktrees; browse branches and PRs
- **Config browser** — inspect CLAUDE.md, skills, hooks, MCP servers, and agents across projects
- **Session persistence** — chat history and sessions survive restarts
- **Search** — find across all sessions and tool outputs
- **Desktop app** — native macOS app via Tauri (optional)

## Development

Clone the repo and install dependencies:

```bash
git clone https://github.com/vladzima/kodeck.git
cd kodeck
pnpm install
```

Start the dev server (client + server concurrently):

```bash
pnpm dev
```

This starts the server on port 3001 and the client on port 5173. Open http://localhost:5173.

### With portless (HTTPS local domain)

For a nicer `https://kodeck.localhost` URL during development:

```bash
npm install -g portless
portless proxy start --https
pnpm dev:local
```

### Project Structure

```
apps/
  client/    React + Tailwind frontend (Vite)
  server/    Node.js WebSocket backend (node-pty)
  desktop/   Tauri macOS app wrapper
  landing/   kodeck.dev landing page
packages/
  shared/    Shared TypeScript types
  kodeck/    Publishable npm CLI package
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start client + server for development |
| `pnpm dev:local` | Same, with portless for `https://kodeck.localhost` |
| `pnpm ready` | Format, lint, test, and build everything |
| `pnpm build:npm` | Build the `kodeck` npm package |
| `pnpm tauri:dev` | Run the native desktop app in dev mode |
| `pnpm tauri:build` | Build the native macOS desktop app |

### Tooling

This project uses [Vite+](https://github.com/nicepkg/vite-plus) (`vp`) as the unified toolchain. Use `vp lint`, `vp fmt`, and `vp test` — do not run oxlint, vitest, or formatters directly.

## License

[MIT](LICENSE)
