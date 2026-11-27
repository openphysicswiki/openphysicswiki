---
title: "Potential energy"
slug: potential-energy
field: classical-mechanics
summary: "Potential energy changes by minus the work done by its conservative force and is fixed up to an additive constant."
roles:
  newtonian: { type: definition, foundational: true, dependencies: [conservative-force] }
---
## Statement
A scalar potential energy $U$ associated with a conservative force $\mathbf F_C$ is defined by
$$
\Delta U=U(\mathbf r_2)-U(\mathbf r_1)
=-W_C=-\int_{\mathbf r_1}^{\mathbf r_2}\mathbf F_C\cdot d\mathbf r.
$$
Equivalently, $\mathbf F_C=-\nabla U$. Choosing $U(\mathbf r_0)$ at one reference point fixes the otherwise arbitrary additive constant.

## Assumptions
The force is conservative on an open connected domain, the work integral is path independent, and $U$ is differentiable wherever the gradient relation is used.
