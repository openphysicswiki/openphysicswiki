# Design: structure mapping, frameworks, and consensus

Status: **draft**, 2026-11-27. The entry schema and framework registry are implemented (build order step 1); everything else is not yet.

## Decisions so far

1. **Ingestion maps structure only.** It records which results a source contains, how they depend on each other, and where they appear. It does not produce entry text.
2. **Content is written in a separate pass, from public-domain sources only.**
3. **Structure comes from many sources:** 5–10 or more per field. Each source is mapped on its own, the maps are compared, and a consensus structure is derived from them.
4. **Frameworks are part of the data model.** Sources are only compared with sources in the same framework. A Newtonian textbook is never aligned edge by edge with a Lagrangian one.
5. **Complexity (levels, hiding, learning paths) is postponed.** One exception: the `special-case-of` relation is recorded during mapping, because alignment needs it (see "Alignment").

## Concepts

| Term | Meaning |
|---|---|
| **Field** | Subject area, as now: `classical-mechanics`, `electromagnetism`, … |
| **Framework** | A way of building a field up from a particular set of primitives and axioms: `newtonian`, `lagrangian`, `hamiltonian`, … Belongs to one field. |
| **Source** | One book or text, mapped once. |
| **Source map** | The structure extracted from one source: its results, their dependencies, and their locations in the source. |
| **Concept** | A canonical result in the wiki. Source-map nodes are aligned to concepts. |
| **Consensus map** | The structure of one framework, derived from all of its source maps, with support counts. |

## Frameworks

