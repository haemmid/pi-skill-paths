# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning for public releases.

## [0.1.0] - 2026-07-04

### Added

- Initial release of `@haemmid/pi-skill-guard`.
- Bash guard: blocks `cat`/`sed`/`head` + `SKILL.md` and `find`/`grep`/`ls`/`rg` + skill-ish paths.
- Read autocorrect: normalizes skill directory paths, resolves relative `.pi/skills/` paths, substitutes canonical absolute paths.
- `buildSkillMap()` — filesystem scan of project and global skill directories.
- Conflict policy: project skills override global, first global wins on conflict.
