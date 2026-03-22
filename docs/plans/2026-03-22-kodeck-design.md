# kodeck — Web-based Multi-Project Claude Code Client

## Vision

A self-contained, browser-based IDE for managing multiple Claude Code sessions across multiple git projects and worktrees. No alt-tabbing — chat UI and terminals live side by side. Think superset.sh but on the web.

## Architecture

### Monorepo structure

```
apps/
  client/     — React SPA (Vite+ / Tailwind v4 / shadcn radix-nova)
  server/     — Node.js backend (WebSocket + HTTP)
packages/
  shared/     — shared types and WebSocket protocol definitions
```

### Data flow

1. User opens kodeck in browser
2. Client connects to server via WebSocket
3. User picks a project/worktree → server spawns `claude --output-format stream-json` in that worktree's directory
4. User types a message → client sends to server → server writes to claude's stdin
5. Claude streams JSON events → server parses and forwards to client → client renders chat
6. Terminal tabs work through `node-pty` → raw PTY data streamed via WebSocket → xterm.js renders

### Connection model

Local only (localhost) to start. Server and client run on the same machine.

## Project / Worktree Model

- **Project** = a git repository registered by path
- **Worktree** = a git worktree (branch) within a project
- Each worktree can have **unlimited** Claude Code sessions and terminal sessions
- No artificial limits on sessions per worktree

## UI Layout

```
┌──────────┬─────────────────────────────────┐
│          │  Tabs: [Chat 1] [Chat 2] [zsh]  │
│ Projects │──────────────────────────────────│
│          │                                  │
│ ▸ repo-a │   Active session content         │
│   main   │   (chat or terminal)             │
│   feat-x │                                  │
│          │                                  │
│ ▸ repo-b │                                  │
│   main   │                                  │
│          │                                  │
│──────────│                                  │
│ [+] Add  │                                  │
│  project │──────────────────────────────────│
│          │  Optional bottom panel            │
│          │  (secondary terminal/output)      │
└──────────┴─────────────────────────────────┘
```

### Left sidebar

Tree view of projects → worktrees. Collapsible. Right-click context menus for creating worktrees, removing projects. "Add project" button at bottom to register a repo by path.

### Tab bar

Scoped to the selected worktree. Shows all open sessions as tabs — icon-differentiated (chat bubble vs terminal). "+" button to create a new chat or terminal session.

### Main panel

Renders the active tab content — either a chat session or xterm.js terminal.

### Bottom panel

Optional, draggable divider. Pin a terminal while keeping chat in the main area.

## Chat Session Rendering

### Message types

- **User messages** — visually distinct, rendered as markdown
- **Assistant text** — streamed token-by-token with markdown rendering and syntax highlighting
- **Tool calls** — collapsible cards showing tool name + icon, summary line, expandable params/results, status indicator (spinning/checkmark/error)
- **Tool results** — nested inside tool call cards, syntax highlighted on expand
- **Permission requests** — prominent card with Accept/Deny buttons

### Input area

- Textarea with send button (Enter to send, Shift+Enter for newline)
- Stop button to interrupt Claude (sends SIGINT)
- Status bar showing session state (idle, streaming, waiting for permission)

### Key bindings (matching Claude Code CLI)

- Escape × 2 → clear input
- Escape while streaming → stop Claude
- Up/Down arrows → scroll through sent message history to populate input

## Server Process Management

### Claude Code sessions

Spawned via `child_process.spawn('claude', ['--output-format', 'stream-json'])` with cwd set to worktree path.

- Writes user messages to stdin as JSON
- Reads structured events from stdout line by line
- Tracks session state (idle, streaming, awaiting permission)
- Handles interrupt via SIGINT
- Multiple concurrent processes supported

### Terminal sessions

Spawned via `node-pty` with user's default shell and worktree path as cwd.

- Bidirectional raw byte streaming over WebSocket
- Handles resize events (cols/rows)
- Detects process exit and notifies client

### Session lifecycle

- Created on demand (user clicks "+" tab)
- Persist while server is running — tab switching doesn't kill processes
- Explicit close to terminate
- All sessions tracked per worktree in memory

### Configuration persistence

Project/worktree registry in `~/.kodeck/config.json`. No database. Chat history not persisted by server — Claude Code manages its own conversation history.

## WebSocket Protocol

Defined as TypeScript discriminated unions in `packages/shared`.

### Client → Server

| Type | Purpose |
|------|---------|
| `session.create` | Create chat or terminal session for a worktree |
| `session.close` | Terminate a session |
| `chat.send` | Send user message to Claude session |
| `chat.interrupt` | SIGINT to stop Claude |
| `chat.permission` | Accept/deny permission request |
| `terminal.input` | Raw keystrokes to PTY |
| `terminal.resize` | Terminal dimensions changed |
| `project.add` / `project.remove` | Register/unregister repo |
| `worktree.create` / `worktree.remove` | Manage git worktrees |

### Server → Client

| Type | Purpose |
|------|---------|
| `chat.text` | Streamed assistant text (batched) |
| `chat.tool_call` | Tool invocation started |
| `chat.tool_result` | Tool completed |
| `chat.permission_request` | Claude needs approval |
| `chat.state` | Session state change |
| `chat.error` | Session error |
| `terminal.output` | Batched PTY bytes |
| `terminal.exit` | PTY process exited |
| `project.worktrees` | Updated worktree list |

All messages carry a `type` discriminator and `sessionId` for routing to the correct tab.

## Performance Strategy

Performance is a first-class concern. The browser is the weak point.

- **Virtual scrolling for chat** — only visible messages + buffer are in the DOM. Collapsed tool calls outside viewport are placeholder divs with measured heights.
- **Terminal offscreen handling** — background xterm.js instances pause their render loop. Only the active terminal runs RAF.
- **Streaming text batching** — tokens batched on ~16ms intervals, flushed once per frame.
- **WebSocket message coalescing** — server batches rapid PTY output into fewer, larger frames.
- **Lazy tool call rendering** — syntax highlighting only on expand, summary-only until then.
- **React render isolation** — sidebar, tab bar, main panel are isolated render boundaries. Careful memo usage, stable references, no context-driven re-renders of entire chat.
- **Lightweight state** — Zustand for global state (project tree, active sessions), local component state for everything else.

## Tech Stack Summary

| Layer | Choice |
|-------|--------|
| Frontend framework | React (via Vite+) |
| Styling | Tailwind CSS v4 + shadcn/ui (radix-nova) |
| Terminal | xterm.js |
| State management | Zustand |
| Backend | Node.js |
| PTY management | node-pty |
| Claude Code integration | CLI subprocess with `--output-format stream-json` |
| IPC | WebSocket |
| Config storage | JSON files in `~/.kodeck/` |
| Monorepo tooling | pnpm + Vite+ |
