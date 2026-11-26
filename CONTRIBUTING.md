# Contributing

Small, focused patches are preferred: one correction, one clarified assumption, or one atomic result.

## Content rules

1. Write one result per file: a definition, axiom, principle, theorem, technique, or example.
2. State all assumptions and include a concise derivation where relevant.
3. Write from scratch. Never copy textbook or online prose, derivations, or problems. Sources may be used only to cross-check results.
4. Link direct prerequisites in `dependencies`. Never maintain or generate a graph by hand.
5. Mark foundational definitions and axioms with `foundational: true`.
6. Preserve global slug uniqueness and keep the filename, field directory, and frontmatter in agreement.

See the entry example and schema documentation in [README.md](README.md).

## Patch workflow

```sh
git checkout -b fix/short-description
npm ci
npm run check
npm test
npm run build
```

Open a pull request against `main`. Explain the physics and assumptions changed, and list sources used only for cross-checking. The **Validate** workflow must pass. It runs the same structural checks locally available through `npm run check:content`, plus type checks, unit tests, and a production build.

Reviewers should check physical correctness, explicit assumptions, atomicity, originality, and whether each dependency is genuinely used. A green structural check does not by itself establish physical correctness.

## Licensing

By contributing, you agree that your code is licensed under MIT and your content under CC BY-SA 4.0. Do not submit material you cannot license under those terms.
