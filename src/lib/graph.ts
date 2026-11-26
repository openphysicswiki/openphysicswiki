export interface GraphEntry {
  slug: string;
  title: string;
  type: string;
  field: string;
  foundational: boolean;
  dependencies: string[];
}

export function findDependencyCycle(entries: GraphEntry[]): string[] | null {
  const byId = new Map(entries.map((entry) => [entry.slug, entry]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(slug: string): string[] | null {
    if (state.get(slug) === "visiting") {
      const start = stack.indexOf(slug);
      return [...stack.slice(start), slug];
    }
    if (state.get(slug) === "done") return null;

    state.set(slug, "visiting");
    stack.push(slug);
    for (const dependency of byId.get(slug)?.dependencies ?? []) {
      if (!byId.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(slug, "done");
    return null;
  }

  for (const entry of entries) {
    const cycle = visit(entry.slug);
    if (cycle) return cycle;
  }
  return null;
}

export class DependencyGraph {
  readonly byId: Map<string, GraphEntry>;
  readonly dependents: Map<string, Set<string>>;

  constructor(entries: GraphEntry[]) {
    this.byId = new Map();
    this.dependents = new Map();

    for (const entry of entries) {
      if (this.byId.has(entry.slug)) throw new Error(`Duplicate entry: ${entry.slug}`);
      this.byId.set(entry.slug, entry);
      this.dependents.set(entry.slug, new Set());
    }
    for (const entry of entries) {
      for (const dependency of entry.dependencies) {
        if (!this.byId.has(dependency)) {
          throw new Error(`${entry.slug} depends on missing entry ${dependency}`);
        }
        this.dependents.get(dependency)?.add(entry.slug);
      }
    }

    const cycle = findDependencyCycle(entries);
    if (cycle) throw new Error(`Dependency cycle: ${cycle.join(" → ")}`);
  }

  ancestors(slug: string): Set<string> {
    return this.walk(slug, (id) => this.byId.get(id)?.dependencies ?? []);
  }

  descendants(slug: string): Set<string> {
    return this.walk(slug, (id) => [...(this.dependents.get(id) ?? [])]);
  }

  neighborhood(slug: string): Set<string> {
    return new Set([slug, ...this.ancestors(slug), ...this.descendants(slug)]);
  }

  layers(scope?: Set<string>): string[][] {
    const visible = scope ?? new Set(this.byId.keys());
    const memo = new Map<string, number>();

    const depth = (slug: string): number => {
      const cached = memo.get(slug);
      if (cached !== undefined) return cached;
      const parents = (this.byId.get(slug)?.dependencies ?? []).filter((id) => visible.has(id));
      const result = parents.length === 0 ? 0 : Math.max(...parents.map(depth)) + 1;
      memo.set(slug, result);
      return result;
    };

    const layers: string[][] = [];
    const ordered = [...visible]
      .map((slug) => this.byId.get(slug))
      .filter((entry): entry is GraphEntry => Boolean(entry))
      .sort((a, b) => a.title.localeCompare(b.title));

    for (const entry of ordered) {
      const index = depth(entry.slug);
      (layers[index] ??= []).push(entry.slug);
    }
    return layers;
  }

  private walk(slug: string, next: (id: string) => string[]): Set<string> {
    if (!this.byId.has(slug)) throw new Error(`Unknown entry: ${slug}`);
    const found = new Set<string>();
    const pending = [...next(slug)];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (found.has(current)) continue;
      found.add(current);
      pending.push(...next(current));
    }
    found.delete(slug);
    return found;
  }
}
