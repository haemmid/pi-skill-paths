# pi-skill-guard — вводный промпт для новой сессии

## Что это

Pi extension, которая предотвращает чтение skill-файлов через bash (`cat`/`sed`/`head`/`find`/`grep`) и автоматически исправляет пути в `read` tool.

## Расположение файлов

```
~/projects/pi/extensions/pi-skill-guard/
├── index.ts          # Entry point: session_start + tool_call intercept
├── skill-map.ts      # buildSkillMap() — сканирует filesystem, строит Map<name, {canonicalPath, scope}>
├── bash-guard.ts     # checkBashSkillAccess() — блокирует опасные bash-команды
├── read-autocorrect.ts # normalizeSkillReadPath() — тихая нормализация путей read
├── README.md         # Описание поведения и conflict policy
└── SESSION-PROMPT.md # Этот файл
```

## Документация Pi (для справки)

- **Extensions API**: `/home/haemmid/.nvm/versions/node/v22.19.0/lib/node_modules/@jmfederico/pi-web/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
  - `pi.on("tool_call", ...)` — intercept + block + mutate event.input
  - `pi.on("session_start", ...)` — инициализация при старте сессии
  - `isToolCallEventType("bash", event)` / `isToolCallEventType("read", event)` — type narrowing
  - `event.input` mutable — мутации применяются до валидации и выполнения
  - `return { block: true, reason }` — блокировка tool call
  - Conflict: extensions can override built-in tools, but we use event interception (cleaner, preserves built-in rendering)
- **Skills**: `/home/haemmid/.nvm/versions/node/v22.19.0/lib/node_modules/@jmfederico/pi-web/node_modules/@earendil-works/pi-coding-agent/docs/skills.md`
  - Skill discovery paths, SKILL.md structure
- **Examples**: `/home/haemmid/.nvm/versions/node/v22.19.0/lib/node_modules/@jmfederico/pi-web/node_modules/@earendil-works/pi-coding-agent/examples/extensions/`
  - `permission-gate.ts` — аналогичный паттерн: intercept tool_call + block
  - `protected-paths.ts` — блокировка write/edit к защищённым путям
  - `tool-override.ts` — переопределение built-in tools (мы НЕ используем этот подход)

## Архитектура

```
session_start
  └→ buildSkillMap(cwd)
       ├→ scan project roots (cwd → git root): .pi/skills/, .agents/skills/
       └→ scan global roots: ~/.pi/agent/skills/, ~/.agents/skills/
       └→ Map<skillName, { canonicalPath, scope }>
            └→ project wins over global
            └→ two global conflicts → console.warn, first wins

tool_call
  ├→ read: normalizeSkillReadPath(path, map, cwd)
  │     ├→ dir without /SKILL.md → append
  │     ├→ known skill → canonical absolute path
  │     ├→ relative .pi/skills/ → resolve to absolute
  │     └→ contains ".." → skip (no autocorrect)
  │
  └→ bash: checkBashSkillAccess(command, map)
        ├→ cat/sed/head + SKILL.md → BLOCK (always)
        └→ find/grep/ls/rg + SKILL/known-skill/word-skill + skill-ish-path → BLOCK
```

## Правила стиля

- **TypeScript**, `.ts` файлы, import/export, typeBox types не нужны (это не tool definition)
- **No npm deps** — только `node:fs/promises`, `node:path`, imports из `@earendil-works/pi-coding-agent`
- **Jiti compatibility** — TypeScript без compilation, jiti загружает файлы
- **Async factory OK**, но `session_start` handler async — `buildSkillMap` async
- **No config** в MVP — без `.pi/settings.json` overrides, без verbose, без logFile
- **No `resources_discover`** — сканируем filesystem напрямую на `session_start`
- **No `CONFIG_DIR_NAME`** — хардкодим `.pi` (TODO в будущем)
- **Comments on Russian** — код на русском, комментарии на русском
- **Single responsibility** — каждый файл одна функция/экспорт
- **No side effects at module level** — только экспортированные функции

## Как тестировать

```bash
# Проверить синтаксис и логику
node --experimental-strip-types -e "
import { buildSkillMap } from './skill-map.ts';
import { checkBashSkillAccess } from './bash-guard.ts';
import { normalizeSkillReadPath } from './read-autocorrect.ts';

const map = await buildSkillMap(process.cwd());
// ... run tests
"
```

## Что может понадобиться доделать

- Добавить `package.json` для pi package (keywords: ["pi-package"])
- Добавить `pi` manifest в package.json (extensions: ["./"])
- Тесты (unit tests для bash-guard и read-autocorrect)
- `resources_discover` для custom paths из settings
- `CONFIG_DIR_NAME` для кастомных дистрибутивов
- Config `verbose: true` для notify при autocorrect
- `tool_result` handler для логирования успешных autocorrect'ов
