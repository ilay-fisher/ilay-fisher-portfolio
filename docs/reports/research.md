# Report: workstream R (animation research)

Deliverable: `docs/research/ANIMATIONS.md` (sections A to H, dependency list, open questions). No application code.

- Method: web research on primary sources (Chrome for Developers, MDN, GSAP and Lenis docs, WICG, WebKit bugs, Codrops, Inigo Quilez),
  `npm view` for versions and licences, local esbuild measurements for min+gzip sizes.
- Verified locally: Playwright 1.65.1 headless Chromium gives WebGL2 (SwiftShader) with float colour buffers and screenshots WebGL canvases
  without `preserveDrawingBuffer`.
- Recommended deps: ogl@1.0.11, gsap@3.15.1, @gsap/react@2.1.2, lenis@1.3.27 (plus one self-hosted OFL display font chosen by F).
- Key findings: HTML-in-Canvas shipped in Chrome 157 (Nov 2026, Chromium only, API renamed from the origin trial); GSAP incl. SplitText is free;
  CSS scroll-driven animations and same-document view transitions are Baseline newly available.
- Not verified: Linux CI Chromium flags, iOS canvas limits, EDT/heatmap timings, SVG-filter dissolve perf, exact WebGL context caps, a few URLs
  cited from knowledge (marked in the doc).
- Plan disagreements: no MSDF/troika for A; one shared WebGL stage for B (not per-image contexts); native range input for E; no Motion or View Transitions for F.
- Shared files touched: none.
