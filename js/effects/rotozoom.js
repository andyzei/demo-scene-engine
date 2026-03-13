import { RGB } from '../palette.js';

const TEXTURE_SIZE = 256;
const TEXTURE_MASK = TEXTURE_SIZE - 1;
const FIXED_SHIFT = 16;
const FIXED_ONE = 1 << FIXED_SHIFT;
const BRAND_COLORS = [
  RGB.edgeBlue,
  RGB.copilotPurple,
  RGB.teal,
  RGB.deepBlack,
];

function wrapTexture(value) {
  return ((value % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
}

function createRenderSurface(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class RotozoomEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.angle = 0;

    this.texture = this.buildTexture();

    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.frame = null;
    this.renderWidth = 0;
    this.renderHeight = 0;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.angle = 0;
    this.resize(canvas, ctx);
  }

  buildTexture() {
    const texture = new Uint8ClampedArray(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const i = (y * TEXTURE_SIZE + x) * 4;
        const checker = ((x >> 4) ^ (y >> 4)) & 1;
        const xorBand = ((x ^ y) >> 4) & 3;
        const stripe = (((x >> 5) + (y >> 5)) ^ xorBand) & 3;
        const index = checker ? xorBand : stripe;
        const color = BRAND_COLORS[index];
        const accent = BRAND_COLORS[(index + 1) & 3];
        const border = (x & 15) === 0 || (y & 15) === 0;
        const grain = 0.72 + ((((x * 5) ^ (y * 3)) & 31) / 31) * 0.38;
        const blend = border ? 0.35 : 0.08;

        texture[i] = Math.min(255, (color.r + (accent.r - color.r) * blend) * grain);
        texture[i + 1] = Math.min(255, (color.g + (accent.g - color.g) * blend) * grain);
        texture[i + 2] = Math.min(255, (color.b + (accent.b - color.b) * blend) * grain);
        texture[i + 3] = 255;
      }
    }

    return texture;
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    const width = Math.max(1, canvas.width | 0);
    const height = Math.max(1, canvas.height | 0);
    const targetPixels = 110000;
    const reduction = Math.max(1.5, Math.sqrt((width * height) / targetPixels));
    const renderWidth = Math.max(1, Math.floor(width / reduction));
    const renderHeight = Math.max(1, Math.floor(height / reduction));

    if (renderWidth === this.renderWidth && renderHeight === this.renderHeight && this.bufferCtx && this.frame) {
      return;
    }

    this.renderWidth = renderWidth;
    this.renderHeight = renderHeight;
    this.bufferCanvas = createRenderSurface(renderWidth, renderHeight);
    this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    this.frame = this.bufferCtx.createImageData(renderWidth, renderHeight);
  }

  update(dt) {
    this.time += dt;

    const rotationSpeed =
      0.55 +
      0.22 * Math.sin(this.time * 0.63) +
      0.18 * Math.sin(this.time * 1.47 + 1.1);

    this.angle += rotationSpeed * dt;
  }

  render(ctx) {
    if (!this.canvas || !this.bufferCtx || !this.frame) return;

    const width = this.renderWidth;
    const height = this.renderHeight;
    const dst = this.frame.data;
    const tex = this.texture;
    const t = this.time;

    const zoom = 1.0 + 0.28 * Math.sin(t * 0.88) + 0.16 * Math.sin(t * 1.73 + 0.6);
    const texelsPerPixel = 1.15 / Math.max(0.45, zoom);
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    const stepUX = cosA * texelsPerPixel;
    const stepVX = sinA * texelsPerPixel;
    const stepUY = -sinA * texelsPerPixel;
    const stepVY = cosA * texelsPerPixel;

    const centerU = wrapTexture(TEXTURE_SIZE * 0.5 + Math.cos(t * 0.31) * 40 + t * 22);
    const centerV = wrapTexture(TEXTURE_SIZE * 0.5 + Math.sin(t * 0.27) * 40 + t * 18);

    const halfW = width * 0.5;
    const halfH = height * 0.5;
    let rowU = centerU - halfW * stepUX - halfH * stepUY;
    let rowV = centerV - halfW * stepVX - halfH * stepVY;

    const dux = Math.floor(stepUX * FIXED_ONE);
    const dvx = Math.floor(stepVX * FIXED_ONE);
    const duy = Math.floor(stepUY * FIXED_ONE);
    const dvy = Math.floor(stepVY * FIXED_ONE);

    let dstIndex = 0;

    for (let y = 0; y < height; y++) {
      let u = Math.floor(rowU * FIXED_ONE);
      let v = Math.floor(rowV * FIXED_ONE);
      const scanline = (y & 1) === 0 ? 1 : 0.9;
      const ny = y / height - 0.5;

      for (let x = 0; x < width; x++) {
        const tx = (u >> FIXED_SHIFT) & TEXTURE_MASK;
        const ty = (v >> FIXED_SHIFT) & TEXTURE_MASK;
        const srcIndex = (ty * TEXTURE_SIZE + tx) * 4;
        const nx = x / width - 0.5;
        const vignette = 1 - Math.min(0.45, (nx * nx + ny * ny) * 0.9);
        const shade = scanline * vignette;

        dst[dstIndex] = tex[srcIndex] * shade;
        dst[dstIndex + 1] = tex[srcIndex + 1] * shade;
        dst[dstIndex + 2] = tex[srcIndex + 2] * shade;
        dst[dstIndex + 3] = 255;

        dstIndex += 4;
        u += dux;
        v += dvx;
      }

      rowU += stepUY;
      rowV += stepVY;
    }

    this.bufferCtx.putImageData(this.frame, 0, 0);

    ctx.save();
    ctx.fillStyle = 'rgb(10, 10, 10)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bufferCanvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = 'rgb(255, 255, 255)';

    for (let y = 0; y < this.canvas.height; y += 4) {
      ctx.fillRect(0, y, this.canvas.width, 1);
    }

    ctx.restore();
  }

  destroy() {
    if (this.bufferCanvas) {
      this.bufferCanvas.width = 0;
      this.bufferCanvas.height = 0;
    }

    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.frame = null;
    this.canvas = null;
    this.ctx = null;
  }
}
