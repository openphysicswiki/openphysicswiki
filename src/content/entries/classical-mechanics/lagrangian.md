---
title: "Lagrangian"
slug: lagrangian
type: definition
field: classical-mechanics
foundational: true
dependencies: [kinetic-energy, potential-energy, generalized-coordinates]
summary: "The Lagrangian is kinetic energy minus potential energy expressed in generalized coordinates and velocities."
---
## Statement
For independent generalized coordinates $q=(q_1,\ldots,q_n)$, the Lagrangian is
$$
L(q,\dot q,t)=T(q,\dot q,t)-U(q,t),
$$
where $T=\frac12\sum_i m_i\,\dot{\mathbf r}_i\cdot\dot{\mathbf r}_i$ and $U(q,t)=\mathcal U(\{\mathbf r_i(q,t)\})$ are the kinetic and potential energies expressed through $\mathbf r_i=\mathbf r_i(q,t)$.

## Assumptions
Particle masses are constant and positions are referred to an inertial frame at nonrelativistic speeds. The coordinates incorporate independent holonomic constraints, and every encoded nonconstraint force derives from a time-independent Cartesian potential: $\mathbf F_i=-\partial\mathcal U/\partial\mathbf r_i$. Moving coordinates can therefore make $U(q,t)$ explicitly time dependent.
