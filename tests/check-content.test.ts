import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateContent } from "../scripts/check-content";
import { validateFrameworkRegistry, type Framework } from "../src/data/frameworks";

function fixture() {
  return mkdtempSync(path.join(tmpdir(), "openphysics-content-"));
}

interface Role { type?: string; dependencies?: string[] }

/** Writes an entry with one role per framework. A bare dependency list means a single newtonian role. */
function addEntry(directory: string, slug: string, roles: string[] | Record<string, Role> = [], extra = "", relations = "") {
  const field = "classical-mechanics";
  const roleMap: Record<string, Role> = Array.isArray(roles) ? { newtonian: { dependencies: roles } } : roles;
  const roleLines = Object.entries(roleMap).map(([framework, role]) => {
    const dependencies = role.dependencies ?? [];
    const type = role.type ?? (dependencies.length ? "theorem" : "definition");
    return `  ${framework}: { type: ${type}, foundational: ${dependencies.length === 0}, dependencies: [${dependencies.join(", ")}] }`;
  });
  mkdirSync(path.join(directory, field), { recursive: true });
  writeFileSync(path.join(directory, field, `${slug}.md`), `---
title: "${slug}"
slug: ${slug}
field: ${field}
summary: "A test entry."
roles:${roleLines.length ? "\n" + roleLines.join("\n") : " {}"}
${relations}---
## Statement
A statement.
## Assumptions
None.
${extra}`);
}

function messages(directory: string, registry?: readonly Framework[]) {
  return validateContent(directory, registry).map((issue) => issue.message).join("\n");
}

