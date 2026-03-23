import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";

export interface ConfigEntry {
  name: string;
  path: string;
  type: "claude-md" | "skill" | "agent" | "command" | "hook" | "mcp" | "setting";
  scope: "project" | "global";
  size: number;
}

export interface ConfigScanResult {
  entries: ConfigEntry[];
}

async function listMdFiles(
  dir: string,
  type: ConfigEntry["type"],
  scope: ConfigEntry["scope"],
): Promise<ConfigEntry[]> {
  const entries: ConfigEntry[] = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile() && item.name.endsWith(".md")) {
        const fullPath = join(dir, item.name);
        const info = await stat(fullPath);
        entries.push({ name: item.name, path: fullPath, type, scope, size: info.size });
      } else if (item.isDirectory()) {
        // Recurse one level for skill/command subdirectories
        const subEntries = await listMdFiles(join(dir, item.name), type, scope);
        for (const sub of subEntries) {
          entries.push({ ...sub, name: `${item.name}/${sub.name}` });
        }
      }
    }
  } catch {
    // directory doesn't exist
  }
  return entries;
}

async function extractSettingsEntries(
  filePath: string,
  scope: ConfigEntry["scope"],
): Promise<ConfigEntry[]> {
  const entries: ConfigEntry[] = [];
  try {
    const content = await readFile(filePath, "utf-8");
    const info = await stat(filePath);
    const data = JSON.parse(content);

    // Hooks
    if (data.hooks && typeof data.hooks === "object") {
      for (const hookName of Object.keys(data.hooks)) {
        entries.push({
          name: hookName,
          path: filePath,
          type: "hook",
          scope,
          size: JSON.stringify(data.hooks[hookName]).length,
        });
      }
    }

    // MCP Servers
    if (data.mcpServers && typeof data.mcpServers === "object") {
      for (const serverName of Object.keys(data.mcpServers)) {
        entries.push({
          name: serverName,
          path: filePath,
          type: "mcp",
          scope,
          size: JSON.stringify(data.mcpServers[serverName]).length,
        });
      }
    }

    // The settings file itself
    entries.push({
      name: basename(filePath),
      path: filePath,
      type: "setting",
      scope,
      size: info.size,
    });
  } catch {
    // file doesn't exist or invalid JSON
  }
  return entries;
}

export async function scanConfigs(worktreePath: string): Promise<ConfigScanResult> {
  const entries: ConfigEntry[] = [];
  const globalDir = join(homedir(), ".claude");
  const projectDir = join(worktreePath, ".claude");

  // CLAUDE.md files
  for (const mdPath of [
    join(worktreePath, "CLAUDE.md"),
    join(projectDir, "CLAUDE.md"),
    join(globalDir, "CLAUDE.md"),
  ]) {
    try {
      const info = await stat(mdPath);
      const scope = mdPath.startsWith(globalDir) ? "global" : "project";
      entries.push({
        name: mdPath.startsWith(globalDir) ? "~/.claude/CLAUDE.md" : basename(mdPath),
        path: mdPath,
        type: "claude-md",
        scope: scope as ConfigEntry["scope"],
        size: info.size,
      });
    } catch {
      // doesn't exist
    }
  }

  // Skills
  entries.push(...(await listMdFiles(join(projectDir, "skills"), "skill", "project")));

  // Agents
  entries.push(...(await listMdFiles(join(globalDir, "agents"), "agent", "global")));

  // Commands
  const projectCommands = join(projectDir, "commands");
  const globalCommands = join(globalDir, "commands");
  entries.push(...(await listMdFiles(projectCommands, "command", "project")));
  entries.push(...(await listMdFiles(globalCommands, "command", "global")));

  // Settings (hooks + MCPs live here)
  entries.push(...(await extractSettingsEntries(join(globalDir, "settings.json"), "global")));
  entries.push(...(await extractSettingsEntries(join(globalDir, "settings.local.json"), "global")));
  entries.push(...(await extractSettingsEntries(join(projectDir, "settings.json"), "project")));
  entries.push(
    ...(await extractSettingsEntries(join(projectDir, "settings.local.json"), "project")),
  );

  return { entries };
}

export async function readConfigFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}
