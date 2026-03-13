const TAU = Math.PI * 2;
const BACKGROUND = '#0A0A0A';
const CORE_COLOR = { r: 255, g: 255, b: 255 };
const STAR_COLORS = [
  { r: 255, g: 255, b: 255, weight: 0.44 },
  { r: 214, g: 244, b: 255, weight: 0.22 },
  { r: 186, g: 235, b: 255, weight: 0.14 },
  { r: 0, g: 120, b: 212, weight: 0.10 },
  { r: 123, g: 97, b: 255, weight: 0.06 },
  { r: 0, g: 255, b: 255, weight: 0.04 },
];

// Nebula cloud definitions
const NEBULA_COLORS = [
  { r: 0, g: 120, b: 212 },   // Edge Blue
  { r: 123, g: 97, b: 255 },  // Copilot Purple
  { r: 0, g: 183, b: 195 },   // Teal
  { r: 255, g: 0, b: 255 },   // Neon Magenta
];

export class StarfieldEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.stars = [];
    this.comets = [];
    this.nebulae = [];
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.fieldRadius = 1;
    this.focalLength = 1;
    this.maxDepth = 1600;
    this.starCount = 700;
    this.baseSpeed = 520;
    this.rotation = 0;
    this.prevRotation = 0;
    this.rotationSpeed = 0.11;
    this.time = 0;
    this.lastDt = 1 / 60;
    this.colorTable = this.buildColorTable();

    // Warp burst state
    this.warpTimer = 0;
    this.warpCooldown = 8;
    this.warpActive = false;
    this.warpIntensity = 0;
    this.warpDuration = 2.5;
    this.warpElapsed = 0;

    // Vortex glow
    this.vortexGlow = 0;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.rotation = 0;
    this.prevRotation = 0;
    this.lastDt = 1 / 60;
    this.warpTimer = 4 + Math.random() * 4;
    this.warpActive = false;
    this.warpIntensity = 0;
    this.warpElapsed = 0;
    this.stars = [];
    this.comets = [];
    this.nebulae = [];
    this.resize(canvas, ctx);

    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this.makeStar(Math.random() * this.maxDepth + 1));
    }

    // Spawn initial nebula clouds
    for (let i = 0; i < 5; i++) {
      this.nebulae.push(this.makeNebula());
    }
  }

  update(dt) {
    if (!this.stars.length) return;

    this.lastDt = Math.max(1 / 240, dt || this.lastDt);
    this.time += this.lastDt;
    this.prevRotation = this.rotation;
    this.rotation += this.rotationSpeed * this.lastDt;

    // Warp burst logic
    this.warpTimer -= this.lastDt;
    if (!this.warpActive && this.warpTimer <= 0) {
      this.warpActive = true;
      this.warpElapsed = 0;
      this.warpDuration = 1.8 + Math.random() * 1.5;
    }
    if (this.warpActive) {
      this.warpElapsed += this.lastDt;
      // Smooth ramp up and down
      const t = this.warpElapsed / this.warpDuration;
      this.warpIntensity = Math.sin(t * Math.PI); // 0 → 1 → 0
      if (this.warpElapsed >= this.warpDuration) {
        this.warpActive = false;
        this.warpIntensity = 0;
        this.warpTimer = 5 + Math.random() * 6;
      }
    }

    const warpMultiplier = 1 + this.warpIntensity * 3.5;
    const pulse = 1 + Math.sin(this.time * 1.7) * 0.08;
    const speedFactor = pulse * warpMultiplier;

    // Vortex glow follows warp
    this.vortexGlow += (this.warpIntensity * 0.6 - this.vortexGlow) * 4 * this.lastDt;

    for (const star of this.stars) {
      star.prevZ = star.z;
      star.z -= this.baseSpeed * star.speed * speedFactor * this.lastDt;

      if (star.z <= 1) {
        this.resetStar(star, this.maxDepth);
      }
    }

    // Comets
    if (Math.random() < 0.008 + this.warpIntensity * 0.02) {
      this.comets.push(this.makeComet());
    }
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.life -= this.lastDt;
      c.x += c.vx * this.lastDt;
      c.y += c.vy * this.lastDt;
      if (c.life <= 0) this.comets.splice(i, 1);
    }

    // Nebulae drift
    for (const n of this.nebulae) {
      n.x += n.vx * this.lastDt;
      n.y += n.vy * this.lastDt;
      n.phase += this.lastDt * 0.3;
      // Wrap around
      if (n.x < -n.radius * 2) n.x = this.width + n.radius;
      if (n.x > this.width + n.radius * 2) n.x = -n.radius;
      if (n.y < -n.radius * 2) n.y = this.height + n.radius;
      if (n.y > this.height + n.radius * 2) n.y = -n.radius;
    }
  }

  render(ctx) {
    const drawCtx = ctx || this.ctx;
    if (!drawCtx) return;

    drawCtx.fillStyle = BACKGROUND;
    drawCtx.fillRect(0, 0, this.width, this.height);

    // Render nebula clouds behind stars
    for (const n of this.nebulae) {
      const breathe = 1 + Math.sin(n.phase) * 0.15;
      const r = n.radius * breathe;
      const grad = drawCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      const c = n.color;
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${n.alpha * 0.7})`);
      grad.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${n.alpha * 0.3})`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      drawCtx.fillStyle = grad;
      drawCtx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
    }

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const prevCos = Math.cos(this.prevRotation);
    const prevSin = Math.sin(this.prevRotation);
    const margin = Math.max(this.width, this.height) * 0.35;

    drawCtx.save();
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    this.stars.sort((a, b) => b.z - a.z);

    // During warp, extend trails dramatically
    const trailScale = 1 + this.warpIntensity * 2.5;

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

      // Trails — longer during warp, start earlier
      const trailThreshold = 0.45 - this.warpIntensity * 0.3;
      if (depthRatio > trailThreshold) {
        const trailMix = Math.min(0.85, (0.18 + depthRatio * 0.38) * trailScale);
        const startX = sx + (px - sx) * trailMix;
        const startY = sy + (py - sy) * trailMix;
        drawCtx.strokeStyle = this.rgba(star.color, Math.min(0.9, brightness * (0.55 + this.warpIntensity * 0.3)));
        drawCtx.lineWidth = Math.max(0.6, size * (0.5 + this.warpIntensity * 0.4));
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

    // Render comets
    for (const c of this.comets) {
      const alpha = Math.min(1, c.life / c.maxLife * 2) * 0.9;
      const tailLen = c.speed * 0.12;
      const grad = drawCtx.createLinearGradient(
        c.x, c.y,
        c.x - c.vx / c.speed * tailLen,
        c.y - c.vy / c.speed * tailLen
      );
      grad.addColorStop(0, this.rgba(c.color, alpha));
      grad.addColorStop(1, this.rgba(c.color, 0));
      drawCtx.strokeStyle = grad;
      drawCtx.lineWidth = c.size;
      drawCtx.beginPath();
      drawCtx.moveTo(c.x, c.y);
      drawCtx.lineTo(
        c.x - c.vx / c.speed * tailLen,
        c.y - c.vy / c.speed * tailLen
      );
      drawCtx.stroke();

      // Bright head
      drawCtx.fillStyle = this.rgba(CORE_COLOR, alpha * 0.9);
      drawCtx.beginPath();
      drawCtx.arc(c.x, c.y, c.size * 0.6, 0, TAU);
      drawCtx.fill();
    }

    // Center vortex glow
    if (this.vortexGlow > 0.01) {
      const glowRadius = Math.min(this.width, this.height) * 0.35;
      const grad = drawCtx.createRadialGradient(
        this.centerX, this.centerY, 0,
        this.centerX, this.centerY, glowRadius
      );
      grad.addColorStop(0, `rgba(0, 120, 212, ${this.vortexGlow * 0.25})`);
      grad.addColorStop(0.3, `rgba(123, 97, 255, ${this.vortexGlow * 0.12})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      drawCtx.fillStyle = grad;
      drawCtx.fillRect(0, 0, this.width, this.height);
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
    this.comets.length = 0;
    this.nebulae.length = 0;
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
      x: 0, y: 0, z: 0, prevZ: 0,
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

  makeComet() {
    const side = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    const speed = 300 + Math.random() * 500;
    switch (side) {
      case 0: x = -20; y = Math.random() * this.height; vx = speed; vy = (Math.random() - 0.5) * speed * 0.5; break;
      case 1: x = this.width + 20; y = Math.random() * this.height; vx = -speed; vy = (Math.random() - 0.5) * speed * 0.5; break;
      case 2: y = -20; x = Math.random() * this.width; vy = speed; vx = (Math.random() - 0.5) * speed * 0.5; break;
      default: y = this.height + 20; x = Math.random() * this.width; vy = -speed; vx = (Math.random() - 0.5) * speed * 0.5; break;
    }
    const life = 1.5 + Math.random() * 2;
    const colors = [
      { r: 0, g: 255, b: 255 },
      { r: 0, g: 120, b: 212 },
      { r: 123, g: 97, b: 255 },
    ];
    return {
      x, y, vx, vy, speed,
      life, maxLife: life,
      size: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  makeNebula() {
    return {
      x: Math.random() * (this.width || 1920),
      y: Math.random() * (this.height || 1080),
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 12,
      radius: 120 + Math.random() * 250,
      alpha: 0.04 + Math.random() * 0.06,
      color: NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)],
      phase: Math.random() * TAU,
    };
  }

  rgba(color, alpha) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }
}
