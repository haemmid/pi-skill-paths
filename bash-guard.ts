/**
 * pi-skill-paths — Bash guard
 *
 * Blocks attempts to read or search Pi skill files via bash commands.
 *
 * Rules:
 *   cat/sed/head + skill-like path containing SKILL.md → block
 *   find/grep/ls/rg + skill-ish path (home, recursive, skill reference) → block
 *
 * Does NOT block:
 *   cat package.json
 *   cat my-SKILL.md-notes.txt (no skill-like path)
 *   find . -name "*.ts" (no skill reference)
 *   ls .pi/skills/ (no SKILL.md or skill name, just directory listing)
 */

import type { SkillMap } from "./skill-map.js";

// Tool categories
const READ_TOOLS = /\b(cat|sed|head)\b/;
const SEARCH_TOOLS = /\b(find|grep|ls|rg)\b/;

// Skill-like path patterns — must match for READ_TOOLS to trigger
const SKILL_PATH_RE =
  /\.pi\/(agent\/)?skills\/[^/]+\/SKILL\.md|\.agents\/skills\/[^/]+\/SKILL\.md|~\/\.pi\/(agent\/)?skills\/|~\/\.agents\/skills\/|\/home\/[^/]+\/\.pi\/(agent\/)?skills\/|\/home\/[^/]+\/\.agents\/skills\//i;

// Patterns that indicate a skill-ish / dangerous path context
const SKILLISH_PATH_PATTERNS = [
  // ~ /home paths with skill references
  /~\/\.pi\/(agent\/)?skills\//,
  /~\/\.agents\//,
  /\/home\/[^/]+\/\.pi\/(agent\/)?skills\//,
  /\/home\/[^/]+\/\.agents\//,

  // find ~ with skill
  /\bfind\s+~.*SKILL/i,
  /\bfind\s+~.*skill/i,

  // grep -R ~ with skill
  /\bgrep\s+-[rR]\b\s+.*SKILL.*~/i,
  /\bgrep\s+-[rR]\b\s+~.*SKILL/i,
  /\bgrep\s+-[rR]\b\s+.*skill.*~/i,
  /\bgrep\s+-[rR]\b\s+~.*skill/i,

  // find /home/ with skill
  /\bfind\s+\/home\//,
  /\bgrep\s+-[rR]\b.*\/home\//,

  // find . (recursive) with skill reference — only if SKILL/skill is mentioned
  /\bfind\s+\.\s+.*SKILL/i,
  /\bfind\s+\.\s+.*skill/i,

  // grep -R . with skill reference — only if SKILL/skill is mentioned
  /\bgrep\s+-[rR]\b\s+.*SKILL/i,
  /\bgrep\s+-[rR]\b\s+.*skill/i,
];

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

function hasSkillishPath(cmd: string): boolean {
  return SKILLISH_PATH_PATTERNS.some((p) => p.test(cmd));
}

function isSkillPath(cmd: string): boolean {
  return SKILL_PATH_RE.test(cmd);
}

export interface BashGuardResult {
  blocked: boolean;
  reason: string;
}

export function checkBashSkillAccess(
  command: string,
  skillMap: SkillMap,
): BashGuardResult {
  // ── Rule 1: cat/sed/head + skill-like path with SKILL.md ─────────
  if (READ_TOOLS.test(command)) {
    // Only block if the path is clearly a skill path (contains .pi/agent/skills, .agents/skills, etc.)
    if (isSkillPath(command)) {
      const skillName = findSkillNameInCommand(command, skillMap);
      if (skillName) {
        const canonical = skillMap.get(skillName)?.canonicalPath;
        if (canonical) {
          return { blocked: true, reason: makeReason(canonical) };
        }
      }
      return { blocked: true, reason: makeGenericReason() };
    }
    // Otherwise allow — e.g. cat package.json, cat my-SKILL.md-notes.txt
    return { blocked: false, reason: "" };
  }

  // ── Rule 2: find/grep/ls/rg + skill-ish path ─────────────────────
  if (SEARCH_TOOLS.test(command)) {
    const hasSkillMd = /SKILL\.md/i.test(command);
    const skillName = findSkillNameInCommand(command, skillMap);
    // "ls .pi/skills/" should pass — it's a directory listing, not a search for SKILL.md
    const isLsOnly = /\bls\b/.test(command) && !hasSkillMd && !skillName && !/\bskill\b/i.test(command);

    if (isLsOnly) {
      return { blocked: false, reason: "" };
    }

    const mentionsSkill = hasSkillMd || skillName || /\bskill\b/i.test(command);

    if (mentionsSkill && hasSkillishPath(command)) {
      if (skillName) {
        const canonical = skillMap.get(skillName)?.canonicalPath;
        if (canonical) {
          return { blocked: true, reason: makeReason(canonical) };
        }
      }
      return { blocked: true, reason: makeGenericReason() };
    }
  }

  return { blocked: false, reason: "" };
}
