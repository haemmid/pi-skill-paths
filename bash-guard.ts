/**
 * pi-skill-paths — Bash guard
 *
 * Blocks bash-based access to SKILL.md files only.
 * Does NOT block access to skill directories, scripts, or assets.
 *
 * Rules:
 *   cat/sed/head + path ending with /SKILL.md → block
 *   find/grep/rg + searching for SKILL.md (e.g. -name SKILL.md, -R SKILL.md) → block
 *
 * Does NOT block:
 *   bash .pi/skills/foo/scripts/run.sh
 *   node ~/.pi/agent/skills/foo/scripts/build.js
 *   python .pi/skills/foo/tool.py
 *   ls .pi/skills/foo/
 *   find .pi/skills/foo/scripts -type f
 *   grep -R TODO .pi/skills/foo/scripts
 */

import type { SkillMap } from "./skill-map.js";

// ── SKILL.md detection ──────────────────────────────────────────────
// Matches SKILL.md as a path segment (preceded by / and followed by end/whitespace/" or -)
const SKILL_MD_RE = /\/SKILL\.md(\s|"|'|$|\/)/i;

// ── Search patterns: indicates the command is searching FOR SKILL.md ─
// e.g. find ... -name SKILL.md, grep -R SKILL.md ..., rg SKILL.md ...
const SEARCHING_FOR_SKILL_MD_RE = /-name\s+SKILL\.md\b|\bgrep\s+-[rR]\b.*\bSKILL\.md\b|\brg\s+.*\bSKILL\.md\b/i;

// Known skill names from the map
function findSkillNameInCommand(cmd: string, skillMap: SkillMap): string | null {
  const sorted = [...skillMap.keys()].sort((a, b) => b.length - a.length);
  const cmdLower = cmd.toLowerCase();
  for (const name of sorted) {
    if (cmdLower.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

function makeReason(canonical: string): string {
  return `pi-skill-paths blocked bash access to SKILL.md. Use read tool: ${canonical}`;
}

function makeGenericReason(): string {
  return "pi-skill-paths blocked bash access to SKILL.md. Use read tool.";
}

export interface BashGuardResult {
  blocked: boolean;
  reason: string;
}

export function checkBashSkillAccess(
  command: string,
  skillMap: SkillMap,
): BashGuardResult {
  // ── Rule 1: cat/sed/head reading SKILL.md ────────────────────────
  if (/\b(cat|sed|head)\b/.test(command) && SKILL_MD_RE.test(command)) {
    const skillName = findSkillNameInCommand(command, skillMap);
    if (skillName) {
      const canonical = skillMap.get(skillName)?.canonicalPath;
      if (canonical) {
        return { blocked: true, reason: makeReason(canonical) };
      }
    }
    return { blocked: true, reason: makeGenericReason() };
  }

  // ── Rule 2: find/grep/rg searching for SKILL.md ──────────────────
  if (SEARCHING_FOR_SKILL_MD_RE.test(command)) {
    const skillName = findSkillNameInCommand(command, skillMap);
    if (skillName) {
      const canonical = skillMap.get(skillName)?.canonicalPath;
      if (canonical) {
        return { blocked: true, reason: makeReason(canonical) };
      }
    }
    return { blocked: true, reason: makeGenericReason() };
  }

  // ── Everything else passes ───────────────────────────────────────
  return { blocked: false, reason: "" };
}