function withFixture(run: (directory: string) => void) {
  const directory = fixture();
  try { run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

// Test registry: a shared kinematics layer, two frameworks built on it, and one standalone.
const REGISTRY: Framework[] = [
  { slug: "kinematics", field: "classical-mechanics", name: "Kinematics", description: "", buildsOn: [] },
  { slug: "newtonian", field: "classical-mechanics", name: "Newtonian", description: "", buildsOn: ["kinematics"], default: true },
  { slug: "lagrangian", field: "classical-mechanics", name: "Lagrangian", description: "", buildsOn: ["kinematics"] },
];

test("an empty content directory is valid", () => withFixture((directory) => {
  assert.deepEqual(validateContent(directory), []);
}));

test("a connected two-entry graph is valid", () => withFixture((directory) => {
  addEntry(directory, "axiom");
  addEntry(directory, "result", ["axiom"], "## Derivation\nA derivation.\n");
  assert.deepEqual(validateContent(directory), []);
}));

test("unresolved references fail validation", () => withFixture((directory) => {
  addEntry(directory, "result", ["missing"]);
  assert.match(messages(directory), /Unresolved dependency "missing"/);
}));

test("dependency cycles fail validation", () => withFixture((directory) => {
  addEntry(directory, "a", ["b"]);
  addEntry(directory, "b", ["a"]);
  assert.match(messages(directory), /Dependency cycle detected in newtonian/);
}));

test("isolated entries fail orphan validation", () => withFixture((directory) => {
  addEntry(directory, "isolated");
  assert.match(messages(directory), /Orphan entry in newtonian/);
}));

test("invalid schema and malformed sections are reported", () => withFixture((directory) => {
  addEntry(directory, "isolated");
  const file = path.join(directory, "classical-mechanics", "isolated.md");
  const original = readFileSync(file, "utf8");
  writeFileSync(file, original.replace("type: definition", "type: example").replace("## Assumptions\nNone.", "## Notes\nNothing."));
  const text = messages(directory);
  assert.match(text, /type:.*(Invalid|invalid|expected)/);
  assert.match(text, /Missing required ## Assumptions/);
}));

test("an entry needs at least one role", () => withFixture((directory) => {
  addEntry(directory, "roleless", {});
  assert.match(messages(directory), /at least one framework role/);
}));

test("unknown frameworks are rejected", () => withFixture((directory) => {
  addEntry(directory, "a", { hertzian: {} });
  assert.match(messages(directory), /roles\.hertzian: unknown framework/);
}));

test("opposite derivations in two frameworks are not a cycle", () => withFixture((directory) => {
  // Newtonian: second law → euler-lagrange. Lagrangian: euler-lagrange → second law.
  addEntry(directory, "newtons-second-law", { newtonian: { type: "axiom" }, lagrangian: { dependencies: ["euler-lagrange"] } },
    "## Derivation (lagrangian)\nFrom Euler–Lagrange.\n");
  addEntry(directory, "euler-lagrange", { newtonian: { dependencies: ["newtons-second-law"] }, lagrangian: { type: "axiom" } },
    "## Derivation (newtonian)\nFrom the second law.\n");
  assert.deepEqual(validateContent(directory, REGISTRY), []);
}));

test("a cycle inside one framework is still caught", () => withFixture((directory) => {
  addEntry(directory, "a", { lagrangian: { dependencies: ["b"] } });
  addEntry(directory, "b", { lagrangian: { dependencies: ["a"] } });
  assert.match(messages(directory, REGISTRY), /Dependency cycle detected in lagrangian: /);
}));

test("dependencies cannot cross into an unrelated framework", () => withFixture((directory) => {
  addEntry(directory, "lagrangian-only", { lagrangian: { type: "axiom" } });
  addEntry(directory, "newtonian-result", { newtonian: { dependencies: ["lagrangian-only"] } });
  assert.match(messages(directory, REGISTRY), /roles\.newtonian: "lagrangian-only" has no role in "newtonian" or "kinematics"/);
}));

test("dependencies may use a framework that is built on", () => withFixture((directory) => {
  addEntry(directory, "position", { kinematics: {} });
  addEntry(directory, "newtonian-result", { newtonian: { dependencies: ["position"] } });
  addEntry(directory, "lagrangian-result", { lagrangian: { dependencies: ["position"] } });
  // "position" has no dependents inside kinematics, but frameworks built on it count, so it is not an orphan.
  assert.deepEqual(validateContent(directory, REGISTRY), []);
}));

test("multi-role entries must name their derivations", () => withFixture((directory) => {
  addEntry(directory, "base", { newtonian: { type: "axiom" }, lagrangian: { type: "axiom" } });
  addEntry(directory, "result", { newtonian: { dependencies: ["base"] }, lagrangian: { dependencies: ["base"] } },
    "## Derivation\nUnnamed.\n## Derivation (hamiltonian)\nNo such role.\n");
  const text = messages(directory, REGISTRY);
  assert.match(text, /With several roles, name the framework/);
  assert.match(text, /names a framework this entry has no role in/);
}));

test("relations are validated but are not dependencies", () => withFixture((directory) => {
  addEntry(directory, "work");
  addEntry(directory, "work-constant-force", ["work"], "", "relations:\n  - { type: special-case-of, target: work }\n");
  assert.deepEqual(validateContent(directory), []);

  addEntry(directory, "bad", ["work"], "", "relations:\n  - { type: equivalent-under, target: missing }\n  - { type: special-case-of, target: bad }\n");
  const text = messages(directory);
  assert.match(text, /equivalent-under relations must state their conditions/);
}));

test("relation targets must exist and not be the entry itself", () => withFixture((directory) => {
  addEntry(directory, "work");
  addEntry(directory, "bad", ["work"], "", "relations:\n  - { type: generalizes, target: missing }\n  - { type: special-case-of, target: bad }\n");
  const text = messages(directory);
  assert.match(text, /Unresolved relation target "missing"/);
  assert.match(text, /cannot have a relation to itself/);
}));

test("the framework registry is validated", () => {
  assert.deepEqual(validateFrameworkRegistry(REGISTRY), []);
  const broken: Framework[] = [
    { slug: "a", field: "classical-mechanics", name: "A", description: "", buildsOn: ["b"], default: true },
    { slug: "b", field: "classical-mechanics", name: "B", description: "", buildsOn: ["a"], default: true },
    { slug: "c", field: "electromagnetism", name: "C", description: "", buildsOn: ["missing"] },
  ];
  const problems = validateFrameworkRegistry(broken).join("\n");
  assert.match(problems, /builds on itself/);
  assert.match(problems, /builds on unknown framework "missing"/);
  assert.match(problems, /"classical-mechanics" must have exactly one default framework \(has 2\)/);
  assert.match(problems, /"electromagnetism" must have exactly one default framework \(has 0\)/);
});
