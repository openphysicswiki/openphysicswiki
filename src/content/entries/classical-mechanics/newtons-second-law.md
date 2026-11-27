---
title: "Newton's second law"
slug: newtons-second-law
field: classical-mechanics
summary: "Newton's second law equates net external force to the time derivative of linear momentum in an inertial frame."
roles:
  newtonian: { type: axiom, foundational: true, dependencies: [newtons-first-law, linear-momentum] }
---
## Statement
Relative to an inertial frame, the net external force on a point particle satisfies
$$
\mathbf F_{\mathrm{net}}=\frac{d\mathbf p}{dt},
\qquad \mathbf p=m\mathbf v.
$$
For constant mass, this reduces to
$$
\mathbf F_{\mathrm{net}}=m\mathbf a.
$$

## Assumptions
The frame is inertial and $\mathbf F_{\mathrm{net}}$ includes every external force on the chosen particle. The reduction to $m\mathbf a$ requires $dm/dt=0$. A variable-mass open system also requires momentum-flux bookkeeping; the displayed point-particle equation alone does not supply it.
