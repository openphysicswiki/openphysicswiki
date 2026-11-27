---
title: "Generalized momentum"
slug: generalized-momentum
field: classical-mechanics
summary: "The generalized momentum conjugate to a coordinate is the Lagrangian's derivative with respect to that coordinate's velocity."
roles:
  newtonian: { type: definition, foundational: true, dependencies: [lagrangian] }
---
## Statement
The generalized momentum $p_j$ conjugate to coordinate $q_j$ is
$$
\boxed{p_j=\frac{\partial L}{\partial\dot q_j}},\qquad j=1,\ldots,n.
$$
It need not equal a component of $m\mathbf v$ and is not automatically conserved.

## Assumptions
$L(q,\dot q,t)$ is differentiable in each $\dot q_j$, and the $q_j$ are independent generalized coordinates. The partial derivative holds $q$, $t$, and all other generalized velocities fixed.
