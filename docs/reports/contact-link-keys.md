# Contact: LinkedIn and GitHub as the shared icon keys

Owner: "Yes, match Contact", plus feedback on the live footer: "email hover animation not looks good".

## What

- New shared component `src/components/LinkKey/` (`LinkKey.tsx`, `LinkKey.css`, `icons.tsx`). It is the footer key, moved out
  of `Footer` and renamed (`footer-key` to `link-key`), so footer and Contact use one implementation. Pointer tracking now
  sits on the key itself (`onPointerMove`), not on the footer list.
- Footer uses `LinkKey` for LinkedIn, GitHub and Email. Rendering is unchanged (see `contact-keys-footer-1440.webp` against
  `footer-links-1440-rest.webp`), apart from the email hover below.
- Contact: "Email Ilay" (primary) and "Copy email" stay as they were. LinkedIn and GitHub are now `LinkKey`s with the same
  hrefs, `target="_blank"`, `rel="noopener noreferrer"` and the hidden "(opens in a new tab)" text. Copy is unchanged.

## Layout decision

Same row as the buttons, in the existing wrapping flex row. At 1440 all four controls sit on one baseline, one family of
pills. Keys are set to 46 px high (footer 48 px) to match the buttons. At 390 the row wraps to two even rows
(primary + copy, then the two keys) with no overflow. A separate row would have added a visual tier to the panel; one row
keeps it quiet. The primary keeps no icon (its shape, colour and label are untouched).

## Email hover redesign (shared key, so footer too)

Old: the flap flipped open (`scaleY(-0.7)`), which in the hovered state read as a flat rectangle with a curved line.
Chosen: option (a). No flap move at all; the whole envelope hops 2 px, tilts -7 degrees and scales to 1.12 on the soft
spring, then settles. It reads as an envelope in every frame (`contact-keys-email-frames.webp`: rest, 60, 150, 270, 570,
900 ms). Why: it is the same family as the LinkedIn tilt-and-pop and the GitHub tilt, it needs no extra drawing, and it
cannot break the silhouette at 16 px. The flap stroke went from 1.9 to 2 for a clearer V at rest. Transform only, still
under reduced motion (no transform at all there).

## Magnet

Keys carry `data-magnetic` (the engine writes `translate`); hover and press use `transform`. Two properties, no competing
transforms. Contact's own `magnet.ts` only re-exports the pure maths and applies nothing to the keys.

## Tests

Unit: `LinkKey.test.tsx` (href, label, icon hidden, external attrs, mailto left alone, data-magnetic, envelope has body
and flap), `Footer.test.tsx` (class rename), `Contact.test.tsx` (keys external, icon hidden, not `.btn`, primary still the
only `.btn--primary`). E2E: new `e2e/contact-keys.spec.ts` (visible, hrefs, 44 px, same height as the buttons, no
overflow at 1440 and 390; hover changes transform; reduced motion still) and one case in `e2e/footer.spec.ts` (the flap is
not transformed while hovered). Existing footer and about tests unchanged.

## Shared files touched

`src/components/LinkKey/*` (new, the approved exception) and `src/components/Footer/*` (moved onto it; `icons.tsx` moved
to `LinkKey/icons.tsx`). Nothing else under `src/components`.

## Screenshots (`docs/reports/img/`)

`contact-keys-1440-rest|hover.webp`, `contact-keys-390-rest|hover.webp`, `contact-keys-footer-1440.webp`,
`contact-keys-email-frames.webp`. The orange dot and white ring are the site cursor.

## Limits

Hover not tested on touch. The mail icon has no flap motion by design. Three pre-existing files fail `prettier --check`
(not touched here).
