# Footer links as tactile icon keys

Owner request: "in the footer i want the linkedin github mail to be more attractive (icon, and animations)".

## What

LinkedIn, GitHub and Email in the footer are now rounded anodised keys (pill, rim gradient, soft top highlight,
grounded shadow, light from top left). Each has an icon in an engraved round well plus the visible label.
Labels: "LinkedIn", "GitHub", "Email" (the address stays out of the footer, it is in Contact). No copy was added.

- Icons: `src/components/Footer/icons.tsx`. LinkedIn "in" (Simple Icons 12.0.0, CC0; the square plate is dropped because
  the key is the plate; current simple-icons no longer ships LinkedIn) and GitHub mark (simple-icons, CC0), `currentColor`.
  Envelope drawn for the site; its flap is a separate path.
- Motion (CSS only, shared spring tokens): hover/focus lifts the key (translateY, scale) on `--spring-snappy`, a shadow
  layer fades in (opacity), a pointer-following amber highlight (transform), press squashes to 96.5% and springs back.
  One move per icon on `--spring-soft`: LinkedIn tilts and pops, GitHub tilts from its base, the envelope flap flips open.
  Accent (`--paint-hi`, `--paint` on press) only on the icon while live.
- Entrance: shared `Reveal variant="stagger"` on the list.
- `data-magnetic` on each key (uses `translate`, no conflict with the hover `transform`); cursor hugs automatically.
- Reduced motion (media query and `html.reduce-motion`): no transforms at all, colour change only.
- A11y: real links, `aria-hidden` focusable=false icons, "(opens in a new tab)" kept for external links, keys 48 px
  high, global paint focus ring follows the pill.

## Tests

Unit (`Footer.test.tsx`, 8): hrefs from profile, names, icons hidden, magnetic, wit line unchanged.
E2E (`e2e/footer.spec.ts`, 5, project default, preview build): links correct and hit areas >= 44 px and no horizontal
scroll at 1440 and 390; hover then press change the transform; reduced motion leaves transform/translate at none;
keyboard focus ring.

## Shared files touched

None.

## Screenshots (`docs/reports/img/`)

`footer-links-1440-rest|hover.webp`, `footer-links-390-rest|hover.webp`, `footer-links-frames.webp`
(rest, hover at 60/150/270/570 ms, press, release).

## Limits

Hover is not tested on touch devices (no hover there; press squash only). The orange dot and white ring in the stills
are the site's custom cursor. The same key styling would suit the Contact secondary links; not done (out of scope).
