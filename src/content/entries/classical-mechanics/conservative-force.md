---
title: "Conservative force"
slug: conservative-force
type: definition
field: classical-mechanics
foundational: true
dependencies: [work]
summary: "A conservative force does path-independent work between any two points in its domain."
---
## Statement
A force field $\mathbf F(\mathbf r)$ is conservative if, for every pair of points, its work is independent of the path joining them. Equivalently,
$$
\oint_C\mathbf F\cdot d\mathbf r=0
$$
for every closed path $C$. On a simply connected domain where $\mathbf F\in C^1$, this is also equivalent to $\nabla\times\mathbf F=\mathbf 0$.

## Assumptions
The force depends only on position in the specified frame, and all paths are piecewise smooth and lie in a common open connected domain in $\mathbb R^3$. The curl criterion additionally requires simple connectedness and continuous first derivatives.
