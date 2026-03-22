import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionInfo, ChatMessage } from "@kodeck/shared";

const CONFIG_DIR = join(homedir(), ".kodeck");
const SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");

export interface PersistedSession {
  info: SessionInfo;
  messages: ChatMessage[];
}

interface SessionsData {
  sessions: PersistedSession[];
}

export async function loadPersistedSessions(): Promise<PersistedSession[]> {
  try {
    const raw = await readFile(SESSIONS_FILE, "utf-8");
    const data = JSON.parse(raw) as SessionsData;
    return data.sessions ?? [];
  } catch {
    return [];
  }
}

async function saveAll(sessions: PersistedSession[]): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(SESSIONS_FILE, JSON.stringify({ sessions }, null, 2));
}

export async function persistSession(info: SessionInfo, messages: ChatMessage[] = []): Promise<void> {
  const sessions = await loadPersistedSessions();
  const existing = sessions.findIndex((s) => s.info.id === info.id);
  if (existing >= 0) {
    sessions[existing] = { info, messages };
  } else {
    sessions.push({ info, messages });
  }
  await saveAll(sessions);
}

export async function removePersistedSession(sessionId: string): Promise<void> {
  const sessions = await loadPersistedSessions();
  await saveAll(sessions.filter((s) => s.info.id !== sessionId));
}

export async function updateSessionMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  const sessions = await loadPersistedSessions();
  const session = sessions.find((s) => s.info.id === sessionId);
  if (session) {
    session.messages = messages;
    await saveAll(sessions);
  }
}
