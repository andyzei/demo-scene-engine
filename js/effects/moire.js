import { PALETTE, RGB } from '../palette.js';

const BLUE = RGB.edgeBlue;
const PURPLE = RGB.copilotPurple;
const BLACK = RGB.deepBlack;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp255(value) {
  return Math.max(0, Math.min(255, value));
}

export class MoireEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.sources = [];

    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.pixels = null;

    this.renderWidth = 0;
    this.renderHeight = 0;
    this.xCoords = null;
    this.yCoords = null;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    this.createSources();
    this.resize(canvas, ctx);
  }

  createSources() {
    this.sources = [
      {
        anchorX: 0.24,
        anchorY: 0.32,
        driftX: 0.10,
        driftY: 0.13,
        orbitX: 0.07,
        orbitY: 0.05,
        freq: 0.330,
        phase: 0.2,
        speed: 0.27,
        phaseSpeed: 0.36,
        blueWeight: 1.00,
        purpleWeight: 0.22,
        polarity: 1,
        x: 0,
        y: 0,
      },
      {
        anchorX: 0.71,
        anchorY: 0.29,
        driftX: 0.11,
        driftY: 0.10,
        orbitX: 0.06,
        orbitY: 0.08,
        freq: 0.347,
        phase: 1.4,
        speed: 0.23,
        phaseSpeed: 0.31,
        blueWeight: 0.25,
        purpleWeight: 1.00,
        polarity: -1,
        x: 0,
        y: 0,
      },
      {
        anchorX: 0.34,
        anchorY: 0.72,
        driftX: 0.09,
        driftY: 0.11,
        orbitX: 0.05,
        orbitY: 0.07,
        freq: 0.364,
        phase: 2.5,
        speed: 0.19,
        phaseSpeed: 0.28,
        blueWeight: 0.80,
        purpleWeight: 0.42,
        polarity: 1,
        x: 0,
        y: 0,
      },
      {
        anchorX: 0.78,
        anchorY: 0.69,
        driftX: 0.12,
        driftY: 0.09,
        orbitX: 0.07,
        orbitY: 0.05,
        freq: 0.381,
        phase: 3.7,
        speed: 0.21,
        phaseSpeed: 0.34,
        blueWeight: 0.32,
        purpleWeight: 0.92,
        polarity: -1,
        x: 0,
        y: 0,
      },
    ];
  }

  update(dt) {
    this.time += dt;

    if (!this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      const orbitTime = this.time * source.speed + source.phase;
      const driftTime = this.time * (source.speed * 0.57 + source.phaseSpeed * 0.18) + source.phase * 1.37;

      source.x = width * (
        source.anchorX +
        source.driftX * Math.sin(driftTime) +
        source.orbitX * Math.cos(orbitTime * 0.91)
      );
      source.y = height * (
        source.anchorY +
        source.driftY * Math.cos(driftTime * 0.93) +
        source.orbitY * Math.sin(orbitTime * 1.07)
      );
    }
  }

  render(ctx) {
    if (!this.imageData || !this.bufferCtx || !this.canvas) return;

    const width = this.renderWidth;
    const height = this.renderHeight;
    const pixels = this.pixels;
    const xCoords = this.xCoords;
    const yCoords = this.yCoords;
    const sources = this.sources;
    const sourceCount = sources.length;
    const time = this.time;

    let offset = 0;

    for (let y = 0; y < height; y++) {
      const sy = yCoords[y];
      const ny = sy / this.canvas.height - 0.5;

      for (let x = 0; x < width; x++) {
        const sx = xCoords[x];
        const nx = sx / this.canvas.width - 0.5;

        let blueEnergy = 0;
        let purpleEnergy = 0;
        let beatField = 0;
        let waveBlend = 0;

        for (let i = 0; i < sourceCount; i++) {
          const source = sources[i];
          const dx = sx - source.x;
          const dy = sy - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const phase = dist * source.freq - time * source.phaseSpeed + source.phase;
          const wave = Math.sin(phase);
          const ring = Math.pow(0.5 + 0.5 * wave, 5.8);

          blueEnergy += ring * source.blueWeight;
          purpleEnergy += ring * source.purpleWeight;
          beatField += wave * source.polarity;
          waveBlend += wave;
        }

        const interference = Math.pow(0.5 + 0.5 * Math.sin(beatField * 2.2 + time * 0.55), 3.2);
        const shimmer = Math.pow(0.5 + 0.5 * Math.cos(waveBlend * 1.4 - time * 0.4), 2.6);
        const vignette = clamp01(1.14 - (nx * nx + ny * ny) * 1.35);

        blueEnergy = clamp01((blueEnergy / 2.0 + interference * 0.42 + shimmer * 0.18) * vignette);
        purpleEnergy = clamp01((purpleEnergy / 2.0 + interference * 0.46 + shimmer * 0.24) * vignette);
        const glow = clamp01((blueEnergy + purpleEnergy) * 0.72 + interference * 0.28);

        pixels[offset] = clamp255(BLACK.r + BLUE.r * blueEnergy * 0.92 + PURPLE.r * purpleEnergy * 0.64 + glow * 24);
        pixels[offset + 1] = clamp255(BLACK.g + BLUE.g * blueEnergy * 0.94 + PURPLE.g * purpleEnergy * 0.38 + glow * 10);
        pixels[offset + 2] = clamp255(BLACK.b + BLUE.b * blueEnergy * 1.02 + PURPLE.b * purpleEnergy * 1.04 + glow * 30);
        pixels[offset + 3] = 255;
        offset += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.deepBlack;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bufferCanvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    if (!this.bufferCanvas || !this.bufferCtx) {
      this.bufferCanvas = document.createElement('canvas');
      this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    }

    const baseScale = 0.28;
    let width = Math.max(180, Math.round(canvas.width * baseScale));
    let height = Math.max(100, Math.round(canvas.height * baseScale));
    const maxPixels = 160000;
    const totalPixels = width * height;

    if (totalPixels > maxPixels) {
      const scale = Math.sqrt(maxPixels / totalPixels);
      width = Math.max(180, Math.round(width * scale));
      height = Math.max(100, Math.round(height * scale));
    }

    this.renderWidth = width;
    this.renderHeight = height;
    this.bufferCanvas.width = width;
    this.bufferCanvas.height = height;
    this.imageData = this.bufferCtx.createImageData(width, height);
    this.pixels = this.imageData.data;

    this.xCoords = new Float32Array(width);
    this.yCoords = new Float32Array(height);

    const stepX = canvas.width / width;
    const stepY = canvas.height / height;

    for (let x = 0; x < width; x++) {
      this.xCoords[x] = (x + 0.5) * stepX;
    }

    for (let y = 0; y < height; y++) {
      this.yCoords[y] = (y + 0.5) * stepY;
    }

    this.update(0);
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.sources = [];
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.pixels = null;
    this.xCoords = null;
    this.yCoords = null;
  }
}
