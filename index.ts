/**
 * pi-skill-paths — Prevents the LLM from reading skill files via bash
 * and autocorrects read tool calls that point to skill directories.
 *
 * Placement: installed via `pi install` (global) or project-local in settings.json
 * Hot-reload: /reload
 *
 * Behavior:
 *   read: skill-like path → canonical SKILL.md
 *   bash: cat/sed/head + skill path → block
 *         find/grep/ls + skill-ish path → block
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { SkillMap } from "./skill-map.js";
import { buildSkillMap } from "./skill-map.js";
import { checkBashSkillAccess } from "./bash-guard.js";
import { normalizeSkillReadPath } from "./read-autocorrect.js";

let skillMap: SkillMap | null = null;

export default function (pi: ExtensionAPI) {
  // Build skill map once at session start
  pi.on("session_start", async (_event, ctx) => {
    skillMap = await buildSkillMap(ctx.cwd);
  });

  // Intercept tool calls
  pi.on("tool_call", async (event, ctx) => {
    // If tool_call arrives before session_start, lazily build the map
    if (!skillMap) {
      skillMap = await buildSkillMap(ctx.cwd);
    }

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
