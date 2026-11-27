---
title: "Work–energy theorem"
slug: work-energy-theorem
field: classical-mechanics
summary: "The net work on a constant-mass particle equals its change in kinetic energy."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [work, kinetic-energy, newtons-second-law] }
---
## Statement
For a point particle moving between times $t_1$ and $t_2$, the work done by the net force is
$$
W_{\mathrm{net}}=\int_{t_1}^{t_2}\mathbf F_{\mathrm{net}}\cdot\mathbf v\,dt
=\Delta T=T_2-T_1.
$$

## Assumptions
The particle has constant mass, the frame is inertial, $\mathbf F_{\mathrm{net}}$ is the total force, and the trajectory is piecewise smooth with nonrelativistic speed.

## Derivation
Newton's second law with constant mass gives
$$
\mathbf F_{\mathrm{net}}\cdot\mathbf v
=m\frac{d\mathbf v}{dt}\cdot\mathbf v
=\frac{d}{dt}\left(\frac12 m\,\mathbf v\cdot\mathbf v\right)
=\frac{dT}{dt}.
$$
Integration from $t_1$ to $t_2$ yields $W_{\mathrm{net}}=T_2-T_1$.
