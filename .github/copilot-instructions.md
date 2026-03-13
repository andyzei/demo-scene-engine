# Copilot Instructions

## Project Overview

Zero-dependency HTML5 Canvas demoscene app that rotates through visual effects with glitch transitions. Pure vanilla ES modules — no build step, no npm, no bundler. Serve statically and open in a browser.

## How to Run

```bash
npx serve .
# or
python -m http.server 8080
```

ES modules require HTTP — `file://` won't work.

## Architecture

**Engine (`js/engine.js`)** is the central orchestrator. It owns the `requestAnimationFrame` loop, manages effect lifecycle, and handles keyboard input. Effects are listed in the `EFFECTS` array as `{ name, cls, duration }` objects and rotate sequentially, looping forever.

**Effects (`js/effects/*.js`)** are self-contained visual modules. Each exports a single class implementing this interface:

```javascript
export class MyEffect {
  init(canvas, ctx) { }   // setup — called once when loaded
  update(dt) { }           // per-frame logic — dt is seconds since last frame
  render(ctx) { }          // draw to canvas
  resize(canvas, ctx) { }  // window resized — rebuild size-dependent buffers
  destroy() { }            // cleanup when unloaded
}
```

**GlitchTransition (`js/glitch.js`)** runs a ~800ms glitch animation between effects. The engine drives it with the same `update(dt)` / `render()` pattern.

**Overlay (`js/overlay.js`)** renders a branding bar via DOM elements (not canvas). Toggled with `B` key.

**Palette (`js/palette.js`)** provides shared brand colors and gradient utilities. Effects may use it or define their own inline palettes.

## Key Conventions

- **Frame-rate independence**: All animation must use `dt` (seconds). Never assume 60fps.
- **Self-contained effects**: Effects receive only `canvas` and `ctx`. No references to other effects, no engine internals, no DOM manipulation, no event listeners.
- **Reduced-resolution rendering**: Pixel-manipulation effects (plasma, fire, metaballs, etc.) render at 1/4 scale into an `ImageData` buffer, then upscale with `drawImage()`. This is critical for performance.
- **Resize safety**: `resize()` can fire at any time. Rebuild `ImageData` buffers and lookup tables; preserve animation state.
- **No external dependencies**: No npm packages, no CDN imports. Everything is vanilla ES modules.
- **Canvas 2D only**: No WebGL. All rendering uses the 2D Canvas API.

## Adding a New Effect

1. Create `js/effects/myeffect.js` implementing the interface above.
2. In `js/engine.js`, import the class and add a `{ name, cls, duration }` entry to the `EFFECTS` array.
3. The engine handles everything else (lifecycle, transitions, overlay updates).

## Brand Colors

Use these when effects need brand-aligned colors:

| Name           | Hex       | RGB            |
|----------------|-----------|----------------|
| Edge Blue      | `#0078D4` | `0, 120, 212`  |
| Copilot Purple | `#7B61FF` | `123, 97, 255` |
| Neon Cyan      | `#00FFFF` | `0, 255, 255`  |
| Deep Black     | `#0A0A0A` | `10, 10, 10`   |
