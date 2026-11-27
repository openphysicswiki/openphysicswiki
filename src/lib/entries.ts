import { getCollection, type CollectionEntry } from "astro:content";
import { defaultFramework } from "../data/frameworks";
import type { EntryRole } from "./entry-schema";
import { frameworkView, type FrameworkGraphEntry } from "./framework-view";
import type { GraphEntry } from "./graph";

export type Entry = CollectionEntry<"entries">;

export async function getEntries(): Promise<Entry[]> {
  const entries = await getCollection("entries");
  return entries.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

/** The flat graph of all entries as seen from one framework (its own roles plus those it builds on). */
export function graphEntries(entries: Entry[], framework: string): FrameworkGraphEntry[] {
  return frameworkView(entries.map((entry) => entry.data), framework);
}

/** The roles an entry has, as [framework, role] pairs. */
export function rolesOf(entry: Entry): Array<[string, EntryRole]> {
  return Object.entries(entry.data.roles).filter((pair): pair is [string, EntryRole] => Boolean(pair[1]));
}

/** The framework an entry is shown in by default: its field's default framework if it has a role there, else its first role. */
export function primaryFramework(entry: Entry): string {
  const preferred = defaultFramework(entry.data.field)?.slug;
  const roles = rolesOf(entry);
  return roles.find(([framework]) => framework === preferred)?.[0] ?? roles[0][0];
}

export function primaryRole(entry: Entry): EntryRole {
  return entry.data.roles[primaryFramework(entry) as keyof Entry["data"]["roles"]]!;
}

export function entryUrl(entry: Entry | GraphEntry): string {
  const data = "data" in entry ? entry.data : entry;
  return `/${data.field}/${data.slug}/`;
}
