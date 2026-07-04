# pi-skill-paths

Canonical `SKILL.md` path correction and bash skill-access guard for Pi.

`pi-skill-paths` intercepts `read` and `bash` tool calls to:

- **Bash guard** — block bash-based read/search of `SKILL.md` only (not skill directories)
- **Read autocorrect** — silently normalize skill directory paths, resolve relative `.pi/skills/` paths, substitute canonical absolute paths

Works with Pi / pi-web environments where extensions can intercept `read` and `bash` tool calls.

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

- **Bash guard** — blocks `cat`/`sed`/`head` on `SKILL.md` and `find`/`grep`/`rg` searching for `SKILL.md`; does NOT block scripts, assets, or directory listing
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
| `cat ~/.pi/agent/skills/ask-chatgpt/SKILL.md` | BLOCK |
| `cat ~/.agents/skills/humanizer/SKILL.md` | BLOCK |
| `sed -n '1,80p' .pi/skills/foo/SKILL.md` | BLOCK |
| `head ~/.agents/skills/visual-test/SKILL.md` | BLOCK |
| `find /home/haemmid -name SKILL.md` | BLOCK |
| `find ~ -name SKILL.md` | BLOCK |
| `find .pi/skills/foo -name SKILL.md` | BLOCK |
| `grep -R SKILL.md ~/.agents` | BLOCK |
| `grep -R SKILL.md .pi/skills/foo` | BLOCK |
| `rg SKILL.md .pi/skills` | BLOCK |
| `cat package.json` | PASSES |
| `cat my-SKILL.md-notes.txt` | PASSES |
| `bash .pi/skills/foo/scripts/run.sh` | PASSES |
| `node ~/.pi/agent/skills/foo/scripts/build.js` | PASSES |
| `python .pi/skills/foo/tool.py` | PASSES |
| `ls .pi/skills/foo/` | PASSES |
| `find .pi/skills/foo/scripts -type f` | PASSES |
| `grep -R TODO .pi/skills/foo/scripts` | PASSES |
| `find . -name "*.ts"` | PASSES |
| `find .` | PASSES |
| `grep -R foo .` | PASSES |

### Read autocorrect (silent)

| Before | After |
|--------|-------|
| `read .agents/skills/ask-chatgpt` | `read /home/haemmid/.pi/agent/skills/ask-chatgpt/SKILL.md` |
| `read .pi/skills/chatgpt-plan-review` | `read /abs/project/.pi/skills/chatgpt-plan-review/SKILL.md` |
| `read ~/.agents/skills/context7-mcp` | `read /home/haemmid/.agents/skills/context7-mcp/SKILL.md` |
| `read ~/.agents/skills/context7-mcp/SKILL.md` | `read /home/haemmid/.agents/skills/context7-mcp/SKILL.md` (canonical) |
| `read ../.pi/skills/foo/SKILL.md` | No change (traversal) |

## Conflict policy

- Project-level skills override global skills
- Duplicate global skills → `console.warn`, first wins

## Not the same as pi-skill-guard

`pi-skill-paths` works **before** tool execution — it intercepts `read` and `bash` calls, corrects skill paths, and blocks bash-based skill access. It does not handle `tool-not-found` recovery, inject skills, or add custom tools.

## License

MIT
