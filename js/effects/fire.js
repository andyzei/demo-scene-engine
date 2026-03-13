const EDGE_BLUE = [0x00, 0x78, 0xD4];
const COPILOT_PURPLE = [0x7B, 0x61, 0xFF];
const NEON_MAGENTA = [0xFF, 0x00, 0xFF];
const WHITE = [0xFF, 0xFF, 0xFF];
const BLACK = [0x00, 0x00, 0x00];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function buildPalette() {
  const stops = [
    { index: 0, color: BLACK },
    { index: 72, color: EDGE_BLUE },
    { index: 144, color: COPILOT_PURPLE },
    { index: 216, color: NEON_MAGENTA },
    { index: 255, color: WHITE },
  ];

  const palette = new Uint8ClampedArray(256 * 4);

  for (let s = 0; s < stops.length - 1; s++) {
    const from = stops[s];
    const to = stops[s + 1];
    const span = to.index - from.index || 1;

    for (let i = from.index; i <= to.index; i++) {
      const t = (i - from.index) / span;
      const offset = i * 4;
      palette[offset] = lerp(from.color[0], to.color[0], t);
      palette[offset + 1] = lerp(from.color[1], to.color[1], t);
      palette[offset + 2] = lerp(from.color[2], to.color[2], t);
      palette[offset + 3] = 255;
    }
  }

  return palette;
}

export class FireEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.buffer = null;
    this.nextBuffer = null;
    this.imageData = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.width = 0;
    this.height = 0;
    this.scale = 4;
    this.cooling = 4;
    this.palette = buildPalette();
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
    this.resize(canvas, ctx);
  }

  update(dt) {
    if (!this.buffer) return;

    const steps = Math.max(1, Math.min(6, Math.round(Math.max(dt, 1 / 120) * 90)));
    for (let i = 0; i < steps; i++) {
      this.stepSimulation();
    }
  }

  render(ctx) {
    if (!this.buffer || !this.imageData || !this.offscreenCtx) return;

    const pixels = this.imageData.data;
    const palette = this.palette;
    const heat = this.buffer;

    for (let i = 0, p = 0; i < heat.length; i++, p += 4) {
      const colorIndex = heat[i] * 4;
      pixels[p] = palette[colorIndex];
      pixels[p + 1] = palette[colorIndex + 1];
      pixels[p + 2] = palette[colorIndex + 2];
      pixels[p + 3] = 255;
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    const nextWidth = Math.max(1, Math.floor(canvas.width / this.scale));
    const nextHeight = Math.max(1, Math.floor(canvas.height / this.scale));

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
    }

    if (this.width === nextWidth && this.height === nextHeight && this.buffer) {
      return;
    }

    const previousBuffer = this.buffer;
    const previousWidth = this.width;
    const previousHeight = this.height;

    this.width = nextWidth;
    this.height = nextHeight;
    this.buffer = new Uint8Array(this.width * this.height);
    this.nextBuffer = new Uint8Array(this.width * this.height);

    if (previousBuffer && previousWidth > 0 && previousHeight > 0) {
      const overlapWidth = Math.min(previousWidth, this.width);
      const overlapHeight = Math.min(previousHeight, this.height);

      for (let y = 0; y < overlapHeight; y++) {
        const sourceY = previousHeight - overlapHeight + y;
        const targetY = this.height - overlapHeight + y;
        const sourceStart = sourceY * previousWidth;
        const targetStart = targetY * this.width;
        this.buffer.set(previousBuffer.subarray(sourceStart, sourceStart + overlapWidth), targetStart);
      }
    }

    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    this.offscreenCtx.imageSmoothingEnabled = false;
    this.imageData = this.offscreenCtx.createImageData(this.width, this.height);

    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }
  }

  destroy() {
    this.buffer = null;
    this.nextBuffer = null;
    this.imageData = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }

  stepSimulation() {
    const w = this.width;
    const h = this.height;
    const bottomRow = (h - 1) * w;
    const current = this.buffer;
    const next = this.nextBuffer;

    for (let x = 0; x < w; x++) {
      current[bottomRow + x] = Math.random() < 0.88
        ? 192 + ((Math.random() * 64) | 0)
        : (Math.random() * 96) | 0;
    }

    next.set(current.subarray(bottomRow, bottomRow + w), bottomRow);

    for (let y = h - 2; y >= 0; y--) {
      const row = y * w;
      const below = (y + 1) * w;
      const below2 = Math.min(h - 1, y + 2) * w;

      for (let x = 0; x < w; x++) {
        const left = x > 0 ? x - 1 : x;
        const right = x < w - 1 ? x + 1 : x;
        const average = (
          current[below + left] +
          current[below + x] +
          current[below + right] +
          current[below2 + x]
        ) >> 2;
        const cooled = average - ((Math.random() * this.cooling) | 0);
        next[row + x] = cooled > 0 ? cooled : 0;
      }
    }

    this.buffer = next;
    this.nextBuffer = current;
  }
}
