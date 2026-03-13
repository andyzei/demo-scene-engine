const SCALE = 0.25;
const BACKGROUND = { r: 10, g: 10, b: 10 };
const THRESHOLD = 1.0;
const EPSILON = 0.0001;
const GRADIENT = [
  { r: 0, g: 120, b: 212 },
  { r: 123, g: 97, b: 255 },
  { r: 0, g: 183, b: 195 },
  { r: 0, g: 255, b: 255 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

function sampleGradient(t) {
  if (t <= 0) return GRADIENT[0];
  if (t >= 1) return GRADIENT[GRADIENT.length - 1];

  const scaled = t * (GRADIENT.length - 1);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const a = GRADIENT[index];
  const b = GRADIENT[index + 1];

  return {
    r: Math.round(lerp(a.r, b.r, localT)),
    g: Math.round(lerp(a.g, b.g, localT)),
    b: Math.round(lerp(a.b, b.b, localT)),
  };
}

export class MetaballsEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.width = 0;
    this.height = 0;
    this.renderWidth = 0;
    this.renderHeight = 0;
    this.scale = SCALE;
    this.threshold = THRESHOLD;
    this.time = 0;
    this.balls = [];
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize(canvas, ctx);
  }

  ensureBuffer(ctx) {
    if (!this.bufferCanvas && typeof document !== 'undefined') {
      this.bufferCanvas = document.createElement('canvas');
      this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: false });
    }

    if (!this.bufferCtx && ctx && typeof ctx.createImageData === 'function') {
      this.bufferCtx = ctx;
    }
  }

  createBalls() {
    const count = 7;
    const minDimension = Math.max(1, Math.min(this.width, this.height));
    const minRadius = Math.max(28, minDimension * 0.055);
    const maxRadius = Math.max(minRadius + 12, minDimension * 0.11);

    this.balls = Array.from({ length: count }, () => {
      const radius = lerp(minRadius, maxRadius, Math.random());
      const angle = Math.random() * Math.PI * 2;
      const speed = lerp(42, 88, Math.random());

      return {
        x: lerp(radius, Math.max(radius, this.width - radius), Math.random()),
        y: lerp(radius, Math.max(radius, this.height - radius), Math.random()),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        wobbleX: lerp(18, 42, Math.random()),
        wobbleY: lerp(18, 42, Math.random()),
        freqX: lerp(0.45, 0.9, Math.random()),
        freqY: lerp(0.4, 0.85, Math.random()),
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      };
    });
  }

  update(dt) {
    if (!this.canvas || this.balls.length === 0) return;

    this.time += dt;
    const maxX = this.width;
    const maxY = this.height;

    for (const ball of this.balls) {
      const vx = ball.vx + Math.sin(this.time * ball.freqX + ball.phaseX) * ball.wobbleX;
      const vy = ball.vy + Math.cos(this.time * ball.freqY + ball.phaseY) * ball.wobbleY;

      ball.x += vx * dt;
      ball.y += vy * dt;

      if (ball.x <= ball.radius) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x >= maxX - ball.radius) {
        ball.x = maxX - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y <= ball.radius) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y >= maxY - ball.radius) {
        ball.y = maxY - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }
    }
  }

  render(ctx) {
    if (!ctx || !this.imageData || !this.bufferCtx) return;

    const data = this.imageData.data;
    const scaledBalls = this.balls.map((ball) => {
      const scaledRadius = Math.max(1, ball.radius * this.scale);
      return {
        x: ball.x * this.scale,
        y: ball.y * this.scale,
        radiusSq: scaledRadius * scaledRadius,
      };
    });

    let offset = 0;
    for (let y = 0; y < this.renderHeight; y++) {
      const py = y + 0.5;
      for (let x = 0; x < this.renderWidth; x++) {
        const px = x + 0.5;
        let field = 0;

        for (let i = 0; i < scaledBalls.length; i++) {
          const ball = scaledBalls[i];
          const dx = px - ball.x;
          const dy = py - ball.y;
          field += ball.radiusSq / (dx * dx + dy * dy + EPSILON);
        }

        if (field >= this.threshold) {
          const intensity = 1 - Math.exp(-(field - this.threshold) * 0.55);
          const color = sampleGradient(Math.pow(clamp(intensity, 0, 1), 0.78));
          data[offset] = color.r;
          data[offset + 1] = color.g;
          data[offset + 2] = color.b;
          data[offset + 3] = 255;
        } else {
          data[offset] = BACKGROUND.r;
          data[offset + 1] = BACKGROUND.g;
          data[offset + 2] = BACKGROUND.b;
          data[offset + 3] = 255;
        }

        offset += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, this.width, this.height);

    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bufferCanvas, 0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = previousSmoothing;
  }

  resize(canvas, ctx) {
    const previousWidth = this.width || canvas.width;
    const previousHeight = this.height || canvas.height;

    this.canvas = canvas;
    this.ctx = ctx;
    this.width = Math.max(1, canvas.width);
    this.height = Math.max(1, canvas.height);
    this.renderWidth = Math.max(1, Math.round(this.width * this.scale));
    this.renderHeight = Math.max(1, Math.round(this.height * this.scale));

    this.ensureBuffer(ctx);
    if (!this.bufferCanvas || !this.bufferCtx) return;

    this.bufferCanvas.width = this.renderWidth;
    this.bufferCanvas.height = this.renderHeight;
    this.imageData = this.bufferCtx.createImageData(this.renderWidth, this.renderHeight);

    if (this.balls.length === 0) {
      this.createBalls();
      return;
    }

    const scaleX = this.width / Math.max(1, previousWidth);
    const scaleY = this.height / Math.max(1, previousHeight);
    const radiusScale = (scaleX + scaleY) * 0.5;
    const minDimension = Math.max(1, Math.min(this.width, this.height));
    const minRadius = Math.max(28, minDimension * 0.055);
    const maxRadius = Math.max(minRadius + 12, minDimension * 0.11);

    for (const ball of this.balls) {
      ball.x *= scaleX;
      ball.y *= scaleY;
      ball.radius = clamp(ball.radius * radiusScale, minRadius, maxRadius);
      ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
      ball.y = clamp(ball.y, ball.radius, this.height - ball.radius);
    }
  }

  destroy() {
    this.balls = [];
    this.imageData = null;
    this.bufferCtx = null;
    this.bufferCanvas = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.renderWidth = 0;
    this.renderHeight = 0;
    this.time = 0;
  }
}
