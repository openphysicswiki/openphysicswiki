import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateContent } from "../scripts/check-content";

function fixture() {
  return mkdtempSync(path.join(tmpdir(), "openphysics-content-"));
}

function addEntry(directory: string, slug: string, dependencies: string[] = [], extra = "") {
  const field = "classical-mechanics";
  mkdirSync(path.join(directory, field), { recursive: true });
  writeFileSync(path.join(directory, field, `${slug}.md`), `---
title: "${slug}"
slug: ${slug}
type: ${dependencies.length ? "theorem" : "definition"}
field: ${field}
foundational: ${dependencies.length === 0}
dependencies: [${dependencies.join(", ")}]
summary: "A test entry."
---
## Statement
A statement.
## Assumptions
None.
${extra}`);
}

test("an empty content directory is valid", () => {
  const directory = fixture();
  try { assert.deepEqual(validateContent(directory), []); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

test("a connected two-entry graph is valid", () => {
  const directory = fixture();
  try {
    addEntry(directory, "axiom");
    addEntry(directory, "result", ["axiom"], "## Derivation\nA derivation.\n");
    assert.deepEqual(validateContent(directory), []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("unresolved references fail validation", () => {
  const directory = fixture();
  try {
    addEntry(directory, "result", ["missing"]);
    assert.match(validateContent(directory).map((issue) => issue.message).join("\n"), /Unresolved dependency "missing"/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("dependency cycles fail validation", () => {
  const directory = fixture();
  try {
    addEntry(directory, "a", ["b"]);
    addEntry(directory, "b", ["a"]);
    assert.match(validateContent(directory).map((issue) => issue.message).join("\n"), /Dependency cycle detected/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("isolated entries fail orphan validation", () => {
  const directory = fixture();
  try {
    addEntry(directory, "isolated");
    assert.match(validateContent(directory).map((issue) => issue.message).join("\n"), /Orphan entry/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("invalid schema and malformed sections are reported", () => {
  const directory = fixture();
  try {
    addEntry(directory, "isolated");
    const file = path.join(directory, "classical-mechanics", "isolated.md");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, original.replace("type: definition", "type: example").replace("## Assumptions\nNone.", "## Notes\nNothing."));
    const messages = validateContent(directory).map((issue) => issue.message).join("\n");
    assert.match(messages, /type:.*(Invalid|invalid|expected)/);
    assert.match(messages, /Missing required ## Assumptions/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

