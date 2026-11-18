# SafeSurf demo report

Replaces the SafeSurf placeholder inside `ProjectFrame` ("Try to switch the filter off.") with a playable simulation. It is labelled as a simulation in the bench caption.

## What it does

- A phone browser shows an original article (Tidewatch) with 4 images and 1 video thumbnail (original SVGs in `public/images/safesurf/`). The filter is on by default.
- Switching the filter off, or allowing for site, page or video, never takes effect at once. It queues behind a compressed delay (default 8 s, "1 hour, compressed"). A dial shows the countdown. While a request waits the visitor can Cancel or Ask sponsor (these controls are hidden, not disabled, when idle; Block again appears only when something is unlocked). Tightening (Block again, switch on) is instant.
- Four bypass attempts (another browser, private DNS, install an app, link inside another app) are each refused with a specific SafeGuard line.
- A status line plus a polite live region report every change. Everything is a real button or switch with an accessible name and visible focus.
- Query hooks: `?safesurfDelay=ms` (300 to 60000) and `?safesurfManual=1` (the burn only advances on a `safesurf:step` window event with `detail` in ms; used for deterministic captures and e2e).

## Composition

Instruments, not widgets. The phone is the hero (large, lit, grounded contact shadow). One compact hardware console (`.bevel`) beside or below it holds: a large physical switch, the delay dial (second largest), three small allow keys, bypass keycaps, and two `.well` displays (request and bypass refusal). One owner-approved line is visible at a time: "Go ahead, turn it off. Everyone tries. It waits." near the switch, replaced by "Want it now? So did I. Come back in an hour." while a request waits. No other copy was invented. At 390 px the console stays compact (switch and dial side by side, keys wrap in two rows), no horizontal scroll.

## The burn

One shared WebGL2 canvas (`loadGlStage()`, dynamic import so OGL stays a lazy chunk, about 58 kB). The front is a fire ramp, thin white-hot core, amber, accent, then a dark char band behind it, with slight scorch darkening ahead of the front, a soft bloom spill, and embers lifting upward with turbulence. Ramp colours come from `--paint`, `--paint-hi`, `--paint-deep` at runtime plus fixed white and char, so it follows the v2 orange-red accent. Re-form is its own event: embers converge, the image knits back from the edges inward in small ragged cells, with a cool mint lip (from `--pass`) at the edge. Items stagger 100 ms apart. A designed tile ("Withheld by SafeSurf") is what is left. Fallbacks: CSS dissolve without WebGL2, instant swap under reduced motion. Render loop pauses off screen, DPR capped at 2, logging via `createLogger('safesurf')`, never per frame.

## Design v2 adoption

Radii use `--radius-chip/control/card/stage`, springs use `--spring-soft` and `--spring-snappy` (and their `-dur`), surfaces use `.bevel` and `.well`, accent only via `--paint*`. No hard-coded pink. One literal ink colour remains on the mock page paper (the article is deliberately a light page).

## Hardware feel

Physical toggle with a throw and spring snap, a 12-detent dial with per-second ticks and pulse, a snap when the delay completes, a shake when a second request arrives while the lock is busy, and a confirm burst plus check-draw for the sponsor. Restrained pointer tilt with a moving sheen on the phone (mouse only, off under reduced motion). `data-cursor` attributes follow the cursor contract.

## Test ids

`safesurf-demo` (root, `data-render` = webgl | css), `safesurf-status`, `safesurf-live`, `safesurf-switch`, `safesurf-allow-site`, `safesurf-allow-page`, `safesurf-allow-video`, `safesurf-block`, `safesurf-countdown`, `safesurf-request`, `safesurf-cancel`, `safesurf-sponsor`, `safesurf-bypass-<id>`, `safesurf-bypass-result`, `safesurf-media-<id>` (`data-state` = blocked | allowed). Dial state: `.ss-lock[data-pending][data-shake]`, `.ss-ring__snap[data-via]`.

## Tests

- Unit: `rules.test.ts`, `status.test.ts`, `dissolve.test.ts`, `SafeSurfDemo.test.tsx` (244 unit tests pass repo-wide).
- E2E: `e2e/safesurf.spec.ts` (9 tests): default blocked state, countdown then allow, cancel, sponsor, bypass refusals, reduced motion, no horizontal scroll at 390, manual-clock choreography, busy-lock shake and sponsor confirm. Slow tests use a long delay because software GL is slow.

## Evidence

- All captured on the v2 look. Stills use a 40 s delay (label reads "compressed to 40 s"); shipped default is 8 s.
- Screenshots: `docs/reports/img/safesurf-{desktop,mobile}-{default,midburn,countdown,allowed}.png` (1440x900 and 390x844, clipped to the demo, site nav hidden in capture only).
- Contact sheets (8 frames, 120 ms apart): `safesurf-frames-burn.png`, `safesurf-frames-reform.png`.
- Video: `docs/reports/video/safesurf.webm`.
- Regenerate: dev server on 5183, then `node e2e/safesurf.capture.mjs` (`VIDEO_ONLY=1` re-records only the video).

## Shared files touched

None.

## Commits

Every commit on this branch ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (model `claude-sonnet-5-5`).

## Known limits

- Verified only on SwiftShader (software GL), never on a real GPU; the machine was heavily loaded during capture so timing is slow.
- Pointer tilt untested on touch hardware.
- The mock article page is a light page inside a dark rig; deliberate, not final art direction.
- The custom cursor and "press" label appear in some stills (they are the shared cursor, not the demo).
- The video is large (about 27 MB) because it was recorded under software GL load.
- Re-form is good but less spectacular than the burn.
- Not a top-tier interactive studio piece yet: no sound, no real GPU tuning, a single article, embers are CPU-simulated, and the burn is shader-good rather than exceptional.
