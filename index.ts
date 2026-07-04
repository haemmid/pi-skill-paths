/**
 * skill-guard — Prevents the LLM from reading skills via bash (cat/sed/head/find/grep)
 * and autocorrects read tool calls that point to skill directories.
 *
 * Placement: .pi/extensions/skill-guard/ (project-local, loaded after trust)
 * Hot-reload: /reload
 *
 * Behavior:
 *   read: skill-like path → canonical SKILL.md
 *   bash: cat/sed/head + SKILL.md → block
 *         find/grep/ls + SKILL.md/known-skill + home/skill-ish path → block
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { buildSkillMap } from "./skill-map.js";
import { checkBashSkillAccess } from "./bash-guard.js";
import { normalizeSkillReadPath } from "./read-autocorrect.js";

let skillMap: ReturnType<typeof buildSkillMap> | null = null;

export default function (pi: ExtensionAPI) {
  // Build skill map once at session start
  pi.on("session_start", async (_event, ctx) => {
    skillMap = await buildSkillMap(ctx.cwd);
  });

  // Intercept tool calls
  pi.on("tool_call", async (event, ctx) => {
    if (!skillMap) return;

    // ── 1. Read autocorrect (mutate in-place, non-blocking) ──────────
    if (isToolCallEventType("read", event)) {
      const result = normalizeSkillReadPath(event.input.path, skillMap, ctx.cwd);
      if (result) {
        event.input.path = result;
      }
    }

    // ── 2. Bash guard (blocking) ─────────────────────────────────────
    if (isToolCallEventType("bash", event)) {
      const check = checkBashSkillAccess(event.input.command, skillMap);
      if (check.blocked) {
        return { block: true, reason: check.reason };
      }
    }
  });
}
