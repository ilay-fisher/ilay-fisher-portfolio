# Hero: GitHub and LinkedIn pieces, TypeScript badge

Request: take the GitHub icon out of its box and make it open my GitHub; do the same for LinkedIn and add a LinkedIn
piece to the hero.

## What changed

- **GitHub** (`token-github`): die-cut disc token, no keycap, no box. It uses GitHub's own white mark for dark
  backgrounds: a raised near-white (#F3F2EE) glossy ceramic disc whose cut-out is the octocat, recessed down to a
  GitHub-black (#1f2328) enamel plate, so the cat edge throws a shadow line. The octocat's tail meets the disc rim, so a
  pure die-cut silhouette would be a C; the plate is therefore the full disc (`FILLED_TOKENS` in `logic/token.ts`).
  The disc is sized to the LinkedIn tile (plate diameter = tile side), the collider is a 12-gon around the disc, and the
  mark's curves are sampled at 20 divisions so the ears and tail stay crisp.
- **LinkedIn** (`linkedin`): bevelled LinkedIn-blue (#0A66C2) ceramic tile with raised white "in" on both faces,
  same family as the SafeSurf and SafeGuard pieces, kind `badge`. Letters are the holes of the official path, read,
  not altered. The path is the CC0 simple-icons **12.0.0** file (current simple-icons no longer ships LinkedIn),
  vendored in `tools/vendor/` and `tools/vendor.mjs`.
- **TypeScript** (`badge-typescript`): same badge kind, blue (#3178C6) tile with white "TS". Plain skill piece, no link.
- Plate corner radius of the badges (`BADGE_CORNER = 0.2`) is a little larger than the official squares so no piece has
  sharp corners.
- **Links**: GitHub and LinkedIn open `profile.links.github` / `profile.links.linkedin` (never hard-coded) in a new
  tab through a real anchor click (`target="_blank"`, `rel="noopener noreferrer"`, `openLink.ts`) inside the gesture:
  double-click (mouse and touch, existing `doublePress` logic) or Enter when keyboard-selected. A single click or a
  drag opens nothing. Only `https:` URLs are opened.
- Hover chip: "GitHub · double-click to open profile". Screen reader text: "GitHub. Double-click or press Enter to open
  my GitHub profile in a new tab." (same for LinkedIn). Opening announces "Opening my GitHub profile in a new tab".
- Each piece appears once in every layout. Counts: desktop 30, desktop lite 20, mobile 18, mobile lite 15.
- **Mobile lite dropped Python** (least important of the top ten) so GitHub and LinkedIn fit without crowding.
- The `claude` piece and its layouts are unchanged (desktop full and desktop lite only; a unit test asserts it).
- Invitation text untouched.
- **Keycaps left: `ml` and `vscode` only.** Not changed.

## Files

`src/sections/Hero/`: `logic/catalogue.ts`, `logic/token.ts`, `openLink.ts`, `index.tsx`, `scene/runtime.ts`,
`scene/geometry.ts`, `scene/materials.ts`, `scene/marks.ts`, `scene/tokenData.ts`, `physics/world.ts`,
`tools/vendor.mjs`, `tools/build-tokens.mjs`, `tools/vendor/simple-icons-12.0.0-linkedin.svg`, plus tests
(`catalogue`, `token`, `world`, `openLink`, `badgeGlyphs`). `e2e/hero.spec.ts`, `README.md` (attribution lines),
`public/hero/still-desktop.webp`, `still-mobile.webp`.

## Colliders

Badges use a convex rounded-square prism; the GitHub token keeps the generated convex hull. Unit tests settle every
new piece asleep in four seeds and all layouts.

## Pictures

- `img/hero-social-desktop-1440.webp`, `img/hero-social-mobile-390.webp` (live scene, seed 11)
- `img/hero-social-close.webp` (close crop: LinkedIn top, GitHub left, TypeScript bottom)

## Honest notes

- The cat is clear in the 1440 shot and the close crop; at 390 it is small but identifiable.
- Hover and touch behaviour was verified by e2e and unit tests, not on a physical phone.
