import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { entrySchema, type EntryData } from "../src/lib/entry-schema";
import { findDependencyCycle } from "../src/lib/graph";
import { frameworkView } from "../src/lib/framework-view";
import { FIELDS } from "../src/data/fields";
import { FRAMEWORKS, getFramework, validateFrameworkRegistry, visibleFrameworks, type Framework } from "../src/data/frameworks";

export interface ValidationIssue {
  file: string;
  message: string;
}

interface ParsedEntry {
  data: EntryData;
  file: string;
}

const FIXED_SECTIONS = ["Statement", "Assumptions"] as const;
const DERIVATION_HEADING = /^Derivation(?: \(([a-z0-9]+(?:-[a-z0-9]+)*)\))?$/;

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const location = path.join(directory, item.name);
    if (item.isDirectory()) return markdownFiles(location);
    return item.isFile() && item.name.endsWith(".md") ? [location] : [];
  });
}

/**
 * Sections: ## Statement, ## Assumptions, then optional derivations. A single-role entry may use a
 * plain ## Derivation; with several roles each derivation names its framework: ## Derivation (newtonian).
 */
function validateSections(body: string, file: string, roleFrameworks: string[] | undefined, issues: ValidationIssue[]) {
  const headings = [...body.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm)];
  const levelTwo = headings.filter((match) => match[1] === "##");
  const names = levelTwo.map((match) => match[2]);

  for (const required of FIXED_SECTIONS) {
    if (!names.includes(required)) issues.push({ file, message: `Missing required ## ${required} section.` });
  }
  for (const heading of headings) {
    const derivation = heading[2].match(DERIVATION_HEADING);
    if (heading[1] !== "##" || (!FIXED_SECTIONS.includes(heading[2] as (typeof FIXED_SECTIONS)[number]) && !derivation)) {
      issues.push({ file, message: `Unsupported heading "${heading[2]}". Use only ## Statement, ## Assumptions, and optional ## Derivation sections.` });
      continue;
    }
    if (!derivation || !roleFrameworks) continue;
    const named = derivation[1];
    if (named && !roleFrameworks.includes(named)) {
      issues.push({ file, message: `"## ${heading[2]}" names a framework this entry has no role in (roles: ${roleFrameworks.join(", ")}).` });
    }
    if (!named && roleFrameworks.length > 1) {
      issues.push({ file, message: `With several roles, name the framework: ${roleFrameworks.map((f) => `"## Derivation (${f})"`).join(" or ")}.` });
    }
  }
  if (new Set(names).size !== names.length) issues.push({ file, message: "Section headings must not repeat." });
  if (names[0] !== "Statement" || (names.includes("Assumptions") && names.indexOf("Assumptions") !== 1)) {
    issues.push({ file, message: "Statement must be the first section, followed by Assumptions." });
  }
  if (body.slice(0, levelTwo[0]?.index ?? body.length).trim()) {
    issues.push({ file, message: "Entry content must begin with ## Statement." });
  }

  levelTwo.forEach((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = levelTwo[index + 1]?.index ?? body.length;
    if (!body.slice(start, end).trim()) issues.push({ file, message: `The ${heading[2]} section cannot be empty.` });
  });
}

function rolesOf(data: EntryData): Array<[string, EntryData["roles"][string]]> {
  return Object.entries(data.roles);
}

/** Per-entry checks that don't need the rest of the collection. */
function validateEntry(data: EntryData, file: string, registry: readonly Framework[], issues: ValidationIssue[]) {
  const expectedFile = `${data.field}/${data.slug}.md`;
  if (file !== expectedFile) issues.push({ file, message: `File location must be ${expectedFile}; field and slug must match the path.` });
  if (!FIELDS.some((field) => field.slug === data.field)) issues.push({ file, message: `Unknown field "${data.field}". Register it in src/data/fields.ts.` });

  for (const [framework, role] of rolesOf(data)) {
    const registered = getFramework(framework, registry);
    if (!registered) {
      issues.push({ file, message: `roles.${framework}: unknown framework. Register it in src/data/frameworks.ts.` });
    } else if (registered.field !== data.field) {
      issues.push({ file, message: `Framework "${framework}" belongs to ${registered.field}, not ${data.field}.` });
    }
    if (new Set(role.dependencies).size !== role.dependencies.length) issues.push({ file, message: `roles.${framework}: dependencies must not repeat.` });
    if (role.dependencies.includes(data.slug)) issues.push({ file, message: `roles.${framework}: an entry cannot depend on itself.` });
  }

  const seen = new Set<string>();
  for (const relation of data.relations) {
    if (relation.target === data.slug) issues.push({ file, message: `An entry cannot have a relation to itself (${relation.type}).` });
    const key = `${relation.type}:${relation.target}`;
    if (seen.has(key)) issues.push({ file, message: `Duplicate relation ${relation.type} → ${relation.target}.` });
    seen.add(key);
  }
}

