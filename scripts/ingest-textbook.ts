#!/usr/bin/env tsx
/**
 * Textbook ingestion prototype - test with local LLM
 * 
 * Usage:
 *   npx tsx scripts/ingest-textbook.ts --text scripts/test-excerpt.txt
 *   npx tsx scripts/ingest-textbook.ts --excerpt "The work-energy theorem..."
 *   npx tsx scripts/ingest-textbook.ts --pdf path/to/book.pdf --page 10
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { entrySchema, ENTRY_TYPES } from "../src/lib/entry-schema";
import { defaultFramework } from "../src/data/frameworks";

// --- Configuration ---

// Any OpenAI-compatible endpoint. Default: llama-server on kronos-ubuntu, reached via
// the `ssh -fN strix-llm` tunnel (the server binds to the Strix's 127.0.0.1 only).
// Ollama also works: LLM_URL=http://127.0.0.1:11434/v1
const DEFAULT_LLM_URL = process.env.LLM_URL || "http://127.0.0.1:8080/v1";
// llama-server serves a single model and ignores this; it matters for Ollama / multi-model servers.
const DEFAULT_MODEL = process.env.LLM_MODEL || "qwen3-coder-next";
const LLM_API_KEY = process.env.LLM_API_KEY; // optional, sent as a Bearer token

// Prompt for extracting atomic physics results
const EXTRACT_PROMPT = `You are a physics reference compiler. Extract atomic results from the textbook excerpt below.

An "atomic result" is a single, self-contained physics concept that can stand alone as a wiki entry.

Available result types:
- definition: A precise statement of what something is
- axiom: A foundational assumption taken as true without proof  
- principle: A broad guiding rule or concept
- theorem: A result proven from axioms/principles/other theorems
- technique: A method or approach for solving problems

For each atomic result found, extract:
1. A concise title (the name of the result)
2. A slug: lowercase, hyphen-separated, named after the concept itself (e.g. "work", "kinetic-energy", "newtons-second-law"). No prefixes such as "definition-of-" or "the-".
3. The type (definition|axiom|principle|theorem|technique). Use exactly one of these five words. Map the book's own labels: Proposition, Corollary, Lemma → theorem; Problem, Method → technique. Skip notes, observations and remarks unless they state a result of their own.
4. A one-sentence summary (concise statement of the result; shorter is better)
5. All explicit assumptions/conditions (as a list)
6. Dependencies: slugs of prerequisite results it directly uses
7. The derivation or key reasoning steps (theorems must have one; leave it "" for definitions and axioms)

Rules for slugs and dependencies:
- Only extract results that the excerpt itself defines, states, or proves. A concept that is merely mentioned or used (defined elsewhere in the book) is NOT a result: do not write an entry for it, and do not guess its definition.
- The wiki already contains the entries listed under "Existing wiki entries" below. If a result is the same concept as an existing entry, reuse that entry's slug exactly. A different concept that merely resembles an existing entry (e.g. a textbook's own, differently founded definition) is still a result: give it its own slug.
- Every dependency must be EITHER an existing entry's slug, copied exactly, OR the slug of another result in your own response.
- Never invent a dependency slug that is in neither list. If a prerequisite is needed but missing from both, extract it as its own result (only if the excerpt supports it), or leave it out.

Existing wiki entries (slug | type | title):
{{CATALOGUE}}

Textbook excerpt:
---
{{EXCERPT}}
---

Output format: valid JSON only, no other text and no markdown code fences:
{
  "results": [
    {
      "title": "Result Name",
      "slug": "result-name",
      "type": "theorem",
      "summary": "One sentence description",
      "assumptions": ["Assumption 1", "Assumption 2"],
      "dependencies": ["prerequisite-slug", "another-prerequisite"],
      "derivation": "Step-by-step derivation in markdown format with equations if needed"
    }
  ]
}

Write mathematics as LaTeX with $...$ or $$...$$ delimiters. Inside JSON strings every backslash must be doubled: write "$\\\\frac{1}{2} m v^2$", never "$\\frac{1}{2} m v^2$".
Use an empty "results" array only when the excerpt contains no definitions, axioms, principles, theorems, or techniques at all.
`;

// --- Linking pass ---

const LINK_PROMPT = `You are linking entries in a physics wiki's dependency graph.

Each entry lists its DIRECT prerequisites: the entries whose concepts its statement, assumptions or derivation actually uses, and which a reader must understand BEFORE this entry. For example, "Work–energy theorem" depends on "work" and "kinetic-energy", but not on "point-particle" just because work is defined for point particles, since that is already implied through "work".

Rules:
- Choose only from the candidate entries below, and copy each slug exactly. Candidates are existing wiki entries plus the entries the textbook defined earlier than this one.
- Direction matters: list what this entry is BUILT FROM, never what is later built on it.
- Direct prerequisites only: skip anything already implied by another prerequisite you chose.
- A definition that is phrased in terms of another concept depends on that concept (e.g. "the position of a system is the set of positions of its material points" depends on the entries for position of a material point and system of material points).
- If the entry uses none of the candidates, return an empty list.

Source excerpt the new entries were extracted from:
---
{{EXCERPT}}
---

Candidate entries (slug | type | title | summary):
{{CANDIDATES}}

Entry to link:
{{ENTRY}}

Answer with JSON only:
{"dependencies": [{"slug": "candidate-slug", "reason": "what in the entry uses it"}]}
`;

export function formatCandidates(entries: Array<{ slug: string; type: string; title: string; summary: string }>): string {
  return entries.map((e) => `- ${e.slug} | ${e.type} | ${e.title} | ${e.summary}`).join("\n");
}

function formatEntryForLinking(result: any): string {
  const lines = [`slug: ${result.slug}`, `type: ${result.type}`, `title: ${result.title}`, `summary: ${result.summary}`];
  if (Array.isArray(result.assumptions) && result.assumptions.length > 0) {
    lines.push(`assumptions:\n${result.assumptions.map((a: string) => `  - ${a}`).join("\n")}`);
  }
  if (typeof result.derivation === "string" && result.derivation.trim()) lines.push(`derivation: ${result.derivation.trim()}`);
  return lines.join("\n");
}

/**
 * Asks the model, for one entry, which of the candidate entries it directly uses.
 * Within a batch, each call's prompt extends the previous one (same excerpt, candidate list grown by
 * one entry), so the server's prompt cache reuses almost all of it.
 */
