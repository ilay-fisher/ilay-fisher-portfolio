# Design system v2: "hardware you cannot stop playing with"

Binding for all workers. Implementation: `src/styles/tokens.css`, `src/styles/global.css`,
`src/components/**`, `src/lib/{spring,cursor,magnetic,pageFx}*.ts`. Art direction (the why behind
the brief): `docs/ART_DIRECTION.md`.

## 0. What changed in v2 and why

v1 ("the bench") read as a drawing: hairline frames, square corners, a blueprint grid, a flat
pink accent, one-shot fades. The owner called it too square, with weak motion, and the portrait
in a sharp square ugly. v2 keeps the dark stage and the thesis (a rig you try to break) but
changes the material: everything is a **rounded, lit, machined object**.

| v1                                  | v2                                                                    |
| ----------------------------------- | --------------------------------------------------------------------- |
| 0 to 2 px radii, hairline frames    | radius ladder 10 / 16 / 24 / 36 / pill, nothing is a sharp corner     |
| flat fills, hairlines as structure  | bevel + rim light + contact shadow from one top-left light            |
| blueprint grid                      | light pools (`.ambient`) and film grain (`.grain`), no grid           |
| pink-red `#ff3d6e`                  | signal cyan family (v2.1; v2.0 was orange), pale specular, teal shade |
| Bricolage 800 at 75% width, Fredoka | Bricolage 700 at normal width, one display face, Fredoka removed      |
| ease-out fades on every reveal      | two shared springs, one loud motion at a time                         |
| tick-mark nav, hairline underline   | floating pill nav with a sliding spring indicator                     |
| square portrait                     | frameless avatar on the stage (alpha, contact pool, rim glow)         |
| system cursor                       | opt-in signature cursor that hugs controls (fine pointer only)        |

### Migration note for feature workers

Use these. They exist and are stable:

- **Radius**: `--radius-chip` 10, `--radius-control` 16, `--radius-card` 24, `--radius-stage` 36,
  `--radius-pill` 999. Buttons, tags, labels: pill. Cards: card. Demo stages: stage.
  `--radius-0` and `--radius-1` are aliases and never render sharp.
- **Shadow**: `--shadow-contact-sm`, `--shadow-contact` (resting), `--shadow-lift` (held or hovered
  up). Always lower right. Never `rgba(0,0,0,.1)` grey drop shadows.
- **Bevel**: `--bevel-inset`, `--bevel-inset-sm`, `--well-inset` (recess), `--rim-gradient` (border
  light), `--rim-light` (accent glow on the lower right edge).
- **Body**: `--body-gradient` (150deg, `--body-hi` to `--body-lo`) for any raised surface.
- **Springs**: `--spring-soft` + `--spring-soft-dur` (880 ms, about 7% overshoot) for layout and
  entrances; `--spring-snappy` + `--spring-snappy-dur` (350 ms) for press and toggles. In JS:
  `SPRING_SOFT`, `SPRING_SNAPPY`, `springEase` from `src/lib/spring.ts`. Do not invent a third.
- **Accent**: `--paint`, `--paint-hi`, `--paint-deep`, `--on-paint`, plus `*-rgb` triplets for
  `rgb(var(--paint-rgb) / .4)`.
- **Utility classes**: `.pill`, `.tile`, `.stage`, `.bevel`, `.well`, `.sheen`, `.spec-card`.
  Prefer them to hand-rolled borders.
- **Components**: same names and props as v1. `Section` gained `accent` (wrap one phrase of the
  title in the accent colour). `Button` primary gets `data-magnetic` automatically.

Forbidden: square corners, hairline-only frames as structure, a visible grid, grey generic drop
shadows, hard-coded hex or px that has a token, ease-only reveals, a third spring, Fredoka, any
motion that does not collapse under `prefers-reduced-motion`, animating layout properties other
than the two documented exceptions (section 6), and hiding the native cursor yourself.

## 1. Palette (and why the accent changed)

