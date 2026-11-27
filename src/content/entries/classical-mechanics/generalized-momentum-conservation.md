---
title: "Conservation of generalized momentum"
slug: generalized-momentum-conservation
field: classical-mechanics
summary: "The generalized momentum conjugate to a cyclic coordinate is constant along every Euler–Lagrange solution."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [euler-lagrange-equations, generalized-momentum] }
---
## Statement
If $q_k$ is cyclic (ignorable), meaning
$$
\frac{\partial L}{\partial q_k}=0,
$$
then its conjugate momentum $p_k=\partial L/\partial\dot q_k$ is constant along every smooth solution:
$$
\frac{dp_k}{dt}=0.
$$

## Assumptions
The Euler–Lagrange hypotheses hold for independent coordinates and ideal holonomic constraints. The Lagrangian may depend on $\dot q_k$ and $t$, but it has no explicit dependence on $q_k$.

## Derivation
The $k$th Euler–Lagrange equation gives
$$
\frac{dp_k}{dt}
=\frac{d}{dt}\frac{\partial L}{\partial\dot q_k}
=\frac{\partial L}{\partial q_k}=0.
$$