async function linkEntry(
  result: any,
  candidatesBlock: string,
  excerpt: string,
  model: string,
  llmUrl: string,
): Promise<Array<{ slug: string; reason: string }>> {
  const prompt = LINK_PROMPT.replace("{{CANDIDATES}}", () => candidatesBlock)
    .replace("{{EXCERPT}}", () => excerpt)
    .replace("{{ENTRY}}", () => formatEntryForLinking(result));
  const response = await fetch(`${llmUrl}/chat/completions`, {
    method: "POST",
    headers: llmHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      cache_prompt: true,
    }),
  });
  if (!response.ok) throw new Error(`LLM API error during linking: ${response.status} ${response.statusText}`);
  const data = await response.json();
  const parsed = parseLLMResponse(data.choices?.[0]?.message?.content ?? "{}");
  const deps = Array.isArray(parsed?.dependencies) ? parsed.dependencies : [];
  return deps
    .map((d: any) => (typeof d === "string" ? { slug: d, reason: "" } : { slug: String(d?.slug ?? ""), reason: String(d?.reason ?? "") }))
    .filter((d: { slug: string }) => d.slug);
}

// --- Text Processing ---

function extractTextFromPDF(pdfPath: string, pageNumber?: number): string {
  throw new Error(
    "PDF extraction not implemented in this prototype.\n" +
    "Use a text file instead: npx tsx scripts/ingest-textbook.ts --text <path>\n" +
    "Or provide direct text: npx tsx scripts/ingest-textbook.ts --excerpt <text>"
  );
}

function llmHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_API_KEY) headers.Authorization = `Bearer ${LLM_API_KEY}`;
  return headers;
}