| Token              | Value                 | Role                                                                          |
| ------------------ | --------------------- | ----------------------------------------------------------------------------- |
| `--stage`          | `#0C1014`             | page background, blue-black graphite                                          |
| `--surface`        | `#131920`             | wells, inputs                                                                 |
| `--surface-raised` | `#1B232C`             | hovered panels                                                                |
| `--body-hi/lo`     | `#28323D` / `#10151B` | lit and shaded ends of anodised bodies                                        |
| `--line`           | `#2B3542`             | soft separators inside cards                                                  |
| `--line-strong`    | `#4A5668`             | control borders (3:1)                                                         |
| `--text`           | `#ECE8DF`             | primary text, 15.6:1 on stage                                                 |
| `--text-dim`       | `#A8B0BC`             | secondary text, 8.1:1 on surface                                              |
| `--text-faint`     | `#8A93A1`             | captions, 5.7:1 on surface                                                    |
| `--paint`          | `#1ED0F2`             | accent: pressable or live. 10.3:1 on stage, 9.6:1 on surface, 8.6:1 on raised |
| `--paint-hi`       | `#8CF1FF`             | pale specular, top of gradients. 14.7:1 on stage                              |
| `--paint-deep`     | `#0A6A87`             | teal shade, bottom of gradients and shadows (fills only, 3.1:1 on stage)      |
| `--on-paint`       | `#0C1014`             | text on paint, 10.3:1; on paint-hi 14.7:1                                     |
| `--pass`           | `#9AE06A`             | status green only (dot, pass). 12.0:1 on stage; hue 96 vs the accent's 190    |

**Why signal cyan.** The owner called the orange "tired" and asked for something alive in the
blue-green range. Hardware you play with (a pilot lamp, an instrument backlight, a status LED on a
studio rack) also lights in cyan, and on a blue-black graphite stage a cyan reads as light being
emitted, where orange only ever read as paint. It carries a highlight (pale cyan) and a shade
(deep teal) as one family, so a gradient reads as a lit object instead of a flat fill, and it
passes AA as text (10.3:1 on stage) and as a button fill with dark text. Three families were
tried on the real page (cyan `#1ED0F2`, azure `#3D9DFF`, mint-teal `#19E3A8`; see
`docs/reports/img/palette-alive-options.png`). Azure looked like a default link colour. Mint-teal
sat at hue 162, too close to the status green. Cyan (hue 190) is the most electric, has the most
contrast headroom, and is far enough from any green to stay unambiguous.

**Status green.** The availability dot and pass states use `--pass`, retuned from the minty
`#7BE0B0` (hue 151) to a lime-leaning `#9AE06A` (hue 96), 94 degrees from the accent. Both lights
stay visible side by side, and a unit test (`src/styles/tokens.test.ts`) holds the gap at 60
degrees or more.

Contrast ratios (WCAG 2.x, computed in `src/styles/tokens.test.ts`):

| Pair                            | Ratio | Use                                |
| ------------------------------- | ----- | ---------------------------------- |
| `--paint` on `--stage`          | 10.33 | accent text, legends               |
| `--paint` on `--surface`        | 9.57  | accent text in wells               |
| `--paint` on `--surface-raised` | 8.58  | accent text on hovered panels      |
| `--on-paint` on `--paint`       | 10.33 | button label                       |
| `--on-paint` on `--paint-hi`    | 14.68 | label on the lit end of a button   |
| `--paint-hi` on `--stage`       | 14.68 | pale accent text                   |
| `--paint-deep` on `--stage`     | 3.11  | fills and shadows only, never text |
| `--pass` on `--stage`           | 12.04 | status text and dot                |

## 2. Typography

- **Display: Bricolage Grotesque** (variable, optical size axis on), weight **700**, tracking
  `-0.026em`, leading 1.02. Round-shouldered and heavy but not black. v1's 800 at 75% width
  merged letters ("ff") and looked cut from paper; normal width with optical sizing keeps
  counters open and the shapes soft, matching the rounded objects. One display face only.
- **Body: Instrument Sans**, 17 to 18 px, line length under 68ch.
- **Mono: Martian Mono**, only for labels that carry data (dates, status, stack).
- Headline treatment: words rise in on a spring (`Reveal variant="words"`), one phrase may take
  the accent via `Section accent`. Not more than one accented phrase per heading.

