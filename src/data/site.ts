export const SITE = {
  name: "openphysics.wiki",
  description: "A free, open-source physics reference built from explicit assumptions and linked results.",
  repositoryUrl: process.env.PUBLIC_REPOSITORY_URL ?? "",
} as const;

export const ENTRY_TYPES = [
  { id: "definition", label: "Definition", code: "D" },
  { id: "axiom", label: "Axiom", code: "A" },
  { id: "principle", label: "Principle", code: "P" },
  { id: "theorem", label: "Theorem", code: "T" },
  { id: "technique", label: "Technique", code: "M" },
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number]["id"];

export function getEntryType(type: string) {
  return ENTRY_TYPES.find((entryType) => entryType.id === type) ?? ENTRY_TYPES[0];
}
