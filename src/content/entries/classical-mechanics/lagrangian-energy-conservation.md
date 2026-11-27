---
title: "Conservation of energy in Lagrangian mechanics"
slug: lagrangian-energy-conservation
field: classical-mechanics
summary: "The Lagrangian energy function h is conserved when the Lagrangian has no explicit time dependence."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [euler-lagrange-equations, lagrangian] }
---
## Statement
Define the Lagrangian energy function
$$
h(q,\dot q,t)=\sum_{j=1}^{n}\dot q_jp_j-L,
\qquad p_j=\frac{\partial L}{\partial\dot q_j}.
$$
If $\partial L/\partial t=0$, then $dh/dt=0$ along every Euler–Lagrange solution. In general $h$ need not equal $T+U$. If, in addition, the constraints are stationary and $U=U(q)$ is velocity independent, then $h=T+U$.

## Assumptions
The Euler–Lagrange equations hold for $n$ independent coordinates, $L=T-U$ is $C^2$, and conservation uses $\partial L/\partial t=0$. For the sufficient identification $h=T+U$, additionally $\mathbf r_i=\mathbf r_i(q)$ and $U=U(q)$; then $T$ is homogeneous quadratic in the $\dot q_j$ and $U$ has no explicit time dependence.

## Derivation
Along a solution, the Euler–Lagrange equations imply $\dot p_j=\partial L/\partial q_j$. Therefore
$$
\begin{aligned}
\frac{dh}{dt}
&=\sum_j\left(\ddot q_jp_j+\dot q_j\dot p_j\right)
-\sum_j\left(\frac{\partial L}{\partial q_j}\dot q_j+\frac{\partial L}{\partial\dot q_j}\ddot q_j\right)
-\frac{\partial L}{\partial t}\\
&=-\frac{\partial L}{\partial t}=0.
\end{aligned}
$$
Under the additional conditions, $L=T-U$ and
$$
T=\frac12\sum_{j,k}M_{jk}(q)\dot q_j\dot q_k,
\qquad
\sum_j\dot q_j\frac{\partial T}{\partial\dot q_j}=2T,
\qquad
\frac{\partial U}{\partial\dot q_j}=0,
$$
so $h=2T-(T-U)=T+U$.
