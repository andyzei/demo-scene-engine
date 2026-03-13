const EDGE_BLUE = { r: 0, g: 120, b: 212 };
const COPILOT_PURPLE = { r: 123, g: 97, b: 255 };
const NEON_CYAN = { r: 0, g: 255, b: 255 };
const DEEP_BLACK = { r: 10, g: 10, b: 10 };

const RENDER_SCALE = 0.25;
const PALETTE_SIZE = 256;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function buildPalette() {
  const electricBlue = mixColor(EDGE_BLUE, NEON_CYAN, 0.45);
  const violetGlow = mixColor(COPILOT_PURPLE, NEON_CYAN, 0.18);
  const cyanBloom = mixColor(NEON_CYAN, { r: 180, g: 255, b: 255 }, 0.35);
  const shadowBlue = mixColor(DEEP_BLACK, EDGE_BLUE, 0.35);

  const stops = [
    { pos: 0.00, color: DEEP_BLACK },
    { pos: 0.14, color: shadowBlue },
    { pos: 0.30, color: EDGE_BLUE },
    { pos: 0.48, color: electricBlue },
    { pos: 0.62, color: cyanBloom },
    { pos: 0.78, color: violetGlow },
    { pos: 0.90, color: COPILOT_PURPLE },
    { pos: 1.00, color: DEEP_BLACK },
  ];

  const palette = new Uint8ClampedArray(PALETTE_SIZE * 4);

  for (let i = 0; i < PALETTE_SIZE; i++) {
    const t = i / (PALETTE_SIZE - 1);
    let start = stops[0];
    let end = stops[stops.length - 1];

    for (let j = 0; j < stops.length - 1; j++) {
      const s0 = stops[j];
      const s1 = stops[j + 1];
      if (t >= s0.pos && t <= s1.pos) {
        start = s0;
        end = s1;
        break;
      }
    }

    const span = end.pos - start.pos || 1;
    const localT = (t - start.pos) / span;
    const color = mixColor(start.color, end.color, localT);
    const offset = i * 4;

    palette[offset] = color.r;
    palette[offset + 1] = color.g;
    palette[offset + 2] = color.b;
    palette[offset + 3] = 255;
  }

  return palette;
}

function createBufferCanvas() {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(1, 1);
  }

  if (typeof document !== 'undefined' && document.createElement) {
    return document.createElement('canvas');
  }

  return null;
}

export class PlasmaEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.bufferWidth = 0;
    this.bufferHeight = 0;
    this.time = 0;
    this.paletteOffset = 0;
    this.palette = buildPalette();

    this.xPhaseA = new Float32Array(0);
    this.xPhaseB = new Float32Array(0);
    this.xPhaseC = new Float32Array(0);
    this.yPhaseA = new Float32Array(0);
    this.yPhaseB = new Float32Array(0);
    this.yPhaseC = new Float32Array(0);
    this.radialField = new Float32Array(0);
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.bufferCanvas = this.bufferCanvas || createBufferCanvas();
    this.bufferCtx = this.bufferCanvas?.getContext('2d', { alpha: false, willReadFrequently: true }) || null;
    this.time = 0;
    this.paletteOffset = 0;
    this.resize(canvas, ctx);
  }

  update(dt) {
    this.time += dt;
    this.paletteOffset = (this.paletteOffset + dt * 24) % PALETTE_SIZE;
  }

  render(ctx = this.ctx) {
    if (!ctx || !this.bufferCtx || !this.imageData || !this.canvas) {
      return;
    }

    const width = this.bufferWidth;
    const height = this.bufferHeight;
    const data = this.imageData.data;
    const palette = this.palette;
    const paletteShift = this.paletteOffset | 0;

    const timeA = this.time * 1.25;
    const timeB = this.time * 1.7;
    const timeC = this.time * 0.9;
    const timeD = this.time * 1.45;
    const timeE = this.time * 1.1;

    let pixelIndex = 0;
    let dataIndex = 0;

    for (let y = 0; y < height; y++) {
      const yA = this.yPhaseA[y] + timeB;
      const yB = this.yPhaseB[y];
      const yC = this.yPhaseC[y] - timeD;

      for (let x = 0; x < width; x++) {
        const plasma =
          Math.sin(this.xPhaseA[x] + timeA) +
          Math.sin(yA) +
          Math.sin(this.xPhaseB[x] + yB + timeC) +
          Math.sin(this.xPhaseC[x] - yC) +
          Math.sin(this.radialField[pixelIndex] - timeE);

        const colorIndex = (((plasma + 5) * 25.5) + paletteShift) & 255;
        const paletteIndex = colorIndex * 4;

        data[dataIndex] = palette[paletteIndex];
        data[dataIndex + 1] = palette[paletteIndex + 1];
        data[dataIndex + 2] = palette[paletteIndex + 2];
        data[dataIndex + 3] = 255;

        pixelIndex++;
        dataIndex += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferWidth,
      this.bufferHeight,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    ctx.restore();
  }

  resize(canvas = this.canvas, ctx = this.ctx) {
    this.canvas = canvas || this.canvas;
    this.ctx = ctx || this.ctx;

    if (!this.canvas || !this.bufferCanvas || !this.bufferCtx) {
      return;
    }

    const nextWidth = Math.max(1, Math.floor(this.canvas.width * RENDER_SCALE));
    const nextHeight = Math.max(1, Math.floor(this.canvas.height * RENDER_SCALE));

    this.bufferWidth = nextWidth;
    this.bufferHeight = nextHeight;
    this.bufferCanvas.width = nextWidth;
    this.bufferCanvas.height = nextHeight;
    this.imageData = this.bufferCtx.createImageData(nextWidth, nextHeight);

    this.precomputeFields();
  }

  precomputeFields() {
    const width = this.bufferWidth;
    const height = this.bufferHeight;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.xPhaseA = new Float32Array(width);
    this.xPhaseB = new Float32Array(width);
    this.xPhaseC = new Float32Array(width);
    this.yPhaseA = new Float32Array(height);
    this.yPhaseB = new Float32Array(height);
    this.yPhaseC = new Float32Array(height);
    this.radialField = new Float32Array(width * height);

    for (let x = 0; x < width; x++) {
      this.xPhaseA[x] = x * 0.118;
      this.xPhaseB[x] = x * 0.051;
      this.xPhaseC[x] = x * 0.082;
    }

    for (let y = 0; y < height; y++) {
      this.yPhaseA[y] = y * 0.094;
      this.yPhaseB[y] = y * 0.065;
      this.yPhaseC[y] = y * 0.071;
    }

    let index = 0;
    for (let y = 0; y < height; y++) {
      const dy = (y - centerY) * 0.9;
      for (let x = 0; x < width; x++) {
        const dx = (x - centerX) * 1.15;
        this.radialField[index++] = Math.hypot(dx, dy) * 0.19;
      }
    }
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCtx = null;
    this.bufferCanvas = null;
    this.imageData = null;
    this.xPhaseA = new Float32Array(0);
    this.xPhaseB = new Float32Array(0);
    this.xPhaseC = new Float32Array(0);
    this.yPhaseA = new Float32Array(0);
    this.yPhaseB = new Float32Array(0);
    this.yPhaseC = new Float32Array(0);
    this.radialField = new Float32Array(0);
  }
}
