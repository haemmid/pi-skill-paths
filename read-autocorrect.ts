/**
 * pi-skill-paths — Read autocorrect
 *
 * Normalizes skill-like read paths to canonical SKILL.md.
 *
 * Rules (in priority order):
 *   1. Path matches a known skill → replace with canonical absolute path
 *   2. Path looks like a skill directory (no SKILL.md) → append /SKILL.md
 *   3. Relative .pi/skills/ path → resolve to absolute
 *
 * Does NOT autocorrect if path contains ".." traversal (too risky).
 * Returns corrected path or null if no change needed.
 */

import { resolve, isAbsolute } from "node:path";

import type { SkillMap } from "./skill-map.js";

// Skill directory patterns (relative or absolute, without SKILL.md)
const SKILL_DIR_PATTERNS = [
  /\.pi\/skills\/[^/]+$/,              // .pi/skills/foo
  /\.agents\/skills\/[^/]+$/,          // .agents/skills/foo
  /\/\.pi\/agent\/skills\/[^/]+$/,     // /.../.pi/agent/skills/foo
  /\/\.agents\/skills\/[^/]+$/,        // /.../.agents/skills/foo
  /~\/\.pi\/agent\/skills\/[^/]+$/,    // ~/.pi/agent/skills/foo
  /~\/\.agents\/skills\/[^/]+$/,       // ~/.agents/skills/foo
];

// Path traversal check — if detected, don't autocorrect
const TRAVERSAL_PATTERN = /\.\./;

// Skill-ish path patterns (for relative resolution)
const SKILLISH_PATH_RE = /\.pi\/(agent\/)?skills\/|\.agents\/skills\//;

// Regex to extract skill name from a skill-like path
// Matches:
//   .pi/skills/<name>, .pi/agent/skills/<name>, .agents/skills/<name>
//   ~/.pi/agent/skills/<name>, ~/.agents/skills/<name>
//   /home/user/.pi/agent/skills/<name>, /home/user/.agents/skills/<name>
const SKILL_NAME_RE =
  /^(?:~\/)?(?:\.pi\/(?:agent\/)?skills|\.agents\/skills)\/([^/]+)(?:\/SKILL\.md)?$/;

const ABSOLUTE_SKILL_NAME_RE =
  /^(?:\/home\/[^/]+\/)?(?:\.pi\/(?:agent\/)?skills|\.agents\/skills)\/([^/]+)(?:\/SKILL\.md)?$/;

function matchesSkillDirPattern(path: string): boolean {
  return SKILL_DIR_PATTERNS.some((p) => p.test(path));
}

function isSkillishPath(path: string): boolean {
  return SKILLISH_PATH_RE.test(path);
}

function extractSkillNameFromPath(path: string): string | null {
  // Try relative/tilde pattern first
  let match = path.match(SKILL_NAME_RE);
  if (match) return match[1];
  // Try absolute path pattern
  match = path.match(ABSOLUTE_SKILL_NAME_RE);
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

  // Expand ~ to $HOME for consistent matching
  const expanded = path.startsWith("~/")
    ? (process.env.HOME ?? "/home/haemmid") + path.slice(1)
    : path;

  // Case 1: Path matches a known skill → canonical path wins
  const skillName = extractSkillNameFromPath(expanded);
  if (skillName && skillMap.has(skillName)) {
    return skillMap.get(skillName)!.canonicalPath;
  }

  // Case 2: Relative .pi/skills/ path without known skill — resolve to absolute
  if (isSkillishPath(path) && !isAbsolute(path)) {
    const resolved = resolve(cwd, path);
    return /SKILL\.md$/i.test(resolved) ? resolved : resolved + "/SKILL.md";
  }

  // Case 3: Path looks like a skill directory (missing SKILL.md)
  if (matchesSkillDirPattern(expanded) && !/SKILL\.md$/i.test(expanded)) {
    return expanded + "/SKILL.md";
  }

  return null;
}
