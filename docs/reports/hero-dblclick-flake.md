# Hero double-click flake (e2e `real double-click scrolls all the way to the section`)

Failure seen on CI (run 44527878297, PR #23, job `e2e (gl-heavy)`, flaky: failed, passed on retry) and locally on
the production preview build.

## Verdict

Two causes, one in the test, one small real bug. Neither is a dropped scroll in the app.

1. **Test timing (most of the failures).** `scrollSettled` called a scroll "finished" after four equal `scrollY` reads
   300 ms apart. On software GL (CI, swiftshader) the browser sometimes goes 1 to 4.5 s between animation frames
   while the main thread stays free. Lenis is frame-driven, so the page stands still in wall time without being done,
   `page.evaluate` answers happily, and the test reads a half-finished scroll (`back at the top`, received 792 on CI,
   2614 and 867 locally; "hash is `#drone` but the page is still at the top" is the same thing seen right after the
   double-click). The scroll does arrive: in the instrumented run the page was held at y=4560 for 4.5 s and then
   reached 0 by itself. A person on a real GPU never gets frames this far apart, and on a slow device the scroll is
   slow, not dropped. No app change is needed for this part.
2. **Real bug, found on the way (`lens`, 1 of 30 after the test was fixed).** The double-press detector timed the
   gesture with `performance.now()` read inside the pointer handlers. A heavy frame landing between the press and
   the release (or between the two presses) delays the handler that runs next, so a quick tap looked like a hold
   (limit 320 ms) or the pair fell outside the 400 ms window, and nothing opened. A visitor on a slow phone or laptop
   can hit this too. It now uses `PointerEvent.timeStamp`, the time the browser received the event.

## Evidence

Failure counts, same test, `vite preview` of the production build, `--workers=1 --retries=0`:

| Build | Result |
| --- | --- |
| Before (origin/main 69ae1c4) | 2 of 8 failed, both `back at the top` (received 2614 and 867) |
| Before, with timing instrumentation | 0 of 6, then 2 of 12 (one `hash still #safesurf` on the lens, one section 7558 px away), then 1 of 20 caught (`back at the top`, received 18) |
| Test fix only (`scrollSettled` and the at-rest check count frames) | 1 of 30 failed: `lens`, hash stayed `#safesurf` (cause 2) |
| Test fix + timestamp fix (final build) | 1 of 30 failed: `lens`, hash stayed `#drone` (the previous piece), so the double-click did not open at all |

The new e2e `a double-click still opens a piece when the page is busy between the two presses` stalls the main thread
450 ms between the press and the release. Before the app fix: 3 of 3 failed (hash stays empty). After: 5 of 5 pass, and 30 of 30 in the final run.
The new `helpers.spec.ts` test starves `requestAnimationFrame` (1.5 s per frame) and checks `scrollSettled`
waits for the scroll to arrive; red before (returned 3000), green after.

Log of a caught run (page events with ms since load, `FRAMEGAP` = time between two animation frames):

```
71898 lenis false  anim=5008 y=5008          previous scroll finished
71907 pointerdown A y=4560                   Playwright clicks the brand link (the test is mid-scroll)
71907 click A  /  replaceState #top          Lenis is asked to go to 0
76370 scroll 4560   FRAMEGAP 4472            first frame after the click arrives 4.5 s later
76371 lenis smooth  anim=5008 y=4560
76371 scrollTo 0
77617 scroll 0      lenis false              arrives at 0, 1.2 s after that
```

Earlier `scrollTo 0` / `scrollTo <y>` pairs in the same logs are ScrollTrigger's refresh (it jumps to 0 and back);
Lenis's tween wins every time, so that is not a cause.

## Touch

Double-tap on mobile (390x844, `hasTouch`, two `touchscreen.tap`): Drone and SafeSurf logo opened and scrolled to the
section on the first run. The lens failed in some runs, and the pointer time stamps show why: the two taps were
620 ms and 642 ms apart (Playwright's tap takes about 100 to 300 ms of round trips on this machine), outside the 400 ms
pair window; the passing ones were 119 to 354 ms apart. The app is correct there, a human double-tap is well inside
400 ms. It shares the timestamp fix (same pointer handler).

## What changed

- `e2e/helpers.ts`: `scrollSettled` also needs 6 consecutive animation frames in which the page did not move
  (and still the wall-time window), and a new `afterFrames`. Backwards compatible for the 14 call sites.
- `e2e/hero.spec.ts`: the "piece is at rest" poll compares positions three drawn frames apart, not 400 ms apart; new
  stall test.
- `e2e/helpers.spec.ts`: new, the red/green test for the helper.
- `src/sections/Hero/logic/doublePress.ts` (+ test): `isQuickTap`, `QUICK_TAP_MS`.
- `src/sections/Hero/scene/runtime.ts`: press start, tap and second-press times come from `e.timeStamp`.

Timeouts were not raised and no retries were added.

## Limits and doubts

- The ScrollTrigger refresh racing a Lenis scroll (a layout shift within about 150 ms of an anchor click) was
  checked and did not reproduce as a dropped scroll (0 of 8 at each delay from 0 to 150 ms); Lenis's tween recovers.
- Other specs that use `scrollSettled` get the stronger helper for free but were not re-run (shared machine, CI is
  the arbiter).
- A residual failure remains: about 1 in 30 (down from about 1 in 4 at baseline), always on the lens. The double-click
  opens nothing (hash is the previous piece's). Not explained: the piece was at rest and on the canvas per the
  test's own checks. Candidates are a pick miss on the lens under a starved frame, or the first press being consumed
  as a grab. I did not find a cause with evidence, so I did not touch the app for it. CI should show whether it persists.
