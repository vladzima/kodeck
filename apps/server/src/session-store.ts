import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionInfo, ChatMessage, SessionMeta } from "@kodeck/shared";

const CONFIG_DIR = join(homedir(), ".kodeck");
const SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");
const SESSIONS_TMP = join(CONFIG_DIR, "sessions.json.tmp");

export interface PersistedSession {
  info: SessionInfo;
  messages: ChatMessage[];
  slashCommands?: string[];
  meta?: SessionMeta;
}

interface SessionsData {
  sessions: PersistedSession[];
}

// ── Write mutex ──────────────────────────────────────────────────────
// Serializes all writes to sessions.json so concurrent updates
// never read stale data or corrupt the file.
let writeQueue: Promise<void> = Promise.resolve();

function enqueue(fn: (sessions: PersistedSession[]) => PersistedSession[] | void): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const sessions = await loadFromDisk();
    const result = fn(sessions);
    const toSave = result ?? sessions;
    await saveToDisk(toSave);
  }).catch((err) => {
    console.error("[session-store] write error:", err);
  });
  return writeQueue;
}

// ── Disk I/O ─────────────────────────────────────────────────────────
async function loadFromDisk(): Promise<PersistedSession[]> {
  try {
    const raw = await readFile(SESSIONS_FILE, "utf-8");
    const data = JSON.parse(raw) as SessionsData;
    return data.sessions ?? [];
  } catch {
    return [];
  }
}

async function saveToDisk(sessions: PersistedSession[]): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  // Atomic write: write to tmp file, then rename
  await writeFile(SESSIONS_TMP, JSON.stringify({ sessions }, null, 2));
  await rename(SESSIONS_TMP, SESSIONS_FILE);
}

// ── Public API ───────────────────────────────────────────────────────
export async function loadPersistedSessions(): Promise<PersistedSession[]> {
  return loadFromDisk();
}

export async function persistSession(info: SessionInfo): Promise<void> {
  return enqueue((sessions) => {
    const existing = sessions.find((s) => s.info.id === info.id);
    if (existing) {
      // Only update info fields, preserve messages/slashCommands/meta
      existing.info = info;
    } else {
      sessions.push({ info, messages: [] });
    }
  });
}

export async function removePersistedSession(sessionId: string): Promise<void> {
  return enqueue((sessions) => sessions.filter((s) => s.info.id !== sessionId));
}

export async function updateSessionName(sessionId: string, name: string): Promise<void> {
  return enqueue((sessions) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (session) session.info.name = name;
  });
}

export async function updateSessionMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  return enqueue((sessions) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (session) session.messages = messages;
  });
}

export async function updateSessionSlashCommands(sessionId: string, commands: string[]): Promise<void> {
  return enqueue((sessions) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (session) session.slashCommands = commands;
  });
}

export async function updateSessionMeta(sessionId: string, meta: SessionMeta): Promise<void> {
  return enqueue((sessions) => {
    const session = sessions.find((s) => s.info.id === sessionId);
    if (session) session.meta = meta;
  });
}
