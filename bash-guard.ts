/**
 * Bash guard — blocks attempts to read/search SKILL.md via bash commands.
 *
 * Rules:
 *   cat/sed/head + SKILL.md → block (always, no path check needed)
 *   find/grep/ls/rg + SKILL.md/known-skill/word-skill + skill-ish/home/recursive path → block
 *
 * Returns canonical read path when a known skill is detected.
 */

import type { SkillMap } from "./skill-map.js";

// Tools that should only trigger on skill-ish paths
const PATH_SENSITIVE_TOOLS = /\b(find|grep|ls|rg)\b/;

// Tools that trigger on any SKILL.md mention
const ANY_PATH_TOOLS = /\b(cat|sed|head)\b/;

// Patterns that indicate a skill-ish path
// (checked via hasSkillishPath — any match is sufficient)
const SKILLISH_PATH_PATTERNS = [
  // /home/user/ paths
  /\/home\/[^/]+\/\.pi\/(agent\/)?skills\//,
  /\/home\/[^/]+\/\.agents\/(skills\/)?/,

  // ~/.pi/ and ~/.agents/ paths
  /~\/\.pi\/(agent\/)?skills\//,
  /~\/\.agents\//,

  // .pi/skills/ and .agents/skills/ relative paths
  /\b\.pi\/(agent\/)?skills\//,
  /\b\.agents\/(skills\/)?/,

  // find ~ variants
  /\bfind\s+~\b.*SKILL/i,
  /\bfind\s+~\b.*skill/i,
  /\bfind\s+~\s+(-|\\w)/,
  /\bfind\s+~\s*$/,

  // grep -R/r ~ variants
  /\bgrep\s+-[rR]\b\s+.*SKILL.*~/i,
  /\bgrep\s+-[rR]\b\s+~.*SKILL/i,
  /\bgrep\s+-[rR]\b\s+.*skill.*~/i,
  /\bgrep\s+-[rR]\b\s+~.*skill/i,

  // find /home/ variants
  /\bfind\s+\/home\//,
  /\bgrep\s+-[rR]\b.*\/home\//,

  // find . (recursive) with skill reference
  /\bfind\s+\.\s+.*SKILL/i,
  /\bfind\s+\.\s+.*skill/i,
  /\bfind\s+\.\s*$/,
  /\bfind\s+\.\s+-/,

  // grep -R . with skill reference
  /\bgrep\s+-[rR]\b\s+.*SKILL\s+\.\s*$/i,
  /\bgrep\s+-[rR]\b\s+.*skill\s+\.\s*$/i,
];

// Known skill names from the map
function findSkillNameInCommand(cmd: string, skillMap: SkillMap): string | null {
  // First try exact match against known skill names (longest first)
  const sorted = [...skillMap.keys()].sort((a, b) => b.length - a.length);
  const cmdLower = cmd.toLowerCase();
  for (const name of sorted) {
    if (cmdLower.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

function hasSkillishPath(cmd: string): boolean {
  return SKILLISH_PATH_PATTERNS.some((p) => p.test(cmd));
}

export interface BashGuardResult {
  blocked: boolean;
  reason: string;
}

export function checkBashSkillAccess(
  command: string,
  skillMap: SkillMap,
): BashGuardResult {
  // Check for cat/sed/head + SKILL.md (any path)
  if (ANY_PATH_TOOLS.test(command) && /SKILL\.md/i.test(command)) {
    const skillName = findSkillNameInCommand(command, skillMap);
    if (skillName) {
      const canonical = skillMap.get(skillName)?.canonicalPath;
      if (canonical) {
        return {
          blocked: true,
          reason: `Не ищи skill через bash. Прочитай через read: ${canonical}`,
        };
      }
    }
    return {
      blocked: true,
      reason: "Не ищи SKILL.md через bash. Используй read tool.",
    };
  }

  // Check for find/grep/ls/rg + SKILL.md/known-skill/word-skill + skill-ish path
  if (PATH_SENSITIVE_TOOLS.test(command)) {
    const hasSkillMd = /SKILL\.md/i.test(command);
    const skillName = findSkillNameInCommand(command, skillMap);
    const mentionsSkill = hasSkillMd || skillName || /\bskill\b/i.test(command);

    if (mentionsSkill && hasSkillishPath(command)) {
      if (skillName) {
        const canonical = skillMap.get(skillName)?.canonicalPath;
        if (canonical) {
          return {
            blocked: true,
            reason: `Не ищи skill через bash. Прочитай через read: ${canonical}`,
          };
        }
      }
      return {
        blocked: true,
        reason: "Не ищи SKILL.md через bash. Используй read tool.",
      };
    }
  }

  return { blocked: false, reason: "" };
}