async function callLocalLLM(excerpt: string, catalogue: string, model: string, llmUrl: string): Promise<string> {
  try {
    // Function replacers, so "$" sequences in the excerpt (LaTeX!) aren't treated as replacement patterns.
    const prompt = EXTRACT_PROMPT.replace("{{CATALOGUE}}", () => catalogue).replace("{{EXCERPT}}", () => excerpt);

    const response = await fetch(`${llmUrl}/chat/completions`, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        temperature: 0.3,
        max_tokens: 8192,
        // Constrains output to valid JSON (llama-server enforces it with a grammar).
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LLM API error: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      console.warn("Warning: response hit max_tokens and is probably truncated.");
    }
    return choice?.message?.content || "";
  } catch (error) {
    console.error("Failed to call LLM:", error);
    console.error(`\nCheck the server: curl ${llmUrl.replace(/\/v1\/?$/, "")}/health`);
    console.error("If the connection is refused, start the tunnel: ssh -fN strix-llm");
    throw error;
  }
}

/**
 * Models write LaTeX inside JSON strings with single backslashes. Some of those are invalid escapes
 * (`\(`, `\d`), which make JSON.parse throw. Worse, some are *valid* escapes that silently corrupt the
 * text: `\frac` → form feed + "rac", `\theta` → tab + "heta", `\nabla` → newline + "abla".
 * Double the backslash in both cases; leave genuine escapes (`\\`, `\"`, `\uXXXX`, a lone `\n`) alone.
 */
export function repairJsonEscapes(text: string): string {
  const pattern =
    /\\(?:(?<keep>[\\"/]|u[0-9a-fA-F]{4})|(?<latex>[bfrt](?=[a-zA-Z])|n(?=(?:abla|u|eq|e|ot|i|eg|earrow|ewline)(?![a-zA-Z])))|(?<plain>[bfnrt])|(?<bad>[\s\S]))/g;
  return text.replace(pattern, (match, ...args) => {
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    if (groups.keep !== undefined || groups.plain !== undefined) return match;
    return "\\\\" + (groups.latex ?? groups.bad);
  });
}

function parseLLMResponse(responseText: string): any {
  let cleanText = responseText.trim();
  
  // Remove markdown code fences if present
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.slice(7);
  }
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.slice(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.slice(0, -3);
  }
  
  cleanText = cleanText.trim();

  return JSON.parse(repairJsonEscapes(cleanText));
}

// --- Existing wiki entries ---

interface WikiEntry {
  slug: string;
  title: string;
  type: string;
  summary: string;
  file: string;
}

const DEFAULT_ENTRIES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/content/entries");

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const location = join(directory, item.name);
    if (item.isDirectory()) return markdownFiles(location);
    return item.isFile() && item.name.endsWith(".md") ? [location] : [];
  });
}

function loadWikiEntries(directory: string): WikiEntry[] {
  return markdownFiles(directory).flatMap((file) => {
    try {
      const { data } = matter(readFileSync(file, "utf-8"));
      if (typeof data.slug !== "string") return [];
      const firstRole: any = Object.values(data.roles ?? {})[0];
      return [{ slug: data.slug, title: String(data.title ?? data.slug), type: String(firstRole?.type ?? data.type ?? "?"), summary: String(data.summary ?? ""), file }];
    } catch {
      return [];
    }
  });
}

function buildCatalogue(entries: WikiEntry[]): string {
  if (entries.length === 0) return "(none yet)";
  return entries
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((e) => `- ${e.slug} | ${e.type} | ${e.title}`)
    .join("\n");
}

// --- Dependency resolution ---

// Wrappers models like to add around a concept's name ("definition-of-work", "the-work-energy-theorem").
const SLUG_PREFIXES = ["definition-of-", "def-", "concept-of-", "principle-of-", "law-of-", "the-"];
const SLUG_SUFFIXES = ["-definition", "-def", "-concept"];

