import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "@kodeck/shared";

const CONFIG_DIR = join(homedir(), ".kodeck");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface KodeckConfig {
  projects: ProjectConfig[];
}

function defaultConfig(): KodeckConfig {
  return { projects: [] };
}

export async function loadConfig(): Promise<KodeckConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as KodeckConfig;
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: KodeckConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function updateProjectCopyPaths(
  projectId: string,
  copyPaths: string[],
): Promise<void> {
  const config = await loadConfig();
  const project = config.projects.find((p) => p.id === projectId);
  if (project) {
    project.worktreeCopyPaths = copyPaths;
    await saveConfig(config);
  }
}
