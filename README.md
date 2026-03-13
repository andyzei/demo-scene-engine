# 31337 — Edge × Copilot Hackathon Demoscene

A fullscreen, zero-dependency HTML5 Canvas application that rotates through classic demoscene visual effects. Built as a background video loop for the Microsoft Edge × Copilot Hackathon 2026.

## Quick Start

Serve the directory with any static HTTP server (ES modules require HTTP, not `file://`):

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser. Press **F** for fullscreen.

## Keyboard Controls

| Key         | Action                              |
|-------------|-------------------------------------|
| `←`         | Previous effect                     |
| `→`         | Next effect                         |
| `Space`     | Pause / resume auto-rotation        |
| `B`         | Toggle branding overlay             |
| `F` / `F11` | Toggle fullscreen                  |

## Project Structure

```
index.html                 Entry point — fullscreen canvas + overlay markup
css/
  style.css                Fullscreen layout, overlay bar styles
img/
  edge-logo.svg            Edge logo (user-provided)
  copilot-logo.svg         Copilot logo (user-provided)
js/
  engine.js                Main loop, effect lifecycle manager, keyboard, transitions
  palette.js               Shared color definitions + gradient utilities
  glitch.js                Glitch transition effect between demos
  overlay.js               Branding overlay (toggle with B key)
  effects/
    plasma.js              Classic sine-based plasma
    starfield.js           3D warp starfield with nebulae + comets
    fire.js                Bottom-up flame simulation
    rotozoom.js            Rotating/zooming texture mapper
    metaballs.js           Blobby organic metaball shapes
    matrix.js              Matrix digital rain with brand strings
    sinescroll.js          Wavy scrolling text scroller
    moire.js               Moiré interference patterns
    fractal.js             Mandelbrot set continuous zoom
    wireframe.js           Rotating 3D wireframe shapes
    particles.js           Particle swarm with attractors
    pipes.js               Windows-style 3D pipes screensaver
    terrain.js             Procedural terrain fly-over
```

## Architecture

### Engine (`js/engine.js`)

The engine is the central orchestrator. It manages:

- **Canvas**: A single `<canvas id="demo">` element, sized to `window.innerWidth × innerHeight`, re-sized on window resize.
- **Main loop**: `requestAnimationFrame`-based with delta-time (`dt` in seconds, clamped to 0.1s max to handle tab-away).
- **Effect lifecycle**: Sequential rotation through the `EFFECTS` array. Each effect runs for its configured `duration` (seconds) before auto-advancing.
- **Transitions**: Before switching effects, the engine triggers a `GlitchTransition` which captures the current frame and runs a ~0.8s glitch animation, then loads the next effect.
- **Keyboard**: Arrow keys for manual navigation (resets timer), Space to pause, B for overlay, F for fullscreen.

#### Effect Rotation

Effects are stored in the `EFFECTS` array as `{ name, cls, duration }` objects. The engine:

1. Instantiates the effect class: `new entry.cls()`
2. Calls `init(canvas, ctx)` on it
3. Calls `update(dt)` and `render(ctx)` each frame
4. After `duration` seconds, triggers a glitch transition and loads the next effect
5. Calls `destroy()` on the outgoing effect before replacing it

The index wraps around using modular arithmetic, so the list loops forever.

### Effect Interface

Every effect in `js/effects/` must export a class with this interface:

```javascript
export class MyEffect {
  // Called once when the effect is loaded. Set up state, buffers, etc.
  // canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D
  init(canvas, ctx) { }

  // Called every frame. dt = seconds since last frame (typically ~0.016).
  // Use dt for all animation to be frame-rate independent.
  update(dt) { }

  // Called every frame after update(). Draw to the canvas.
  // ctx: CanvasRenderingContext2D (same as init, but passed for convenience)
  render(ctx) { }

  // Called when the browser window is resized.
  // Rebuild any size-dependent buffers (ImageData, lookup tables, etc).
  // canvas/ctx may have new dimensions.
  resize(canvas, ctx) { }

  // Called when the effect is unloaded. Clean up references, null out buffers.
  destroy() { }
}
```

#### Key conventions:

- **Frame-rate independence**: Always multiply velocities/positions by `dt`. Never assume 60fps.
- **Self-contained**: Effects must not reference other effects or engine internals. They receive `canvas` and `ctx` and that's it.
- **Performance target**: 60fps on modern hardware. Pixel-manipulation effects (plasma, metaballs, fire, etc.) typically render at reduced resolution (1/3 to 1/4 scale) then upscale.
- **Resize safety**: `resize()` can be called at any time. Rebuild ImageData buffers, recalculate lookup tables, and preserve animation state where possible.
- **No DOM manipulation**: Effects only draw to the provided canvas context. No creating elements, no event listeners.

### Adding a New Effect

1. Create `js/effects/myeffect.js` implementing the effect interface above.
2. In `js/engine.js`:
   - Add `import { MyEffect } from './effects/myeffect.js';`
   - Add `{ name: 'My Effect', cls: MyEffect, duration: 45 },` to the `EFFECTS` array.
