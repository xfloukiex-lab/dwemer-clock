# The Dwemer Clock

A bronze clock-lock that fills the screen. Three concentric dials — **seconds**,
**minutes**, **hours** — start on the real current time. Wind them and each turns
round to twelve in turn; when all three land, the bolts withdraw, the face sinks,
and you travel down the barrel of the case into the movement.

**[Open it →](https://xfloukiex-lab.github.io/dwemer-clock/)**

## Controls

| | |
|---|---|
| Wind / travel | mouse wheel, trackpad, or drag on touch |
| Outer dial (seconds) | <kbd>↑</kbd> <kbd>↓</kbd> |
| Inner dial (hours) | <kbd>←</kbd> <kbd>→</kbd> |
| Middle dial (minutes) | <kbd>Shift</kbd> + <kbd>↑</kbd> <kbd>↓</kbd> |
| Jump | <kbd>Home</kbd> / <kbd>End</kbd>, <kbd>PageUp</kbd> / <kbd>PageDown</kbd> |

Nothing on the page scrolls — the wheel drives the timeline directly, so there is
no scrollbar and the same input works on a trackpad or a phone.

## What is in the movement

Laid out in the order power actually flows through a mechanical clock:
**mainspring barrel → fusee → going train → bevel drive → escape wheel → anchor →
pendulum → worm drive**, mounted on ring plates held apart by pillars, with amber
lamps down the barrel. Past the last plate it opens into a chamber of
cathedral-scale wheels.

### The gears are real gears

Two things separate a gear train from a row of gear-shaped discs, and both are
implemented rather than faked:

1. **Involute tooth profile.** Teeth are generated as the true involute of the
   base circle at a 20° pressure angle — the curve that lets teeth roll against
   each other instead of scraping. A trapezoid tooth reads as fake instantly.
2. **Phase lock.** Meshing wheels are placed exactly pitch-to-pitch and each one's
   angle is solved from its parent every frame:

   ```
   θB = (φ + π) − (θA − φ)·(N_A / N_B) + π / N_B
   ```

   Turning neighbours at the right *ratio* is not enough. Without the phase term
   the teeth pass straight through each other.

## How it is built

No models, no textures, no downloads. Every surface is generated in code:

- The face is drawn once as a **world-space height field** — engraved divisions,
  Roman numerals, machined turning, rivets, hexagonal bosses — then converted to a
  normal map, so each cut catches the light instead of being painted on.
- All three dials share that one texture. Each ring only covers its own radial
  band, so it shows only its own markings and carries them round as it turns.
- Metal is procedural bronze and steel. The chamber sky is a canvas gradient.

Built with [three.js](https://threejs.org) (MIT), pinned to `0.161.0`.

## Running it locally

ES modules cannot load over `file://`, so serve the folder:

```
python -m http.server 8128
```

Then open <http://localhost:8128/>. Add `?tier=low|medium|high` to force a quality
tier — useful for testing the phone path on a desktop.

## Performance

Quality tiers from core count and pointer type: pixel ratio, the bloom pass, and
the density of the movement all scale down. Rendering pauses entirely when the tab
is hidden.

## Licence

MIT.