## 3. Material recipe (bevel, highlight, contact shadow)

Light is one source, top left (`--light-angle: 135deg`), shared with the 3D hero.

1. **Body**: `background: padding-box var(--body-gradient)` lit top left, dark bottom right.
2. **Rim**: a second `border-box` layer with `--rim-gradient` behind a 1 px transparent border.
   The edge catches light on the upper left and falls to black on the lower right.
3. **Bevel**: `box-shadow: var(--bevel-inset)` (top highlight, side highlight, bottom shade,
   soft sheen).
4. **Contact shadow**: `--shadow-contact` (three layers: tight, mid, long, all to the lower
   right). Held or hovered objects use `--shadow-lift` and rise 1 to 2 px.
5. **Specular**: `.sheen` adds a diagonal glint; paint objects add `--rim-light` on the lower
   right edge.
6. **Recess**: wells (`--well-inset`) are the opposite: dark inner top left shadow, light catches
   the lower right lip. Use for tracks, inputs, bench labels, the footer tray.

## 4. Backgrounds: light pools, grain, no grid

`PageFx` mounts `.ambient` (three blurred radial `.pool`s) and `.grain` (SVG noise at low opacity,
slowly drifting) behind and above the page. `data-mood` on `.ambient` is set from the section in
view (hero, about, cool, signal, deep) and re-tints the pools over about 1.2 s. A grid draws a
technical drawing; pools and grain read as light in a dark room, which suits lit objects.
Under reduced motion the pools are static and `grain[data-moving]` is `false`.

## 5. Springs

| Name            | Params                    | Settle | Overshoot | Use                                |
| --------------- | ------------------------- | ------ | --------- | ---------------------------------- |
| `SPRING_SOFT`   | stiffness 90, damping 12  | 880 ms | about 7%  | entrances, nav indicator, count-up |
| `SPRING_SNAPPY` | stiffness 520, damping 30 | 350 ms | about 6%  | press, release, toggle, magnetic   |

Two springs only, so everything on the page feels like one material. Generated from one
function (`springStep`) as GSAP eases and as CSS `linear()` tokens, with unit tests for rest and
settle time. Plain eases (`--ease-out`, `--ease-in-out`) remain for opacity.

**One loud motion at a time.** Entrances stagger, never overlap with a second big move. Press
squash uses the independent CSS `scale` property and magnetic pull uses `translate`, so they
never fight.

## 6. Interaction

- **Press**: `:active` squashes to `scale: .955 .915` on the snappy spring; release overshoots.
- **Magnetic pull**: `[data-magnetic]` moves toward the pointer within 44 px, strength 0.28, max
  9 px, via `translate`. Primary `Button`s have it by default; `magnetic={false}` opts out.
- **Label-on-pill**: bench labels and spec labels are small pills (`.pill`), not tracked caps
  above headings. The pill encodes the field name and the value sits inside the same capsule.
  It replaces the all-caps eyebrow and the top rule of v1.
- **Nav**: floating pill, indicator slides on `--spring-soft`, scroll progress inside the bar.
- **Documented exceptions** to "transform and opacity only": the cursor ring's width, height and
  radius are written once per frame by one rAF loop that runs only while the cursor is visible or
  settling; the nav indicator transitions width.
- **Reduced motion**: springs collapse to the finished state, grain stops, magnetic and cursor
  are not mounted, `Reveal` marks content `data-reveal-ready` immediately.

## 7. The cursor

Opt-in, signature, off on touch, coarse pointer and reduced motion. The native cursor is hidden
(`html.has-cursor`) only after the first real mouse move, never before the engine is ready.
`pointer-events: none` always, text selection unaffected.

Behaviour: a 34 px ring with a core dot; on a link or button it **hugs** the element (ring grows
to its rounded rect plus 16 px pad, leans 0.18 toward the pointer clamped to 8 px, ticks hide);
press shrinks it; over text it becomes an I-beam-like core; with a verb it grows to 68 px and
shows the label; velocity rotates the ticks (vx times 0.05, clamped to 30 degrees).