3. That's it — the engine handles everything else.

### Glitch Transition (`js/glitch.js`)

Exports `GlitchTransition` class. When `start(onComplete)` is called:

1. Captures the current canvas as `ImageData`
2. Over ~800ms, applies progressively:
   - RGB channel horizontal split
   - Random block displacement (horizontal shifts of rectangular regions)
   - Scanline overlay (every 3rd pixel row darkened)
   - Random brand-colored flashes
   - White flash at the midpoint
3. Calls `onComplete()` when finished

The engine calls `update(dt)` and `render()` on the transition each frame while it's active, skipping the current effect's render.

### Overlay (`js/overlay.js`)

Exports `Overlay` class. A semi-transparent bar at the bottom of the screen showing:

- Edge + Copilot logos (SVG images from `img/`)
- "HACKATHON 2026" title
- Current effect name and index (`[3/13] Metaballs`)
- Countdown timer showing time remaining for current effect

Toggled with the **B** key. Fades in/out with CSS transitions. The overlay DOM is in `index.html`, styled in `css/style.css`.

### Palette (`js/palette.js`)

Shared color definitions and utilities:

| Name           | Hex       | RGB              |
|----------------|-----------|------------------|
| Edge Blue      | `#0078D4` | `0, 120, 212`    |
| Copilot Purple | `#7B61FF` | `123, 97, 255`   |
| Teal           | `#00B7C3` | `0, 183, 195`    |
| Neon Cyan      | `#00FFFF` | `0, 255, 255`    |
| Neon Magenta   | `#FF00FF` | `255, 0, 255`    |
| Electric Green | `#39FF14` | `57, 255, 20`    |
| Deep Black     | `#0A0A0A` | `10, 10, 10`     |

Exports:
- `PALETTE` — hex color strings
- `RGB` — pre-parsed `{r, g, b}` objects
- `lerpColor(c1, c2, t)` — linear interpolation between two RGB colors
- `buildGradient(stops)` — builds a 256-entry palette array from color stops
- `rgbCSS(color, alpha)` — converts `{r,g,b}` to CSS `rgb()`/`rgba()` string

Note: Most effects define their own inline palettes for self-containment. `palette.js` is available as a shared utility but is not required.

## Effects Reference

| # | Effect        | File            | Duration | Technique                                  |
|---|---------------|-----------------|----------|--------------------------------------------|
| 1 | Plasma        | `plasma.js`     | 45s      | Multi-wave sine fields, ImageData          |
| 2 | Starfield     | `starfield.js`  | 45s      | 3D perspective stars, warp bursts, nebulae |
| 3 | Fire          | `fire.js`       | 40s      | Heat buffer simulation, ImageData          |
| 4 | Rotozoom      | `rotozoom.js`   | 35s      | Rotated/scaled texture mapping, ImageData  |
| 5 | Metaballs     | `metaballs.js`  | 45s      | Distance field threshold, ImageData        |
| 6 | Matrix Rain   | `matrix.js`     | 50s      | Falling characters, fillText, fade overlay |
| 7 | Sine Scroll   | `sinescroll.js` | 40s      | Per-char sine displacement, fillText       |
| 8 | Moiré         | `moire.js`      | 35s      | Overlapping sine ring fields, ImageData    |
| 9 | Fractal Zoom  | `fractal.js`    | 60s      | Mandelbrot iteration, ImageData            |
|10 | 3D Wireframe  | `wireframe.js`  | 40s      | Rotation matrices, perspective projection  |
|11 | Particle Swarm| `particles.js`  | 50s      | Attractor physics, trail overlay           |
|12 | 3D Pipes      | `pipes.js`      | 45s      | Grid-based growth, cylindrical shading     |
|13 | Terrain       | `terrain.js`    | 50s      | Perlin noise heightmap, filled strips      |

## Performance Notes

- **Reduced-resolution rendering**: Pixel-based effects (plasma, fire, metaballs, moiré, fractal, rotozoom) render to a smaller internal buffer (typically `canvas.width/4 × canvas.height/4`) using `ImageData`, then draw the small image onto the full canvas with `drawImage()` and `imageSmoothingEnabled` for upscaling.
- **Delta-time**: All animation is multiplied by `dt` (seconds). The engine clamps `dt` to 0.1s max to prevent physics explosions after tab-away.
- **No WebGL**: Everything uses the 2D Canvas API for simplicity and compatibility.
- **No dependencies**: Zero npm packages, zero CDN imports. Pure vanilla ES modules.

## Browser Requirements

- Any modern browser with ES module support and Canvas 2D
- Recommended: Microsoft Edge (naturally 😎)
- Fullscreen API support for the F key toggle

## Logo Setup

The overlay expects two SVG files:
- `img/edge-logo.svg` — Microsoft Edge logo
- `img/copilot-logo.svg` — GitHub Copilot logo

These are not included in the repo (trademarked assets). Drop in your own SVGs and they'll render at 32px height in the overlay bar.
