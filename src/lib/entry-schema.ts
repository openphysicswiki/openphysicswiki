import { z } from "zod";

export const ENTRY_TYPES = [
  "definition",
  "axiom",
  "principle",
  "theorem",
  "technique",
  "example",
] as const;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single hyphens.");

export const entrySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    slug: slugSchema,
    type: z.enum(ENTRY_TYPES),
    field: slugSchema,
    foundational: z.boolean(),
    dependencies: z.array(slugSchema).max(100),
    summary: z.string().trim().min(1).max(220),
  })
  .strict();

export type EntryData = z.infer<typeof entrySchema>;
