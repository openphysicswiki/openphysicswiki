import { FRAMEWORKS, visibleFrameworks, type Framework } from "../data/frameworks";
import type { EntryRole } from "./entry-schema";
import type { GraphEntry } from "./graph";

/** The parts of an entry the framework view needs; satisfied by both collection data and raw frontmatter. */
export interface RoledEntry {
  slug: string;
  title: string;
  field: string;
  roles: Record<string, EntryRole>;
}

export interface FrameworkGraphEntry extends GraphEntry {
  /** The framework whose role supplied this node: the viewed one, or one it builds on. */
  framework: string;
}

/**
 * Flattens entries into the graph as seen from one framework: every entry with a role in that
 * framework or in one it builds on, using the most specific role available. The graph library
 * works on this flat view unchanged.
 */
export function frameworkView(entries: RoledEntry[], framework: string, registry: readonly Framework[] = FRAMEWORKS): FrameworkGraphEntry[] {
  const layers = visibleFrameworks(framework, registry);
  return entries.flatMap((entry) => {
    const layer = layers.find((candidate) => entry.roles[candidate]);
    if (!layer) return [];
    const role = entry.roles[layer]!;
    return [{
      slug: entry.slug,
      title: entry.title,
      field: entry.field,
      type: role.type,
      foundational: role.foundational,
      dependencies: [...role.dependencies],
      framework: layer,
    }];
  });
}
