/**
 * Build a reverse map: skill name → { canonicalPath, scope }
 *
 * Scans filesystem at session_start:
 *   1. Project roots: cwd → git root (or fs root)
 *   2. Global roots: ~/.pi/agent/skills/, ~/.agents/skills/
 *
 * Conflict policy:
 *   - project wins over global
 *   - two different global roots with same name → console warning, first wins
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";

export interface SkillEntry {
  canonicalPath: string;
  scope: "project" | "global";
}

export type SkillMap = Map<string, SkillEntry>;

const SKILL_DIR_NAME = ".pi/skills";
const AGENTS_SKILLS_DIR = ".agents/skills";

async function discoverSkillDirs(root: string): Promise<Map<string, string>> {
  const skills = new Map<string, string>();

  for (const baseDir of [SKILL_DIR_NAME, AGENTS_SKILLS_DIR]) {
    const dir = join(root, baseDir);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = join(dir, entry.name, "SKILL.md");
        const s = await stat(skillMd).catch(() => null);
        if (s?.isFile()) {
          skills.set(entry.name, skillMd);
        }
      }
    } catch {
      // Directory doesn't exist or not readable — skip
    }
  }

  return skills;
}

function findProjectRoot(cwd: string): string {
  // Walk up to git root or filesystem root
  let dir = cwd;
  const root = "/";
  while (dir !== root) {
    try {
      const gitHead = join(dir, ".git");
      const gitDirStat = stat(gitHead).catch(() => null);
      if (gitDirStat) return dir;
      // .git file (gitdir reference in worktrees)
      const gitFileStat = stat(gitHead).catch(() => null);
      if (gitFileStat?.isFile()) return dir;
    } catch {
      // ignore
    }
    const parent = join(dir, "..");
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return cwd;
}

function getUserHome(): string {
  return process.env.HOME ?? "/home/haemmid";
}

export async function buildSkillMap(cwd: string): Promise<SkillMap> {
  const map = new Map<string, SkillEntry>();
  const home = getUserHome();

  // 1. Project roots
  const projectRoot = findProjectRoot(cwd);
  let root = projectRoot;
  while (root !== "/") {
    const projectSkills = await discoverSkillDirs(root);
    for (const [name, path] of projectSkills) {
      if (!map.has(name)) {
        map.set(name, { canonicalPath: path, scope: "project" });
      }
    }
    const parent = join(root, "..");
    if (parent === root) break;
    root = parent;
  }

  // 2. Global roots
  const globalRoots = [
    join(home, ".pi", "agent", "skills"),
    join(home, ".agents", "skills"),
  ];

  for (const gRoot of globalRoots) {
    try {
      const entries = await readdir(gRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = join(gRoot, entry.name, "SKILL.md");
        const s = await stat(skillMd).catch(() => null);
        if (!s?.isFile()) continue;

        if (map.has(entry.name)) {
          // Conflict: project already has it, or another global root claimed it
          const existing = map.get(entry.name)!;
          if (existing.scope === "project") {
            // Project wins silently
            continue;
          }
          // Two different global roots with same name
          console.warn(
            `[skill-guard] Conflict: skill "${entry.name}" found in multiple global roots:\n` +
            `  ${existing.canonicalPath}\n` +
            `  ${skillMd}\n` +
            `Keeping first.`,
          );
          continue;
        }

        map.set(entry.name, { canonicalPath: skillMd, scope: "global" });
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  return map;
}
