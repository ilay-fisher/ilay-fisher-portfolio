# Design system v2: "hardware you cannot stop playing with"

Binding for all workers. Implementation: `src/styles/tokens.css`, `src/styles/global.css`,
`src/components/**`, `src/lib/{spring,cursor,magnetic,pageFx}*.ts`. Art direction (the why behind
the brief): `docs/ART_DIRECTION.md`.

## 0. What changed in v2 and why

v1 ("the bench") read as a drawing: hairline frames, square corners, a blueprint grid, a flat
pink accent, one-shot fades. The owner called it too square, with weak motion, and the portrait
in a sharp square ugly. v2 keeps the dark stage and the thesis (a rig you try to break) but
changes the material: everything is a **rounded, lit, machined object**.

| v1                                  | v2                                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| 0 to 2 px radii, hairline frames    | radius ladder 10 / 16 / 24 / 36 / pill, nothing is a sharp corner  |
| flat fills, hairlines as structure  | bevel + rim light + contact shadow from one top-left light         |
| blueprint grid                      | light pools (`.ambient`) and film grain (`.grain`), no grid        |
| pink-red `#ff3d6e`                  | signal orange family, amber specular, ember shade                  |
| Bricolage 800 at 75% width, Fredoka | Bricolage 700 at normal width, one display face, Fredoka removed   |
| ease-out fades on every reveal      | two shared springs, one loud motion at a time                      |
| tick-mark nav, hairline underline   | floating pill nav with a sliding spring indicator                  |
| square portrait                     | portrait in a rounded lens bezel (glass, glint), monogram fallback |
| system cursor                       | opt-in signature cursor that hugs controls (fine pointer only)     |

### Migration note for feature workers

Use these. They exist and are stable:

- **Radius**: `--radius-chip` 10, `--radius-control` 16, `--radius-card` 24, `--radius-stage` 36,
  `--radius-pill` 999. Buttons, tags, labels: pill. Cards: card. Demo stages: stage.
  `--radius-0` and `--radius-1` are aliases and never render sharp.
- **Shadow**: `--shadow-contact-sm`, `--shadow-contact` (resting), `--shadow-lift` (held or hovered
  up). Always lower right. Never `rgba(0,0,0,.1)` grey drop shadows.
- **Bevel**: `--bevel-inset`, `--bevel-inset-sm`, `--well-inset` (recess), `--rim-gradient` (border
  light), `--rim-light` (ember glow on the lower right edge).
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

| Token              | Value                 | Role                                                        |
| ------------------ | --------------------- | ----------------------------------------------------------- |
| `--stage`          | `#0C1014`             | page background, blue-black graphite                        |
| `--surface`        | `#131920`             | wells, inputs                                               |
| `--surface-raised` | `#1B232C`             | hovered panels                                              |
| `--body-hi/lo`     | `#28323D` / `#10151B` | lit and shaded ends of anodised bodies                      |
| `--line`           | `#2B3542`             | soft separators inside cards                                |
| `--line-strong`    | `#4A5668`             | control borders (3:1)                                       |
| `--text`           | `#ECE8DF`             | primary text, 15.6:1 on stage                               |
| `--text-dim`       | `#A8B0BC`             | secondary text, 8.1:1 on surface                            |
| `--text-faint`     | `#8A93A1`             | captions, 5.7:1 on surface                                  |
| `--paint`          | `#FF5A1F`             | accent: pressable or live. 6.1:1 on stage, 5.7:1 on surface |
| `--paint-hi`       | `#FFB347`             | amber specular, top of gradients                            |
| `--paint-deep`     | `#A8300F`             | ember shade, bottom of gradients and shadows                |
| `--on-paint`       | `#0C1014`             | text on paint, 6.1:1; on paint-hi 10.7:1                    |

**Why orange.** Hardware you play with (a studio knob, a shutter button, a pilot lamp) lights in
signal orange. It carries a highlight (amber) and a shade (ember) as one family, so a gradient
reads as a lit object instead of a flat fill. It is warm against a cold graphite stage, passes AA
as text and as a button fill with dark text, and it is not the pink of v1, nor the acid green,
vermilion-on-black or cream and terracotta defaults. It is used for one thing per view: what you
can press or what is live.

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
view (top, about, cool, amber, ember) and re-tints the pools over about 1.2 s. A grid draws a
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
- **About**: sticky lens portrait column (>= 960 px) beside a long story column, which removes the
  v1 dead space. **Experience**: reading tiles, round timeline nodes, role spec-cards. **Contact**:
  one rounded stage panel with the email set large in the display face.
- Portrait never square: `.lens` (rounded bezel) > `.lens__glass` > image, `.lens__glint` on top.
  Fallback monogram keeps the same lens.
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
