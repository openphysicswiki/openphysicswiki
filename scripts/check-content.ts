import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { entrySchema, type EntryData } from "../src/lib/entry-schema";
import { findDependencyCycle, type GraphEntry } from "../src/lib/graph";
import { FIELDS } from "../src/data/fields";

export interface ValidationIssue {
  file: string;
  message: string;
}

interface ParsedEntry {
  data: EntryData;
  file: string;
}

const ALLOWED_SECTIONS = ["Statement", "Assumptions", "Derivation"] as const;

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const location = path.join(directory, item.name);
    if (item.isDirectory()) return markdownFiles(location);
    return item.isFile() && item.name.endsWith(".md") ? [location] : [];
  });
}

function validateSections(body: string, file: string, issues: ValidationIssue[]) {
  const headings = [...body.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm)];
  const levelTwo = headings.filter((match) => match[1] === "##");
  const names = levelTwo.map((match) => match[2]);

  for (const required of ["Statement", "Assumptions"]) {
    if (!names.includes(required)) issues.push({ file, message: `Missing required ## ${required} section.` });
  }
  for (const heading of headings) {
    if (heading[1] !== "##" || !ALLOWED_SECTIONS.includes(heading[2] as (typeof ALLOWED_SECTIONS)[number])) {
      issues.push({ file, message: `Unsupported heading "${heading[2]}". Use only ## Statement, ## Assumptions, and optional ## Derivation.` });
    }
  }
  if (new Set(names).size !== names.length) issues.push({ file, message: "Section headings must not repeat." });
  if (names[0] !== "Statement" || (names.includes("Assumptions") && names.indexOf("Assumptions") < names.indexOf("Statement"))) {
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

export function validateContent(contentDirectory: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

    validateSections(raw.content, file, issues);
    const result = entrySchema.safeParse(raw.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ file, message: `${issue.path.join(".") || "frontmatter"}: ${issue.message}` });
      }
      continue;
    }

    const data = result.data;
    const expectedFile = `${data.field}/${data.slug}.md`;
    if (file !== expectedFile) issues.push({ file, message: `File location must be ${expectedFile}; field and slug must match the path.` });
    if (!FIELDS.some((field) => field.slug === data.field)) issues.push({ file, message: `Unknown field "${data.field}". Register it in src/data/fields.ts.` });
    if (new Set(data.dependencies).size !== data.dependencies.length) issues.push({ file, message: "Dependencies must not repeat." });
    if (data.dependencies.includes(data.slug)) issues.push({ file, message: "An entry cannot depend on itself." });

    parsed.push({ data, file });
  }

  const bySlug = new Map<string, ParsedEntry[]>();
  for (const entry of parsed) bySlug.set(entry.data.slug, [...(bySlug.get(entry.data.slug) ?? []), entry]);
  for (const [slug, matches] of bySlug) {
    if (matches.length > 1) {
      for (const match of matches) issues.push({ file: match.file, message: `Duplicate slug "${slug}". Slugs must be globally unique.` });
    }
  }

  const duplicates = [...bySlug.values()].some((matches) => matches.length > 1);
  if (parsed.length > 0 && !duplicates) {
    const graphEntries: GraphEntry[] = parsed.map(({ data }) => ({ ...data, dependencies: [...data.dependencies] }));
    const known = new Set(graphEntries.map((entry) => entry.slug));
    let hasMissingReferences = false;
    for (const entry of parsed) {
      for (const dependency of entry.data.dependencies) {
        if (!known.has(dependency)) {
          issues.push({ file: entry.file, message: `Unresolved dependency "${dependency}".` });
          hasMissingReferences = true;
        }
      }
    }

    if (!hasMissingReferences) {
      const cycle = findDependencyCycle(graphEntries);
      if (cycle) {
        const target = parsed.find((entry) => entry.data.slug === cycle[0])?.file ?? "content";
        issues.push({ file: target, message: `Dependency cycle detected: ${cycle.join(" → ")}.` });
      }

      const hasDependent = new Set(graphEntries.flatMap((entry) => entry.dependencies));
      for (const entry of parsed) {
        if (entry.data.dependencies.length === 0 && !hasDependent.has(entry.data.slug)) {
          issues.push({ file: entry.file, message: "Orphan entry: connect it to at least one prerequisite or dependent." });
        }
      }
    }
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
  console.log(`✓ ${count} ${count === 1 ? "entry" : "entries"}: valid format, resolved references, acyclic graph, no orphans.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
