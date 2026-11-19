# Get in touch leads: hero, nav, contact keys 2+2

Owner: "the get in touch should be more present. safesurf isn't the big deal here. present it in nav also."

## What

- Hero: "Get in touch" is the primary accent action (magnetic, spring press, `#contact`); "See SafeSurf" is the secondary.
  Why keep the SafeSurf label: CONTENT.md has no neutral "See the work", so no new copy; demoting the style is what was asked.
- Nav: a "Get in touch" pill (the shared primary `LinkButton`, 40 px, `nav__cta`) ends the bar at every width. It sits outside
  the collapsible list, so on phones it stays next to Menu. "Contact" is removed from the text list (the pill replaces it);
  `aria-current="true"` moves to the pill while Contact is in view and the sliding indicator hides then (`data-for=""`).
  Phones (<900) tighten gaps/padding and, under 420 px, shrink the brand so brand + Menu + pill fit at 360 without overflow.
- Contact row: grid of two equal columns below 900 px (always 2 + 2, no orphan GitHub key), one flex row from 900 px.
- Optional email prominence: skipped. The address is already the largest text in the panel with Email Ilay / Copy email under
  it; no new copy was needed or invented.

## Tests

Unit: Nav (CTA href, primary, magnetic, outside `#nav-links`, beside Menu, `aria-current` on the CTA, no Contact in the list,
observer still watches `#contact`) and Hero (order and primary uniqueness). New `e2e/contact-presence.spec.ts`: pill visible and
landing on `#contact` at 1440, 665 and 390 (Menu left of it on phones, no overflow), keyboard Enter, and the Contact row shape
(`[4]` from 900, `[2,2]` below) at 1440/1024/665/480/390/360. Updated for the removed Contact link: `about`, `anchors`, `smoke`,
`smooth-scroll` (nav link "Contact" is now "Get in touch"), and `hero.spec` (scoped to `.hero__actions` because the label now
appears twice).

## Shared files touched

`src/components/Nav/*`, `src/sections/Hero/index.tsx` and its test, `src/sections/Contact/Contact.css`, and e2e specs above.
Colours come from tokens only (works with the palette change).

## Screenshots (`docs/reports/img/`, production build)

`contact-presence-{1440,665,390}-hero.png`, `contact-presence-{1440,665,390}-contact.png`,
`contact-presence-nav-cta-frames.png` (rest, hover+magnet, press, release, settle, rest).

## Limits

The pill shows the accent ring while Contact is in view. Hover not tested on touch. Prettier fails on 4 files I did not touch.
