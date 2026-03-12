const TAU = Math.PI * 2;
const BACKGROUND = '#0A0A0A';
const CORE_COLOR = { r: 255, g: 255, b: 255 };
const STAR_COLORS = [
  { r: 255, g: 255, b: 255, weight: 0.52 },
  { r: 214, g: 244, b: 255, weight: 0.26 },
  { r: 186, g: 235, b: 255, weight: 0.14 },
  { r: 0, g: 120, b: 212, weight: 0.05 },
  { r: 123, g: 97, b: 255, weight: 0.03 },
];

export class StarfieldEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.stars = [];
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.fieldRadius = 1;
    this.focalLength = 1;
    this.maxDepth = 1600;
    this.starCount = 600;
    this.baseSpeed = 520;
    this.rotation = 0;
    this.prevRotation = 0;
    this.rotationSpeed = 0.11;
    this.time = 0;
    this.lastDt = 1 / 60;
    this.colorTable = this.buildColorTable();
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.rotation = 0;
    this.prevRotation = 0;
    this.lastDt = 1 / 60;
    this.stars = [];
    this.resize(canvas, ctx);

    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this.makeStar(Math.random() * this.maxDepth + 1));
    }
  }

  update(dt) {
    if (!this.stars.length) return;

    this.lastDt = Math.max(1 / 240, dt || this.lastDt);
    this.time += this.lastDt;
    this.prevRotation = this.rotation;
    this.rotation += this.rotationSpeed * this.lastDt;

    const pulse = 1 + Math.sin(this.time * 1.7) * 0.08;
    for (const star of this.stars) {
      star.prevZ = star.z;
      star.z -= this.baseSpeed * star.speed * pulse * this.lastDt;

      if (star.z <= 1) {
        this.resetStar(star, this.maxDepth);
      }
    }
  }

  render(ctx) {
    const drawCtx = ctx || this.ctx;
    if (!drawCtx) return;

    drawCtx.fillStyle = BACKGROUND;
    drawCtx.fillRect(0, 0, this.width, this.height);

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const prevCos = Math.cos(this.prevRotation);
    const prevSin = Math.sin(this.prevRotation);
    const margin = Math.max(this.width, this.height) * 0.35;

    drawCtx.save();
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    this.stars.sort((a, b) => b.z - a.z);

    for (const star of this.stars) {
      const rx = star.x * cos - star.y * sin;
      const ry = star.x * sin + star.y * cos;
      const invZ = this.focalLength / Math.max(star.z, 1);
      const sx = this.centerX + rx * invZ;
      const sy = this.centerY + ry * invZ;

      if (
        (sx < -margin || sx > this.width + margin || sy < -margin || sy > this.height + margin) &&
        star.z < this.maxDepth * 0.22
      ) {
        this.resetStar(star, this.maxDepth);
        continue;
      }

      if (sx < -margin || sx > this.width + margin || sy < -margin || sy > this.height + margin) {
        continue;
      }

      const prevRx = star.x * prevCos - star.y * prevSin;
      const prevRy = star.x * prevSin + star.y * prevCos;
      const prevInvZ = this.focalLength / Math.max(star.prevZ, 1);
      const px = this.centerX + prevRx * prevInvZ;
      const py = this.centerY + prevRy * prevInvZ;

      const depthRatio = 1 - star.z / this.maxDepth;
      const twinkle = 0.84 + 0.16 * Math.sin(this.time * 2.4 + star.seed);
      const brightness = Math.min(1, (0.2 + depthRatio * 1.05) * twinkle);
      const size = Math.max(0.8, 0.25 + depthRatio * depthRatio * 4.8 + invZ * 0.65);

      if (depthRatio > 0.45) {
        const trailMix = Math.min(0.62, 0.18 + depthRatio * 0.38);
        const startX = sx + (px - sx) * trailMix;
        const startY = sy + (py - sy) * trailMix;
        drawCtx.strokeStyle = this.rgba(star.color, Math.min(0.8, brightness * 0.55));
        drawCtx.lineWidth = Math.max(0.6, size * 0.5);
        drawCtx.beginPath();
        drawCtx.moveTo(startX, startY);
        drawCtx.lineTo(sx, sy);
        drawCtx.stroke();
      }

      drawCtx.fillStyle = this.rgba(star.color, Math.min(1, 0.3 + brightness * 0.8));
      if (size <= 1.15) {
        drawCtx.fillRect(sx, sy, size, size);
      } else {
        drawCtx.beginPath();
        drawCtx.arc(sx, sy, size * 0.5, 0, TAU);
        drawCtx.fill();

        drawCtx.fillStyle = this.rgba(CORE_COLOR, Math.min(1, 0.18 + brightness * 0.9));
        drawCtx.beginPath();
        drawCtx.arc(sx, sy, Math.max(0.45, size * 0.18), 0, TAU);
        drawCtx.fill();
      }
    }

    drawCtx.restore();
  }

  resize(canvas, ctx) {
    if (canvas) this.canvas = canvas;
    if (ctx) this.ctx = ctx;
    if (!this.canvas) return;

    const previousRadius = this.fieldRadius;
    const previousCount = this.starCount;

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.centerX = this.width * 0.5;
    this.centerY = this.height * 0.5;
    this.fieldRadius = Math.max(this.width, this.height) * 0.8;
    this.focalLength = Math.max(180, Math.min(this.width, this.height) * 0.95);
    this.maxDepth = Math.max(1400, this.fieldRadius * 1.7);
    this.starCount = Math.max(480, Math.min(1100, Math.floor((this.width * this.height) / 2200)));

    if (!this.stars.length || !previousRadius) {
      return;
    }

    const radiusScale = this.fieldRadius / previousRadius;
    for (const star of this.stars) {
      star.x *= radiusScale;
      star.y *= radiusScale;
      star.z = Math.min(star.z, this.maxDepth);
      star.prevZ = Math.min(star.prevZ, this.maxDepth);
    }

    if (this.starCount > previousCount) {
      for (let i = previousCount; i < this.starCount; i++) {
        this.stars.push(this.makeStar(Math.random() * this.maxDepth + 1));
      }
    } else if (this.starCount < previousCount) {
      this.stars.length = this.starCount;
    }
  }

  destroy() {
    this.stars.length = 0;
    this.canvas = null;
    this.ctx = null;
  }

  buildColorTable() {
    let totalWeight = 0;
    for (const color of STAR_COLORS) {
      totalWeight += color.weight;
    }

    let cursor = 0;
    return STAR_COLORS.map((color) => {
      cursor += color.weight / totalWeight;
      return { threshold: cursor, color };
    });
  }

  pickColor() {
    const roll = Math.random();
    for (const entry of this.colorTable) {
      if (roll <= entry.threshold) {
        return entry.color;
      }
    }
    return this.colorTable[this.colorTable.length - 1].color;
  }

  makeStar(z) {
    const star = {
      x: 0,
      y: 0,
      z: 0,
      prevZ: 0,
      speed: 1,
      seed: Math.random() * TAU,
      color: STAR_COLORS[0],
    };

    this.resetStar(star, z);
    return star;
  }

  resetStar(star, z = this.maxDepth) {
    const angle = Math.random() * TAU;
    const radius = this.fieldRadius * (0.05 + Math.pow(Math.random(), 0.58) * 0.95);

    star.speed = 0.72 + Math.random() * 0.72;
    star.x = Math.cos(angle) * radius * (0.8 + Math.random() * 0.28);
    star.y = Math.sin(angle) * radius * (0.8 + Math.random() * 0.28);
    star.z = Math.max(1, Math.min(z, this.maxDepth));
    star.prevZ = Math.min(this.maxDepth, star.z + this.baseSpeed * star.speed * this.lastDt);
    star.seed = Math.random() * TAU;
    star.color = this.pickColor();
  }

  rgba(color, alpha) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }
}
