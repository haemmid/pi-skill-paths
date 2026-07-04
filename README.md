# pi-skill-paths

Canonical `SKILL.md` path correction and bash skill-access guard for Pi.

`pi-skill-paths` blocks the agent from reading `SKILL.md` files through bash commands (`cat`, `sed`, `head`, `find`, `grep`) and silently normalizes `read` tool calls that point to skill directories or relative paths.

Designed for use with [jmfederico/pi-web](https://github.com/jmfederico/pi-web).

[![npm](https://img.shields.io/npm/v/@haemmid/pi-skill-paths)](https://www.npmjs.com/package/@haemmid/pi-skill-paths)
[![Pi Extension](https://img.shields.io/badge/Pi-extension-6f42c1)](https://pi.dev/packages/%40haemmid/pi-skill-paths)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why

Agents sometimes try to read skill files using bash (`cat ~/.pi/agent/skills/.../SKILL.md`), which:

- Bypasses Pi's skill system and rendering
- Produces raw markdown without proper context
- Can break with path resolution quirks

This extension prevents that and auto-corrects paths so the agent uses `read` the right way.

## Features

- **Bash guard** — blocks `cat`/`sed`/`head` + `SKILL.md` and `find`/`grep`/`ls`/`rg` + skill-ish paths
- **Read autocorrect** — normalizes skill directory paths, resolves relative `.pi/skills/` paths, substitutes canonical absolute paths
- **Zero config** — works out of the box, no settings needed
- **No npm deps** — only `node:fs/promises` and `node:path`

## Install

Install from npm:

```bash
pi install npm:@haemmid/pi-skill-paths
```

Install from git:

```bash
pi install git:github.com/haemmid/pi-skill-paths
```

Or install from a local checkout:

```bash
pi install /path/to/pi-skill-paths
```

## Behavior

### Bash guard (blocking)

| Command | Result |
|---------|--------|
| `cat ~/.pi/agent/skills/ask-chatgpt/SKILL.md` | BLOCK → "use read: /abs/path/SKILL.md" |
| `cat SKILL.md` | BLOCK → "use read" |
| `find /home/haemmid -name SKILL.md` | BLOCK → "use read" |
| `cat package.json` | PASSES |
| `ls .pi/skills/` | PASSES |

### Read autocorrect (silent)

| Before | After |
|--------|-------|
| `read .agents/skills/ask-chatgpt/SKILL.md` | `read /home/haemmid/.pi/agent/skills/ask-chatgpt/SKILL.md` |
| `read .pi/skills/chatgpt-plan-review` | `read .pi/skills/chatgpt-plan-review/SKILL.md` |
| `read .pi/skills/foo/SKILL.md` | `read /abs/project/.pi/skills/foo/SKILL.md` |

## Conflict policy

- Project-level skills override global skills
- Duplicate global skills → `console.warn`, first wins

## License

MIT
