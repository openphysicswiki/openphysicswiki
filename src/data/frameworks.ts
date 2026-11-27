import type { FieldSlug } from "./fields";

export interface Framework {
  slug: string;
  field: FieldSlug | (string & {});
  name: string;
  description: string;
  /**
   * Frameworks whose entries this one may depend on, e.g. a shared kinematics layer.
   * Resolution is transitive. A framework's roots are computed from the graph (entries with no
   * dependencies), never declared here, so they cannot drift from the content.
   */
  buildsOn: readonly string[];
  /** The framework shown for a field when none is selected. Exactly one per field that has frameworks. */
  default?: boolean;
}

export const FRAMEWORKS: readonly Framework[] = [
  {
    slug: "newtonian",
    field: "classical-mechanics",
    name: "Newtonian mechanics",
    description: "Forces and Newton's laws in inertial frames, with Lagrangian results derived from them.",
    buildsOn: [],
    default: true,
  },
];

export function getFramework(slug: string, registry: readonly Framework[] = FRAMEWORKS): Framework | undefined {
  return registry.find((framework) => framework.slug === slug);
}

export function frameworksForField(field: string, registry: readonly Framework[] = FRAMEWORKS): Framework[] {
  return registry.filter((framework) => framework.field === field);
}

export function defaultFramework(field: string, registry: readonly Framework[] = FRAMEWORKS): Framework | undefined {
  return frameworksForField(field, registry).find((framework) => framework.default);
}

/**
 * The framework itself first, then everything it builds on (breadth-first, transitively).
 * The order matters: when an entry has roles in several of these, the earliest one wins.
 */
export function visibleFrameworks(slug: string, registry: readonly Framework[] = FRAMEWORKS): string[] {
  const order: string[] = [];
  const queue = [slug];
  while (queue.length) {
    const current = queue.shift()!;
    if (order.includes(current)) continue;
    order.push(current);
    for (const parent of getFramework(current, registry)?.buildsOn ?? []) queue.push(parent);
  }
  return order;
}

/** Problems with the registry itself: unknown or cross-field buildsOn, cycles, default count per field. */
export function validateFrameworkRegistry(registry: readonly Framework[] = FRAMEWORKS): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const framework of registry) {
    if (slugs.has(framework.slug)) problems.push(`Duplicate framework "${framework.slug}".`);
    slugs.add(framework.slug);
  }
  for (const framework of registry) {
    for (const parent of framework.buildsOn) {
      const target = getFramework(parent, registry);
      if (!target) problems.push(`Framework "${framework.slug}" builds on unknown framework "${parent}".`);
      else if (target.field !== framework.field) problems.push(`Framework "${framework.slug}" builds on "${parent}" from another field.`);
    }
    // A buildsOn cycle means some framework reaches itself again through its parents.
    const reachable = new Set<string>();
    const stack = [...framework.buildsOn];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === framework.slug) { problems.push(`Framework "${framework.slug}" builds on itself (buildsOn cycle).`); break; }
      if (reachable.has(current)) continue;
      reachable.add(current);
      stack.push(...(getFramework(current, registry)?.buildsOn ?? []));
    }
  }
  const fields = new Set(registry.map((framework) => framework.field));
  for (const field of fields) {
    const defaults = registry.filter((framework) => framework.field === field && framework.default).length;
    if (defaults !== 1) problems.push(`Field "${field}" must have exactly one default framework (has ${defaults}).`);
  }
  return problems;
}
