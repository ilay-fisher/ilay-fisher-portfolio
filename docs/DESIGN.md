# Design system: "the bench"

Owner: foundation workstream (F). Binding for A to E and Q. The implementation lives in
`src/styles/tokens.css` and `src/styles/global.css`; this file explains it and sets the rules.

## 1. Concept

The thesis is "I build software that has to hold up when someone is actively trying to
break it." So the page is a **test bench**. Each project section is a small rig the visitor is
invited to try to break, and the rig holds. The page is dark like a stage with the work lit,
a faint blueprint grid sits under everything, and one hot glossy "paint" colour is used for
the things that matter. Section metadata reads like bench labels (case number, status, stack).

Spend boldness in two places only: the hero (glossy paint laid down by the cursor) and the
display headlines (big, confident, tight). Everything else is quiet, hairline-precise and flat.

### Why this palette and these fonts

- **Stage `#0C1014`** is a blue-black graphite, not neutral black and not purple. It reads as
  an instrument panel. Text is **warm paper `#ECE8DF`**, which keeps the contrast soft
  against the cold stage and avoids the stark white-on-black look.
- **Paint `#FF3D6E`** is a hot lacquer pink-red. It is deliberately not the usual acid green,
  not vermilion, not purple or blue. Glossy paint needs a hue that carries a highlight and a
  deep shadow: the paint family (`--paint`, `--paint-hi`, `--paint-deep`) gives the hero a
  believable specular and a body colour. It has 5.6:1 contrast on the stage, so it is also
  legal as text for short labels and links.
- **Bricolage Grotesque** (display) is an expressive grotesque with width (75 to 100) and
  optical size axes. At 800 weight and 75% width it makes tight, poster-like headlines that
  feel hand-cut, which suits "paint". The hero rasterises it into a canvas, so it needs to be
  bold and have strong counters.
- **Instrument Sans** (body) is calm, slightly condensed and very legible at 17 px, so the
  display face can be loud.
- **Martian Mono** (labels) is a wide, technical mono used only for bench labels, stack
  tags and numbers. Mono here encodes information (case numbers, statuses), it is not
  decoration. Never use it for body copy.

All three are self-hosted via `@fontsource-variable/*`. No request leaves the origin.

## 2. Tokens

All tokens are CSS custom properties in `src/styles/tokens.css`. Never hard-code a value that
has a token.

### 2.1 Colour

| Token | Value | Role |
|---|---|---|
| `--stage` | `#0C1014` | page background |
| `--surface` | `#12171D` | panels, rigs, inputs |
| `--surface-raised` | `#1A2129` | hovered or active panels |
| `--line` | `#2B3542` | hairlines, grid |
| `--line-strong` | `#4A5668` | borders of interactive controls (3:1 UI contrast) |
| `--text` | `#ECE8DF` | primary text |
| `--text-dim` | `#A8B0BC` | secondary text |
| `--text-faint` | `#8A93A1` | tertiary text, captions |
| `--paint` | `#FF3D6E` | the accent: primary action, active state, one highlight per section |
| `--paint-hi` | `#FF93AE` | paint specular highlight, hover on paint |
| `--paint-deep` | `#B3174A` | paint shadow, pressed state |
| `--on-paint` | `#0C1014` | text on a paint fill |
| `--pass` | `#7BE0B0` | functional only: the "holds" status dot. Never decorative |

Contrast (WCAG 2.x, computed from the hex values):

| Pair | Ratio | Verdict |
|---|---|---|
| text on stage / surface / raised | 15.6 / 14.7 / 13.3 | AAA |
| text-dim on stage / surface / raised | 8.7 / 8.2 / 7.4 | AAA |
| text-faint on stage / surface / raised | 6.2 / 5.8 / 5.2 | AA body text |
| paint on stage / surface / raised | 5.6 / 5.3 / 4.8 | AA body text |
| on-paint on paint | 5.6 | AA |
| pass on stage | 11.9 | AAA |
| line-strong on stage | 2.6 | decorative only, pair with another cue; controls also carry a text label or fill |

Rules: paint is used on at most one focal element per viewport besides links and the
focus ring. No gradients except the hero's paint rendering. No glass, blur panels or drop
shadows; depth comes from hairlines and surface steps.

### 2.2 Typography

Families (also used by the hero canvas; they must be loaded before rasterising, call
`document.fonts.load('800 200px "Bricolage Grotesque Variable"')` first):

| Token | Family string |
|---|---|
| `--font-display` | `'Bricolage Grotesque Variable', 'Arial Narrow', system-ui, sans-serif` |
| `--font-body` | `'Instrument Sans Variable', system-ui, sans-serif` |
| `--font-mono` | `'Martian Mono Variable', ui-monospace, Menlo, monospace` |

Exact canvas family name: `Bricolage Grotesque Variable` (weights 200 to 800, `font-stretch`
75% to 100%).

Fluid scale (360 to 1920 px viewport, `clamp(min, preferred, max)`):

| Token | Value | Use |
|---|---|---|
| `--step--1` | `clamp(0.78rem, 0.76rem + 0.1vw, 0.875rem)` | mono labels, captions |
| `--step-0` | `clamp(1rem, 0.96rem + 0.2vw, 1.125rem)` | body |
| `--step-1` | `clamp(1.2rem, 1.1rem + 0.5vw, 1.5rem)` | lead paragraph, summaries |
| `--step-2` | `clamp(1.5rem, 1.3rem + 1vw, 2.25rem)` | sub-headings |
| `--step-3` | `clamp(2.25rem, 1.7rem + 2.8vw, 4rem)` | section headings (h2) |
| `--step-4` | `clamp(3rem, 1.8rem + 6vw, 7.5rem)` | hero and project titles |

