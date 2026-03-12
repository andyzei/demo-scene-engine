import { RGB } from '../palette.js';

const TWO_PI = Math.PI * 2;
const TEXTURE_SIZE = 256;
const TEXTURE_MASK = TEXTURE_SIZE - 1;
const TEXTURE_SHIFT = 8;
const BRAND_STOPS = [
  RGB.deepBlack,
  RGB.edgeBlue,
  RGB.copilotPurple,
  RGB.neonCyan,
  RGB.edgeBlue,
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleBrandGradient(t) {
  const clamped = Math.max(0, Math.min(0.9999, t));
  const scaled = clamped * (BRAND_STOPS.length - 1);
  const index = scaled | 0;
  const localT = scaled - index;
  const c0 = BRAND_STOPS[index];
  const c1 = BRAND_STOPS[index + 1];

  return {
    r: lerp(c0.r, c1.r, localT),
    g: lerp(c0.g, c1.g, localT),
    b: lerp(c0.b, c1.b, localT),
  };
}

export class TunnelEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.time = 0;

    this.renderScale = 1;
    this.renderWidth = 0;
    this.renderHeight = 0;

    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;

    this.textureData = null;
    this.angleLut = null;
    this.distanceLut = null;

    this.lutWidth = 0;
    this.lutHeight = 0;
    this.lutPaddingX = 0;
    this.lutPaddingY = 0;
    this.wobbleRangeX = 0;
    this.wobbleRangeY = 0;
    this.invMaxDistance = 0;
    this.depthScale = 0;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;

    if (!this.textureData) {
      this.buildTexture();
    }

    this.resize(canvas, ctx);
  }

  update(dt) {
    this.time += dt;
  }

  render(ctx = this.ctx) {
    if (!ctx || !this.imageData || !this.bufferCtx || !this.bufferCanvas) {
      return;
    }

    const dst = this.imageData.data;
    const tex = this.textureData;
    const angleLut = this.angleLut;
    const distanceLut = this.distanceLut;
    const lutWidth = this.lutWidth;
    const renderWidth = this.renderWidth;
    const renderHeight = this.renderHeight;
    const mask = TEXTURE_MASK;
    const shift = TEXTURE_SHIFT;
    const invMaxDistance = this.invMaxDistance;
    const depthScale = this.depthScale;

    const wobbleX = Math.round(
      Math.sin(this.time * 1.35) * this.wobbleRangeX * 0.65 +
      Math.sin(this.time * 0.49 + 1.7) * this.wobbleRangeX * 0.35
    );
    const wobbleY = Math.round(
      Math.sin(this.time * 1.08 + 0.6) * this.wobbleRangeY * 0.6 +
      Math.sin(this.time * 0.71 + 2.3) * this.wobbleRangeY * 0.4
    );

    const startX = this.lutPaddingX + wobbleX;
    const startY = this.lutPaddingY + wobbleY;
    const angleScroll = (this.time * 42) | 0;
    const depthScroll = (this.time * 180) | 0;

    let dstIndex = 0;
    for (let y = 0; y < renderHeight; y++) {
      let lutIndex = (y + startY) * lutWidth + startX;
      for (let x = 0; x < renderWidth; x++, lutIndex++) {
        const distance = distanceLut[lutIndex];
        const depth = depthScale / distance;
        const texU = (angleLut[lutIndex] + angleScroll + depth * 0.55) & mask;
        const texV = (depth + depthScroll) & mask;
        const texIndex = (((texV << shift) + texU) << 2);

        const radius = distance * invMaxDistance;
        const fog = 1 - Math.min(1, radius * radius * 1.08);
        const depthLight = Math.min(1, 0.32 + depth * 0.03);
        const shade = Math.min(1, fog * (0.45 + depthLight * 0.95));

        dst[dstIndex] = tex[texIndex] * shade;
        dst[dstIndex + 1] = tex[texIndex + 1] * shade;
        dst[dstIndex + 2] = tex[texIndex + 2] * shade;
        dst[dstIndex + 3] = 255;
        dstIndex += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bufferCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  resize(canvas = this.canvas, ctx = this.ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    if (!canvas) {
      return;
    }

    const area = Math.max(1, canvas.width * canvas.height);
    this.renderScale = Math.min(1, Math.max(0.28, Math.sqrt(140000 / area)));
    this.renderWidth = Math.max(120, Math.round(canvas.width * this.renderScale));
    this.renderHeight = Math.max(68, Math.round(canvas.height * this.renderScale));

    this.depthScale = Math.min(this.renderWidth, this.renderHeight) * 4.5;
    this.wobbleRangeX = Math.max(10, Math.round(this.renderWidth * 0.075));
    this.wobbleRangeY = Math.max(10, Math.round(this.renderHeight * 0.085));
    this.lutPaddingX = this.wobbleRangeX + 2;
    this.lutPaddingY = this.wobbleRangeY + 2;
    this.lutWidth = this.renderWidth + this.lutPaddingX * 2;
    this.lutHeight = this.renderHeight + this.lutPaddingY * 2;

    const maxRadius = Math.hypot(
      this.renderWidth * 0.5 + this.wobbleRangeX,
      this.renderHeight * 0.5 + this.wobbleRangeY
    );
    this.invMaxDistance = maxRadius > 0 ? 1 / maxRadius : 0;

    if (!this.bufferCanvas) {
      this.bufferCanvas = document.createElement('canvas');
    }

    this.bufferCanvas.width = this.renderWidth;
    this.bufferCanvas.height = this.renderHeight;
    this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    this.bufferCtx.imageSmoothingEnabled = false;
    this.imageData = this.bufferCtx.createImageData(this.renderWidth, this.renderHeight);

    this.buildLookupTables();

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.textureData = null;
    this.angleLut = null;
    this.distanceLut = null;
  }

  buildTexture() {
    const data = new Uint8ClampedArray(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const fy = y / TEXTURE_SIZE;
      const rings = 0.5 + 0.5 * Math.sin(fy * Math.PI * 38);

      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const fx = x / TEXTURE_SIZE;
        const stripes = 0.5 + 0.5 * Math.sin(fx * Math.PI * 14 + rings * 2.6);
        const interference = 0.5 + 0.5 * Math.sin((x + y) * 0.11);
        const band = Math.min(1, rings * 0.58 + stripes * 0.28 + interference * 0.14);
        const base = sampleBrandGradient(band);
        const cyanLift = stripes * stripes * 0.2 + rings * 0.1;

        const index = ((y * TEXTURE_SIZE) + x) << 2;
        data[index] = Math.min(255, base.r + (RGB.neonCyan.r - base.r) * cyanLift);
        data[index + 1] = Math.min(255, base.g + (RGB.neonCyan.g - base.g) * cyanLift);
        data[index + 2] = Math.min(255, base.b + (RGB.neonCyan.b - base.b) * cyanLift);
        data[index + 3] = 255;
      }
    }

    this.textureData = data;
  }

  buildLookupTables() {
    const total = this.lutWidth * this.lutHeight;
    this.angleLut = new Uint16Array(total);
    this.distanceLut = new Float32Array(total);

    const centerX = this.lutWidth * 0.5;
    const centerY = this.lutHeight * 0.5;

    let index = 0;
    for (let y = 0; y < this.lutHeight; y++) {
      const dy = y - centerY;
      for (let x = 0; x < this.lutWidth; x++, index++) {
        const dx = x - centerX;
        const distance = Math.max(1, Math.hypot(dx, dy));
        let angle = Math.atan2(dy, dx);
        if (angle < 0) {
          angle += TWO_PI;
        }

        this.angleLut[index] = ((angle / TWO_PI) * TEXTURE_SIZE) & TEXTURE_MASK;
        this.distanceLut[index] = distance;
      }
    }
  }
}