/** Dependency checks for one framework: resolution, cycles, orphans. Relations play no part. */
function validateFramework(framework: string, parsed: ParsedEntry[], registry: readonly Framework[], issues: ValidationIssue[]) {
  const layers = visibleFrameworks(framework, registry);
  const view = frameworkView(parsed.map(({ data }) => data), framework, registry);
  const inView = new Set(view.map((node) => node.slug));
  const fileOf = new Map(parsed.map((entry) => [entry.data.slug, entry.file]));
  const allSlugs = new Set(parsed.map((entry) => entry.data.slug));
  const members = parsed.filter((entry) => entry.data.roles[framework]);

  let hasMissingReferences = false;
  for (const entry of members) {
    for (const dependency of entry.data.roles[framework].dependencies) {
      if (inView.has(dependency)) continue;
      hasMissingReferences = true;
      issues.push({
        file: entry.file,
        message: allSlugs.has(dependency)
          ? `roles.${framework}: "${dependency}" has no role in ${layers.map((l) => `"${l}"`).join(" or ")}. Dependencies must stay within a framework and the frameworks it builds on.`
          : `Unresolved dependency "${dependency}".`,
      });
    }
  }
  if (hasMissingReferences) return;

  const cycle = findDependencyCycle(view);
  if (cycle) {
    issues.push({ file: fileOf.get(cycle[0]) ?? "content", message: `Dependency cycle detected in ${framework}: ${cycle.join(" → ")}.` });
    return;
  }

  // Orphans are judged in the framework the entry belongs to; dependents may come from frameworks that build on it.
  const hasDependent = new Set<string>();
  for (const other of registry) {
    if (!visibleFrameworks(other.slug, registry).includes(framework)) continue;
    for (const node of frameworkView(parsed.map(({ data }) => data), other.slug, registry)) {
      for (const dependency of node.dependencies) hasDependent.add(dependency);
    }
  }
  for (const entry of members) {
    const role = entry.data.roles[framework];
    if (role.dependencies.length === 0 && !hasDependent.has(entry.data.slug)) {
      issues.push({ file: entry.file, message: `Orphan entry in ${framework}: connect it to at least one prerequisite or dependent.` });
    }
  }
}

export function validateContent(contentDirectory: string, registry: readonly Framework[] = FRAMEWORKS): ValidationIssue[] {
  const issues: ValidationIssue[] = validateFrameworkRegistry(registry).map((message) => ({ file: "src/data/frameworks.ts", message }));
  if (issues.length > 0) return issues;
  const parsed: ParsedEntry[] = [];
  const files = markdownFiles(contentDirectory).sort();

  for (const absoluteFile of files) {
    const file = path.relative(contentDirectory, absoluteFile).split(path.sep).join("/");
    let raw: ReturnType<typeof matter>;
    try {
      raw = matter(readFileSync(absoluteFile, "utf8"));
    } catch (error) {
      issues.push({ file, message: `Cannot parse frontmatter: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }

    const result = entrySchema.safeParse(raw.data);
    validateSections(raw.content, file, result.success ? rolesOf(result.data).map(([f]) => f) : undefined, issues);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ file, message: `${issue.path.join(".") || "frontmatter"}: ${issue.message}` });
      }
      continue;
    }

    validateEntry(result.data, file, registry, issues);
    parsed.push({ data: result.data, file });
  }

  const bySlug = new Map<string, ParsedEntry[]>();
  for (const entry of parsed) bySlug.set(entry.data.slug, [...(bySlug.get(entry.data.slug) ?? []), entry]);
  for (const [slug, matches] of bySlug) {
    if (matches.length > 1) {
      for (const match of matches) issues.push({ file: match.file, message: `Duplicate slug "${slug}". Slugs must be globally unique.` });
    }
  }
  if ([...bySlug.values()].some((matches) => matches.length > 1)) return issues;

  for (const entry of parsed) {
    for (const relation of entry.data.relations) {
      if (!bySlug.has(relation.target)) issues.push({ file: entry.file, message: `Unresolved relation target "${relation.target}" (${relation.type}).` });
    }
  }

  const used = new Set(parsed.flatMap(({ data }) => rolesOf(data).map(([framework]) => framework)));
  for (const framework of registry) {
    if (used.has(framework.slug)) validateFramework(framework.slug, parsed, registry, issues);
  }

  return issues;
}

function main() {
  const directory = path.resolve(process.cwd(), "src/content/entries");
  const issues = validateContent(directory);
  if (issues.length > 0) {
    console.error(`\nContent validation failed with ${issues.length} ${issues.length === 1 ? "error" : "errors"}:\n`);
    for (const issue of issues) console.error(`  ${issue.file}\n    ${issue.message}\n`);
    process.exitCode = 1;
    return;
  }
  const count = markdownFiles(directory).length;
  console.log(`✓ ${count} ${count === 1 ? "entry" : "entries"}: valid format, resolved references, acyclic graph per framework, no orphans.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
