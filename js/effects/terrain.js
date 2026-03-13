const DEEP_BLACK = { r: 10, g: 10, b: 10 };
const EDGE_BLUE = { r: 0, g: 120, b: 212 };
const TEAL = { r: 0, g: 183, b: 195 };
const COPILOT_PURPLE = { r: 123, g: 97, b: 255 };
const NEON_CYAN = { r: 0, g: 255, b: 255 };
const WHITE = { r: 245, g: 250, b: 255 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixColor(a, b, t) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function scaleColor(color, factor) {
  return {
    r: clamp(Math.round(color.r * factor), 0, 255),
    g: clamp(Math.round(color.g * factor), 0, 255),
    b: clamp(Math.round(color.b * factor), 0, 255),
  };
}

function toRgb(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function toRgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

class PerlinNoise {
  constructor(seed = 31337) {
    const source = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) {
      source[i] = i;
    }

    let state = seed >>> 0;
    for (let i = 255; i > 0; i -= 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const j = state % (i + 1);
      const tmp = source[i];
      source[i] = source[j];
      source[j] = tmp;
    }

    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i += 1) {
      this.perm[i] = source[i & 255];
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  grad(hash, x, y) {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  noise2D(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xi = x0 & 255;
    const yi = y0 & 255;
    const xf = x - x0;
    const yf = y - y0;
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    const x1 = lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  fbm(x, y, octaves = 4) {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let normalizer = 0;

    for (let i = 0; i < octaves; i += 1) {
      sum += this.noise2D(x * frequency, y * frequency) * amplitude;
      normalizer += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return normalizer ? sum / normalizer : 0;
  }
}

export class TerrainEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.horizonY = 0;
    this.horizonGlowY = 0;
    this.projectionX = 0;
    this.projectionY = 0;
    this.cameraHeight = 56;
    this.baseCameraHeight = 56;
    this.heightScale = 28;
    this.forwardSpeed = 26;
    this.scroll = 0;
    this.time = 0;
    this.cameraX = 0;
    this.bank = 0;
    this.columns = 0;
    this.rows = 0;
    this.verticalWireStep = 3;
    this.nearZ = 26;
    this.rowSpacing = 8.5;
    this.terrainWidth = 0;
    this.xCoords = new Float32Array(0);
    this.rowDepths = new Float32Array(0);
    this.rowFog = new Float32Array(0);
    this.rowScalesX = new Float32Array(0);
    this.rowScalesY = new Float32Array(0);
    this.projectedRows = [];
    this.rowAverageHeight = new Float32Array(0);
    this.noise = new PerlinNoise(31337);
    this.colorCache = new Map();
    this.horizonColor = mixColor(DEEP_BLACK, EDGE_BLUE, 0.52);
    this.skyBase = '#0A0A0A';

    // Rolling spheres
    this.sphereRadius1 = 5;
    this.sphereRadius2 = 4;
    this.sphereDepth1 = 160;
    this.sphereDepth2 = 100;
    this.sphereRotation1 = 0;
    this.sphereRotation2 = 0;
    this.sphereTex1 = null;
    this.sphereTex2 = null;
    this.sphereTexturesReady = false;
    this._sphereBuffer = null;
    this._sphereBufferCtx = null;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scroll = Math.random() * 5000;
    this.time = 0;
    this.cameraX = 0;
    this.bank = 0;
    this.colorCache.clear();
    this.resize(canvas, ctx);
    if (!this.sphereTexturesReady) this._loadSphereTextures();
  }

  update(dt) {
    const delta = Math.max(0, dt || 0);
    this.time += delta;
    this.scroll += this.forwardSpeed * delta;

    const targetX =
      this.noise.fbm(this.time * 0.08, 14.75, 3) * 38 +
      Math.sin(this.time * 0.17) * 18;
    const follow = 1 - Math.exp(-delta * 1.6);
    this.cameraX = lerp(this.cameraX, targetX, follow);

    const targetBank =
      this.noise.fbm(41.3, this.time * 0.11, 3) * 0.9 +
      Math.sin(this.time * 0.23) * 0.35;
    this.bank = lerp(this.bank, targetBank, 1 - Math.exp(-delta * 1.3));

    const ride = this.noise.fbm(73.1, this.time * 0.09, 2) * 4 + Math.sin(this.time * 0.6) * 1.5;
    this.cameraHeight = this.baseCameraHeight + ride;

    this.sphereRotation1 += (this.forwardSpeed / this.sphereRadius1) * delta;
    this.sphereRotation2 += (this.forwardSpeed / this.sphereRadius2) * delta;
  }

  render(ctx = this.ctx) {
    if (!ctx || !this.canvas) {
      return;
    }

    this.projectTerrain();
    this.drawBackground(ctx);
    this.drawTerrainStrips(ctx);
    this.drawWireframe(ctx);
    this._drawSpheres(ctx);
  }

  resize(canvas = this.canvas, ctx = this.ctx) {
    this.canvas = canvas || this.canvas;
    this.ctx = ctx || this.ctx;

    if (!this.canvas) {
      return;
    }

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.centerX = this.width * 0.5;
    this.horizonY = this.height * 0.33;
    this.horizonGlowY = this.horizonY + this.height * 0.04;
    this.projectionX = this.width * 0.9;
    this.projectionY = this.height * 1.02;
    this.heightScale = Math.max(22, Math.min(34, Math.min(this.width, this.height) * 0.028));
    this.baseCameraHeight = this.heightScale * 1.92;
    this.cameraHeight = this.baseCameraHeight;

    this.columns = Math.max(80, Math.min(100, Math.round(this.width / 22)));
    this.rows = Math.max(60, Math.min(74, Math.round(this.height / 18)));
    this.verticalWireStep = Math.max(2, Math.round(this.columns / 28));
    this.rowSpacing = 8.2;
    this.terrainWidth = Math.max(380, this.width * 0.34);

    this.xCoords = new Float32Array(this.columns);
    this.rowDepths = new Float32Array(this.rows);
    this.rowFog = new Float32Array(this.rows);
    this.rowScalesX = new Float32Array(this.rows);
    this.rowScalesY = new Float32Array(this.rows);
    this.rowAverageHeight = new Float32Array(this.rows);
    this.projectedRows = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.columns }, () => ({ sx: 0, sy: 0, h: 0 }))
    );

    const halfWidth = this.terrainWidth * 0.5;
    for (let col = 0; col < this.columns; col += 1) {
      const t = this.columns === 1 ? 0.5 : col / (this.columns - 1);
      this.xCoords[col] = lerp(-halfWidth, halfWidth, t);
    }

    for (let row = 0; row < this.rows; row += 1) {
      const z = this.nearZ + row * this.rowSpacing;
      const fog = Math.pow(row / Math.max(1, this.rows - 1), 1.35);
      this.rowDepths[row] = z;
      this.rowFog[row] = fog;
      this.rowScalesX[row] = this.projectionX / z;
      this.rowScalesY[row] = this.projectionY / z;
    }

    this.colorCache.clear();
  }

  destroy() {
    this.projectedRows.length = 0;
    this.colorCache.clear();
    this.xCoords = new Float32Array(0);
    this.rowDepths = new Float32Array(0);
    this.rowFog = new Float32Array(0);
    this.rowScalesX = new Float32Array(0);
    this.rowScalesY = new Float32Array(0);
    this.rowAverageHeight = new Float32Array(0);
    this._sphereBuffer = null;
    this._sphereBufferCtx = null;
    this.sphereTex1 = null;
    this.sphereTex2 = null;
    this.sphereTexturesReady = false;
    this.canvas = null;
    this.ctx = null;
  }

  projectTerrain() {
    const bottomClamp = this.height + this.height * 0.28;
    const topClamp = -this.height * 0.2;
    const horizonDrift = Math.sin(this.time * 0.2) * this.height * 0.01;

    for (let row = 0; row < this.rows; row += 1) {
      const sampleZ = this.scroll + this.rowDepths[row];
      const scaleX = this.rowScalesX[row];
      const scaleY = this.rowScalesY[row];
      const fog = this.rowFog[row];
      const bankShift = this.bank * this.width * 0.055 * (1 - fog * 0.45);
      let rowHeightSum = 0;

      for (let col = 0; col < this.columns; col += 1) {
        const localX = this.xCoords[col];
        const worldX = this.cameraX + localX;
        const height = this.sampleHeight(worldX, sampleZ);
        const point = this.projectedRows[row][col];
        const sy = this.horizonY + horizonDrift + (this.cameraHeight - height) * scaleY;

        point.sx = this.centerX + localX * scaleX + bankShift;
        point.sy = clamp(sy, topClamp, bottomClamp);
        point.h = height;
        rowHeightSum += height;
      }

      this.rowAverageHeight[row] = rowHeightSum / this.columns;
    }
  }

  drawBackground(ctx) {
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, '#0A0A0A');
    sky.addColorStop(0.56, '#0A0A0A');
    sky.addColorStop(0.78, 'rgba(0, 50, 92, 0.65)');
    sky.addColorStop(1, 'rgb(5, 10, 18)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    const glow = ctx.createRadialGradient(
      this.centerX,
      this.horizonGlowY,
      0,
      this.centerX,
      this.horizonGlowY,
      Math.max(this.width * 0.24, this.height * 0.26)
    );
    glow.addColorStop(0, 'rgba(0, 255, 255, 0.16)');
    glow.addColorStop(0.25, 'rgba(0, 183, 195, 0.14)');
    glow.addColorStop(0.55, 'rgba(0, 120, 212, 0.18)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    const sunGlow = ctx.createRadialGradient(
      this.centerX,
      this.horizonY + this.height * 0.025,
      0,
      this.centerX,
      this.horizonY + this.height * 0.025,
      Math.min(this.width, this.height) * 0.11
    );
    sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    sunGlow.addColorStop(0.45, 'rgba(0, 255, 255, 0.06)');
    sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(0, 183, 195, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.horizonY + this.height * 0.005);
    ctx.lineTo(this.width, this.horizonY + this.height * 0.005);
    ctx.stroke();
    ctx.restore();
  }

  drawTerrainStrips(ctx) {
    ctx.save();
    ctx.lineJoin = 'round';

    for (let row = this.rows - 2; row >= 0; row -= 1) {
      const nearRow = this.projectedRows[row];
      const farRow = this.projectedRows[row + 1];
      const fog = this.rowFog[row + 1];

      for (let col = 0; col < this.columns - 1; col += 1) {
        const nearLeft = nearRow[col];
        const nearRight = nearRow[col + 1];
        const farLeft = farRow[col];
        const farRight = farRow[col + 1];
        const averageHeight = (nearLeft.h + nearRight.h + farLeft.h + farRight.h) * 0.25;

        ctx.fillStyle = this.getTerrainFillStyle(averageHeight, fog);
        ctx.beginPath();
        ctx.moveTo(farLeft.sx, farLeft.sy);
        ctx.lineTo(farRight.sx, farRight.sy);
        ctx.lineTo(nearRight.sx, nearRight.sy);
        ctx.lineTo(nearLeft.sx, nearLeft.sy);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawWireframe(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'screen';

    for (let row = this.rows - 1; row >= 0; row -= 1) {
      const points = this.projectedRows[row];
      const fog = this.rowFog[row];
      const averageHeight = this.rowAverageHeight[row];
      const stroke = mixColor(this.getBaseTerrainColor(averageHeight), WHITE, 0.18 + (1 - fog) * 0.18);

      ctx.strokeStyle = toRgba(mixColor(stroke, this.horizonColor, fog * 0.72), 0.12 + (1 - fog) * 0.33);
      ctx.lineWidth = 0.7 + (1 - fog) * 0.95;
      ctx.beginPath();
      ctx.moveTo(points[0].sx, points[0].sy);
      for (let col = 1; col < this.columns; col += 1) {
        ctx.lineTo(points[col].sx, points[col].sy);
      }
      ctx.stroke();
    }

    for (let col = 0; col < this.columns; col += this.verticalWireStep) {
      ctx.beginPath();
      let started = false;
      for (let row = this.rows - 1; row >= 0; row -= 1) {
        const point = this.projectedRows[row][col];
        if (!started) {
          ctx.moveTo(point.sx, point.sy);
          started = true;
        } else {
          ctx.lineTo(point.sx, point.sy);
        }
      }

      const columnMix = col / Math.max(1, this.columns - 1);
      const base = mixColor(TEAL, NEON_CYAN, 0.25 + 0.3 * Math.sin(columnMix * Math.PI));
      ctx.strokeStyle = toRgba(base, 0.16);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    ctx.restore();
  }

  _loadSphereTextures() {
    const edgeImg = new Image();
    const copilotImg = new Image();
    let loaded = 0;

    const onLoad = () => {
      if (++loaded < 2) return;
      this.sphereTex1 = this._createSphereTexture(edgeImg, EDGE_BLUE);
      this.sphereTex2 = this._createSphereTexture(copilotImg, COPILOT_PURPLE);
      this.sphereTexturesReady = true;
    };

    edgeImg.onload = onLoad;
    copilotImg.onload = onLoad;
    edgeImg.src = 'img/edge-logo.svg';
    copilotImg.src = 'img/copilot-logo.svg';
  }

  _createSphereTexture(img, accent) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const tctx = c.getContext('2d');

    tctx.clearRect(0, 0, size, size);

    const pad = 20;
    const maxDim = size - pad * 2;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const aspect = iw / ih;
    let w, h;
    if (aspect >= 1) { w = maxDim; h = maxDim / aspect; }
    else { h = maxDim; w = maxDim * aspect; }
    tctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    return { data: tctx.getImageData(0, 0, size, size).data, size, accent };
  }

  _drawSpheres(ctx) {
    if (!this.sphereTexturesReady || !ctx) return;

    const t = this.time;
    const horizonDrift = Math.sin(t * 0.2) * this.height * 0.01;

    const worldX1 = this.cameraX - 10 + Math.sin(t * 0.4) * 20;
    const worldZ1 = this.scroll + this.sphereDepth1;
    const h1 = this.sampleHeight(worldX1, worldZ1);

    const worldX2 = this.cameraX + 8 + Math.cos(t * 0.3) * 16;
    const worldZ2 = this.scroll + this.sphereDepth2;
    const h2 = this.sampleHeight(worldX2, worldZ2);

    const spheres = [
      this._projectSpherePoint(worldX1, h1 + this.sphereRadius1, this.sphereDepth1, this.sphereRadius1, horizonDrift, this.sphereTex1, this.sphereRotation1),
      this._projectSpherePoint(worldX2, h2 + this.sphereRadius2, this.sphereDepth2, this.sphereRadius2, horizonDrift, this.sphereTex2, this.sphereRotation2),
    ];

    spheres.sort((a, b) => b.depth - a.depth);

    for (const s of spheres) {
      if (s.depth < this.nearZ || s.sr < 2) continue;
      if (s.sx + s.sr < 0 || s.sx - s.sr > this.width) continue;
      if (s.sy + s.sr < 0 || s.sy - s.sr > this.height) continue;
      this._renderSphere(ctx, s);
    }
  }

  _projectSpherePoint(worldX, sphereY, depth, radius, horizonDrift, tex, rotation) {
    const localX = worldX - this.cameraX;
    const scaleX = this.projectionX / depth;
    const scaleY = this.projectionY / depth;
    const maxRow = Math.max(1, this.rows - 1);
    const fogT = Math.pow(clamp((depth - this.nearZ) / (maxRow * this.rowSpacing), 0, 1), 1.35);
    const bankShift = this.bank * this.width * 0.055 * (1 - fogT * 0.45);

    return {
      sx: this.centerX + localX * scaleX + bankShift,
      sy: this.horizonY + horizonDrift + (this.cameraHeight - sphereY) * scaleY,
      sr: radius * scaleX,
      depth,
      fog: fogT,
      tex,
      rotation,
    };
  }

  _renderSphere(ctx, s) {
    const { sx, sy, sr, tex, rotation, fog } = s;
    if (sr < 2) return;

    const diameter = Math.ceil(sr * 2);
    const halfD = diameter / 2;

    if (!this._sphereBuffer || this._sphereBuffer.width < diameter || this._sphereBuffer.height < diameter) {
      this._sphereBuffer = document.createElement('canvas');
      this._sphereBufferCtx = this._sphereBuffer.getContext('2d');
    }
    this._sphereBuffer.width = diameter;
    this._sphereBuffer.height = diameter;

    const imageData = this._sphereBufferCtx.createImageData(diameter, diameter);
    const data = imageData.data;

    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    // Normalized light direction (upper-left, into screen)
    const _lx = -0.4, _ly = -0.6, _lz = 0.75;
    const ll = 1 / Math.sqrt(_lx * _lx + _ly * _ly + _lz * _lz);
    const nlx = _lx * ll, nly = _ly * ll, nlz = _lz * ll;

    const texData = tex ? tex.data : null;
    const texSize = tex ? tex.size : 0;
    const accent = tex ? tex.accent : EDGE_BLUE;

    // Each logo cap covers ~60° from the pole
    const capCos = 0.5;
    const capExtent = Math.sqrt(1 - capCos * capCos);

    const hcr = this.horizonColor.r, hcg = this.horizonColor.g, hcb = this.horizonColor.b;
    const fogF = fog > 0.01 ? fog * 0.8 : 0;

    for (let py = 0; py < diameter; py++) {
      const ny = (2 * (py + 0.5) / diameter) - 1;
      const ny2 = ny * ny;

      for (let px = 0; px < diameter; px++) {
        const nx = (2 * (px + 0.5) / diameter) - 1;
        const r2 = nx * nx + ny2;
        if (r2 >= 1) continue;

        const nz = Math.sqrt(1 - r2);

        // Rotate into sphere local frame (Y-axis roll)
        const rx = nx * cosR + nz * sinR;
        const rz = -nx * sinR + nz * cosR;

        // Base color: dark with accent tint
        let cr = accent.r * 0.08 + 8;
        let cg = accent.g * 0.08 + 8;
        let cb = accent.b * 0.08 + 10;

        // Sample logo on front cap (rz ~ +1) and back cap (rz ~ -1)
        if (texData) {
          let capU = -1, capV = -1;
          if (rz > capCos) {
            capU = (rx / capExtent) * 0.5 + 0.5;
            capV = (ny / capExtent) * 0.5 + 0.5;
          } else if (rz < -capCos) {
            capU = (-rx / capExtent) * 0.5 + 0.5;
            capV = (ny / capExtent) * 0.5 + 0.5;
          }

          if (capU >= 0 && capU < 1 && capV >= 0 && capV < 1) {
            const tx = (capU * texSize) | 0;
            const ty = (capV * texSize) | 0;
            const ti = (ty * texSize + tx) * 4;
            const ta = texData[ti + 3] / 255;
            if (ta > 0.02) {
              const glow = 1.4;
              cr = cr * (1 - ta) + texData[ti] * glow * ta;
              cg = cg * (1 - ta) + texData[ti + 1] * glow * ta;
              cb = cb * (1 - ta) + texData[ti + 2] * glow * ta;
            }
          }
        }

        // Diffuse lighting
        const diff = Math.max(0, nx * nlx + ny * nly + nz * nlz);
        const lit = 0.15 + diff * 0.85;

        // Specular (Phong)
        const ndotl = nx * nlx + ny * nly + nz * nlz;
        const specR = ndotl > 0 ? Math.pow(Math.max(0, 2 * ndotl * nz - nlz), 48) : 0;

        cr = cr * lit + specR * 160;
        cg = cg * lit + specR * 160;
        cb = cb * lit + specR * 200;

        // Fresnel rim glow (neon cyan)
        const fresnel = Math.pow(1 - nz, 3.5);
        cr += fresnel * NEON_CYAN.r * 0.3;
        cg += fresnel * NEON_CYAN.g * 0.3;
        cb += fresnel * NEON_CYAN.b * 0.3;

        // Fog
        if (fogF > 0) {
          cr = cr * (1 - fogF) + hcr * fogF;
          cg = cg * (1 - fogF) + hcg * fogF;
          cb = cb * (1 - fogF) + hcb * fogF;
        }

        const idx = (py * diameter + px) * 4;
        data[idx]     = cr > 255 ? 255 : cr < 0 ? 0 : cr | 0;
        data[idx + 1] = cg > 255 ? 255 : cg < 0 ? 0 : cg | 0;
        data[idx + 2] = cb > 255 ? 255 : cb < 0 ? 0 : cb | 0;
        data[idx + 3] = 255;
      }
    }

    this._sphereBufferCtx.putImageData(imageData, 0, 0);

    // Ground shadow
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - fog);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy + sr * 0.85, sr * 0.75, sr * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Composite sphere onto scene
    ctx.drawImage(this._sphereBuffer, 0, 0, diameter, diameter,
      sx - halfD, sy - halfD, diameter, diameter);
  }

  sampleHeight(x, z) {
    const broad = this.noise.fbm(x * 0.0048, z * 0.0052, 4);
    const rolling = this.noise.fbm(x * 0.0105 + 18.7, z * 0.0115 + 6.3, 3);
    const detail = this.noise.noise2D(x * 0.024 + 73.2, z * 0.022 - 18.4);
    const ridges = 1 - Math.abs(this.noise.noise2D(x * 0.015 - 43.1, z * 0.016 + 29.7));
    const swell = Math.sin(x * 0.016 + z * 0.0032) * 0.08;
    const noiseValue = broad * 0.6 + rolling * 0.27 + detail * 0.1 + (ridges * 2 - 1) * 0.11 + swell - 0.04;
    const softened = Math.sign(noiseValue) * Math.pow(Math.abs(noiseValue), 0.92);
    return softened * this.heightScale;
  }

  getTerrainFillStyle(height, fog) {
    const heightKey = Math.round(clamp((height / (this.heightScale * 1.4) + 1) * 0.5, 0, 1) * 30);
    const fogKey = Math.round(clamp(fog, 0, 1) * 24);
    const cacheKey = `${heightKey}:${fogKey}`;
    const cached = this.colorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const base = this.getBaseTerrainColor((heightKey / 30 - 0.5) * this.heightScale * 2.8);
    const fogged = mixColor(base, this.horizonColor, (fogKey / 24) * 0.82);
    const shaded = scaleColor(fogged, 0.84 + (1 - fogKey / 24) * 0.2);
    const style = toRgb(shaded);
    this.colorCache.set(cacheKey, style);
    return style;
  }

  getBaseTerrainColor(height) {
    const normalized = clamp((height / (this.heightScale * 1.35) + 1) * 0.5, 0, 1);

    if (normalized < 0.34) {
      return mixColor(EDGE_BLUE, TEAL, smoothstep(0, 0.34, normalized));
    }
    if (normalized < 0.7) {
      return mixColor(TEAL, COPILOT_PURPLE, smoothstep(0.34, 0.7, normalized));
    }
    if (normalized < 0.9) {
      return mixColor(COPILOT_PURPLE, NEON_CYAN, smoothstep(0.7, 0.9, normalized));
    }
    return mixColor(NEON_CYAN, WHITE, smoothstep(0.9, 1, normalized));
  }
}
