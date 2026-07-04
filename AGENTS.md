# pi-skill-paths

Public Pi extension that prevents reading skill files via bash and autocorrects read tool paths.

## Structure

- `index.ts` — entry point: `session_start` + `tool_call` intercept
- `skill-map.ts` — `buildSkillMap()` — scans filesystem, builds `Map<name, {canonicalPath, scope}>`
- `bash-guard.ts` — `checkBashSkillAccess()` — blocks bash read/search of `SKILL.md` only (not skill directories)
- `read-autocorrect.ts` — `normalizeSkillReadPath()` — silent path normalization for read tool
- `pi-skill-paths.test.ts` — unit tests

## Stack

- TypeScript (no compilation, loaded via jiti)
- No npm dependencies — only `node:fs/promises`, `node:path`
