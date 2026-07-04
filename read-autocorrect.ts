/**
 * Read autocorrect — normalizes skill-like read paths to canonical SKILL.md.
 *
 * Rules:
 *   1. Path ends with skill directory (no SKILL.md) → append /SKILL.md
 *   2. Path matches known skill → replace with canonical absolute path
 *   3. Relative .pi/skills/ path → resolve to absolute
 *
 * Does NOT autocorrect if path contains ".." traversal (too risky).
 * Returns corrected path or null if no change needed.
 */

import { resolve, isAbsolute } from "node:path";

import type { SkillMap } from "./skill-map.js";

// Skill directory patterns (relative or absolute)
const SKILL_DIR_PATTERNS = [
  /\.pi\/skills\/[^/]+$/,              // .pi/skills/foo
  /\.agents\/skills\/[^/]+$/,          // .agents/skills/foo
  /\/\.pi\/agent\/skills\/[^/]+$/,     // /.../.pi/agent/skills/foo
  /\/\.agents\/skills\/[^/]+$/,        // /.../.agents/skills/foo
];

// Path traversal check — if detected, don't autocorrect
const TRAVERSAL_PATTERN = /\.\./;

// Skill-ish path patterns (for known skill detection)
const SKILLISH_PATH_RE = /\.pi\/(agent\/)?skills\/|\.agents\/skills\//;

export interface ReadAutocorrectResult {
  correctedPath: string;
}

function matchesSkillDirPattern(path: string): boolean {
  return SKILL_DIR_PATTERNS.some((p) => p.test(path));
}

function isSkillishPath(path: string): boolean {
  return SKILLISH_PATH_RE.test(path);
}

function extractSkillNameFromPath(path: string): string | null {
  // .pi/skills/<name>/SKILL.md → <name>
  // .pi/skills/<name> → <name>
  // ~/.pi/agent/skills/<name>/SKILL.md → <name>
  const match = path.match(/(?:\.pi\/(?:agent\/)?skills|\.agents\/skills)\/([^/]+)(?:\/SKILL\.md)?$/);
  if (match) return match[1];
  return null;
}

export function normalizeSkillReadPath(
  path: string,
  skillMap: SkillMap,
  cwd: string,
): string | null {
  // Skip traversal paths
  if (TRAVERSAL_PATTERN.test(path)) {
    return null;
  }

  // Case 1: Path looks like a skill directory (missing SKILL.md)
  if (matchesSkillDirPattern(path) && !/SKILL\.md$/i.test(path)) {
    return path + "/SKILL.md";
  }

  // Case 2: Path matches a known skill
  const skillName = extractSkillNameFromPath(path);
  if (skillName && skillMap.has(skillName)) {
    return skillMap.get(skillName)!.canonicalPath;
  }

  // Case 3: Relative .pi/skills/ path without known skill — resolve to absolute
  if (isSkillishPath(path) && !isAbsolute(path)) {
    return resolve(cwd, path);
  }

  return null;
}
