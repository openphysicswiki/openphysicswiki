import { getCollection, type CollectionEntry } from "astro:content";
import type { GraphEntry } from "./graph";

export type Entry = CollectionEntry<"entries">;

export async function getEntries(): Promise<Entry[]> {
  const entries = await getCollection("entries");
  return entries.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export function toGraphEntry(entry: Entry): GraphEntry {
  return {
    slug: entry.data.slug,
    title: entry.data.title,
    type: entry.data.type,
    field: entry.data.field,
    foundational: entry.data.foundational,
    dependencies: [...entry.data.dependencies],
  };
}

export function entryUrl(entry: Entry | GraphEntry): string {
  const data = "data" in entry ? entry.data : entry;
  return `/${data.field}/${data.slug}/`;
}
