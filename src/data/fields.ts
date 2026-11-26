export const FIELDS = [
  {
    slug: "classical-mechanics",
    name: "Classical mechanics",
    shortName: "Classical mechanics",
    description: "Newtonian dynamics, Lagrangian mechanics, and conservation laws.",
    available: true,
  },
  {
    slug: "electromagnetism",
    name: "Electromagnetism",
    shortName: "E&M",
    description: "Electric and magnetic fields, potentials, and Maxwell's equations.",
    available: false,
  },
  {
    slug: "thermodynamics",
    name: "Thermodynamics",
    shortName: "Thermodynamics",
    description: "Heat, work, entropy, and the laws of thermal systems.",
    available: false,
  },
  {
    slug: "quantum-mechanics",
    name: "Quantum mechanics",
    shortName: "Quantum",
    description: "States, observables, evolution, and measurement.",
    available: false,
  },
  {
    slug: "relativity",
    name: "Relativity",
    shortName: "Relativity",
    description: "Spacetime, Lorentz transformations, and gravitation.",
    available: false,
  },
  {
    slug: "statistical-mechanics",
    name: "Statistical mechanics",
    shortName: "Statistical",
    description: "Microstates, ensembles, and the origin of macroscopic laws.",
    available: false,
  },
] as const;

export type FieldSlug = (typeof FIELDS)[number]["slug"];

export function getField(slug: string) {
  return FIELDS.find((field) => field.slug === slug);
}
