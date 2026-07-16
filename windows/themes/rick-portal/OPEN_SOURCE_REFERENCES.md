# Animated portal references

The preview animation is an original, dependency-free implementation. No third-party source code or shader text is bundled in the theme. Its painted portal texture comes from the visual reference supplied by the user and is animated by the theme's original shader.

The design and architecture were informed by these open-source projects:

- [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT): GPU fluid motion, mobile-aware quality controls, and framebuffer-based effects.
- [mrdoob/three.js](https://github.com/mrdoob/three.js) (MIT): additive compositing and bloom/post-processing design patterns.
- [cglab-public/agenfk](https://github.com/cglab-public/agenfk) (ISC): a simple portal transition based on a rotating conic gradient. It was reviewed as a lightweight baseline, but its code is not used here.

The resulting theme uses a small custom WebGL2 fragment shader to combine a stable painted base with a slowly rotating, radially flowing liquid layer. The portal is presented as a subtle vertical ellipse and deliberately does not render separate particles, electrical arcs, or dashed rings. If WebGL2 is unavailable, a simple Canvas 2D radial glow keeps the background coherent without adding those details.
