# Art direction (v2) — written by the manager, binding for every worker

This file overrides `docs/DESIGN.md` wherever they disagree. `DESIGN.md` holds the token
values and component rules that implement this direction.

## Why v2

Owner feedback on v1, in his words: the animations are not at the level of the reference,
he did not like "the square looking", the portrait "inside a sharp edges square is kind of
ugly", and the first hero (pink inflated letters painted by the cursor) was "not like that
animation": too childish, bubblegum. He chose **playable 3D objects** as the hero.

So v1's "lab bench" (hairline boxes, corner ticks, square blueprint grid, pink balloon paint)
is retired.

## The idea: hardware you cannot stop playing with

Ilay builds software that has to hold up when someone is actively trying to break it. The
site makes that physical. Everything on the page is a piece of well-made hardware on a dark
stage: machined, bevelled, weighty, and built to be pushed. The visitor is invited to throw
things, flip switches, turn dials and try to break the rigs. They respond with real physics
and they hold.

Think premium audio gear, mechanical keyboards, flight instruments. Not toys, not balloons,
not a spreadsheet.

## Shape

- Nothing is a sharp rectangle. Every surface has a radius and, where it is an object, a bevel.
- Radius scale (tokens): 10 chips and tags, 16 controls, 24 cards, 36 rig stages and large
  panels, full pill for buttons, switches and labels.
- Forbidden: corner-tick frames, 1 px box outlines as the main frame, square grids, square
  image crops, full-width table rules. A hairline may separate rows inside a rounded card.
- Portrait: never a square. A soft rounded form (squircle or a slow-breathing organic mask)
  seated in a bevelled bezel like an instrument lens, with a faint accent rim light.

## Material and light

- Stage: near-black, slightly blue (keep `#0C1014` family). Background is not a grid. Use
  two or three large, very soft light pools that drift slowly, plus fine film grain.
- Objects: dark anodised or ceramic bodies with a soft top highlight, a tight specular line
  on the bevel and a grounded contact shadow. Depth comes from light, never from outlines.
- One light source, top-left, for the whole page (3D hero, CSS shadows and highlights agree).
- Glass is allowed only as a real lens over an image (X-Ray), never as generic blurred cards.

## Colour

- The pink `#FF3D6E` read as bubblegum. Replace the accent family with a hot, technical
  signal colour in the orange-red range (international orange, drone and flight hardware),
  with a lighter amber for speculars and a deep ember for shadowed accent surfaces. The
  design worker picks exact values, checks AA contrast and keeps the token names.
- Accent is for what is live or pressable: legends on keys, the armed switch, the path, the
  burn front, one word in a headline. Never large flat fills behind text.
- Text stays warm paper on the dark stage. Green stays a status-only colour.

## Type

- Drop the Fredoka balloon face completely.
- Headlines: confident and round-shouldered, not condensed and blocky. Normal width, heavy
  but not black, tight tracking, sentence case. One word per headline may take the accent.
- Labels: mono, small, sitting on pills or engraved on hardware (legends), never floating
  as loose "case:" rows.

## Motion: everything has mass

- Vocabulary: press (squash a few percent, spring back), throw (momentum, bounce, settle),
  turn (dial with detents), snap (switch with a decisive stop), settle (damped overshoot).
- Springs, not linear tweens. Two shared springs (soft and snappy) as tokens. Nothing fades
  in flat: things arrive with weight (rise, slight overshoot, settle) and staggered children.
- Pointer: a soft custom cursor that lags slightly and hugs the control it is over;
  primary controls pull toward it (magnetic); highlights on glossy surfaces follow it.
- Scroll: smooth, with section entrances choreographed once. Light pools shift per section.
- Budget: one loud motion on screen at a time; ambient motion stays under a few percent of
  amplitude. Transform and opacity only; 60 FPS; all of it off under reduced motion, where
  every piece shows its finished state.

## Hero: playable 3D objects

- A real-time 3D scene with rigid-body physics: a set of glossy, bevelled, rounded objects
  the visitor can grab, drag, throw and stack with the pointer or a finger. They collide,
  tumble and come to rest with believable weight.
- The objects mean something: keycap-like blocks engraved with what Ilay works in (Kotlin,
  Java, C, C++, Python, TypeScript, React, WASM, TFLite, PyTorch, Firebase, Node), plus a
  few larger hardware pieces (a dial, a toggle, a shield or lock block).
- The thesis is acted out: the name "Ilay Fisher" stands in the scene as a solid, immovable
  form. Whatever the visitor throws at it bounces off. It holds.
- Never empty or static: on load the objects drop in and settle (about 2 s, choreographed);
  when idle, a small nudge now and then keeps the scene alive.
- Look: dark stage, studio lighting with soft area highlights and reflections, grounded
  shadows, accent only on legends and a few caps. Serious and tactile, not candy.
- The headline, role line, availability and two actions sit beside or under the scene as
  real HTML. Vertical touch drags outside objects still scroll the page.
- Fallbacks: a rendered still of the settled scene when WebGL2 is missing, on context loss
  and under reduced motion.

## Project rigs: instruments, not widgets

- Each rig sits on a large rounded stage (radius 36) lit like a product shot.
- Controls are physical: SafeSurf's filter is a real toggle switch with a throw and a snap,
  the delay lock is a dial or a ring with detents and weight, the X-Ray divider is a round
  knob on a rail, drone tools are keycaps. Readouts are small instrument displays.
- SafeSurf burn, drone wavefront and path, X-Ray scan and lock-on keep their briefs; restyle
  them into this material world and the new accent.

## Quality gates (manager checks each before merging)

1. No-rectangle test: no sharp corner anywhere at 1440 and 390.
2. Ten-second test: a visitor wants to keep playing with it for ten seconds.
3. Frame test: any frame of the motion contact sheet looks like a deliberate still.
4. Mass test: nothing moves linearly or stops dead; everything settles.
5. Serious test: a hiring manager at a systems company reads it as engineering craft, not a toy.