function slugVariants(slug: string): string[] {
  const variants = new Set([slug]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const v of [...variants]) {
      for (const p of SLUG_PREFIXES) if (v.startsWith(p) && v.length > p.length) changed = addNew(variants, v.slice(p.length)) || changed;
      for (const s of SLUG_SUFFIXES) if (v.endsWith(s) && v.length > s.length) changed = addNew(variants, v.slice(0, -s.length)) || changed;
      // Possessives: "newton-s-second-law" -> "newtons-second-law"
      if (v.includes("-s-")) changed = addNew(variants, v.replace(/-s-/g, "s-")) || changed;
    }
  }
  return [...variants];
}

function addNew(set: Set<string>, value: string): boolean {
  if (set.has(value)) return false;
  set.add(value);
  return true;
}

interface Resolution {
  resolved: string[];
  mapped: Array<{ from: string; to: string }>;
  unresolved: string[];
}

/**
 * Maps each dependency onto a known slug (existing wiki entries + results in this batch).
 * `aliases` maps alternative spellings (slugified titles, wrapper-stripped variants) to real slugs.
 */
function resolveDependencies(deps: unknown, selfSlug: string, known: Set<string>, aliases: Map<string, string>): Resolution {
  const out: Resolution = { resolved: [], mapped: [], unresolved: [] };
  const list = Array.isArray(deps) ? deps.map((d) => slugify(String(d))).filter(Boolean) : [];
  for (const dep of list) {
    let target: string | undefined;
    if (known.has(dep)) target = dep;
    else {
      for (const v of slugVariants(dep)) {
        target = known.has(v) ? v : aliases.get(v);
        if (target) break;
      }
    }
    if (!target) {
      out.unresolved.push(dep);
      continue;
    }
    if (target !== dep) out.mapped.push({ from: dep, to: target });
    if (target !== selfSlug && !out.resolved.includes(target)) out.resolved.push(target);
  }
  return out;
}

function buildAliases(entries: Array<{ slug: string; title: string }>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const { slug, title } of entries) {
    for (const v of [...slugVariants(slug), ...slugVariants(slugify(title))]) {
      if (!aliases.has(v)) aliases.set(v, slug);
    }
  }
  return aliases;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateEntryMarkdown(result: any, field: string, framework: string): { slug: string; entry: string } {
  const { title, slug, type, summary, assumptions, dependencies, derivation } = result;

  const assumptionsList = assumptions && assumptions.length > 0
    ? assumptions.map((a: string) => `- ${a}`).join("\n")
    : "(No explicit assumptions stated)";

  const dependenciesArray = Array.isArray(dependencies) ? dependencies : [];

  // check-content.ts rejects empty sections, so omit Derivation when there is none.
  const derivationSection = typeof derivation === "string" && derivation.trim()
    ? `\n## Derivation\n${derivation.trim()}\n`
    : "";

  // JSON strings are valid YAML double-quoted scalars, so quotes/backslashes in titles and summaries are escaped safely.
  const entry = `---
title: ${JSON.stringify(title)}
slug: ${slug}
field: ${field}
summary: ${JSON.stringify(summary)}
roles:
  ${framework}: { type: ${type}, foundational: ${type === "definition" || type === "axiom"}, dependencies: [${dependenciesArray.join(", ")}] }
---
## Statement
${summary}

## Assumptions
${assumptionsList}
${derivationSection}`;

  return { slug, entry };
}

// Matches the wiki's convention: theorems are derived; definitions and axioms are not.
const DERIVATION_REQUIRED = new Set(["theorem"]);
const DERIVATION_FORBIDDEN = new Set(["definition", "axiom"]);

// Textbooks label results in their own vocabulary; map it onto the wiki's five types.
const TYPE_ALIASES: Record<string, string> = {
  proposition: "theorem", corollary: "theorem", lemma: "theorem", law: "principle",
  problem: "technique", method: "technique",
};

export function normalizeType(type: unknown): unknown {
  if (typeof type !== "string") return type;
  const t = type.trim().toLowerCase();
  return TYPE_ALIASES[t] ?? t;
}