Data-attribute contract:

| Attribute                  | Effect                                       |
| -------------------------- | -------------------------------------------- |
| `data-cursor="drag"`       | any word: verb mode, ring 68 px, label shown |
| `data-cursor-label="toss"` | overrides the verb label                     |
| `data-cursor="hug"`        | force hug on a non-link element              |
| `data-cursor="none"`       | hide ring over this element                  |
| `data-cursor="text"`       | text mode                                    |
| `data-cursor="default"`    | plain ring                                   |

Links, buttons, `role=button` and checkboxes hug automatically; the nearest ancestor with
`data-cursor` wins. Hug applies only to targets up to 800 x 160 px; larger ones use the plain
ring. Logic is pure and tested in `src/lib/cursor.ts`; the DOM engine is `cursorEngine.ts`.

## 8. Layout and components

- Sections use `--section-pad` vertical rhythm, container 1280, gutter 16 / 24 / 32.
- **About**: sticky avatar column (>= 960 px) beside a long story column, which removes the
  v1 dead space. **Experience**: reading tiles, round timeline nodes, role spec-cards. **Contact**:
  one rounded stage panel with the email set large in the display face.
- Avatar is frameless: `.avatar` > `.avatar__stage` > `img.avatar__still` + `canvas.avatar__frames`, no bezel, ring,
  border or round crop (e2e asserts no ancestor of the canvas draws one). `.avatar__pool` is the soft contact shadow.
  Fallback monogram sits on the same free stage.
- Components: `Section`, `Reveal`, `Button`/`LinkButton`, `Tag`, `ProjectFrame`, `DemoPlaceholder`,
  `Nav`, `Footer`, `PageFx`. Names and props unchanged from v1.

## 8b. Voice

Wit is sparing and only the lines approved in `docs/CONTENT.md` "Voice". Contact carries
"Throwing things was fun. Hiring me is more useful." (small line under the buttons); the footer
closes with "You reached the bottom. Nothing broke. That's the point." About and Experience carry
none. Cursor verb labels stay plain verbs (drag, throw, flip, open).

## 9. Do and don't

Do: round every corner; light from the top left; ground every raised object with a contact
shadow; use one accent per view; give every press a spring; finish states under reduced motion.

Don't: frame with hairlines, show a grid, use identical cards with identical grey shadows, put
caps eyebrows over headings, animate several things at once, hide the native cursor on touch,
or add a third spring.

## Inner scroll areas

Any element with its own scrolling (`overflow-y: auto|scroll`) is a **scroll area**: it carries `data-scroll-area`
(spread `scrollAreaProps(label)` from `src/lib/scrollArea.ts`, or `useScrollArea(label)` for text that only overflows
on some viewports). The attribute does three things: Lenis leaves wheel and touch over it alone so it scrolls
natively; `global.css` gives it the slim `--line-strong` scrollbar and the focus ring; and it makes the area a
focusable, named `role="region"` for the keyboard. Never set `overscroll-behavior: contain` on one: at its end the
page must take over (no scroll trap). `e2e/inner-scroll.spec.ts` fails if any overflow element lacks the attribute.

## About avatar (head-turn)

The About avatar stands free on the stage: no bezel, ring or round crop. Frames are WebP with true alpha chroma-keyed from green-screen footage (512 px, 63 frames, about 1.17 MB; one monotonic yaw sequence from about 65 degrees to screen right through the frontal pose to about 65 degrees to screen left, every blink and half-closed frame excluded) so the character is lit by the section light pools and the page grain like everything else. Depth comes from light only: a soft contact pool under the shoulders and a faint accent rim glow (`drop-shadow` follows the alpha silhouette). They are generated by `src/sections/About/avatar/generate_frames.py` and described by `frames.json`. The still (`still.webp`, same framing) shows first; the frames load when About is within 300 px of the viewport and the canvas takes over. The head follows the pointer anywhere on the page. Yaw is the angle of the pointer seen from the face centre (`pointerToYaw`: `atan2(dx, 260 px)`, full turn at 52 degrees, a smooth 70 px ramp over the face instead of a dead zone), driven by a critically damped spring (`LOOK_SPRING`, about 0.25 s). Fractional positions are drawn as an exact premultiplied cross-fade of the two neighbouring frames (`blendFrames`, `lighter` composite), so motion is continuous at any pointer speed. Pitch comes from the vertical angle, with a few degrees of tilt and parallax from the vertical position. When the pointer is idle the head glances around and returns; on touch it drifts with scroll and turns toward a tap. Reduced motion draws one static frame facing the visitor. Fallbacks: frames fail, the still stays; the still fails, the IF monogram shows. `data-avatar` (`still|frames|static|monogram`) and `data-frame` on `.avatar__stage` expose the state. He blinks (below).

