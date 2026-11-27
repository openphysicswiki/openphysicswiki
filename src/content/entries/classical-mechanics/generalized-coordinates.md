---
title: "Generalized coordinates"
slug: generalized-coordinates
field: classical-mechanics
summary: "Generalized coordinates are independent parameters describing every configuration allowed by holonomic constraints."
roles:
  newtonian: { type: definition, foundational: true, dependencies: [kinematics] }
---
## Statement
A set $q=(q_1,\ldots,q_n)$ of $n$ independent generalized coordinates specifies every allowed configuration of an $N$-particle system through
$$
\mathbf r_i=\mathbf r_i(q,t),\qquad i=1,\ldots,N.
$$
A virtual displacement at fixed time is
$$
\delta\mathbf r_i=\sum_{j=1}^{n}\frac{\partial\mathbf r_i}{\partial q_j}\,\delta q_j,
$$
with no $\partial\mathbf r_i/\partial t$ term because $\delta t=0$.

## Assumptions
All constraints are holonomic and independent, the $q_j$ independently parametrize the $n$-dimensional configuration space, and each $\mathbf r_i(q,t)$ has the required derivatives. Virtual variations remain compatible with the constraints at fixed $t$.
