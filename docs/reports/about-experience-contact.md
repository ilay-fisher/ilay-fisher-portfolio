# Report: workstream B (About, Experience, Contact, Nav, Footer)

Branch `feat/about-experience-contact`.

## What was built

- **About**: square portrait rig with corner ticks (`public/images/ilay.jpg`, 800x800, width/height set, lazy,
  `decoding=async`, "IF" monogram on error), thesis as the summary, SafeSurf origin story, availability line with the
  `--pass` dot, "What I built" as a label/value spec list (one `Reveal`), stack tags, and a Writing strip (blurb, six topic
  tags, link to LinkedIn; no post text). Spec labels (Browser, Enforcement, ...) are a local array in the section.
- **Experience**: four bench readings (false-block 36.6% to 14.2%, 22+ releases, 3-month beta, 10 students) in one rig
  (one `Reveal`), a timeline (`<ol>`) of the three roles, then education as a spec list. Count-up is the pure
  `countUpValue` + `formatReading`; the GSAP tween runs once at 90% of the viewport. The final value is in the DOM from the
  start; assistive tech reads a visually hidden sentence. Reduced motion: no tween at all.
- **Contact**: the ask as the summary, address in mono, one primary `mailto:` button, Copy email (clipboard +
  `role=status aria-live=polite`, failure message tells the visitor what to do), LinkedIn and GitHub secondary. Magnetic
  hover (max 8 px, fine pointer only, off under reduced motion) on a wrapper span around the primary button.
- **Nav**: IntersectionObserver band (`-40% / -59%`) sets `aria-current="true"`; `pickActive` is pure. Scroll-progress
  hairline written straight to the DOM (`data-progress`, no re-render). Below 900 px a Menu button
  (`aria-expanded`, `aria-controls`), focus moves to the first link on open, Escape closes and returns focus, focus
  leaving the header or an outside pointer closes, choosing a link closes. Skip link unchanged, no `scroll-margin-top`.
- **Footer**: name, year, location, LinkedIn, GitHub, Email, built-with line linking to the repo, back-to-top `#top`.

## Tests

Unit: 110 total in the repo (39 new/changed here: About 7, Experience 5 + countUp 5, Contact 8 incl. `magnetOffset`,
Nav 8 + navLogic 6, Footer 4). E2E: 27 total, 11 in `e2e/about.spec.ts` (headings visible, nav highlight while scrolling,
progress hairline, mobile menu at 390x844 reaches all six sections + Escape/focus return, skip link, no overflow at 360 and
1440, copy-email with real clipboard, portrait fallback with the request aborted, heading order + landmarks + accessible
names + `rel` hand-checked, reduced-motion readings). No console errors asserted in the first test.

## Decisions

- Experience readings and Spec labels live in the section folders (not `src/content`, which is frozen); every figure is
  from CONTENT.md.
- Footer "Built with React, GSAP and OGL" names the libraries actually in `package.json`.
- The "Contact" heading and the "Experience" heading keep the foundation stub titles.

## Known limits / unverified

- No automated axe run (no new dependency); a11y was checked by the hand-written e2e checks only. No screen-reader pass.
- Active-section band: at the very bottom of the page the last section is active only if it overlaps the band; verified
  in e2e for Contact on a 1280x720 viewport, not on very tall viewports.
- Mobile menu has no focus trap by design (non-modal); it closes when focus leaves.
- Magnetic hover and the count-up were checked in headless Chromium only, not by eye in motion.
- The screenshots of tall sections hide the sticky nav (element screenshots would otherwise paste it mid-page).
- Test files were reformatted by Prettier in the `feat:` commit, so that commit touches them.
- Left out of CONTENT.md: nothing from About/Experience/Education/Writing. The Magshimim and AharayTech end dates
  (Oct 2026) are as in the content module.

## Shared files touched

None outside my owned paths.

## Screenshots

`docs/reports/img/about-desktop-{about,experience,contact,footer,nav-active}.png`,
`about-mobile-{about,experience,contact,menu}.png` (1440x900 and 390x844).
