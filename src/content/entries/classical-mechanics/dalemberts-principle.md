---
title: "d'Alembert's principle"
slug: dalemberts-principle
type: principle
field: classical-mechanics
foundational: false
dependencies: [newtons-second-law, generalized-coordinates]
summary: "For ideal constraints, applied forces minus inertial forces have zero total virtual work."
---
## Statement
For $N$ particles, let $\mathbf F_i^{(a)}$ be the applied force on particle $i$, excluding its constraint force $\mathbf R_i$. For every fixed-time virtual displacement compatible with the constraints,
$$
\boxed{\sum_{i=1}^{N}\left(\mathbf F_i^{(a)}-m_i\mathbf a_i\right)\cdot\delta\mathbf r_i=0.}
$$
Ideal constraints satisfy $\sum_i\mathbf R_i\cdot\delta\mathbf r_i=0$.

## Assumptions
The frame is inertial, each $m_i$ is constant, and the holonomic constraints are ideal. Virtual displacements are taken at fixed time. Applied forces, including retained interparticle interactions, are distinct from constraint forces; no general cancellation of internal-force virtual work is invoked.

## Derivation
Newton's second law gives $\mathbf F_i^{(a)}+\mathbf R_i=m_i\mathbf a_i$. Taking the virtual-work sum,
$$
\sum_i\left(\mathbf F_i^{(a)}+\mathbf R_i-m_i\mathbf a_i\right)\cdot\delta\mathbf r_i=0.
$$
Subtracting the vanishing virtual work $\sum_i\mathbf R_i\cdot\delta\mathbf r_i$ leaves the stated principle.