Display style: weight 800, `font-stretch: 75%`, line-height 0.92, letter-spacing -0.02em,
sentence case. Body: weight 420, line-height 1.6, measure at most 68ch. Mono labels: weight
500, `font-stretch: 100%`, sentence case with `letter-spacing: 0.02em`. No all caps labels.

### 2.3 Spacing, radii, lines

4 px base. `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24, `-6` 32, `-7` 48, `-8` 72,
`-9` 112, `-10` 168 px. Section vertical padding is `--section-pad` =
`clamp(4.5rem, 3rem + 7vw, 10rem)`.

Radii: `--radius-0` 0 (panels, rigs, the grid is square), `--radius-1` 4 px (buttons, inputs,
tags), `--radius-pill` 999 px (status dot only). Do not mix more than these.

Hairline: `--hairline` = `1px solid var(--line)`. Panels have a hairline border, no shadow.
Corner ticks (`.ticks`, a small crosshair at each corner of a rig) mark "this is the thing
under test". Use them on the demo slot, not on every box.

Blueprint grid: `body` carries a fixed background grid, 1 px lines in `--line` at 8% mix,
every `--grid-size` (64 px), plus a stronger 4% step every 4th line. It is `background-attachment: fixed`
and never animates.

### 2.4 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | `120ms` | hover, press, focus |
| `--dur-base` | `240ms` | state changes, reveals answering an action |
| `--dur-slow` | `520ms` | the one orchestrated page-load moment |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entrances, state changes |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | moves between two resting states |

Principles:

- Motion answers an action (press, drag, toggle, hover on a control) or is the single
  load moment (hero paint). No scroll-triggered fade-up on every section, no hover lift on
  every card.
- Things that move: the hero paint, the interactive rigs, the focus ring, buttons.
  Things that never move: the grid, hairlines, nav, section headings, body copy.
- Animate `transform` and `opacity` only. Never layout properties. No per-frame logging.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` zeroes all durations in
  `global.css`. Rigs must expose a static state (see AGENT_RULES section 5) and use
  `usePrefersReducedMotion()` for JS-driven motion.

## 3. Layout

Single column page, content in a 12-column grid inside `.container`.

| Breakpoint | Name | Behaviour |
|---|---|---|
| 360 to 599 | phone | one column, gutter 16 px |
| 600 to 899 | tablet | gutter 24 px, bench-label row becomes inline |
| 900 to 1279 | laptop | 12 columns, project copy and rig side by side |
| 1280 to 1920 | desktop | content max width 1280 px (`--container`), gutter 32 px; beyond 1920 content stays centred |

Use `min-width` media queries only, at `600px`, `900px`, `1280px`. Never rely on a width
above 1920. No horizontal scroll at any width from 360 (`overflow-x: clip` on `html` is a
safety net, not a fix; do not depend on it).

Alignment: left aligned everywhere. Centre alignment only inside the hero canvas poster and
the 404-style fallbacks. No justified text.

Section anatomy (every section, via `Section`):

```
------------------------------------------------------------ hairline
CASE-01   In production   Kotlin, Java, GeckoView         <- bench-label row (mono, --step--1)
Try to switch the filter off.                              <- h2, display, --step-3 or --step-4
one-line summary                                           <- --step-1, text-dim
[ rig / demo slot, corner ticks ]                          <- children
------------------------------------------------------------
```

## 4. Component inventory

All in `src/components/`. Import from `src/components/<Name>`.

| Component | Use it for | Rules |
|---|---|---|
| `Section` | every section | renders `<section id aria-labelledby>`, the hairline top rule, optional bench-label row, the h2. Never write a bare `<section>` |
| `ProjectFrame` | the three project sections | wraps `Section`; gives title, summary, stack tags, links, optional numbers, and the `demo` slot with corner ticks. Put the demo as `children` and give it `data-testid` |
| `Button`, `LinkButton` | actions and links that look like actions | `variant`: `primary` (paint fill, max one per section), `secondary` (hairline). `LinkButton` renders an `<a>`, opens external links with `rel="noopener noreferrer"` |
| `Tag` | stack and topic chips | mono, hairline, `--radius-1`. Not clickable |
| `Nav`, `Footer` | page chrome | owned by B after foundation |

Rig rules: a rig sits in `.rig` (surface background, hairline, corner ticks), has an
accessible name, shows a one-line instruction in plain words ("Drag the slider."), and a
reset control if the state can get stuck.

## 5. Do and don't

Do:
- Use tokens for every colour, size, space, radius and duration.
- Write sentence case, plain verbs, numbers over adjectives, no exclamation marks.
- Give every interactive element a visible `:focus-visible` (global style: 2 px paint outline, 3 px offset). Do not remove it.
- Keep hairlines at 1 px and surfaces flat.
- Use the mono face only for labels, tags, numbers, code.
- Provide a static fallback for every canvas or WebGL piece.

Don't:
- No purple, blue or teal gradients. No glassmorphism, blur panels, glows, drop shadows.
- No emoji, no stock icon sets. If an icon is needed, draw a 16 px inline SVG with 1.5 px strokes.
- No all-caps eyebrow labels, no numbered markers unless the content is a sequence, no `->` arrows appended to every link.
- No cards in a grid of identical rounded boxes. Panels are square with a hairline.
- No scroll-triggered fade-and-slide on every section; no parallax.
- Do not add a second accent colour. `--pass` is the only other hue and is functional.
- Do not set fonts directly; use `--font-*` tokens.
