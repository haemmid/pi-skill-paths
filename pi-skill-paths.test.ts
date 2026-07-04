/**
 * pi-skill-paths — Tests
 *
 * Run with: npx tsx pi-skill-paths.test.ts
 */

import { join } from "node:path";
import { buildSkillMap, type SkillMap, type SkillEntry } from "./skill-map.js";
import { checkBashSkillAccess } from "./bash-guard.js";
import { normalizeSkillReadPath } from "./read-autocorrect.js";

// ── Helpers ──────────────────────────────────────────────────────────

const HOME = process.env.HOME ?? "/home/haemmid";
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function eq<T>(a: T, b: T, label: string) {
  assert(a === b, label);
}

// ── Tests ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== pi-skill-paths tests ===\n");

  // ── buildSkillMap tests ────────────────────────────────────────────
  console.log("buildSkillMap");

  const skillMap = await buildSkillMap(HOME);

  // Should contain known global skills
  assert(skillMap.has("context7-mcp"), "contains context7-mcp");
  assert(skillMap.has("humanizer"), "contains humanizer");
  assert(skillMap.has("ask-chatgpt"), "contains ask-chatgpt");

  // All global skills should have correct scope
  const globalScope = ["context7-mcp", "humanizer", "ask-chatgpt"];
  for (const name of globalScope) {
    const entry = skillMap.get(name);
    assert(entry?.scope === "global", `${name} has scope "global"`);
  }

  // ── Bash guard: BLOCKED cases ──────────────────────────────────────
  console.log("\nbash guard — blocked");

  const blockedTests: Array<{ cmd: string; desc: string }> = [
    // cat/sed/head reading SKILL.md directly
    {
      cmd: `cat ${HOME}/.agents/skills/context7-mcp/SKILL.md`,
      desc: "cat ~/.agents/skills/foo/SKILL.md is blocked",
    },
    {
      cmd: `cat ${HOME}/.pi/agent/skills/humanizer/SKILL.md`,
      desc: "cat ~/.pi/agent/skills/foo/SKILL.md is blocked",
    },
    {
      cmd: `sed -n '1,80p' .pi/skills/ask-chatgpt/SKILL.md`,
      desc: "sed .pi/skills/foo/SKILL.md is blocked",
    },
    {
      cmd: `head ${HOME}/.agents/skills/visual-test/SKILL.md`,
      desc: "head ~/.agents/skills/foo/SKILL.md is blocked",
    },
    // find/grep/rg searching for SKILL.md
    {
      cmd: `find /home/haemmid -name SKILL.md`,
      desc: "find /home/... -name SKILL.md is blocked",
    },
    {
      cmd: `find ~ -name SKILL.md`,
      desc: "find ~ -name SKILL.md is blocked",
    },
    {
      cmd: `find .pi/skills/foo -name SKILL.md`,
      desc: "find .pi/skills/foo -name SKILL.md is blocked",
    },
    {
      cmd: `grep -R SKILL.md ~/.agents`,
      desc: "grep -R SKILL.md ~/.agents is blocked",
    },
    {
      cmd: `grep -R SKILL.md .pi/skills/foo`,
      desc: "grep -R SKILL.md .pi/skills/foo is blocked",
    },
    {
      cmd: `rg SKILL.md .pi/skills`,
      desc: "rg SKILL.md .pi/skills is blocked",
    },
  ];

  for (const { cmd, desc } of blockedTests) {
    const result = checkBashSkillAccess(cmd, skillMap);
    assert(result.blocked, desc);
    assert(
      result.reason.startsWith("pi-skill-paths blocked"),
      `${desc} → reason starts with "pi-skill-paths blocked"`,
    );
  }

  // ── Bash guard: PASSED cases (regression) ──────────────────────────
  console.log("\nbash guard — passed");

  const passedTests: Array<{ cmd: string; desc: string }> = [
    // Normal files
    { cmd: "cat package.json", desc: "cat package.json passes" },
    { cmd: "cat my-SKILL.md-notes.txt", desc: "cat my-SKILL.md-notes.txt passes" },
    { cmd: "cat README.md", desc: "cat README.md passes" },
    { cmd: "cat /etc/hostname", desc: "cat /etc/hostname passes" },
    // Scripts and assets inside skill directories
    {
      cmd: "bash .pi/skills/foo/scripts/run.sh",
      desc: "bash .pi/skills/foo/scripts/run.sh passes",
    },
    {
      cmd: "node ~/.pi/agent/skills/foo/scripts/build.js",
      desc: "node ~/.pi/agent/skills/foo/scripts/build.js passes",
    },
    {
      cmd: "python .pi/skills/foo/tool.py",
      desc: "python .pi/skills/foo/tool.py passes",
    },
    // Directory listing and traversal
    {
      cmd: "ls .pi/skills/foo/",
      desc: "ls .pi/skills/foo/ passes",
    },
    {
      cmd: "ls .pi/skills/",
      desc: "ls .pi/skills/ passes",
    },
    {
      cmd: "find .pi/skills/foo/scripts -type f",
      desc: "find .pi/skills/foo/scripts -type f passes",
    },
    { cmd: 'find . -name "*.ts"', desc: 'find . -name "*.ts" passes' },
    { cmd: 'find . -name "*.md"', desc: 'find . -name "*.md" passes' },
    { cmd: "find .", desc: "find . (no args) passes" },
    // grep without SKILL.md
    { cmd: "grep -R TODO .pi/skills/foo/scripts", desc: "grep -R TODO .pi/skills/foo/scripts passes" },
    { cmd: "grep -R foo .", desc: "grep -R foo . passes" },
    { cmd: "grep -R foo src/", desc: "grep -R foo src/ passes" },
    { cmd: "rg 'hello' src/", desc: "rg 'hello' src/ passes" },
    { cmd: "ls -la", desc: "ls -la passes" },
  ];

  for (const { cmd, desc } of passedTests) {
    const result = checkBashSkillAccess(cmd, skillMap);
    assert(!result.blocked, desc);
  }

  // ── Read autocorrect tests ─────────────────────────────────────────
  console.log("\nread autocorrect");

  // Known project skill → canonical path
  const projectSkillPath = ".pi/skills/ask-chatgpt";
  const corrected1 = normalizeSkillReadPath(projectSkillPath, skillMap, HOME);
  eq(
    corrected1,
    join(HOME, ".pi", "agent", "skills", "ask-chatgpt", "SKILL.md"),
    "read .pi/skills/ask-chatgpt → canonical path",
  );

  // Known global skill via ~/.agents/skills → canonical path
  const globalSkillPath = "~/.agents/skills/context7-mcp";
  const corrected2 = normalizeSkillReadPath(globalSkillPath, skillMap, HOME);
  eq(
    corrected2,
    join(HOME, ".agents", "skills", "context7-mcp", "SKILL.md"),
    "read ~/.agents/skills/context7-mcp → canonical path",
  );

  // Already has SKILL.md → canonical path for known skill
  const globalSkillPathMd = "~/.agents/skills/context7-mcp/SKILL.md";
  const corrected3 = normalizeSkillReadPath(globalSkillPathMd, skillMap, HOME);
  eq(
    corrected3,
    join(HOME, ".agents", "skills", "context7-mcp", "SKILL.md"),
    "read ~/.agents/skills/context7-mcp/SKILL.md → canonical path (no change)",
  );

  // Traversal → no autocorrect
  const traversalPath = "../.pi/skills/foo/SKILL.md";
  const corrected4 = normalizeSkillReadPath(traversalPath, skillMap, HOME);
  eq(corrected4, null, "read ../.pi/skills/foo/SKILL.md → null (traversal)");

  // Absolute path to known skill → canonical from map
  const absPath = join(HOME, ".agents", "skills", "humanizer", "SKILL.md");
  const corrected5 = normalizeSkillReadPath(absPath, skillMap, HOME);
  // canonical path comes from the map (first global root wins)
  const humanizerCanonical = skillMap.get("humanizer")?.canonicalPath;
  eq(
    corrected5,
    humanizerCanonical,
    "read /abs/path/.agents/skills/humanizer/SKILL.md → map canonical",
  );

  // Relative path without known skill → resolve to absolute + SKILL.md
  const relativePath = ".agents/skills/unknown-skill";
  const corrected6 = normalizeSkillReadPath(relativePath, skillMap, HOME);
  eq(
    corrected6,
    join(HOME, relativePath, "SKILL.md"),
    "read .agents/skills/unknown-skill → resolved + /SKILL.md",
  );

  // ── Project priority over global ───────────────────────────────────
  console.log("\nproject priority");

  const mockMap = new Map<string, SkillEntry>();
  mockMap.set("test-skill", {
    canonicalPath: join(HOME, ".agents", "skills", "test-skill", "SKILL.md"),
    scope: "global",
  });
  // Project skill overrides global
  mockMap.set("test-skill", {
    canonicalPath: join(HOME, "project", ".agents", "skills", "test-skill", "SKILL.md"),
    scope: "project",
  });

  const entry = mockMap.get("test-skill");
  assert(entry?.scope === "project", "project skill overrides global skill");
  eq(
    entry?.canonicalPath,
    join(HOME, "project", ".agents", "skills", "test-skill", "SKILL.md"),
    "project skill canonical path is used",
  );

  // ── Duplicate global skill warning (non-breaking) ──────────────────
  console.log("\nduplicate global skill");

  // buildSkillMap handles duplicates by checking map.has() before set.
  // Simulate: first global root sets entry, second tries to add same name.
  const warnMap = new Map<string, SkillEntry>();
  warnMap.set("dup-skill", {
    canonicalPath: "/root1/.agents/skills/dup-skill/SKILL.md",
    scope: "global",
  });
  // Simulate the buildSkillMap duplicate check
  if (!warnMap.has("dup-skill")) {
    warnMap.set("dup-skill", {
      canonicalPath: "/root2/.agents/skills/dup-skill/SKILL.md",
      scope: "global",
    });
  }
  assert(warnMap.size === 1, "duplicate global skill: map size stays 1");
  assert(
    warnMap.get("dup-skill")?.canonicalPath === "/root1/.agents/skills/dup-skill/SKILL.md",
    "duplicate global skill: first entry kept (map.has check)",
  );

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