export function validateExtractedResult(result: any, field = "classical-mechanics", framework = defaultFramework(field)?.slug ?? "newtonian"): string[] {
  const issues: string[] = [];

  // Check required fields
  if (!result.title) issues.push("Missing title");
  if (!result.type) issues.push("Missing type");
  if (!result.summary) issues.push("Missing summary");

  const hasDerivation = typeof result.derivation === "string" && result.derivation.trim().length > 0;
  if (DERIVATION_REQUIRED.has(result.type) && !hasDerivation) {
    issues.push(`Missing derivation (required for ${result.type})`);
  }
  if (DERIVATION_FORBIDDEN.has(result.type) && hasDerivation) {
    issues.push(`Has a derivation, but ${result.type}s are not derived (dropped or retype it)`);
  }

  // Validate assumptions is array
  if (result.assumptions && !Array.isArray(result.assumptions)) {
    issues.push("Assumptions should be an array");
  }

  return [...issues, ...frontmatterIssues(result, field, framework)];
}

/**
 * The frontmatter schema check-content enforces (type, slug format, ...), for an entry with a
 * single role in `framework`. Any issue here means the entry would fail `npm run check:content`.
 */
export function frontmatterIssues(result: any, field: string, framework: string): string[] {
  const frontmatter = entrySchema.safeParse({
    title: result.title,
    slug: result.slug,
    field,
    summary: result.summary,
    roles: {
      [framework]: {
        type: result.type,
        foundational: result.type === "definition" || result.type === "axiom",
        dependencies: Array.isArray(result.dependencies) ? result.dependencies : [],
      },
    },
  });
  if (frontmatter.success) return [];
  return frontmatter.error.issues.map((issue) => {
    const where = issue.path.join(".") || "frontmatter";
    if (where === `roles.${framework}.type`) return `Invalid type "${result.type}" (must be one of ${ENTRY_TYPES.join(", ")})`;
    return `${where}: ${issue.message}`;
  });
}

