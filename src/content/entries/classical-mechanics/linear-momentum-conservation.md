---
title: "Conservation of linear momentum"
slug: linear-momentum-conservation
field: classical-mechanics
summary: "The total linear momentum of an isolated system of point particles is constant in an inertial frame."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [newtons-second-law, newtons-third-law, linear-momentum] }
---
## Statement
For $N$ point particles with total linear momentum
$$
\mathbf P=\sum_{i=1}^{N}\mathbf p_i,
$$
if every external force vanishes, then
$$
\frac{d\mathbf P}{dt}=\mathbf 0,
\qquad \mathbf P(t_2)=\mathbf P(t_1).
$$

## Assumptions
The frame is inertial, all motion is nonrelativistic, and every interparticle force is an equal-and-opposite pairwise interaction evaluated at the same Newtonian time. Isolation means zero external force on every particle; particle masses are constant.

## Derivation
Let $\mathbf F_{i\leftarrow j}$ be the force on particle $i$ due to particle $j$. Newton's second law and isolation give
$$
\frac{d\mathbf P}{dt}
=\sum_{i=1}^{N}\sum_{j\ne i}\mathbf F_{i\leftarrow j}
=\frac12\sum_{i=1}^{N}\sum_{j\ne i}
\left(\mathbf F_{i\leftarrow j}+\mathbf F_{j\leftarrow i}\right)
=\mathbf 0,
$$
where each unordered pair cancels by Newton's third law.
