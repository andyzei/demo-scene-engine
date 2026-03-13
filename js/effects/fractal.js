import { RGB, buildGradient } from '../palette.js';

const INSIDE_COLOR = RGB.deepBlack;
const FRACTAL_PALETTE = buildGradient([
  { color: RGB.edgeBlue, pos: 0 },
  { color: RGB.copilotPurple, pos: 0.25 },
  { color: RGB.neonCyan, pos: 0.5 },
  { color: RGB.neonMagenta, pos: 0.75 },
  { color: RGB.edgeBlue, pos: 1 },
]);

export class FractalEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.pixels = null;

    this.renderScale = 0.25;
    this.frameInterval = 1 / 10;
    this.baseSpan = 3.2;
    this.zoomRate = 0.14;
    this.startIterations = 100;
    this.maxIterations = this.startIterations;

    this.targetX = -0.743643887037151;
    this.targetY = 0.13182590420533;

    this.time = 0;
    this.zoomTime = 0;
    this.frameTimer = 0;
    this.zoom = 1;
    this.aspect = 1;
    this.needsRender = true;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.zoomTime = 0;
    this.frameTimer = 0;
    this.zoom = 1;
    this.maxIterations = this.startIterations;
    this.needsRender = true;

    this.bufferCanvas = document.createElement('canvas');
    this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    this.resize(canvas, ctx);
  }

  update(dt) {
    this.time += dt;
    this.zoomTime += dt;
    this.frameTimer += dt;

    this.zoom = Math.exp(this.zoomTime * this.zoomRate);
    const zoomDepth = this.zoomTime * this.zoomRate;
    this.maxIterations = Math.min(
      320,
      Math.round(this.startIterations + zoomDepth * 14 + Math.pow(zoomDepth + 1, 1.2) * 6)
    );

    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer %= this.frameInterval;
      this.needsRender = true;
    }
  }

  render(ctx) {
    if (!this.bufferCanvas || !this.bufferCtx || !this.imageData) return;

    if (this.needsRender) {
      this.renderFractal();
      this.needsRender = false;
    }

    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bufferCanvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = previousSmoothing;
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    if (!this.bufferCanvas) {
      this.bufferCanvas = document.createElement('canvas');
      this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    }

    const width = Math.max(1, Math.floor(canvas.width * this.renderScale));
    const height = Math.max(1, Math.floor(canvas.height * this.renderScale));

    this.bufferCanvas.width = width;
    this.bufferCanvas.height = height;
    this.aspect = width / height;
    this.imageData = this.bufferCtx.createImageData(width, height);
    this.pixels = this.imageData.data;
    this.needsRender = true;
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.pixels = null;
  }

  renderFractal() {
    const width = this.bufferCanvas.width;
    const height = this.bufferCanvas.height;
    const pixels = this.pixels;
    const spanX = this.baseSpan / this.zoom;
    const spanY = spanX / this.aspect;
    const driftX = spanX * 0.06 * Math.cos(this.time * 0.21);
    const driftY = spanY * 0.05 * Math.sin(this.time * 0.17);
    const centerX = this.targetX + driftX;
    const centerY = this.targetY + driftY;
    const minX = centerX - spanX * 0.5;
    const maxY = centerY + spanY * 0.5;
    const stepX = spanX / width;
    const stepY = spanY / height;
    const maxIterations = this.maxIterations;

    let offset = 0;
    for (let y = 0, cy = maxY; y < height; y += 1, cy -= stepY) {
      for (let x = 0, cx = minX; x < width; x += 1, cx += stepX) {
        let zx = 0;
        let zy = 0;
        let zx2 = 0;
        let zy2 = 0;
        let iteration = 0;

        while (zx2 + zy2 <= 4 && iteration < maxIterations) {
          zy = 2 * zx * zy + cy;
          zx = zx2 - zy2 + cx;
          zx2 = zx * zx;
          zy2 = zy * zy;
          iteration += 1;
        }

        if (iteration >= maxIterations) {
          pixels[offset] = INSIDE_COLOR.r;
          pixels[offset + 1] = INSIDE_COLOR.g;
          pixels[offset + 2] = INSIDE_COLOR.b;
          pixels[offset + 3] = 255;
          offset += 4;
          continue;
        }

        const magnitude = Math.sqrt(zx2 + zy2);
        const smoothIteration = iteration + 1 - Math.log2(Math.log2(Math.max(magnitude, 2)));
        const colorIndex = Math.floor(smoothIteration * 10) & 255;
        const color = FRACTAL_PALETTE[colorIndex];

        pixels[offset] = color.r;
        pixels[offset + 1] = color.g;
        pixels[offset + 2] = color.b;
        pixels[offset + 3] = 255;
        offset += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);
  }
}
