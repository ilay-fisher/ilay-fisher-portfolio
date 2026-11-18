# SafeSurf demo report

Replaces the SafeSurf placeholder inside `ProjectFrame` ("Try to switch the filter off.") with a playable simulation. It is labelled as a simulation in the bench caption.

## What it does

- A phone browser shows an original article (Tidewatch) with 4 images and 1 video thumbnail (original SVGs in `public/images/safesurf/`). The filter is on by default.
- Switching the filter off, or allowing for site, page or video, never takes effect at once. It queues behind a compressed delay (default 8 s, "1 hour, compressed"). A dial shows the countdown. The visitor can cancel, or press Ask sponsor to approve early. Tightening (Block again, switch on) is instant.
- Four bypass attempts (another browser, private DNS, install an app, link inside another app) are each refused with a specific SafeGuard line.
- A status line plus a polite live region report every change. Everything is a real button or switch with an accessible name and visible focus.
- Query hooks: `?safesurfDelay=ms` (300 to 60000) and `?safesurfManual=1` (the burn only advances on a `safesurf:step` window event with `detail` in ms; used for deterministic captures and e2e).

## The burn

One shared WebGL2 canvas (`loadGlStage()`, dynamic import so OGL stays out of the main chunk). A fragment shader draws each image as a rounded-rect mask eaten by an irregular two-octave noise front: white-hot core, token-accent glow, dark char, a thin charred border, heat shimmer ahead of the front, and embers (lifting, drifting, fading, with turbulence). Re-form is its own effect: block-quantised ragged knit with a mint tint, converging embers. Items stagger 100 ms apart, about 1.4 s in total for five. A designed tile (tag, message, "Withheld by SafeSurf") is what is left. The palette is read at runtime from `--paint`, `--paint-hi`, `--paint-deep`, `--pass`, and the corner radius from each frame's computed style. Fallbacks: CSS dissolve without WebGL2, instant swap under reduced motion. Render loop pauses off screen, DPR capped at 2, logging via `createLogger('safesurf')` and never per frame.

## Hardware feel

Physical toggle with a throw and spring-overshoot snap, a 12-detent dial with eased per-second ticks and pulse, a snap when the delay completes, a shake when a second request arrives while the lock is busy, and a distinct confirm burst plus check-draw for the sponsor. Restrained pointer tilt with a moving sheen on the phone (mouse only, off under reduced motion). Pill controls with hover lift and press squash.

## Test ids

`safesurf-demo` (root, `data-render` = webgl | css), `safesurf-status`, `safesurf-live`, `safesurf-switch`, `safesurf-allow-site`, `safesurf-allow-page`, `safesurf-allow-video`, `safesurf-block`, `safesurf-countdown`, `safesurf-request`, `safesurf-cancel`, `safesurf-sponsor`, `safesurf-bypass-<id>`, `safesurf-bypass-result`, `safesurf-media-<id>` (`data-state` = blocked | allowed). Dial state: `.ss-lock[data-pending][data-shake]`, `.ss-ring__snap[data-via]`.

## Tests

- Unit: `rules.test.ts`, `status.test.ts`, `dissolve.test.ts`, `SafeSurfDemo.test.tsx` (60 tests).
- E2E: `e2e/safesurf.spec.ts` (9 tests): default blocked state, countdown then allow, cancel, sponsor, bypass refusals, reduced motion, no horizontal scroll at 390, manual-clock choreography, busy-lock shake and sponsor confirm. Slow tests use a long delay because software GL is slow.

## Evidence

- Screenshots: `docs/reports/img/safesurf-{desktop,mobile}-{default,midburn,countdown,allowed}.png` (1440x900 and 390x844, clipped to the demo, site nav hidden in capture only).
- Contact sheets (8 frames, 120 ms apart): `safesurf-frames-burn.png`, `safesurf-frames-reform.png`.
- Video: `docs/reports/video/safesurf.webm`.
- Regenerate: dev server on 5183, then `node e2e/safesurf.capture.mjs`.

## Shared files touched

None.

## Known limits

- Verified only on SwiftShader (software GL), never on a real GPU.
- CSS easing uses spring-like cubic-beziers, not true springs.
- The page screen is a light article inside a dark rig; that contrast is deliberate but is not the final word on the art direction.
- Re-form reads as mint blocks knitting back; effective but less refined than the burn.
- Pointer tilt untested on touch hardware. `data-cursor` attributes are inert until the custom cursor ships.
- The accent is still the current pink; it follows the tokens when the design-soften tokens land. Radius uses local fallbacks (`--radius-chip/control/card/stage`) until those tokens exist.
- Pink corner ticks on the frame come from the shared `ProjectFrame`, not this demo.
- Not a top-tier interactive studio piece yet: no sound, no real GPU tuning, a single article, and mid-burn stills show the shader is good rather than exceptional.
