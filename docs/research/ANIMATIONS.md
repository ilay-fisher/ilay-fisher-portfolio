# Animation research (workstream R)

Date of research: 2026-11-18. Everything below was checked against primary sources on that date unless marked
**[unverified]**. Versions come from `npm view`, sizes were measured here (esbuild `--minify`, gzip -9, only the
classes we import, React/three externalised where noted), not copied from bundlephobia. Code is illustrative and
original; no code or assets from the reference designer.

Contract with the implementation workers: **WebGL2 only** (GLSL ES 3.00). No WebGL2 means the static fallback, never a
WebGL1 path. Every effect has a pure-TS core (maths, state machines, layouts) that is unit-tested in Vitest, and a thin
GL or canvas shell that is screenshot-tested in Playwright.

## 1. Summary

| Item | Technique | Library | Difficulty | Fallback |
|---|---|---|---|---|
| A Hero text paint | Canvas-2D text raster, CPU Euclidean distance transform (EDT) to a balloon height profile, capsule-stamped paint buffer (ping-pong, half-float) with decay and diffusion, damped-wave ripple, normals from height gradient, procedural matcap plus fresnel/spec | OGL | High | CSS gradient text with `background-clip:text` and text-shadow; same shader rendered once for reduced motion |
| B SafeSurf dissolve | One shared WebGL2 canvas over the mock page, one quad per `<img>`, baked-noise threshold with emissive edge, CPU-spawned ember points | OGL | Medium | CSS opacity/blur/scale swap to a "blocked" tile; instant swap for reduced motion |
| C Voronoi glass | Fragment-shader jittered-grid Voronoi, per-cell offset/refraction, IQ border distance for edges | OGL (same stage) | Medium | Static image with CSS cracks overlay (SVG) |
| D Drone grid | Canvas 2D, cached static layer, 40x24 `ImageData` heat layer scaled up, arc-length drone motion with critically damped follow | none | Medium | Not needed (2D canvas); reduced motion drops easing and flashes |
| E Before/after + heatmap | Stacked `<img>` with `clip-path: inset()`, native `input[type=range]` overlay, 320 px absdiff, blur, LUT colormap, SVG ROI boxes | none | Low-medium | Heatmap precomputed as a PNG if `getImageData` fails |
| F Motion system | GSAP (core + ScrollTrigger + SplitText) driven by Lenis | gsap, @gsap/react, lenis | Medium | Native scroll, content visible, no transforms |
| G WebGL layer | OGL behind a small `GlStage` wrapper | ogl | n/a | See H |
| H Robustness | DPR cap, IO pause, adaptive resolution, context-loss rebuild, font preload, Playwright hooks | none | n/a | n/a |

## 2. Recommended dependency list (foundation worker installs exactly this)

Runtime (`dependencies`):

| Package | Version | Licence | Measured min+gzip | Why |
|---|---|---|---|---|
| `ogl` | 1.0.11 | Unlicense | 14.5 KB (Renderer, Program, Mesh, Triangle, Texture, RenderTarget) | WebGL layer for A, B, C |
| `gsap` | 3.15.1 | GSAP Standard "no charge" licence | 48.4 KB (core + ScrollTrigger + SplitText) | Reveals, scroll triggers, split text, quickTo |
| `@gsap/react` | 2.1.2 | same GSAP licence | about 1 KB (not measured) | `useGSAP` cleanup under StrictMode |
| `lenis` | 1.3.27 | MIT | 6.1 KB with `lenis/react` | Smooth scroll |

Fonts, self-hosted (no runtime Google Fonts call, per AGENT_RULES section 3): pick one heavy rounded display face for
the inflated hero from `@fontsource-variable/fredoka` 5.3.0 (OFL-1.1), `@fontsource-variable/rubik` 5.3.0 (OFL-1.1) or
`@fontsource/archivo-black` 5.3.0 (OFL-1.1). The foundation worker owns the final choice in `docs/DESIGN.md`; the hero
needs weight 700+ with round terminals because thin strokes cannot inflate.

Dev dependencies: none beyond the foundation's own toolchain. `lil-gui` 0.21.0 (MIT) is optional for tuning, never
imported in production code.

**Do not install**: `three` (0.187.0, MIT, 132 KB gz for a minimal import set, measured), `@react-three/fiber` (9.8.2),
`motion` (14.14.0, 47.8 KB gz for `motion.div`, measured), `troika-three-text`, `html2canvas`, `html-to-image`,
`simplex-noise`, `split-type`, `pathfinding`. Reasons are in each section.