A framework is identified by its **roots**: the primitive notions and axioms that everything else is derived from. Roots are **computed** from the graph (a framework's entries with no dependencies), not declared, so they can't drift from the content.

```ts
// src/data/frameworks.ts (implemented)
{
  slug: "newtonian",
  field: "classical-mechanics",
  name: "Newtonian mechanics",
  description: "...",
  buildsOn: [],      // frameworks whose entries this one may depend on, e.g. a shared kinematics layer
  default: true,     // exactly one per field
}
```

Only `newtonian` is registered for now. The Hertzian framework was dropped on 2026-11-27 as not worth the cost: it has essentially one source and little current use.

### Rule: assigning a source to a framework

1. Map the source.
2. Take its roots: nodes with no dependencies that are axioms or primitive definitions.
3. Compare those roots with each registered framework's roots, after alignment.
   - **Match:** the source belongs to that framework.
   - **Partial match:** a *variant* of that framework. For example, one Newtonian text takes force as a primitive while another defines it through $F = ma$. These are recorded as a variant and reviewed by hand. Either the variant is merged into the framework (its root difference is noted) or it becomes a new framework.
   - **No match:** propose a new framework.
4. **A human confirms the assignment.** Nothing is merged across frameworks automatically.

## Data model (entries)

The variation between frameworks lies in each result's *role*: its type, dependencies and derivation. The result itself stays the same. For example, Newton's second law is an axiom in the Newtonian framework, while in the Lagrangian framework it is a theorem derived from the Euler–Lagrange equations.

```yaml
title: "Work–energy theorem"
slug: work-energy-theorem
field: classical-mechanics
summary: "..."
roles:
  newtonian:  { type: theorem, foundational: false, dependencies: [work, kinetic-energy, newtons-second-law] }
  lagrangian: { type: theorem, foundational: false, dependencies: [lagrangian, euler-lagrange-equations, kinetic-energy] }
relations:
  - { type: special-case-of, target: ... }
```

- **Body:** a shared `## Statement` and `## Assumptions`. A single-role entry may use a plain `## Derivation`. With several roles, each derivation names its framework: `## Derivation (<framework>)`.
- **Different concepts that share a name are separate entries.** For example, a geometric definition of mass and `mass-inertial` (a ratio of inertia).
  - They are connected by **relations, which are not dependencies**: `equivalent-under` (with the conditions stated), `generalizes`, `special-case-of`.
  - Relations don't count towards cycle or orphan checks.
- **Validation runs per framework:** a role's dependencies must have a role in the same framework or in one it builds on. Each framework's graph must have no cycles and no orphans. Opposite derivations in two frameworks are therefore allowed.
- **Cross-framework equivalence theorems** (for example, Newton's second law ⇔ Euler–Lagrange, under stated conditions) need both frameworks' entries. Under the per-framework rule they need a home: probably a small *bridge* framework that `buildsOn` both. This is not decided yet.

**Migration (done, 2026-11-27):** all 21 existing entries became `roles.newtonian`, keeping their type, foundational marker and dependencies. d'Alembert's principle and the Euler–Lagrange equations stay Newtonian, since in this wiki they're derived from Newton's laws. A true `lagrangian` framework, rooted in Hamilton's principle, will get its own roles once sources are mapped. The built site is unchanged (all 32 pages compared after normalising per-build graph IDs).

## Source maps

Source maps are stored as data, not content. They are never published as entries.

```
structure/<field>/sources/<source-id>.json
structure/<field>/<framework>.consensus.json
```

```jsonc
{
  "source": { "id": "webster-1904", "title": "The Dynamics of Particles and of Rigid, Elastic, and Fluid Bodies",
              "author": "A. G. Webster", "year": 1904, "publicDomain": true },
  "framework": "newtonian",           // assigned by the rule above, human-confirmed
  "nodes": [
    { "id": "n1", "label": "Inertial frame", "type": "definition",
      "location": "§1", "concept": "inertial-frame", "alignment": "confirmed" }
  ],
  "edges": [ { "from": "n1", "to": "n2" } ],          // prerequisite → dependent
  "relations": [ { "type": "special-case-of", "from": "n7", "to": "n3" } ]
}
```

What the pipeline already does carries over directly: chunked extraction, the linking pass, and slug resolution. Its output changes from Markdown entries to a source map.

## Alignment

Alignment is the hard part. Before any comparison, every source node has to be matched to a canonical concept.

- **Same concept, different names:** handled by the existing alias and slug resolution, plus an LLM-proposed match that a human confirms. Confirmed aliases are stored and reused, so each source needs less review than the one before.
- **Same name, different concept:** different definitions become different concepts, not one merged concept. This is why roots decide the framework.
- **Different scope:** "work = F·d" (an intro text) and "work = ∫F·dr" (a graduate text) are aligned through `special-case-of`. Without that relation they would either be merged, losing information, or flagged as a conflict, which is wrong. This is the one complexity-related piece recorded now.

## Consensus within a framework

1. **Which nodes to keep:** keep a concept if it appears in at least *k* of the framework's *N* sources. *k* is a parameter (open question 2).
2. **Compare dependencies through indirect paths too.** A source supports A → B if **A is an ancestor of B** in that source's map, not only if the edge is direct. Sources differ in granularity: one goes A → B → C, another goes straight A → C. Both should count as support for "A comes before C".
3. **Keep the well-supported links,** then remove any link that's already implied by a chain of others. What's left becomes `dependencies`.
4. **Disagreements about direction:** if sources disagree on which way a link goes (some say A before B, others B before A), the consensus would contain a cycle. This is reported as a **conflict for a human to resolve**. It often means the framework should be split into variants.
5. **Nothing is thrown away.** The consensus file stores the support for each node and link (for example, "7/9 sources"), and minority structures stay in the source maps. The site could later show how settled each link is.

## Sources

Entry content is written only from public-domain sources.

| Framework | Candidate public-domain sources (classical mechanics) |
|---|---|
| newtonian | Newton, *Principia* (Motte 1729 transl.); Thomson & Tait, *Treatise on Natural Philosophy* (1867); Routh; Ziwet; Webster, *Dynamics of Particles* (1904) |
| lagrangian | Lagrange, *Mécanique analytique* (1788); Routh; Whittaker, *Analytical Dynamics* (1904, PD in the US) |
| hamiltonian | Hamilton's papers (1834–35); Jacobi, *Vorlesungen über Dynamik* (1866) |
| (critique) | Mach, *Die Mechanik in ihrer Entwickelung* (1883; transl. 1893) |

Notes:
- **Some frameworks may only ever have one or two sources,** so they can't have a meaningful consensus. They are kept as **single-source frameworks** and marked as such.
- The Hertz run (Book I Ch. I–II, Book II Ch. II; 2026-11-27) was a useful test of the pipeline on a messy scan, but Hertzian mechanics is not pursued.
- **Public-domain status depends on jurisdiction.** In the US, works published before 1931 are public domain as of 2026. Elsewhere, the term is usually the author's life + 70 years. Each source records which applies.

## Open questions

1. **Who confirms:** framework assignment and concept alignment are human-confirmed. Is that one maintainer for now, or a review step in PRs?
2. **Consensus threshold *k*:** a fixed fraction (for example, half the sources) or relative to the sources that *cover* a region? An intro text never reaches generalized coordinates. If support is counted against all N sources, advanced nodes get unfairly low support.
3. **Granularity:** one source's single result can be three in another source. Is alignment many-to-one (several nodes map to one concept), or must sources be split first?
4. **Field boundaries:** where do shared mathematical prerequisites live (vectors, line integrals, manifolds)? The README notes that slugs are global "because later fields may share mathematical prerequisites", but there's no maths field yet.

## Build order (proposal)

1. ~~**Schema:** `frameworks.ts`, entry `roles` and `relations`, and validation per framework. Migrate the 21 entries.~~ Done 2026-11-27.
2. **Source-map format and pipeline output:** switch the ingestion script to produce source maps, and map a first Newtonian source.
3. **Alignment tool:** match proposals, the review step, and the stored alias table.
4. **Two more Newtonian sources,** then the first consensus run. That's the smallest setup where comparing sources means anything.
5. **Framework assignment and conflict reports.**
6. **The content pass** (public-domain sources), and later complexity and levels.
