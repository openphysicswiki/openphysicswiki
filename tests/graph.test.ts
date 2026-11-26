import test from "node:test";
import assert from "node:assert/strict";
import { DependencyGraph, findDependencyCycle, type GraphEntry } from "../src/lib/graph";

function entry(slug: string, dependencies: string[] = []): GraphEntry {
  return { slug, title: slug, type: "theorem", field: "classical-mechanics", foundational: false, dependencies };
}

test("ancestors and descendants are computed transitively", () => {
  const graph = new DependencyGraph([entry("a"), entry("b", ["a"]), entry("c", ["b"]), entry("d")]);
  assert.deepEqual([...graph.ancestors("c")].sort(), ["a", "b"]);
  assert.deepEqual([...graph.descendants("a")].sort(), ["b", "c"]);
  assert.deepEqual([...graph.neighborhood("b")].sort(), ["a", "b", "c"]);
  assert.equal(graph.ancestors("d").size, 0);
});

test("cycles are rejected with a readable path", () => {
  const entries = [entry("a", ["c"]), entry("b", ["a"]), entry("c", ["b"])];
  assert.deepEqual(findDependencyCycle(entries), ["a", "c", "b", "a"]);
  assert.throws(() => new DependencyGraph(entries), /Dependency cycle/);
});

test("missing references are rejected", () => {
  assert.throws(() => new DependencyGraph([entry("a", ["missing"])]), /missing entry/);
});

test("layering works for scoped graphs and empty builds", () => {
  const graph = new DependencyGraph([entry("a"), entry("b", ["a"]), entry("c", ["b"]), entry("other")]);
  assert.deepEqual(graph.layers(new Set(["a", "b", "c"])), [["a"], ["b"], ["c"]]);
  assert.deepEqual(graph.layers(new Set()), []);
  assert.deepEqual(new DependencyGraph([]).layers(), []);
});
