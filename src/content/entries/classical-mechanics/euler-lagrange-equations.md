---
title: "Euler–Lagrange equations"
slug: euler-lagrange-equations
field: classical-mechanics
summary: "Smooth admissible trajectories satisfy one Euler–Lagrange equation for each independent generalized coordinate."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [dalemberts-principle, lagrangian] }
---
## Statement
The physical trajectory $q(t)$ satisfies, for each $j=1,\ldots,n$,
$$
\boxed{\frac{d}{dt}\left(\frac{\partial L}{\partial\dot q_j}\right)-\frac{\partial L}{\partial q_j}=0.}
$$

## Assumptions
The $q_j$ independently parametrize ideal holonomic constraints, $L=T-U$ with $U=U(q,t)$ is $C^2$, and no explicit constraint-force terms remain because constraint virtual work vanishes. Velocity dependence is regular,
$$
\det\!\left[\frac{\partial^2L}{\partial\dot q_j\,\partial\dot q_k}\right]_{j,k=1}^{n}\ne0,
$$
and the $\delta q_j$ are independent fixed-time virtual variations.

## Derivation
For $\mathbf r_i=\mathbf r_i(q,t)$, the kinetic identity is
$$
\sum_i m_i\ddot{\mathbf r}_i\cdot\delta\mathbf r_i
=\sum_j\left[\frac{d}{dt}\frac{\partial T}{\partial\dot q_j}-\frac{\partial T}{\partial q_j}\right]\delta q_j.
$$
The generalized applied force is
$$
Q_j=\sum_i\mathbf F_i^{(a)}\cdot\frac{\partial\mathbf r_i}{\partial q_j}
=-\frac{\partial U}{\partial q_j}.
$$
Substitution into d'Alembert's principle and independence of the $\delta q_j$ give
$$
\frac{d}{dt}\frac{\partial T}{\partial\dot q_j}-\frac{\partial T}{\partial q_j}+\frac{\partial U}{\partial q_j}=0.
$$
Since $\partial U/\partial\dot q_j=0$, this is the Euler–Lagrange equation for $L=T-U$.