// --- Main ---

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("text", {
      type: "string",
      describe: "Path to text file containing textbook excerpt",
    })
    .option("excerpt", {
      type: "string",
      describe: "Direct text excerpt to process",
    })
    .option("pdf", {
      type: "string",
      describe: "Path to PDF textbook (not yet implemented)",
    })
    .option("page", {
      type: "number",
      describe: "Page number to extract from PDF (1-indexed)",
    })
    .option("model", {
      type: "string",
      describe: "Model name sent to the server (env LLM_MODEL)",
      default: DEFAULT_MODEL,
    })
    .option("llm-url", {
      type: "string",
      describe: "OpenAI-compatible API base URL, including /v1 (env LLM_URL)",
      default: DEFAULT_LLM_URL,
    })
    .option("output-dir", {
      type: "string",
      describe: "Directory to write generated entry files",
      default: "/tmp/opencode/ingestion-output",
    })
    .option("field", {
      type: "string",
      describe: "Field slug for generated entries",
      default: "classical-mechanics",
    })
    .option("entries-dir", {
      type: "string",
      describe: "Existing wiki entries, used to resolve dependency slugs",
      default: DEFAULT_ENTRIES_DIR,
    })
    .option("framework", {
      type: "string",
      describe: "Framework the generated roles belong to (default: the field's default framework)",
    })
    .option("dry-run", {
      type: "boolean",
      describe: "Show results without saving files",
      default: false,
    })
    .option("link", {
      type: "boolean",
      describe: "Run the linking pass (one extra LLM call per new entry); --no-link to skip",
      default: true,
    })
    .parseSync();

  // Get the text excerpt
  let excerpt = argv.excerpt;
  
  if (!excerpt) {
    if (argv.text) {
      excerpt = readFileSync(resolve(argv.text), "utf-8");
    } else if (argv.pdf) {
      excerpt = extractTextFromPDF(resolve(argv.pdf), argv.page);
    } else {
      console.error("Error: Provide --excerpt, --text, or --pdf");
      process.exit(1);
    }
  }

  console.log(`Processing excerpt (${excerpt.length} characters)...\n`);
  console.log(`Preview (first 200 chars):`);
  console.log(`"${excerpt.substring(0, 200)}${excerpt.length > 200 ? "..." : ""}"`);
  console.log();

  // Check LLM connection
  console.log(`Checking ${argv.model} at ${argv.llmUrl}...`);
  try {
    const checkResponse = await fetch(`${argv.llmUrl}/models`, { headers: llmHeaders() });
    if (checkResponse.status === 503) {
      console.error("Server is up but still loading the model. Try again shortly.");
      process.exit(1);
    } else if (!checkResponse.ok) {
      console.error(`Warning: Could not verify model availability (${checkResponse.status}). Continuing anyway...`);
    } else {
      const data = await checkResponse.json();
      const models: string[] = data.data?.map((m: any) => m.id) || [];
      if (!models.includes(argv.model)) {
        console.warn(`Warning: Model "${argv.model}" not listed by the server.`);
        console.warn(`Available models: ${models.join(", ") || "(none)"}`);
      }
    }
  } catch (error) {
    console.error(`Error connecting to LLM server: ${error instanceof Error ? error.message : String(error)}`);
    console.error("If it's the Strix llama-server, start the tunnel first: ssh -fN strix-llm");
    process.exit(1);
  }
  console.log("✓ LLM connection OK\n");

  // Existing entries: given to the model as a catalogue, and used to resolve its dependency slugs.
  const framework = argv.framework ?? defaultFramework(argv.field)?.slug;
  if (!framework) {
    console.error(`No framework given and field "${argv.field}" has no default framework (src/data/frameworks.ts).`);
    process.exit(1);
  }
  const wikiEntries = loadWikiEntries(resolve(argv.entriesDir));
  console.log(`Loaded ${wikiEntries.length} existing wiki entries from ${argv.entriesDir}\n`);

  // Call the LLM
  console.log(`Calling ${argv.model} with prompt...\n`);
  const llmResponse = await callLocalLLM(excerpt, buildCatalogue(wikiEntries), argv.model, argv.llmUrl);

  console.log("LLM Response:");
  console.log("=".repeat(70));
  console.log(llmResponse);
  console.log("=".repeat(70));
  console.log();

  // Parse the response
  let results;
  try {
    results = parseLLMResponse(llmResponse);
  } catch (error) {
    console.error("Failed to parse LLM response as JSON.");
    console.error("Raw response:");
    console.error(llmResponse.substring(0, 1000));
    throw error;
  }
  const extracted: any[] = Array.isArray(results?.results) ? results.results : [];

  // Normalise slugs: use the model's slug if given, else derive from the title, then canonicalise
  // through the same alias table so "definition-of-work" becomes the existing "work".
  const existingSlugs = new Set(wikiEntries.map((e) => e.slug));
  const existingAliases = buildAliases(wikiEntries);
  for (const result of extracted) {
    const raw = slugify(String(result.slug || result.title || ""));
    const canonical = existingSlugs.has(raw)
      ? raw
      : slugVariants(raw).map((v) => (existingSlugs.has(v) ? v : existingAliases.get(v))).find(Boolean);
    result.slug = canonical ?? raw;
  }

  // Known slugs = existing entries + this batch. Aliases include batch titles so a dependency
  // spelled like a sibling's title still resolves to that sibling.
  const known = new Set([...existingSlugs, ...extracted.map((r) => r.slug)]);
  const aliases = new Map([...buildAliases(extracted.map((r) => ({ slug: r.slug, title: String(r.title ?? r.slug) }))), ...existingAliases]);

  // Linking pass: one focused call per new entry, choosing its direct prerequisites from the
  // existing entries plus the entries extracted BEFORE it. Textbooks define before they use, and
  // existing entries never depend on new ones, so this ordering makes cycles impossible.
  // Its answer replaces the extraction's guesses.
  const linkNotes = new Map<any, string>();
  if (argv.link && extracted.length > 0) {
    const fresh = extracted.filter((r) => !existingSlugs.has(r.slug));
    for (const r of fresh) r.type = normalizeType(r.type);
    const asCandidate = (r: any) => ({ slug: r.slug, type: String(r.type), title: String(r.title ?? r.slug), summary: String(r.summary ?? "") });

    console.log(`Linking ${fresh.length} new entries (against ${wikiEntries.length} existing + earlier entries in this batch)...`);
    const started = Date.now();
    for (let i = 0; i < fresh.length; i++) {
      const r = fresh[i];
      const earlier = fresh.slice(0, i);
      const allowed = new Set([...existingSlugs, ...earlier.map((e) => e.slug)]);
      const candidatesBlock = formatCandidates([...wikiEntries, ...earlier.map(asCandidate)]);
      const before = resolveDependencies(r.dependencies, r.slug, known, aliases).resolved;

      let proposed: Array<{ slug: string; reason: string }> | undefined;
      let lastError = "";
      for (let attempt = 1; attempt <= 2 && !proposed; attempt++) {
        try {
          proposed = await linkEntry(r, candidatesBlock, excerpt, argv.model, argv.llmUrl);
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (!proposed) {
        // Keep the extraction's dependencies, minus any that point forward (they could form a cycle).
        r.dependencies = before.filter((d) => allowed.has(d));
        const dropped = before.filter((d) => !allowed.has(d));
        linkNotes.set(r, `linking failed twice, kept extraction's dependencies${dropped.length ? ` minus forward refs ${dropped.join(", ")}` : ""} (${lastError})`);
        continue;
      }

      const resolution = resolveDependencies(proposed.map((p) => p.slug), r.slug, known, aliases);
      const accepted = resolution.resolved.filter((d) => allowed.has(d));
      const forward = resolution.resolved.filter((d) => !allowed.has(d));
      r.dependencies = accepted;

      const added = accepted.filter((d) => !before.includes(d));
      const removed = before.filter((d) => !accepted.includes(d));
      const notes = [];
      if (added.length) notes.push(`+${added.join(", +")}`);
      if (removed.length) notes.push(`-${removed.join(", -")}`);
      if (forward.length) notes.push(`ignored forward refs: ${forward.join(", ")}`);
      if (resolution.unresolved.length) notes.push(`unknown slugs ignored: ${resolution.unresolved.join(", ")}`);
      if (notes.length) linkNotes.set(r, notes.join("; "));
    }
    console.log(`✓ Linking done in ${Math.round((Date.now() - started) / 1000)}s\n`);
  }

  // Create output directory
  if (!argv.dryRun && !existsSync(argv.outputDir)) {
    mkdirSync(argv.outputDir, { recursive: true });
  }

  // Process results
  console.log(`\nExtracted ${extracted.length} results:`);
  console.log("-".repeat(70));

  const allIssues: Array<{ result: any; issues: string[] }> = [];
  const seenSlugs = new Set<string>();

  // Pass 1: normalise, resolve and validate everything before writing anything.
  interface Processed { result: any; issues: string[]; hard: string[]; existing?: WikiEntry; mappedNote: string; typeNote: string; linkNote: string }
  const processed: Processed[] = extracted.map((result) => {
    const originalType = result.type;
    result.type = normalizeType(result.type);
    const typeNote = originalType !== result.type && typeof originalType === "string" ? `${originalType}→${result.type}` : "";

    const resolution = resolveDependencies(result.dependencies, result.slug, known, aliases);
    result.dependencies = resolution.resolved;

    const issues = validateExtractedResult(result, argv.field, framework);
    const hard = frontmatterIssues(result, argv.field, framework);
    if (resolution.unresolved.length > 0) {
      issues.push(`Unresolved dependencies (dropped): ${resolution.unresolved.join(", ")}`);
    }

    const existing = wikiEntries.find((e) => e.slug === result.slug);
    if (existing) {
      issues.push(`Already in the wiki as "${existing.slug}" (${existing.title}); merge by hand instead of adding`);
    }
    if (seenSlugs.has(result.slug)) {
      issues.push(`Duplicate slug "${result.slug}" within this batch`);
      hard.push("duplicate slug");
    }
    seenSlugs.add(result.slug);

    const mappedNote = resolution.mapped.map((m) => `${m.from}→${m.to}`).join(", ");
    return { result, issues, hard, existing, mappedNote, typeNote, linkNote: linkNotes.get(result) ?? "" };
  });

  // Entries that would fail check-content go to needs-fix/, and so does anything that depends on
  // them (transitively), so the main output folder always passes check-content as a unit.
  const blocked = new Set(processed.filter((p) => p.hard.length > 0 && !p.existing).map((p) => p.result.slug));
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of processed) {
      if (p.existing || blocked.has(p.result.slug)) continue;
      const bad = p.result.dependencies.find((d: string) => blocked.has(d));
      if (bad) {
        blocked.add(p.result.slug);
        p.issues.push(`Depends on "${bad}", which needs fixing first`);
        changed = true;
      }
    }
  }
  const needsFixDir = join(argv.outputDir, "needs-fix");
  if (!argv.dryRun && blocked.size > 0) mkdirSync(needsFixDir, { recursive: true });

  // Pass 2: report and write.
  for (let i = 0; i < processed.length; i++) {
    const { result, issues, existing, mappedNote, typeNote, linkNote } = processed[i];

    if (issues.length > 0) {
      allIssues.push({ result, issues });
    }

    if (argv.dryRun) {
      console.log(`\n  ${i + 1}. [${result.type || "UNKNOWN"}] ${result.title || "(no title)"}  (${result.slug})`);
      console.log(`     Summary: ${result.summary?.substring(0, 60)}${result.summary && result.summary.length > 60 ? "..." : ""}`);
      console.log(`     Assumptions: ${result.assumptions?.length || 0}`);
      console.log(`     Dependencies: ${result.dependencies.join(", ") || "none"}`);
      if (mappedNote) console.log(`     Renamed: ${mappedNote}`);
      if (typeNote) console.log(`     Retyped: ${typeNote}`);
      if (linkNote) console.log(`     Linking: ${linkNote}`);
    } else if (existing) {
      console.log(`  ${i + 1}. [${result.type || "UNKNOWN"}] ${result.title || "(no title)"}`);
      console.log(`     → Skipped: already exists at ${existing.file}`);
    } else {
      const { slug, entry } = generateEntryMarkdown(result, argv.field, framework);
      const isBlocked = blocked.has(slug);
      writeFileSync(join(isBlocked ? needsFixDir : argv.outputDir, `${slug}.md`), entry);

      console.log(`  ${i + 1}. [${result.type || "UNKNOWN"}] ${result.title || "(no title)"}`);
      console.log(`     → Saved to: ${isBlocked ? "needs-fix/" : ""}${slug}.md`);
      if (mappedNote) console.log(`     Renamed: ${mappedNote}`);
      if (typeNote) console.log(`     Retyped: ${typeNote}`);
      if (linkNote) console.log(`     Linking: ${linkNote}`);
    }

    if (issues.length > 0) {
      console.log(`     ⚠ Validation issues: ${issues.join("; ")}`);
    }
  }

  // Report validation issues
  if (allIssues.length > 0) {
    console.log("\n" + "-".repeat(70));
    console.log(`⚠ ${allIssues.length} result(s) had validation issues:`);
    allIssues.forEach(({ result, issues }) => {
      console.log(`  - "${result.title}": ${issues.join("; ")}`);
    });
  }

  if (!argv.dryRun) {
    console.log(`\n✓ New entries saved to: ${argv.outputDir}`);
    if (blocked.size > 0) console.log(`⚠ ${blocked.size} entr${blocked.size === 1 ? "y" : "ies"} that would fail check-content are in: ${needsFixDir}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review each entry file`);
    console.log(`  2. Check assumptions are explicit`);
    console.log(`  3. Move accepted entries into src/content/entries/${argv.field}/`);
    console.log(`  4. Run: npm run check:content`);
  } else {
    console.log("\n✓ Dry run complete. No files were saved.");
  }
}

// Main execution guard for ESM
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ingest-textbook.ts")) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
