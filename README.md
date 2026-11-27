# openphysics.wiki

A free, open-source, crowd-maintained physics reference. One result per page, explicit assumptions, and a dependency graph computed entirely from entry links. Never monetised.

## First milestone

The initial 21 classical-mechanics entries run from point-particle kinematics and Newton's laws through d'Alembert's principle and the Euler–Lagrange equations to momentum and energy conservation. This milestone tests whether exposing logical dependencies makes a result faster to locate and understand.

## Run locally

Node 24 LTS (or Node 22.23.4 and newer) is required.

```sh
npm ci
npm run dev
```

Astro serves the site at `http://localhost:4321` by default.

```sh
npm run check        # Content validation + Astro/TypeScript checks
npm test             # Graph and validator unit tests
npm run build        # Validate and generate dist/
npm run preview      # Serve the production build locally
```

The build intentionally supports an empty `src/content/entries/` directory.

## Entry format

Entries live at `src/content/entries/<field>/<slug>.md`. The path, field, and slug must agree. Slugs are globally unique because later fields may share mathematical prerequisites.

```md
---
title: "Work–energy theorem"
slug: work-energy-theorem
field: classical-mechanics
summary: "The net work on a particle equals its change in kinetic energy."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [work, kinetic-energy, newtons-second-law] }
relations:
  - { type: generalizes, target: work-energy-theorem-constant-force }
---
## Statement
...
## Assumptions
...
## Derivation
...
```

- **Frameworks:** a field can be built up in more than one way (Newtonian, Lagrangian, …). Frameworks are registered in [`src/data/frameworks.ts`](src/data/frameworks.ts); each field has one default. A framework may `buildsOn` others (for example, a shared kinematics layer), and its entries may then depend on theirs.
- **Roles:** an entry has one role per framework it belongs to, keyed by framework slug. A role holds what varies between frameworks: the type, the foundational marker, and the dependencies. The statement and assumptions are shared; if they would differ, it is a different concept and gets its own entry.
- **Types:** `definition`, `axiom`, `principle`, `theorem`, `technique`.
- **Foundational:** mark definitions and axioms that are conceptual starting points. The marker is independent of dependency count.
- **Dependencies:** direct prerequisite slugs only, within the role's framework or a framework it builds on. Use `[]` for a starting point. Do not list transitive prerequisites unless the statement or derivation directly uses them.
- **Relations** (optional): links that are not dependencies: `special-case-of`, `generalizes`, and `equivalent-under` (which requires `conditions`). They never take part in cycle or orphan checks.
- **Sections:** `Statement` and `Assumptions` are required and nonempty; `Derivation` is optional. An entry with several roles names each derivation: `## Derivation (newtonian)`. No other headings are allowed.
- **Original writing:** write all entry content from scratch. External references may only cross-check correctness.

An edge points **prerequisite → dependent**. Each framework has its own graph, so a result can be derived one way in one framework and the other way round in another. Field maps show the field's default framework. Entry maps include the full transitive ancestor and descendant sets. Both maps are generated at build time; there is no hand-maintained graph file.

## Validation

`npm run check:content` rejects:

- malformed or unknown frontmatter fields;
- invalid types, slugs, fields, paths, summaries, and duplicate dependencies;
- unknown frameworks, or frameworks from another field;
- duplicate or self-referencing slugs;
- unresolved references, and dependencies outside a role's framework (and those it builds on);
- dependency cycles within a framework;
- orphan entries (no prerequisite and no dependent in their framework);
- unresolved, duplicate, or self-referencing relations, and `equivalent-under` without conditions;
- missing, empty, duplicated, or unsupported sections, and derivations naming a framework the entry has no role in.

An empty collection is valid. Validation runs in [`Validate`](.github/workflows/validate.yml) on every push and pull request. To make it a required PR check in GitHub, enable branch protection for `main`, select **Require status checks to pass before merging**, and add the **Validate** check from this workflow.

Units/dimensional checks and symbolic derivation verification (for example, SymPy) are the next validation layer. Lean proofs may later cover selected results.

## Project structure

```text
src/content/entries/       Original CC BY-SA physics content
src/lib/entry-schema.ts   Shared content schema
src/lib/graph.ts          Dependency graph, traversal, cycle detection
src/lib/graph-layout.ts   Deterministic SVG layout
src/components/           Accessible graphs, breadcrumbs, type markers
src/pages/                Static field, entry, and project pages
scripts/check-content.ts  Standalone structural checker
tests/                    Executable graph and checker tests
.github/workflows/        Required-check workflow
```

The site is static HTML/CSS with framework-free browser JavaScript for graph highlighting and theme selection. KaTeX is rendered at build time. Graph nodes are keyboard-focusable SVG links; type differs by colour, shape, and letter code.

Search uses Pagefind's accessible modal component and a static browser-side index. An Astro build-completion hook indexes only `/<field>/<slug>/` entry pages, so both `astro build` and `npm run build` produce the bundle. The search control is hidden and indexing is skipped when there are no entries. Titles, summaries, prose, assumptions, and derivations are searchable; rendered KaTeX and dependency graphs are excluded to avoid noisy text results. No search server or external service is involved. Use **Ctrl/Cmd+K** or start typing anywhere outside a form field to open search. Press **Enter** in the search input to open the first result. For local search testing, run `npm run build` followed by `npm run preview` (or `npm run search:serve`); the index is not generated by the Astro dev server.

## Deployment

The site is entirely prerendered. **Cloudflare Workers static assets** are configured explicitly in `wrangler.jsonc`: Wrangler uploads `dist/`—the same directory generated and indexed by Astro—and no Worker script or Astro adapter is used. This prevents Wrangler's automatic framework setup from moving assets to `dist/client` during deployment.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (or `npm run deploy`)
- Assets directory: `dist`
- Node version: `24`

Cloudflare Pages and GitHub Pages can also publish the same `dist/` output without changes.

**GitHub Pages**

Use a static-site deployment action after `npm run build`, publishing `dist/`. With the custom apex domain, no Astro `base` override is needed.

Optional environment variables:

- `PUBLIC_SITE_URL` — canonical origin; defaults to `https://openphysics.wiki`.
- `PUBLIC_REPOSITORY_URL` — adds source links on the site once the organisation repository URL is known.

## Licences

- Code and validation tooling: [MIT](LICENSE).
- Entry content and original explanatory material: [CC BY-SA 4.0](LICENSE-CONTENT).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the patch workflow.
