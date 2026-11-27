---
title: "Conservation of mechanical energy"
slug: mechanical-energy-conservation
field: classical-mechanics
summary: "Mechanical energy T+U is constant when the total force is conservative and its potential is time independent."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [work-energy-theorem, potential-energy] }
---
## Statement
If the total force is conservative, $\mathbf F=-\nabla U$, then the mechanical energy
$$
E=T+U
$$
is constant along the motion: $E_2=E_1$. If nonconservative forces also act, the corresponding balance is $\Delta E=W_{\mathrm{nc}}$.

## Assumptions
Particle masses are constant, motion is referred to an inertial frame, and trajectories are piecewise smooth. Conservation requires the entire net force to be conservative with a time-independent $U$; $W_{\mathrm{nc}}$ is the work by all nonconservative forces in the extended balance.

## Derivation
The work–energy theorem and the potential-energy convention give
$$
\Delta T=W_{\mathrm{net}}=W_C=-\Delta U,
$$
so $\Delta(T+U)=0$. With an additional nonconservative contribution, $W_{\mathrm{net}}=W_C+W_{\mathrm{nc}}$ and hence $\Delta(T+U)=W_{\mathrm{nc}}$.