GSAP licence (checked at https://gsap.com/standard-license): free for commercial use, including the former members-only
plugins such as SplitText; the restriction is building a competing visual no-code animation tool, which does not apply.
Webflow announcement: https://webflow.com/blog/gsap-becomes-free. The npm `license` field reads "Standard 'no charge'
license", so licence checkers need an allow-list entry for GSAP (not SPDX).

## 3. A. Hero: real-time glossy text paint

### 3.1 How it works

The look is a height field, lit like a glossy surface. Letters are not geometry. A 2D scalar field `h(x,y)` says how
"inflated" each pixel is; normals come from its gradient; a matcap plus fresnel makes it read as balloon or clay.

Pass list per frame (all full-quad, all WebGL2, three persistent render targets):

| # | Pass | Reads | Writes | Notes |
|---|---|---|---|---|
| init | Text raster (CPU) | font | `textMask` | Canvas 2D `fillText`, word-wrapped, white on black |
| init | EDT (CPU, TS) | `textMask` | `profile` texture (R8) | Balloon profile of distance to edge; unit-testable |
| 1 | Stamp + decay + diffuse | `paintPrev`, pointer segments | `paintNext` (ping-pong) | R = paint amount |
| 2 | Ripple (damped wave) | `wavePrev`, `paintNext` | `waveNext` (ping-pong) | RG = height, previous height; optional |
| 3 | Height compose | `profile`, `paintNext`, `waveNext` | `height` (R16F or RGBA8) | `h = profile * smooth(paint) + ripple` |
| 4 | Shade to screen | `height`, `ramp`, matcap math | canvas | normals by 4 taps, lighting, dither |

Passes 2 and 3 can merge. Skip passes 1 to 3 entirely when the pointer is idle, the intro has finished and the buffers
have settled (render on demand; see H).

### 3.2 Text to texture: canvas 2D, not MSDF

Recommendation: rasterise with Canvas 2D `fillText` into a 2D canvas at CSS size (capped to 1280 px wide), then derive
the distance field yourself.

Why not MSDF (msdfgen, `msdf-bmfont-xml` 2.8.0, troika-three-text 0.53.1): MSDF exists to keep edges crisp at any scale
by sampling a distance texture in the final shader. Our final look is built from a blurred or inflated height, never
from a crisp edge, and the headline is one fixed string at one size per breakpoint. `troika-three-text` also needs
three.js. A canvas raster plus a CPU EDT is about 60 lines, has no runtime dependency, works with the page's own
webfont, and is testable without a GPU. Revisit MSDF only if the hero text must scale live (it does not).

Rules: `await document.fonts.load('800 64px "<Family>"')` **before** `fonts.ready`, because `ready` does not force a
font nobody has used yet to load (MDN: https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready ). Rasterise
again on resize (debounced 150 ms) and on font swap. Layout lines with a pure function
`layoutLines(words, maxWidth, measure)` so wrapping is unit-testable with an injected `measure`.

Keep the real text in the DOM: an `<h1>` with the headline, `color: transparent`, canvas `aria-hidden="true"`. Selectable,
SEO-visible, screen-reader-visible.

### 3.3 Mask to balloon height: CPU EDT

Felzenszwalb and Huttenlocher's linear-time squared EDT (two 1D passes with a lower envelope of parabolas) on the
inside of the mask gives `d` = distance to the nearest edge in pixels. Inflate with a circular cross-section so the
letters look round, not tent-shaped:

```ts
/** Balloon height in [0,1] from edge distance d and the stroke half-width R (pixels). */
export function balloon(d: number, R: number): number {
  const t = Math.min(d / R, 1);
  return Math.sqrt(1 - (1 - t) * (1 - t)); // quarter circle: steep at the edge, flat on top
}
```

Choose `R` about 0.6 of the thickest stroke half-width (measure from the EDT maximum), so thick strokes get a flat
plateau and thin strokes still bulge. Store the result as an 8-bit texture (R8, linear filter). Optional second channel:
unclamped normalised distance for colour banding. Run EDT at the sim resolution (not DPR). At 1280x400 this is a few
milliseconds in JS; run it once per resize, inside `requestIdleCallback` or a worker if it shows in profiles.
**[unverified timing]**; measure.

GPU alternative (jump flooding, about 11 passes once) is not needed because the text is static.

### 3.4 Pointer trail accumulation (pass 1)

Stamp a capsule (segment `p0 -> p1` with radius `r`) per pointer move, never a point, otherwise fast strokes leave gaps
of dots. Uniforms: `uP0, uP1` (UV, aspect-corrected), `uRadius`, `uStrength`, `uActive`.

```glsl
#version 300 es
precision highp float;
uniform sampler2D uPrev;         // RG: paint, spare
uniform vec2 uTexel, uP0, uP1;   // uP in texel-aspect space (x scaled by aspect)
uniform float uRadius, uStrength, uDecay, uDiffuse, uAspect;
in vec2 vUv; out vec4 o;

float capsule(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float c = texture(uPrev, vUv).r;
  // cheap diffusion: blend toward the 4-neighbour mean (wet paint bleeding)
  float n = 0.25 * (texture(uPrev, vUv + vec2(uTexel.x, 0.0)).r + texture(uPrev, vUv - vec2(uTexel.x, 0.0)).r
                  + texture(uPrev, vUv + vec2(0.0, uTexel.y)).r + texture(uPrev, vUv - vec2(0.0, uTexel.y)).r);
  c = mix(c, n, uDiffuse);                       // 0.15 to 0.35
  c = max(c * uDecay - 0.0015, 0.0);             // multiplicative plus a constant, see pitfall
  float d = capsule(p, uP0, uP1);
  float brush = uStrength * smoothstep(uRadius, 0.0, d);   // soft brush
  o = vec4(clamp(max(c, brush), 0.0, 1.0), 0.0, 0.0, 1.0);
}
```

Pitfall (applies to any 8-bit trail buffer): `c * 0.99` in RGBA8 never decays below about 0.4 because the product rounds
back to the same byte. Use a constant subtraction, or a half-float target. Prefer RGBA16F; fall back to RGBA8 with
subtractive decay only.

Fluid-ish spreading, cheapest first (pick tier 1 for v1):

1. **Decay plus diffusion** (above). No velocity. Looks like wet paint, costs one pass.
2. **Add advection** by a low-res velocity field (semi-Lagrangian: sample paint at `uv - v*dt`) where `v` is written by the
   same capsule stamp with the pointer velocity. OGL ships this as `Flowmap` (options `size`, `falloff`, `alpha`,
   `dissipation`) with a worked example, https://tympanus.net/codrops/2019/09/25/mouse-flowmap-deformation-with-ogl/ .
   Use its velocity texture to offset the paint lookup.
3. Full Navier-Stokes (divergence, pressure Jacobi iterations, vorticity): Pavel Dobryakov's MIT project is the
   reference, https://github.com/PavelDoGreat/WebGL-Fluid-Simulation . Not recommended here: 20+ passes, float targets,
   and the "glossy" look comes from the shading, not the fluid.

Reveal semantics: `paint` is how inflated each pixel is allowed to be. Text with zero paint is a flat, matte "rest"
layer at 12 percent height, so the hero is never empty even before the first stroke and after full decay.

### 3.5 Ripple (pass 2, optional but cheap)

A damped 2D wave gives the jelly wobble where the cursor passes. State in RG16F: `h` and `hPrev`.
`hNext = 2h - hPrev + c2 * (laplacian(h)) - damping*(h - hPrev)`, forced by `paint` change. Keep `c2 <= 0.25` for
stability on a 4-neighbour Laplacian. Inject `uStrength * capsule` into `h` with the same stamp.

### 3.6 Height compose and normals (passes 3 and 4)

```glsl
// pass 3
float base  = mix(0.12, 1.0, smoothstep(0.0, 0.6, paint)) * profile;   // rest 12 percent, painted up to 100
float h = base + 0.35 * wave;                                           // wave in [-1,1] scaled

// pass 4: central differences on the composed height (sampled as a texture)
float hl = texture(uH, vUv - vec2(uTexel.x,0.)).r, hr = texture(uH, vUv + vec2(uTexel.x,0.)).r;
float hd = texture(uH, vUv - vec2(0.,uTexel.y)).r, hu = texture(uH, vUv + vec2(0.,uTexel.y)).r;
vec3 n = normalize(vec3((hl - hr) * uBump, (hd - hu) * uBump, 1.0));     // uBump 6 to 14 for the inflated look
```

Smooth `profile` slightly (single 3x3 tent blur in pass 3) so the 8-bit stair-stepping does not show as banded normals.

### 3.7 Glossy shading, matcap and fresnel, no assets

Generate a **matcap in code** (a 256x256 canvas with radial gradients and a softbox highlight) and sample at
`n.xy*0.5+0.5`, or evaluate analytically:

```glsl
vec3 V = vec3(0.0, 0.0, 1.0);
vec3 L1 = normalize(vec3(-0.5, 0.7, 0.6)), L2 = normalize(vec3(0.6, -0.3, 0.5));
float diff = 0.55 + 0.45 * dot(n, L1);                       // wrapped diffuse
float spec = pow(max(dot(n, normalize(L1 + V)), 0.0), 90.0)  // tight key highlight
           + 0.5 * pow(max(dot(n, normalize(L2 + V)), 0.0), 40.0);
float fres = pow(1.0 - max(n.z, 0.0), 3.0);                  // rim
vec3 env  = texture(uMatcap, n.xy * 0.5 + 0.5).rgb;          // studio reflection
// colour ramp from a 256x1 LUT: index by height and a touch of normal tilt
vec3 albedo = texture(uRamp, vec2(clamp(h * 0.9 + 0.1 * (1.0 - n.z), 0.0, 1.0), 0.5)).rgb;
vec3 col = albedo * diff + env * (0.25 + 0.6 * fres) + vec3(1.0) * spec;
col *= mix(0.55, 1.0, smoothstep(0.0, 0.25, h));             // fake AO in the crevices
float a = smoothstep(0.02, 0.06, h);                          // soft silhouette
col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;               // dither to kill banding on dark gradients
```

Colour ramp: orange to pink to yellow stops drawn into a 256x1 canvas with `createLinearGradient`; stops come from
`src/styles/tokens.css` so the palette stays in one place. Reference style is only "glossy inflated paint"; do not copy
his palette values or timing.

### 3.8 Intro stroke, pointer and touch

- Intro: a scripted path (3 to 4 Catmull-Rom points sweeping each text line left to right, 2.0 to 2.6 s, `power2.inOut`)
  feeds the same `stamp(p0,p1)` API as the pointer. Generate it with a pure function `introPath(lines, t)`; unit-test
  that coverage of all line boxes is above 95 percent when integrated.
- Pointer: listen on the hero section, not the canvas. Use `pointermove` and, when
  `PointerEvent.prototype.getCoalescedEvents` exists, iterate coalesced events for smooth capsules (feature-detect; not
  verified on every Safari version).
- Touch: canvas gets `touch-action: pan-y` so vertical scroll keeps working; horizontal drags paint; a tap stamps a
  splat. Setting `touch-action: none` over a full-viewport hero would trap scrolling on phones.
- Idle: after 4 s without input, a slow ambient wander stroke (low strength) keeps the surface alive; stop when the hero
  leaves the viewport.

### 3.9 Parameters worth tuning

`uRadius` 0.035 to 0.06 of hero height; `uDiffuse` 0.15 to 0.35; decay 0.995 to 0.9985 (about 2 to 8 s half-life at 60 FPS);
`uBump` 6 to 14; matcap strength; spec exponent 60 to 120; wave `c2` 0.15 to 0.25 and damping 0.01 to 0.03; sim scale
1.0 down to 0.5 (adaptive, see H).

### 3.10 Fallbacks

- No WebGL2 or context creation throws: show the `<h1>` with CSS `background: linear-gradient(...)`, `-webkit-background-clip:text`,
  heavy `text-shadow` and an `inset` highlight faked via a pseudo-element. Log `warn`.
- `prefers-reduced-motion: reduce`: run the intro to completion offline (call stamp N steps without presenting), render
  **one** frame, stop the loop, no pointer painting. If float targets are unavailable, still works (RGBA8).
- Context lost: show the CSS fallback immediately, rebuild everything on `webglcontextrestored` (H).

### 3.11 Tests

Vitest: `edt()` against brute force on random 32x32 masks; `balloon()` monotonic and bounded; `layoutLines()`; `introPath()`
coverage; capsule distance CPU twin matches expected values; decay function never sticks above 0 for RGBA8 mode (simulate
byte quantisation). Playwright: `data-ready`, then screenshot reduced-motion static frame; then `page.mouse.move` across
the hero, wait N frames (`data-frame`), screenshot, expect visible change.

### 3.12 Sources

OGL Flowmap and trail tutorials: https://tympanus.net/codrops/2019/09/25/mouse-flowmap-deformation-with-ogl/ ,
https://tympanus.net/codrops/2019/09/24/crafting-stylised-mouse-trails-with-ogl/ . Fluid reference:
https://github.com/PavelDoGreat/WebGL-Fluid-Simulation . iOS float target limits: WebKit bug 247240 and 216010
(https://bugs.webkit.org/show_bug.cgi?id=247240). I found no single write-up of the exact "inflated text" look; the
height-field plus normals plus matcap pipeline above is assembled from standard techniques, and the EDT-balloon profile
is my own choice **[no external source; validate visually]**.

## 4. B. Dissolve / burn for the SafeSurf mock page

### 4.1 Recommendation

Route 1 (WebGL), **one shared canvas for the whole mock page**, not one canvas per image. Reason: context budget (see G)
and one render loop. Route 2 (CSS/SVG) only as the fallback.

### 4.2 Route 2 assessment (why not primary)

- `mask-image` with a noise image: the mask is static; changing the threshold needs a filter (`contrast()` trick) or
  per-frame regeneration. Not a clean animated threshold.
- `filter: url(#f)` with `feTurbulence` -> `feColorMatrix` -> `feComponentTransfer` -> `feComposite` /
  `feDisplacementMap`: works, but the filter is recomputed on the CPU whenever you change an attribute per frame, for each
  image, and Safari has a long history of filter-on-HTML bugs. **[not benchmarked here]**. No ember particles, edge
  glow needs extra morphology passes.
- `@property` (registered custom properties) animates a `<number>` smoothly in CSS, which gives a good progress driver
  (`@property --p { syntax:'<number>'; inherits:false; initial-value:0 }`) for gradient-mask wipes, not for noise.
- Use it only for the fallback: `opacity`, `filter: blur() saturate()` and `transform: scale()` transition (200 to 450 ms)
  from the image to the "blocked" tile.

### 4.3 Route 1 pipeline

1. `DissolveStage` owns one OGL renderer, `premultipliedAlpha: true`, `alpha: true`, absolutely positioned over the mock
   page with `pointer-events: none`.
2. For each registered `<img>` (bundled, same origin, so no tainting) create a texture from `await img.decode()` then
   upload; create a quad sized by `getBoundingClientRect()` relative to the stage; recompute on `ResizeObserver`.
3. Hide the DOM `<img>` (`opacity:0`, keep it for layout, alt text and fallback) only after the first successful frame.
4. Per image state machine (pure TS, unit tested): `intact -> burning -> gone -> forming -> intact`, with progress `p`
   in [0,1] tweened by GSAP (`power2.inOut`, 0.9 to 1.4 s) or by a `smoothDamp` function. Re-form reverses `p` and swaps
   the edge palette to cool teal so "allowed" reads differently from "blocked".
5. Noise: **bake it once** into a 256x256 tileable single-channel texture (fbm of value noise, generated in TS) and use
   it from both GLSL and the TS particle spawner. Benefits: no per-pixel octave loops (cheap on mobile), no
   `fract(sin())` hash precision problems on `mediump`, and one source of truth for where the burn front is.
6. Video thumbnails: use still frames plus a CSS play badge. Streaming a `<video>` into a texture costs an upload per
   frame per tile; avoid unless one tile plays at a time.

### 4.4 Fragment shader sketch

```glsl
#version 300 es
precision highp float;
uniform sampler2D uImg, uNoise;       // uNoise: baked fbm, 0..1
uniform float uP, uTime, uEdge;       // uP 0..1 burn progress, uEdge ~0.06
uniform vec2 uOrigin;                 // where the burn starts (0..1)
uniform vec3 uHot, uMid, uChar;       // yellow-white, orange, dark brown
in vec2 vUv; out vec4 o;
void main() {
  vec4 img = texture(uImg, vUv);
  float n  = texture(uNoise, vUv * 1.7 + 0.03 * uTime).r;
  float dir = distance(vUv, uOrigin) * 0.55;               // burns outward from the origin
  float f  = clamp(n * 0.6 + dir, 0.0, 1.0);               // 0 burns first
  float d  = f - mix(-uEdge * 2.0, 1.0 + uEdge * 2.0, uP); // < 0 burnt, > 0 alive
  float alive = step(0.0, d);
  float band  = 1.0 - smoothstep(0.0, uEdge, abs(d));       // glow on both sides of the front
  float chr   = 1.0 - smoothstep(0.0, uEdge * 3.0, max(d, 0.0)); // char just inside the front
  vec3 col = mix(img.rgb, uChar, chr * 0.85);
  vec3 glow = mix(uMid, uHot, band * band) * band * 1.6;
  // premultiplied: alpha only where the image is alive, glow is additive (alpha 0, rgb > 0 is legal)
  o = vec4(col * alive * img.a + glow, alive * img.a);
}
```

Blend state: `ONE, ONE_MINUS_SRC_ALPHA`. Pad each quad by 24 px so the glow can spill past the image rectangle.

### 4.5 Embers

CPU pool of 200 to 400 particles drawn as one `gl.POINTS` mesh (OGL `Mesh` with `mode: gl.POINTS`), additive blending.
Each frame, spawn 2 to 6 per burning image by sampling random texels of the baked noise array and accepting those where
`|f - front| < uEdge`; give them an upward velocity with sideways noise, life 0.6 to 1.4 s, size shrinking, colour from
the ramp. Pure TS `EmberPool` (spawn, step, cull) is unit-testable with a seeded RNG.

### 4.6 HTML in Canvas: status as of 2026-11-18

- **Shipped in Chrome 157 stable** (Chrome post dated 26 Oct 2026; the Register reports Chrome 157 shipping and a WHATWG
  submission, 16 Nov 2026). Sources: https://developer.chrome.com/blog/html-in-canvas ,
  https://developer.chrome.com/docs/web-platform/html-in-canvas/concepts ,
  https://www.theregister.com/devops/2026/11/16/html-in-canvas-ships-and-could-make-the-web-a-lot-more-creativeand-a-lot-stupider/5310135 .
- **API names changed**, so ignore older tutorials. Origin trial (Chrome 148 to 150/151): `<canvas layoutsubtree>`,
  `texElementImage2D`. Chrome 157: `<canvas content="drawable">`, `drawable` attribute on every drawn child
  (missing it throws `InvalidStateError` inside the paint handler), `paint` event plus `canvas.requestPaint()`,
  `ctx.drawElementImage(el, x, y)`, WebGL `gl.texElementSubImage2D(target, level, xoff, yoff, el)` (texture must be
  pre-allocated with `texImage2D`; `texElementImage2D` removed), `canvas.updateElementGeometry(el, {canvasTransform})`
  for hit-testing and accessibility in 3D. Rename details come from the third-party but detailed
  https://html-in-canvas.dev/docs/api-reference/ **[secondary source; check against Chrome docs before coding]**.
- Feature test (Chrome's own): create a canvas, `setAttribute('content','drawable')`, check `canvas.content === 'drawable'`.
- **Not in Firefox or Safari**: no implementation or announced work, Mozilla has no published position
  (https://html-in-canvas.dev/docs/browser-support/ , third-party, matches The Register). Edge follows Chromium.
- Verdict: **do not depend on it.** Using it would make the demo Chromium-only. We control the mock page, so real `<img>`
  textures give the identical burn without capturing DOM. If someone wants a stretch goal ("burn the whole mock card"),
  gate it behind the feature test and keep the `<img>` route as the default. Fallback libraries named by Chrome itself:
  `html2canvas` 1.4.1 (MIT, no release since 2022 **[version date unverified]**), `html-to-image` 1.11.13 (MIT);
  SVG `foreignObject` rasterisation is the underlying trick and taints/blocks external resources, so avoid.

### 4.7 Pitfalls and tests

Premultiplied alpha mismatch gives dark halos; `decode()` before upload; set `UNPACK_FLIP_Y_WEBGL` (OGL `flipY`) once;
textures above 2048 px on mobile cost memory, downscale thumbnails to 1.5x display size; context budget. Tests: state
machine transitions (including interrupt mid-burn reversing from the current `p`), `EmberPool`, noise bake determinism,
Playwright: toggle filter, wait for `data-state="gone"` on tile, screenshot at `p=0.5` using a debug query param that
freezes `p`.

Sources: Codrops dissolve with particles https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/ ,
reveal shader https://tympanus.net/codrops/2024/12/02/how-to-code-a-shader-based-reveal-effect-with-react-three-fiber-glsl/ .

## 5. C. Shattered / Voronoi glass panel (sketch)

Technique: jittered grid Voronoi in the fragment shader. For each pixel, scan the 3x3 neighbouring cells, keep the
nearest feature point (`F1`) and its cell id; run a second pass over the 3x3 to get the exact distance to the nearest
border (Inigo Quilez, https://iquilezles.org/articles/voronoilines/ : plain `F2-F1` is not a true distance, the
two-pass version is). Cost is about 18 hash evaluations per pixel, fine for a single panel.

```glsl
// uint hash keeps this exact on mediump-hostile GPUs (WebGL2 supports integers)
uvec2 pcg2(uvec2 v){ v = v*1664525u + 1013904223u; v.x += v.y*1664525u; v.y += v.x*1664525u;
  v ^= v >> 16u; v.x += v.y*1664525u; v.y += v.x*1664525u; return v ^ (v >> 16u); }
vec2 rnd(vec2 c){ return vec2(pcg2(uvec2(ivec2(c) + 4096))) * (1.0/4294967295.0); }

// returns: xy = cell centre, z = border distance, w = cell hash
vec4 voronoi(vec2 x){
  vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.0;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = vec2(i,j), r = g + rnd(n+g)*0.9 - f; float d = dot(r,r);
    if (d < md){ md = d; mr = r; mg = g; } }
  md = 8.0;
  for (int j=-2;j<=2;j++) for (int i=-2;i<=2;i++){
    vec2 g = mg + vec2(i,j), r = g + rnd(n+g)*0.9 - f;
    if (dot(mr-r,mr-r) > 1e-5) md = min(md, dot(0.5*(mr+r), normalize(r-mr))); }
  return vec4(x + mr, md, rnd(n+mg).x);
}
// per pixel: cell = voronoi(uv*scale); dir = (rnd tilt per cell) ; offset = dir*uShatter*ease(uImpactWave(cell))
// colour = texture(uBg, uv + offset*0.04 + (pointer-cell)*0.01*uShatter);   // refraction-like shift
// edge  = 1.0 - smoothstep(0.0, 0.03, cell.z);  col += edge * vec3(0.8,0.9,1.0) * (0.4 + 0.6*fresnel);
```

Behaviour: crack front travels from an impact point, each cell breaks when `distance(cellCentre, impact) < radius(t)`;
unbroken cells keep zero offset so the panel stays coherent; broken cells ease out (`expo.out`, 0.5 s) and can reform in
reverse. 18 to 30 cells across the long axis. Use the same `GlStage` as B if both sections ever share a stage; otherwise
a third lazy context (budget fine, see G). Fallback: static image with an SVG crack overlay. Reduced motion: show the
shattered frame statically. Sources: IQ above; Book of Shaders cellular noise https://thebookofshaders.com/12/ .

## 6. D. Grid pathfinding in Canvas 2D (drone)

### 6.1 Layers and drawing

Three canvases stacked in one wrapper, all sized `cssW*dpr` by `cssH*dpr`, `ctx.setTransform(dpr,0,0,dpr,0,0)`:

| Layer | Redraw when | How |
|---|---|---|
| `bg` | resize | grid lines and background, cached; one `drawImage` from an offscreen canvas |
| `heat` | search steps reveal | 40x24 `ImageData` (960 px) filled from a `Uint8Array` via a 256-entry colour LUT, `putImageData` to a 40x24 offscreen canvas, then one `drawImage` scaled up with `imageSmoothingEnabled = false` (or true with a blur for a soft look). One draw call instead of 960 `fillRect` |
| `fg` | each animated frame | obstacles (dirty cells only), path polyline, drone, flash |

- Snap the cell size to an integer number of **device** pixels: `cell = Math.floor(cssW*dpr/40)`, centre the grid, draw
  1 px lines at `+0.5` offsets. Prevents blurry lines at fractional DPR (1.25, 1.5).
- Drive the loop with `useRafLoop` and a dirty flag: no animation active means no frames. Pause off-screen.
- Heat: `Uint8Array heat[960]`, set to 255 when a cell is expanded, decay `*= 0.985` per frame on a time basis;
  colour from an inferno-like 6-stop LUT built once. Reveal search order progressively at 1 expansion per 6 to 10 ms from
  the planner's recorded `expansionOrder` so the viewer sees it think; the planner itself runs synchronously (960
  cells is microseconds).

### 6.2 Path and drone motion

- Plan on the grid (A* with 8-neighbour and octile heuristic, D* Lite for incremental). Pure TS, no DOM, tested against
  known grids and for re-plan equivalence with a fresh A* on random obstacle edits.
- Display smoothing: Chaikin corner cutting (2 iterations) of the polyline for the drawn path; the plan stays on cells.
- Drone follows by arc length: precompute cumulative lengths `s[i]`; keep `s_drone` and a lookahead `s_target = s_drone + L`.
  Use critically damped follow `smoothDamp(current, target, velocity, smoothTime ~0.18, maxSpeed)` rather than
  time-parametrised tweens: on **re-plan** the drone keeps its position and velocity and just receives a new path, so
  there is no teleport or restart ease. Heading: lerp the angle along the shortest arc (`atan2(sin d, cos d)`).
- Re-plan flash: new obstacle cell scales 1.5 to 1 with `expo.out` in 280 ms and fills red; the old path fades
  (`globalAlpha` 1 to 0 over 250 ms) in red while the new path draws in via `setLineDash([len, len])` with
  `lineDashOffset` going `len -> 0` (500 ms, `power2.out`). Reduced motion: no scale, no draw-in, instant swap, keep a
  short colour change for the information.
- Pre-render the drone sprite once to an offscreen canvas at device scale; per frame `drawImage` with rotate.

### 6.3 Obstacle placement by drag

Pointer events with `setPointerCapture`; convert to cell with the snapped geometry; the first cell decides paint or erase
(toggle) for the whole drag; fill the gap between consecutive pointer samples with Bresenham so fast drags leave no holes;
re-plan once per animation frame at most (coalesce). Keyboard: arrow keys move a focus cell, Space/Enter toggles an
obstacle, with `aria-live="polite"` status ("path found, 38 steps" or "no path"). Touch: `touch-action: none` on the grid
steals page scroll on phones; add an explicit "Draw / Scroll" toggle on touch devices instead of always capturing.

Sources: MDN canvas optimisation https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas ;
Red Blob Games grid pathfinding (A*, heuristics) https://www.redblobgames.com/pathfinding/a-star/introduction.html
**[URL not fetched here; well-known]**.

## 7. E. Before/after split slider with heatmap (X-Ray)

### 7.1 Compositing choice

| Option | Verdict |
|---|---|
| `clip-path: inset(0 0 0 var(--split))` on the top `<img>` | **Use.** Supported everywhere, no extra canvas, crisp. Repaints, fine for one image pair |
| `mask-image` gradient | Same cost, more verbose, only needed for soft edge |
| Canvas compositing | Only if the heat layer must be blended with a mode not available in CSS |
| Counter-translate trick (overflow hidden wrapper) | Compositor-only, use if profiling shows paint cost on low-end phones |

Update `--split` from the input's `input` event inside `requestAnimationFrame` (coalesce), not on every event.

### 7.2 Accessibility pattern

Use a **native `<input type="range" min=0 max=100 step=1>`** stretched over the image (`opacity:0`, full size, 44 px
thumb, `touch-action: pan-y`) and draw the visible handle yourself from its value. A native range has the implicit
`slider` role, full keyboard support (arrows, Home, End, PageUp/PageDown), touch and screen-reader announcements for
free, and track clicks jump. Give it `aria-label="Compare original and heatmap"` and `aria-valuetext` such as
"Heatmap shows on the right, 60 percent". Visible focus: style the handle with `:has(input:focus-visible)`.

If a custom `role="slider"` element is required instead: `tabindex=0`, `aria-valuemin/max/now`, `aria-valuetext`,
`aria-orientation="horizontal"`; Left/Down -1, Right/Up +1, PageUp/PageDown +10, Home 0, End 100; pointer capture on
`pointerdown`, update on `pointermove`, release on `pointerup`/`pointercancel`; the container keeps `touch-action: pan-y`.
Reference: WAI-ARIA Authoring Practices slider pattern https://www.w3.org/WAI/ARIA/apg/patterns/slider/ **[URL not fetched here]**.

### 7.3 Client-side diff heatmap

```ts
/** Perceptual-ish difference in [0,1] for two RGBA pixels. */
export function pixelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, i: number): number {
  const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
  return (0.3 * dr + 0.59 * dg + 0.11 * db) / 255;
}
```

Pipeline (pure TS functions on typed arrays, so it is unit-testable in Vitest with synthetic buffers):

1. Draw both images to two offscreen canvases at about 320 px wide (same aspect). `drawImage` does the resample and
   anti-alias for free. Use `getContext('2d', { willReadFrequently: true })`.
2. `getImageData` both (bundled same-origin images, no tainting). `diff[i] = pixelDiff(...)`.
3. Two separable box blurs, radius 3 to 5 px at 320 wide (close to Gaussian), into a `Float32Array`.
4. Normalise by the 99th percentile, not the max (one hot pixel must not flatten everything), then `v = pow(v, 0.7)`.
5. Colormap with a 256-entry LUT built from 6 to 7 hand-picked stops (inferno-like: near-black, purple, red-orange,
   yellow). Interpolate linearly; alpha `smoothstep(0.12, 0.45, v)` so near-zero difference stays transparent.
6. `putImageData` into a small canvas, display it scaled up (`image-rendering: auto`) and `mix-blend-mode: screen` or
   plain alpha. Cost at 320x200 is a few ms **[not measured]**; run once at load, not per slider move.

Compute lazily the first time the section scrolls into view. If the inputs ever come from user uploads, they would
need CORS handling; for bundled assets they do not. Use a precomputed PNG as fallback if `getImageData` throws.

### 7.4 ROI boxes and streamed diagnosis

- ROI boxes: SVG overlay with `viewBox` = image natural size, `preserveAspectRatio` matching the image, `<rect pathLength="1"
  stroke-dasharray="1" stroke-dashoffset="1" vector-effect="non-scaling-stroke">`; animate `stroke-dashoffset 1 -> 0`
  (GSAP, 450 ms, stagger 120 ms) when the slider first passes 15 percent or the section enters view. Labels fade after.
  Reduced motion: boxes appear instantly.
- Streaming text: pure function `streamPlan(text, { cps: 38, jitter: 0.4, punctuationPause: 160 })` returns
  `[{ at: ms, upTo: charIndex }]` in 2 to 4 char chunks so it feels token-streamed; the component walks the plan with
  rAF. Mark the live text `aria-hidden` while typing and put the full sentence in a visually-hidden element with
  `role="status"` revealed once, so screen readers do not receive one announcement per chunk. Caret via CSS blink.
  Reduced motion: render full text immediately. Unit-test monotonic timing, last chunk equals full text.

## 8. F. Page-level motion system

### 8.1 Recommendation (one approach)

**Lenis 1.3.27 for scrolling plus GSAP 3.15.1 (core, ScrollTrigger, SplitText) for everything that animates**, wired
through `@gsap/react`. Hand-written code for the cursor, magnet and grain. No Motion for React, no CSS scroll timelines,
no View Transitions in v1.

Why: GSAP is now free for commercial use including SplitText (checked above), one timeline and ticker for every scroll
and reveal effect, and the line-mask split is the single most reused effect in this design. Motion for React duplicates it
and costs 47.8 KB gz for `motion.div`.

Native alternatives, for the record:

- **CSS scroll-driven animations** (`animation-timeline: view()`): web-features lists "Newly available" since 2026-10-27
  (Chrome/Edge 115, Safari 26, Firefox 159)
  https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations ; MDN marks `view()` Baseline
  2026. Great for simple parallax with zero JS, but you cannot mix it with SplitText line masks, timelines or the
  Lenis smoothed position consistently, and old Firefox/Safari installs will not run it. Keep it as a v2 enhancement
  for trivial effects behind `@supports (animation-timeline: view())`.
- **View Transitions API**: same-document transitions are Baseline newly available since Firefox 144 (Oct 2025);
  Safari 18.4 per Chrome's post https://developer.chrome.com/blog/view-transitions-in-2025 **[Safari threshold differs
  between sources: 18 vs 18.4]**. A one-page site has no route change to animate; reserve it for an optional theme
  toggle crossfade, wrapped in `if (document.startViewTransition && !reduced)`.

### 8.2 Wiring (React + Lenis + GSAP)

```tsx
// src/components/SmoothScroll.tsx (foundation owns)
import 'lenis/dist/lenis.css';
import { ReactLenis, type LenisRef } from 'lenis/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useEffect, useRef } from 'react';

gsap.registerPlugin(ScrollTrigger, SplitText);
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<LenisRef>(null);
  useEffect(() => {
    const tick = (t: number) => ref.current?.lenis?.raf(t * 1000);   // GSAP time is seconds
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ref.current?.lenis?.on('scroll', ScrollTrigger.update);
    return () => gsap.ticker.remove(tick);
  }, []);
  return <ReactLenis root ref={ref} options={{ autoRaf: false, anchors: true, lerp: 0.1 }}>{children}</ReactLenis>;
}
```

Lenis facts (README, https://github.com/darkroomengineering/lenis ): `respectReducedMotion` defaults to true (smoothing
off, programmatic scrolls jump); anchor links need `anchors: true` or `scrollTo`; `position: sticky` keeps working
because Lenis drives native scroll; `position: fixed` can lag on pre-M1 Safari; CSS scroll-snap is unsupported; nested
scrollers need `data-lenis-prevent`; Safari caps rAF at 60 FPS (30 in low-power mode). Import `lenis/dist/lenis.css`.

Nav links must use `lenis.scrollTo('#drone', { offset: -72 })` or anchors mode, and update `location.hash` with
`history.replaceState` so deep links work after reload.

### 8.3 Reveals and split text

- Registry attribute: `data-reveal="up|fade|lines|chars"` on elements; one `useGSAP` hook per section scans its scope
  and builds triggers. Default: `y: 24`, `opacity: 0`, 0.7 s, `expo.out`, `start: 'top 85%'`, `once: true`.
- Line reveal: `SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, onSplit(self){ return gsap.from(self.lines, {yPercent:110, duration:.8, stagger:.08, ease:'expo.out'}) } })`.
  SplitText adds `aria-label` on the parent and `aria-hidden` on pieces by default; for nested links use `aria: 'none'`
  plus a visually hidden copy. Run after `await document.fonts.ready`; `autoSplit` re-splits on width change and re-syncs the
  returned tween. Docs: https://gsap.com/docs/v3/Plugins/SplitText/ .
- Initial hidden state: set it in CSS under `html.js:not(.reduce-motion) [data-reveal]{opacity:0}` and add the classes
  in an inline script, so content is visible if JS fails and never flashes when it works.
- `useGSAP({ scope })` reverts animations on unmount, which fixes React StrictMode double invoke
  (https://gsap.com/resources/React/ ). Wrap handlers in `contextSafe`.
- Call `ScrollTrigger.refresh()` after fonts and hero images settle; set `ScrollTrigger.config({ ignoreMobileResize: true })`.
- Reduced motion: `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` builds animations; the `reduce`
  branch just removes the hidden state (or a 150 ms opacity fade). Lenis already disables smoothing.

### 8.4 Cursor, magnet, grain, transitions

- **Custom cursor**: only under `(hover: hover) and (pointer: fine)`. Keep the native cursor (no `cursor: none`); add a
  12 px ring that follows with `gsap.quickTo(ring, 'x', {duration:.35, ease:'power3'})`, grows over links and buttons
  (`[data-cursor]`), `pointer-events: none`, `mix-blend-mode: difference`. Hidden for touch and reduced motion.
- **Magnetic buttons**: `pointermove` within `rect.inflate(40px)` -> `quickTo` x,y at 0.25 to 0.35 of the offset, clamp 12 px,
  `pointerleave` -> `elastic.out(1, 0.4)`. Move an inner span, not the focusable element, so hit boxes and focus rings do
  not jitter. Disable on coarse pointers and reduced motion.
- **Film grain**: one fixed `::before` with a 200x200 tile from an inline SVG `feTurbulence` data URI as the background
  (rasterised once), `opacity: .05 to .08`, `pointer-events: none`. Animate by stepping `background-position` with
  `steps(6)` at about 8 FPS in CSS, not by JS. Avoid `mix-blend-mode` on a fixed full-screen layer (forces extra
  compositing on scroll). Static under reduced motion.
- **Section transitions**: no pinning. A ScrollTrigger scrubbed tween (`scrub: 0.6`) writes `--bg-shift` on `:root` to tint
  the background between sections; headings use line reveals. If sticky stacking is wanted, use CSS `position: sticky`
  (it works under Lenis).

## 9. G. WebGL layer choice

| | Raw WebGL2 | **OGL 1.0.11** | three 0.187.0 | react-three-fiber 9.8.2 |
|---|---|---|---|---|
| Measured min+gz | 0 plus about 300 lines of our own helpers | **14.5 KB** | 132 KB (minimal import set) | three plus reconciler (not measured, larger) |
| Licence | n/a | Unlicense | MIT | MIT |
| Types | built-in DOM types | ships `types/` | ships | ships |
| Fit for 2 to 3 independent full-quad canvases | fine, verbose | **ideal** | oversized | oversized, React reconciler per canvas |
| Utilities we use | none | `RenderTarget`, `Triangle`, `Flowmap`, `GPGPU`, `Post` | many | many |
| Context loss | manual | manual (none built in) | manual (`WebGLRenderer` has events) | manual |
| Testability | thin shell if we wrap it | thin shell if we wrap it | heavy mocks | heavy mocks |

**Recommendation: OGL**, wrapped by our own `GlStage` (about 80 lines) so the rest of the code never imports OGL
directly (swap to raw later without touching effects). Facts verified from the installed package: `sideEffects: false`
(tree-shakes), `Renderer` options `dpr`, `alpha`, `premultipliedAlpha` (default **false**), `preserveDrawingBuffer`
(default false), `powerPreference` (default `'default'`, set `'high-performance'` for the hero), `webgl` (default 2).
**Gotcha**: with `webgl: 2` OGL silently falls back to WebGL1 if WebGL2 is unavailable and logs via `console.error`; our
GLSL is ES 3.00, so gate on `isWebGLAvailable()` (WebGL2 check, owned by `src/lib/webgl.ts`) before constructing and
verify `renderer.isWebgl2`. Float render targets: OGL enables `EXT_color_buffer_float` and `OES_texture_float_linear`
on WebGL2 when present; still verify the framebuffer is complete.

Context budget: browsers cap live contexts (reports: about 16 on desktop Chrome and Safari, 8 on some Android, Firefox much
higher; Chrome and Safari log "too many active WebGL contexts, the oldest context will be lost").
Sources: https://bugzilla.mozilla.org/show_bug.cgi?id=1748592 and community reports **[no official number published;
treat as approximate]**. Our plan is 3 contexts (hero, SafeSurf stage, optional Voronoi), well under the cap. Rules:
create lazily when the section is within 1 viewport (IntersectionObserver `rootMargin: '100% 0px'`), pause when off screen,
and only call `WEBGL_lose_context.loseContext()` if a section is removed from the DOM.

Context-loss pattern (all three stages share it):

```ts
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stage.status = 'lost'; log.warn('context lost'); showFallback(); });
canvas.addEventListener('webglcontextrestored', () => { stage.dispose(); stage.init(); log.info('context restored'); hideFallback(); });
```

After a restore **every** GL object is invalid (programs, textures, render targets); rebuild from the CPU state (text mask,
noise array, image elements) rather than trying to patch. E2E: `gl.getExtension('WEBGL_lose_context').loseContext()` then
`restoreContext()` and assert the fallback toggles and the canvas draws again.

## 10. H. Performance and robustness checklist

| Area | Rule |
|---|---|
| DPR | `Math.min(devicePixelRatio, 2)`; hero sim at CSS pixels, not DPR; adaptive scale below |
| Adaptive quality | Average frame time over 30 frames; if above 20 ms step sim scale 1 -> 0.75 -> 0.5 then DPR 2 -> 1.5; never step back up (no thrashing). Log `info` on each step |
| Off-screen | `IntersectionObserver` stops the loop; `visibilitychange` stops it; use `useRafLoop` from the foundation |
| Render on demand | Stop the loop when idle and settled; restart on pointer, resize or toggle |
| Power | `powerPreference: 'high-performance'` only for the hero; `'low-power'` for B and C |
| Precision | Declare `precision highp float;` in every fragment shader (ES 3.00 requires highp support in fragment shaders); use `highp sampler2D` for float textures (iOS returns `lowp` otherwise, per MDN best practices https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices ); never use `fract(sin(x))` hashes at `mediump`; use the integer hash in section 5 |
| Float targets | Detect: create RGBA16F target, check `checkFramebufferStatus`. iOS has no `EXT_color_buffer_float` (WebKit bug 247240) and no `EXT_float_blend`; use `EXT_color_buffer_half_float` or RGBA8 with subtractive decay. Do not rely on linear filtering of 32-bit float on iOS |
| Texture size | Hero buffers at most 1280 px wide; thumbnails at most 1.5x display size; call `texStorage`-style allocation once, not per frame |
| Shader compile | Compile every program, then link, and use `KHR_parallel_shader_compile` where present (MDN above); do not call `getError` or `readPixels` in the loop |
| Fonts | `await document.fonts.load(...)` then `fonts.ready`, then rasterise (section 3.2) |
| Resize | One `ResizeObserver` per stage, debounce 150 ms for expensive rebuilds (EDT, noise placement), cheap for `viewport`/uniform updates |
| Reduced motion | Static frame or fade; no pointer-reactive loops; Lenis smoothing off (default); grain static; cursor, magnet off |
| Safari / iOS | Use `svh`/`dvh` not `vh` for the hero; low-power mode caps rAF at 30 FPS (Lenis README); contexts are lost more aggressively when the tab backgrounds, so the restore path must work; canvas area is limited on iOS (about 16.7 million pixels, old knowledge **[unverified]**); no `OES_texture_float_linear`; `touch-action` as above |
| Memory | Dispose textures and render targets on unmount; do not leak `ResizeObserver` or `IntersectionObserver` |
| Logging | `createLogger('hero' / 'safesurf' / 'glass')`; log lifecycle only, never inside the frame loop |
| Fallback never blank | Every WebGL piece renders its DOM/CSS fallback first and swaps to canvas after the first successful frame |

### Playwright and WebGL

Verified locally on this machine (macOS, Playwright 1.65.1, bundled Chromium, headless, no flags): `getContext('webgl2')`
succeeds, renderer string is ANGLE on SwiftShader (software), `EXT_color_buffer_float` and `EXT_color_buffer_half_float` are
available, `MAX_TEXTURE_SIZE` 8192, a cleared canvas reads back the expected pixel and `page.screenshot()` captures a
WebGL canvas drawn without `preserveDrawingBuffer`. Passing `--use-angle=swiftshader --enable-unsafe-swiftshader` also
worked, and so did `--ignore-gpu-blocklist`; they changed nothing here.

Recommendations:

- Set `launchOptions.args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']` in `playwright.config.ts` for Linux CI
  runners **[not verified on Linux CI; Chromium sources advise against `--use-gl=...` and `--disable-gpu`, which breaks
  WebGL on recent Chrome, per https://developer.chrome.com/blog/supercharge-web-ai-testing and Chromium graphics-dev]**.
- Add a test-ID probe: `data-webgl="ok|fallback|lost"` and `data-frame="<n>"` on each canvas wrapper, and
  `data-ready="true"` after the first presented frame. Wait with
  `page.waitForFunction(() => Number(el.dataset.frame) > 2)`. Never `waitForTimeout`.
- Do **not** ship `preserveDrawingBuffer: true` (slower, disables some optimisations). `page.screenshot()` works without it.
  Use `canvas.toDataURL()` only inside the same task as a draw, or when you add a debug flag.
- Determinism: for visual baselines use `page.emulateMedia({ reducedMotion: 'reduce' })` (the static frame is deterministic),
  and for mid-interaction shots use `?freeze=1` (fixed time step, seeded RNG) plus `page.mouse.move(x, y, { steps: 20 })`.
  Use `toHaveScreenshot({ maxDiffPixelRatio: 0.02 })` and generate baselines only on the CI OS, because SwiftShader and
  real GPUs differ slightly.
- Cover the fallback: a project that launches with `--disable-webgl` (or an `addInitScript` that makes
  `HTMLCanvasElement.prototype.getContext` return null for `webgl2`) and asserts the CSS fallback is visible.

## 11. Open questions and risks

1. **Hero look needs a visual loop.** The pipeline is standard but the exact inflated look depends on `uBump`, the profile
   and the matcap. Budget two iteration passes with screenshots; do not promise one-shot. The EDT-balloon profile has no
   external reference.
2. **iOS float targets.** Paint and ripple need RGBA16F; RGBA8 fallback works but needs the subtractive decay. Test on a
   real iPhone; none was available to verify here.
3. **Touch drawing versus scroll** in the hero and drone grid. Chosen defaults: `pan-y` on the hero (vertical drags scroll),
   explicit draw mode on the grid.
4. **HTML-in-Canvas** is Chromium-only (Chrome 157, shipped Nov 2026). Treated as optional; the secondary-source API
   reference should be rechecked against Chrome docs if anyone adopts it.
5. **GSAP licence** is a custom "no charge" licence, not an SPDX one, and Webflow can change it for future versions
   (existing versions stay under their original terms). Pin the exact version, keep the `package-lock.json` entry.
6. **Bundle weight.** GSAP + ScrollTrigger + SplitText is 48.4 KB gz, plus OGL 14.5 KB and Lenis 6.1 KB, about 69 KB of
   libraries. Acceptable, but lazy-load OGL-based sections (`React.lazy` + IO) so the first paint carries only GSAP, Lenis
   and the CSS fallback hero.
7. **CSS scroll-driven animations** are Baseline but Firefox 159 only shipped on 2026-10-27, so many installs lack it; kept out of v1.
8. **Not verified:** EDT and heatmap timings, SVG-filter dissolve performance, Linux CI flags, iOS canvas-area limit,
   `getCoalescedEvents` support on every Safari, exact WebGL context caps in 2026 browsers, Safari 18 vs 18.4 for view
   transitions, the APG slider and Red Blob URLs (cited from knowledge, not fetched).

### Disagreements with the plan

- **A:** "troika / MSDF" is the wrong tool; the look comes from a height field, so a canvas raster plus an EDT is simpler.
- **B:** "per-image WebGL contexts" would eat the context budget; use one stage. HTML in Canvas is no longer
  experimental-only (shipped in Chrome 157) but is still Chromium-only, so it cannot be the primary route.
- **E:** `role="slider"` on a custom element is the harder route; a native range input gives the same role with less code.
- **F:** Both "GSAP vs CSS scroll timelines vs Motion" and "View Transitions" are moot for a one-page site; one system is enough.
