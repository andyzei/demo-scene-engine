import { PALETTE, RGB, lerpColor, rgbCSS } from '../palette.js';

const MESSAGES = [
  'MICROSOFT EDGE',
  '× COPILOT ×',
  'HACKATHON 2026',
  'WELCOME TO THE DEMO SCENE',
  '31337',
  'PUSHING PIXELS SINCE 1991',
];

const COLOR_SEQUENCE = [
  RGB.edgeBlue,
  RGB.copilotPurple,
  RGB.neonCyan,
  RGB.neonMagenta,
];

const FONT_FAMILY = 'Arial Black, Segoe UI, Helvetica, Arial, sans-serif';

function wrapIndex(index, length) {
  return ((index % length) + length) % length;
}

function paletteColorAt(phase) {
  const total = COLOR_SEQUENCE.length;
  const normalized = ((phase % total) + total) % total;
  const fromIndex = Math.floor(normalized);
  const toIndex = (fromIndex + 1) % total;
  return lerpColor(COLOR_SEQUENCE[fromIndex], COLOR_SEQUENCE[toIndex], normalized - fromIndex);
}

export class SineScrollEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;

    this.time = 0;
    this.colorPhase = 0;
    this.messageIndex = 0;
    this.message = '';
    this.characters = [];
    this.messageWidth = 0;
    this.scrollX = Number.NaN;

    this.fontSize = 96;
    this.baseY = 0;
    this.waveAmplitude = 48;
    this.scrollSpeed = 220;
    this.letterSpacing = 4;
    this.messageGap = 160;

    this.stars = [];
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.colorPhase = 0;
    this.messageIndex = 0;
    this.message = MESSAGES[0];
    this.resize(canvas, ctx);
    this.setMessage(0, true);
  }

  setFont(ctx) {
    ctx.font = `900 ${this.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  setMessage(index, resetPosition = false) {
    this.messageIndex = wrapIndex(index, MESSAGES.length);
    this.message = MESSAGES[this.messageIndex];
    this.measureMessage();

    if (resetPosition || !Number.isFinite(this.scrollX)) {
      this.scrollX = this.canvas.width + this.fontSize;
    }
  }

  measureMessage() {
    if (!this.ctx) {
      return;
    }

    this.setFont(this.ctx);
    this.characters = [];

    let width = 0;
    for (const char of this.message) {
      const charWidth = Math.max(10, this.ctx.measureText(char).width);
      this.characters.push({ char, width: charWidth });
      width += charWidth + this.letterSpacing;
    }

    this.messageWidth = Math.max(0, width - this.letterSpacing);
  }

  buildStars() {
    const area = this.canvas.width * this.canvas.height;
    const count = Math.max(32, Math.floor(area / 14000));
    this.stars = Array.from({ length: count }, () => this.makeStar(true));
  }

  makeStar(randomizeX = false) {
    const depth = Math.random();
    return {
      x: randomizeX ? Math.random() * this.canvas.width : this.canvas.width + Math.random() * this.canvas.width * 0.25,
      y: Math.random() * this.canvas.height,
      size: 0.8 + depth * 2.2,
      speed: 12 + depth * 48,
      alpha: 0.2 + depth * 0.5,
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  resetStar(star) {
    const depth = Math.random();
    star.x = this.canvas.width + Math.random() * this.canvas.width * 0.3;
    star.y = Math.random() * this.canvas.height;
    star.size = 0.8 + depth * 2.2;
    star.speed = 12 + depth * 48;
    star.alpha = 0.2 + depth * 0.5;
    star.twinkle = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (!this.canvas) {
      return;
    }

    this.time += dt;
    this.colorPhase = (this.colorPhase + dt * 1.15) % COLOR_SEQUENCE.length;
    this.scrollX -= this.scrollSpeed * dt;

    if (this.scrollX + this.messageWidth < -this.messageGap) {
      this.setMessage(this.messageIndex + 1, true);
    }

    for (const star of this.stars) {
      star.x -= star.speed * dt;
      star.twinkle += dt * (0.8 + star.speed * 0.02);

      if (star.x < -star.size * 2) {
        this.resetStar(star);
      }
    }
  }

  renderBackground(ctx) {
    ctx.fillStyle = PALETTE.deepBlack;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, 'rgba(10, 10, 10, 1)');
    gradient.addColorStop(0.55, 'rgba(12, 14, 24, 0.96)');
    gradient.addColorStop(1, 'rgba(10, 10, 10, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const glow = ctx.createRadialGradient(
      this.canvas.width * 0.5,
      this.baseY,
      this.fontSize * 0.2,
      this.canvas.width * 0.5,
      this.baseY,
      this.canvas.width * 0.65,
    );
    glow.addColorStop(0, 'rgba(123, 97, 255, 0.09)');
    glow.addColorStop(0.45, 'rgba(0, 120, 212, 0.06)');
    glow.addColorStop(1, 'rgba(10, 10, 10, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const star of this.stars) {
      const twinkle = (Math.sin(star.twinkle) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * (0.45 + twinkle * 0.55)})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  render(ctx) {
    if (!this.canvas) {
      return;
    }

    this.renderBackground(ctx);
    this.setFont(ctx);

    let x = this.scrollX;

    ctx.save();
    for (let i = 0; i < this.characters.length; i++) {
      const glyph = this.characters[i];
      const char = glyph.char;
      const width = glyph.width;

      if (x > this.canvas.width + width) {
        x += width + this.letterSpacing;
        continue;
      }

      if (x + width < -width) {
        x += width + this.letterSpacing;
        continue;
      }

      const wave =
        Math.sin(this.time * 5.4 + i * 0.62) * this.waveAmplitude +
        Math.sin(this.time * 2.15 + i * 0.18) * this.waveAmplitude * 0.28;
      const y = this.baseY + wave;
      const color = paletteColorAt(this.colorPhase + i * 0.22);
      const glowColor = rgbCSS(color, 0.95);
      const fillColor = rgbCSS(color);

      ctx.shadowBlur = this.fontSize * 0.52;
      ctx.shadowColor = glowColor;
      ctx.fillStyle = rgbCSS(color, 0.42);
      ctx.fillText(char, x, y);

      ctx.shadowBlur = 0;
      ctx.fillStyle = fillColor;
      ctx.fillText(char, x, y);

      x += width + this.letterSpacing;
    }
    ctx.restore();
  }

  resize(canvas, ctx) {
    const previousWidth = this.canvas ? this.canvas.width : canvas.width;
    const previousScrollX = Number.isFinite(this.scrollX) ? this.scrollX : null;

    this.canvas = canvas;
    this.ctx = ctx;
    this.fontSize = Math.max(56, Math.round(canvas.height * 0.18));
    this.baseY = canvas.height * 0.52;
    this.waveAmplitude = Math.max(20, Math.round(canvas.height * 0.11));
    this.scrollSpeed = Math.max(180, canvas.width * 0.24);
    this.letterSpacing = Math.max(2, Math.round(this.fontSize * 0.045));
    this.messageGap = Math.max(this.fontSize * 2.5, canvas.width * 0.18);

    if (previousScrollX !== null && previousWidth > 0) {
      this.scrollX = previousScrollX * (canvas.width / previousWidth);
    }

    this.buildStars();
    this.measureMessage();

    if (!Number.isFinite(this.scrollX)) {
      this.scrollX = canvas.width + this.fontSize;
    }
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.characters = [];
    this.stars = [];
  }
}
