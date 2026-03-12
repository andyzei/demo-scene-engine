import { PALETTE, RGB, buildGradient, rgbCSS } from '../palette.js';

const TAU = Math.PI * 2;
const TRAIL_ALPHA = 0.16;
const CELL_SIZE = 52;
const NEIGHBOR_RADIUS = 56;
const SEPARATION_RADIUS = 18;
const MAX_SPEED = 168;
const MIN_SPEED = 10;
const GRADIENT = buildGradient([
  { color: RGB.edgeBlue, pos: 0 },
  { color: RGB.copilotPurple, pos: 0.33 },
  { color: RGB.teal, pos: 0.7 },
  { color: RGB.neonCyan, pos: 1 },
]);
const GRADIENT_CSS = GRADIENT.map((color) => rgbCSS(color));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap(value, min, max) {
  const span = max - min;
  if (span <= 0) return min;
  let wrapped = (value - min) % span;
  if (wrapped < 0) wrapped += span;
  return wrapped + min;
}

export class ParticlesEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.particles = [];
    this.attractors = [];
    this.grid = new Map();
    this.layout = [
      { u: 0, v: 0, driftX: 0.18, driftY: 0.14, phase: 0.0, strength: 165, spin: 1 },
      { u: 0, v: -1.28, driftX: 0.14, driftY: 0.11, phase: 0.9, strength: 190, spin: -1 },
      { u: 1.0, v: 0, driftX: 0.12, driftY: 0.17, phase: 1.8, strength: 170, spin: 1 },
      { u: 0, v: 1.28, driftX: 0.16, driftY: 0.13, phase: 2.7, strength: 190, spin: -1 },
      { u: -1.0, v: 0, driftX: 0.13, driftY: 0.18, phase: 3.6, strength: 170, spin: 1 },
    ];
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.resize(canvas, ctx);
    this.fillBackground(1);
  }

  update(dt) {
    if (!this.width || !this.height || !this.particles.length) return;

    const step = Math.min(dt || 0.016, 0.05);
    this.time += step;
    this.updateAttractors();
    this.rebuildGrid();

    const neighborRadiusSq = NEIGHBOR_RADIUS * NEIGHBOR_RADIUS;
    const separationRadiusSq = SEPARATION_RADIUS * SEPARATION_RADIUS;
    const margin = 24;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const cellX = Math.floor(particle.x / CELL_SIZE);
      const cellY = Math.floor(particle.y / CELL_SIZE);

      let alignmentX = 0;
      let alignmentY = 0;
      let alignmentCount = 0;
      let separationX = 0;
      let separationY = 0;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = this.grid.get(`${cellX + ox},${cellY + oy}`);
          if (!bucket) continue;

          for (let j = 0; j < bucket.length; j++) {
            const otherIndex = bucket[j];
            if (otherIndex === i) continue;

            const other = this.particles[otherIndex];
            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= 0 || distSq > neighborRadiusSq) continue;

            alignmentX += other.vx;
            alignmentY += other.vy;
            alignmentCount++;

            if (distSq < separationRadiusSq) {
              const force = 1 / (distSq + 12);
              separationX -= dx * force;
              separationY -= dy * force;
            }
          }
        }
      }

      let nearest = this.attractors[0];
      let nearestIndex = 0;
      let nearestDx = nearest.x - particle.x;
      let nearestDy = nearest.y - particle.y;
      let nearestDistSq = nearestDx * nearestDx + nearestDy * nearestDy;

      for (let j = 1; j < this.attractors.length; j++) {
        const attractor = this.attractors[j];
        const dx = attractor.x - particle.x;
        const dy = attractor.y - particle.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearest = attractor;
          nearestIndex = j;
          nearestDx = dx;
          nearestDy = dy;
          nearestDistSq = distSq;
        }
      }

      const distance = Math.sqrt(nearestDistSq + 80);
      const attraction = Math.min(nearest.strength / (nearestDistSq + 450), 0.5);
      let ax = (nearestDx / distance) * attraction * 900;
      let ay = (nearestDy / distance) * attraction * 900;

      const swirl = nearest.spin * 70 / (distance + 45);
      ax += (-nearestDy / distance) * swirl;
      ay += (nearestDx / distance) * swirl;

      if (alignmentCount > 0) {
        const avgVX = alignmentX / alignmentCount;
        const avgVY = alignmentY / alignmentCount;
        ax += (avgVX - particle.vx) * 0.22;
        ay += (avgVY - particle.vy) * 0.22;
      }

      ax += separationX * 135;
      ay += separationY * 135;

      const wander = 10 + nearestIndex * 2;
      ax += Math.sin(this.time * (0.9 + particle.seed * 0.5) + particle.seed * 13) * wander;
      ay += Math.cos(this.time * (0.7 + particle.seed * 0.4) + particle.seed * 17) * wander;

      particle.vx += ax * step;
      particle.vy += ay * step;

      const drag = Math.max(0.86, 1 - step * 0.6);
      particle.vx *= drag;
      particle.vy *= drag;

      let speed = Math.hypot(particle.vx, particle.vy);
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        particle.vx *= scale;
        particle.vy *= scale;
        speed = MAX_SPEED;
      } else if (speed < MIN_SPEED) {
        const kick = (MIN_SPEED - speed) * 0.6;
        particle.vx += (Math.random() - 0.5) * kick;
        particle.vy += (Math.random() - 0.5) * kick;
        speed = Math.hypot(particle.vx, particle.vy);
      }

      particle.x += particle.vx * step;
      particle.y += particle.vy * step;

      particle.x = wrap(particle.x, -margin, this.width + margin);
      particle.y = wrap(particle.y, -margin, this.height + margin);
      particle.speed = speed;
      particle.attractorIndex = nearestIndex;
    }
  }

  render(ctx) {
    if (!ctx || !this.width || !this.height) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(10, 10, 10, ${TRAIL_ALPHA})`;
    ctx.fillRect(0, 0, this.width, this.height);

    this.renderAttractorHints(ctx);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const speedT = clamp(particle.speed / MAX_SPEED, 0, 1);
      const attractorPhase = particle.attractorIndex / Math.max(1, this.attractors.length - 1);
      const gradientT = (speedT * 0.68 + attractorPhase * 0.22 + particle.colorOffset * 0.1) % 1;
      const color = GRADIENT_CSS[Math.floor(gradientT * 255)];
      const radius = clamp(particle.radius + speedT * 0.85, 1, 3);

      ctx.globalAlpha = 0.24 + speedT * 0.68;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  resize(canvas, ctx) {
    if (canvas) this.canvas = canvas;
    if (ctx) this.ctx = ctx;

    const previousWidth = this.width || this.canvas?.width || 1;
    const previousHeight = this.height || this.canvas?.height || 1;

    this.width = this.canvas?.width || 0;
    this.height = this.canvas?.height || 0;

    if (!this.width || !this.height) return;

    const scaleX = this.width / previousWidth;
    const scaleY = this.height / previousHeight;

    if (this.particles.length) {
      for (let i = 0; i < this.particles.length; i++) {
        const particle = this.particles[i];
        particle.x *= scaleX;
        particle.y *= scaleY;
        particle.x = clamp(particle.x, 0, this.width);
        particle.y = clamp(particle.y, 0, this.height);
      }
    }

    this.ensureParticleCount();
    this.updateAttractors();
    this.fillBackground(1);
  }

  destroy() {
    this.grid.clear();
    this.particles.length = 0;
    this.attractors.length = 0;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }

  ensureParticleCount() {
    const area = this.width * this.height;
    const target = clamp(Math.round(area / 2600), 500, 800);

    while (this.particles.length < target) {
      this.particles.push(this.makeParticle());
    }

    if (this.particles.length > target) {
      this.particles.length = target;
    }
  }

  makeParticle() {
    const spread = Math.min(this.width, this.height) * 0.36;
    const angle = Math.random() * TAU;
    const radial = Math.sqrt(Math.random()) * spread;
    const x = this.width * 0.5 + Math.cos(angle) * radial + (Math.random() - 0.5) * this.width * 0.14;
    const y = this.height * 0.5 + Math.sin(angle) * radial + (Math.random() - 0.5) * this.height * 0.14;
    const heading = Math.random() * TAU;
    const speed = 16 + Math.random() * 42;

    return {
      x: clamp(x, 0, this.width),
      y: clamp(y, 0, this.height),
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      radius: 1 + Math.random() * 1.35,
      seed: Math.random(),
      colorOffset: Math.random(),
      speed,
      attractorIndex: 0,
    };
  }

  updateAttractors() {
    if (!this.width || !this.height) return;

    const centerX = this.width * 0.5 + Math.sin(this.time * 0.18) * this.width * 0.08;
    const centerY = this.height * 0.5 + Math.cos(this.time * 0.16) * this.height * 0.07;
    const rotation = Math.sin(this.time * 0.1) * 0.2 + this.time * 0.08;
    const sin = Math.sin(rotation);
    const cos = Math.cos(rotation);
    const starScale = Math.min(this.width, this.height) * 0.12;

    this.attractors.length = this.layout.length;

    for (let i = 0; i < this.layout.length; i++) {
      const point = this.layout[i];
      const localX = point.u * starScale;
      const localY = point.v * starScale;
      const rotatedX = localX * cos - localY * sin;
      const rotatedY = localX * sin + localY * cos;
      const driftX = Math.sin(this.time * point.driftX + point.phase) * this.width * 0.028;
      const driftY = Math.cos(this.time * point.driftY + point.phase) * this.height * 0.028;

      this.attractors[i] = {
        x: centerX + rotatedX + driftX,
        y: centerY + rotatedY + driftY,
        strength: point.strength,
        spin: point.spin,
        colorIndex: Math.floor((i / Math.max(1, this.layout.length - 1)) * 255),
      };
    }
  }

  rebuildGrid() {
    this.grid.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const cellX = Math.floor(particle.x / CELL_SIZE);
      const cellY = Math.floor(particle.y / CELL_SIZE);
      const key = `${cellX},${cellY}`;
      const bucket = this.grid.get(key);

      if (bucket) {
        bucket.push(i);
      } else {
        this.grid.set(key, [i]);
      }
    }
  }

  renderAttractorHints(ctx) {
    if (!this.attractors.length) return;

    const center = this.attractors[0];

    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = GRADIENT_CSS[200];
    ctx.beginPath();
    for (let i = 1; i < this.attractors.length; i++) {
      const attractor = this.attractors[i];
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(attractor.x, attractor.y);
    }
    ctx.stroke();

    for (let i = 0; i < this.attractors.length; i++) {
      const attractor = this.attractors[i];
      ctx.globalAlpha = i === 0 ? 0.14 : 0.11;
      ctx.fillStyle = GRADIENT_CSS[attractor.colorIndex];
      ctx.beginPath();
      ctx.arc(attractor.x, attractor.y, i === 0 ? 4 : 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  fillBackground(alpha) {
    if (!this.ctx || !this.width || !this.height) return;
    this.ctx.save();
    this.ctx.fillStyle = alpha >= 1 ? PALETTE.deepBlack : `rgba(10, 10, 10, ${alpha})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }
}