**Blinking.** Every 3 to 7 s (a second quick blink follows about one in five), at whatever angle the head is at: lids about 120 ms down, a held beat, about 170 ms up (`blinkLogic.ts`: seeded scheduler, easing curve, nearest-set choice, eye tracks; all unit-tested). Nothing is drawn: `generate_blinks.py` (run by `generate_frames.py`, which also reads the optional `avatar-blinks-green.mp4`) cuts each real blink in the footage (5 blinks) into a few small RGBA lid patches (84 x 56 px per eye, soft oval matte whose opacity follows how closed the lid is, so the first and last patch are transparent), registered by optical flow and colour-matched to one head frame (its anchor). Each blink is also mirrored, for the side the footage never turns to. Per eye, an affine track over all 63 frames follows the eye, so at runtime a patch is drawn at `T(frame) * T(anchor)^-1`, composited `source-atop` so nothing lands off the silhouette. The nearest anchor within `reach` (10 frames) is played, so only the lids change: no head jump, no pop. One 107 kB WebP atlas + `blinks.json`, lazy-loaded with the frames. Blinking pauses under reduced motion and off screen. `data-blink` (`off|idle|blinking`), `data-blink-started`, `data-blink-ended` on `.avatar__stage`. Contact sheet: `docs/reports/img/avatar-blink-contact-sheet.jpg`. Honest status: real footage, registered directly, for frontal to right profile (anchors 3 to 17). Left of the neutral frame (anchors 35 to 56) the lids are the same real blinks mirrored and re-toned; they look natural at a glance, but the far eye at three-quarter left has a slightly cooler, softer lid than the near eye. Frames 62 and 0 (the extreme ends) are the least certain.

**Interim alpha (current footage).** The source video has a dark backdrop and its hair top is cropped, so a true cutout is impossible. Each frame gets a soft organic alpha: the dark backdrop is keyed by colour distance, the head interior is filled, and a wide feather follows the head-and-shoulders silhouette loosely (no circle) and fades the cropped top and the bottom, so no edge or shape shows at any yaw on any section mood.

**Green-screen mode (true alpha).** The frames come from two green-screen clips in the `_assets` folder (`$AVATAR_ASSETS`): `avatar-turn-green-a.mp4` (clean frontal to right-profile turn, source frames 97..150) and `avatar-turn-green-b.mp4` (clean turn from three-quarter right through frontal to left profile, frames 13..125). One command, `python3 src/sections/About/avatar/generate_frames.py`, builds everything: clip A reversed (right profile down to the seam), then clip B, with B registered onto A (scale and shift measured by ECC on the keyed subject) and the seam at the frontal pose (A frame 90, B frame 49, where gaze, pose and scale agree best; `--seam A:B` overrides). Backdrop is keyed to alpha (greenness ratio, un-mix from the measured backdrop colour, despill, largest-component clean-up, premultiplied resize), the bottom of the crop dissolves instead of cutting the shoulders, one common square is used for every frame, `--keep` limits the yaw range to 74 percent of the way to each profile and frames are thinned to even head-motion steps. Neutral is the most mirror-symmetric frame, so the frame under the pointer looks at the visitor. The blink ranges were excluded by checking the eye region of every kept frame (`docs/reports/img/avatar-eyes-sheet.png`). With only the older single dark-backdrop video (`avatar-turn.mp4`) present the script falls back to the interim soft-alpha mode; a single `avatar-turn-green.mp4` still works too.
