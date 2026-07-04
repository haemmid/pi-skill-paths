/**
 * pi-skill-paths — Build a reverse map: skill name → { canonicalPath, scope }
 *
 * Scans filesystem at session_start:
 *   1. Project roots: cwd → git root (up to 10 levels)
 *   2. Global roots: $HOME/.pi/agent/skills/, $HOME/.agents/skills/
 *
 * Conflict policy:
 *   - project wins over global
 *   - two different global roots with same name → console warning, first wins
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface SkillEntry {
  canonicalPath: string;
  scope: "project" | "global";
}

export type SkillMap = Map<string, SkillEntry>;

const SKILL_DIR_NAMES = [".pi/skills", ".agents/skills"];
const AGENTS_SKILLS_DIR = ".agents/skills";
const MAX_PROJECT_DEPTH = 10;

async function discoverSkillDirs(
  root: string,
  home: string,
): Promise<Map<string, string>> {
  const skills = new Map<string, string>();

  for (const baseDir of SKILL_DIR_NAMES) {
    // Skip .agents/skills when root is the home directory —
    // that location is a global skills directory, not a project one.
    if (baseDir === AGENTS_SKILLS_DIR && root === home) {
      continue;
    }
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

async function findProjectRoot(cwd: string): Promise<string> {
  let dir = cwd;
  let depth = 0;
  while (depth < MAX_PROJECT_DEPTH) {
    const gitHead = join(dir, ".git");
    try {
      const st = await stat(gitHead);
      if (st.isDirectory() || st.isFile()) {
        return dir;
      }
    } catch {
      // .git doesn't exist here
    }
    const parent = join(dir, "..");
    if (parent === dir) break; // reached filesystem root
    dir = parent;
    depth++;
  }
  return cwd;
}

function getUserHome(): string {
  return process.env.HOME ?? "/home/haemmid";
}

export async function buildSkillMap(cwd: string): Promise<SkillMap> {
  const map = new Map<string, SkillEntry>();
  const home = getUserHome();

  // 1. Project roots — scan cwd and its ancestors up to git root
  //    Walk upward from cwd; stop at git root or MAX_PROJECT_DEPTH.
  //    Each directory is scanned for .pi/skills/ and .agents/skills/.
  let dir = cwd;
  let depth = 0;
  while (depth < MAX_PROJECT_DEPTH) {
    const projectSkills = await discoverSkillDirs(dir, home);
    for (const [name, path] of projectSkills) {
      if (!map.has(name)) {
        map.set(name, { canonicalPath: path, scope: "project" });
      }
    }
    // Check if this dir is a git root — if so, stop here
    const gitHead = join(dir, ".git");
    try {
      const st = await stat(gitHead);
      if (st.isDirectory() || st.isFile()) {
        break; // git root reached, don't go further up
      }
    } catch {
      // no .git here
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
    depth++;
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
          const existing = map.get(entry.name)!;
          if (existing.scope === "project") {
            // Project wins silently
            continue;
          }
          // Two different global roots with same name
          console.warn(
            `[pi-skill-paths] Conflict: skill "${entry.name}" found in multiple global roots:\n` +
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
