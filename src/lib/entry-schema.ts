import { z } from "zod";

export const ENTRY_TYPES = [
  "definition",
  "axiom",
  "principle",
  "theorem",
  "technique",
] as const;

export const RELATION_TYPES = ["special-case-of", "generalizes", "equivalent-under"] as const;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single hyphens.");

/** How an entry participates in one framework: its type, starting-point status, and direct prerequisites. */
export const roleSchema = z
  .object({
    type: z.enum(ENTRY_TYPES),
    foundational: z.boolean(),
    dependencies: z.array(slugSchema).max(100),
  })
  .strict();

/** A link between entries that is not a dependency. Relations never take part in cycle or orphan checks. */
export const relationSchema = z
  .object({
    type: z.enum(RELATION_TYPES),
    target: slugSchema,
    conditions: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((relation) => relation.type !== "equivalent-under" || relation.conditions, {
    message: "equivalent-under relations must state their conditions.",
    path: ["conditions"],
  });

export const entrySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    slug: slugSchema,
    field: slugSchema,
    summary: z.string().trim().min(1),
    // Keys are framework slugs. Registration and field membership are checked by check-content
    // (which also runs before every build), so tests can supply their own framework registry.
    roles: z
      .record(slugSchema, roleSchema)
      .refine((roles) => Object.keys(roles).length > 0, { message: "An entry needs at least one framework role." }),
    relations: z.array(relationSchema).default([]),
  })
  .strict();

export type EntryData = z.infer<typeof entrySchema>;
export type EntryRole = z.infer<typeof roleSchema>;
export type EntryRelation = z.infer<typeof relationSchema>;
