// Ray Tracing — reflective spheres on a checkerboard floor

const EDGE_BLUE = { r: 0, g: 120, b: 212 };
const COPILOT_PURPLE = { r: 123, g: 97, b: 255 };
const NEON_CYAN = { r: 0, g: 255, b: 255 };
const NEON_MAGENTA = { r: 255, g: 0, b: 255 };
const DEEP_BLACK = { r: 10, g: 10, b: 10 };

const RENDER_SCALE = 0.25;
const MAX_DEPTH = 2;
const FOG_DIST = 30;
const EPSILON = 0.001;

// ── Vector math ──────────────────────────────────────────────

function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scl(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 1, z: 0 };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function reflect(d, n) {
  const dn2 = 2 * dot(d, n);
  return { x: d.x - dn2 * n.x, y: d.y - dn2 * n.y, z: d.z - dn2 * n.z };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ── Ray intersection ─────────────────────────────────────────

function hitSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const ecx = ox - cx;
  const ecy = oy - cy;
  const ecz = oz - cz;
  const b = 2 * (ecx * dx + ecy * dy + ecz * dz);
  const c = ecx * ecx + ecy * ecy + ecz * ecz - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) * 0.5;
  return t > EPSILON ? t : -1;
}

function hitPlane(oy, dy) {
  if (dy > -EPSILON) return -1;
  const t = -oy / dy;
  return t > EPSILON ? t : -1;
}

// ── Buffer canvas helper ────────────────────────────────────

function createBufferCanvas() {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(1, 1);
  }
  if (typeof document !== 'undefined' && document.createElement) {
    return document.createElement('canvas');
  }
  return null;
}

// ── Effect ───────────────────────────────────────────────────

export class RaytraceEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.imageData = null;
    this.bufferWidth = 0;
    this.bufferHeight = 0;
    this.time = 0;
    this.texSize = 64;
    this.edgeTex = null;
    this.copilotTex = null;
    this.texturesReady = false;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.bufferCanvas = this.bufferCanvas || createBufferCanvas();
    this.bufferCtx = this.bufferCanvas?.getContext('2d', { alpha: false, willReadFrequently: true }) || null;
    this.time = 0;
    this.resize(canvas, ctx);
    if (!this.texturesReady) this._loadTextures();
  }

  _loadTextures() {
    const sz = this.texSize;
    const edge = new Image();
    const copilot = new Image();
    let loaded = 0;

    const onLoad = () => {
      if (++loaded < 2) return;
      const tc = createBufferCanvas();
      if (!tc) return;
      tc.width = sz;
      tc.height = sz;
      const tctx = tc.getContext('2d');

      tctx.clearRect(0, 0, sz, sz);
      tctx.drawImage(edge, 0, 0, sz, sz);
      this.edgeTex = tctx.getImageData(0, 0, sz, sz).data;

      tctx.clearRect(0, 0, sz, sz);
      tctx.drawImage(copilot, 0, 0, sz, sz);
      this.copilotTex = tctx.getImageData(0, 0, sz, sz).data;

      this.texturesReady = true;
    };

    edge.onload = onLoad;
    copilot.onload = onLoad;
    edge.src = 'img/edge-logo.svg';
    copilot.src = 'img/copilot-logo.svg';
  }

  update(dt) {
    this.time += dt;
  }

  render(ctx = this.ctx) {
    if (!ctx || !this.bufferCtx || !this.imageData || !this.canvas) return;

    const w = this.bufferWidth;
    const h = this.bufferHeight;
    const data = this.imageData.data;
    const t = this.time;

    // Camera orbits the scene
    const camAngle = t * 0.25;
    const camR = 9;
    const camY = 3.5 + Math.sin(t * 0.4) * 0.8;
    const camX = Math.cos(camAngle) * camR;
    const camZ = Math.sin(camAngle) * camR;

    // Look-at target
    const tgtX = 0, tgtY = 1.0, tgtZ = 0;
    const fwd = normalize({ x: tgtX - camX, y: tgtY - camY, z: tgtZ - camZ });
    const right = normalize(cross(fwd, { x: 0, y: 1, z: 0 }));
    const up = cross(right, fwd);

    // Scene: two spheres
    const s1y = 1.5 + Math.sin(t * 1.0) * 0.4;
    const s2angle = t * 0.6;
    const s2x = Math.cos(s2angle) * 3.2;
    const s2z = Math.sin(s2angle) * 3.2;
    const s2y = 0.7 + Math.sin(t * 1.6) * 0.25;

    // Light orbits overhead
    const lAngle = t * 0.45;
    const lx = Math.cos(lAngle) * 5;
    const ly = 7 + Math.sin(t * 0.7) * 2;
    const lz = Math.sin(lAngle) * 5;

    const aspect = w / h;
    const fovScale = 0.9;

    let idx = 0;
    for (let py = 0; py < h; py++) {
      const ny = (1 - 2 * py / h) * fovScale;
      for (let px = 0; px < w; px++) {
        const nx = (2 * px / w - 1) * aspect * fovScale;

        // Primary ray direction
        const dx = right.x * nx + up.x * ny + fwd.x;
        const dy = right.y * nx + up.y * ny + fwd.y;
        const dz = right.z * nx + up.z * ny + fwd.z;
        const dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rdx = dx / dlen, rdy = dy / dlen, rdz = dz / dlen;

        const c = this._trace(
          camX, camY, camZ, rdx, rdy, rdz,
          0, s1y, s2x, s2z, s2y, lx, ly, lz, t, 0,
        );

        data[idx]     = c.r > 255 ? 255 : c.r < 0 ? 0 : c.r;
        data[idx + 1] = c.g > 255 ? 255 : c.g < 0 ? 0 : c.g;
        data[idx + 2] = c.b > 255 ? 255 : c.b < 0 ? 0 : c.b;
        data[idx + 3] = 255;
        idx += 4;
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.bufferCanvas,
      0, 0, this.bufferWidth, this.bufferHeight,
      0, 0, this.canvas.width, this.canvas.height,
    );
    ctx.restore();
  }

  _trace(ox, oy, oz, dx, dy, dz, s1x, s1y, s2x, s2z, s2y, lx, ly, lz, time, depth) {
    if (depth > MAX_DEPTH) return this._sky(dy, time);

    // Find nearest intersection
    let nearest = Infinity;
    let what = -1; // 0=floor, 1=sphere1, 2=sphere2

    const t1 = hitSphere(ox, oy, oz, dx, dy, dz, s1x, s1y, 0, 1.0);
    if (t1 > 0 && t1 < nearest) { nearest = t1; what = 1; }

    const t2 = hitSphere(ox, oy, oz, dx, dy, dz, s2x, s2y, s2z, 0.6);
    if (t2 > 0 && t2 < nearest) { nearest = t2; what = 2; }

    const tp = hitPlane(oy, dy);
    if (tp > 0 && tp < nearest) { nearest = tp; what = 0; }

    if (what < 0) return this._sky(dy, time);

    // Hit point
    const hx = ox + dx * nearest;
    const hy = oy + dy * nearest;
    const hz = oz + dz * nearest;

    // Normal
    let nx, ny, nz;
    if (what === 0) {
      nx = 0; ny = 1; nz = 0;
    } else {
      const cx = what === 1 ? s1x : s2x;
      const cy = what === 1 ? s1y : s2y;
      const cz = what === 1 ? 0 : s2z;
      const r = what === 1 ? 1.0 : 0.6;
      nx = (hx - cx) / r;
      ny = (hy - cy) / r;
      nz = (hz - cz) / r;
    }

    // Shadow origin (nudged)
    const sox = hx + nx * EPSILON * 10;
    const soy = hy + ny * EPSILON * 10;
    const soz = hz + nz * EPSILON * 10;

    // To light
    const tlx = lx - hx, tly = ly - hy, tlz = lz - hz;
    const tll = Math.sqrt(tlx * tlx + tly * tly + tlz * tlz);
    const ldx = tlx / tll, ldy = tly / tll, ldz = tlz / tll;

    // Shadow test
    let shadow = 1.0;
    if (hitSphere(sox, soy, soz, ldx, ldy, ldz, s1x, s1y, 0, 1.0) > 0) shadow = 0.25;
    if (hitSphere(sox, soy, soz, ldx, ldy, ldz, s2x, s2y, s2z, 0.6) > 0) shadow = 0.25;

    // Diffuse
    const diff = Math.max(0, nx * ldx + ny * ldy + nz * ldz) * shadow;

    // Specular (Phong)
    const rdx2 = reflect({ x: dx, y: dy, z: dz }, { x: nx, y: ny, z: nz });
    const spec = Math.pow(Math.max(0, rdx2.x * ldx + rdx2.y * ldy + rdx2.z * ldz), 48) * shadow;

    // Distance fog
    const fogT = clamp01(nearest / FOG_DIST);
    const fogR = 5, fogG = 3, fogB = 18;

    let r, g, b;

    if (what === 0) {
      // ── Checkerboard floor with logo textures ──
      const cx = Math.floor(hx), cz = Math.floor(hz);
      const light = ((cx + cz) & 1) === 0;

      let baseR = light ? EDGE_BLUE.r * 0.7 : DEEP_BLACK.r * 1.2;
      let baseG = light ? EDGE_BLUE.g * 0.7 : DEEP_BLACK.g * 1.2;
      let baseB = light ? EDGE_BLUE.b * 0.7 : DEEP_BLACK.b * 2.5;

      // Sample logo texture into the tile
      if (this.texturesReady) {
        const tex = light ? this.edgeTex : this.copilotTex;
        const sz = this.texSize;
        // UV within tile, inset with margin so logos don't touch edges
        const margin = 0.12;
        const span = 1 - 2 * margin;
        const u = (hx - cx - margin) / span;
        const v = (hz - cz - margin) / span;
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          const tx = (u * sz) | 0;
          const ty = (v * sz) | 0;
          const ti = (ty * sz + tx) * 4;
          const a = tex[ti + 3] / 255;
          if (a > 0.05) {
            // Blend logo color onto tile, boosted for a luminous glow
            const glow = 1.4;
            baseR = baseR * (1 - a) + tex[ti] * glow * a;
            baseG = baseG * (1 - a) + tex[ti + 1] * glow * a;
            baseB = baseB * (1 - a) + tex[ti + 2] * glow * a;
          }
        }
      }

      const ambient = 0.12;
      const lit = diff + ambient;
      r = baseR * lit + spec * 50;
      g = baseG * lit + spec * 50;
      b = baseB * lit + spec * 70;

      // Subtle floor reflection
      if (depth < 1) {
        const rc = this._trace(
          sox, soy, soz, rdx2.x, rdx2.y, rdx2.z,
          s1x, s1y, s2x, s2z, s2y, lx, ly, lz, time, depth + 1,
        );
        const m = 0.18;
        r = r * (1 - m) + rc.r * m;
        g = g * (1 - m) + rc.g * m;
        b = b * (1 - m) + rc.b * m;
      }
    } else {
      // ── Reflective sphere ──
      const rc = this._trace(
        sox, soy, soz, rdx2.x, rdx2.y, rdx2.z,
        s1x, s1y, s2x, s2z, s2y, lx, ly, lz, time, depth + 1,
      );

      let baseCol, refl;
      if (what === 1) {
        // Main sphere: Copilot Purple tint, highly reflective
        baseCol = COPILOT_PURPLE;
        refl = 0.75;
      } else {
        // Orbiting sphere: Neon Cyan / Magenta shimmer
        const shimmer = Math.sin(time * 2.0) * 0.5 + 0.5;
        baseCol = {
          r: NEON_CYAN.r * (1 - shimmer) + NEON_MAGENTA.r * shimmer,
          g: NEON_CYAN.g * (1 - shimmer) + NEON_MAGENTA.g * shimmer,
          b: NEON_CYAN.b * (1 - shimmer) + NEON_MAGENTA.b * shimmer,
        };
        refl = 0.6;
      }

      const ambient = 0.08;
      const lit = diff + ambient;
      const base = 1 - refl;
      r = baseCol.r * lit * base + rc.r * refl + spec * 220;
      g = baseCol.g * lit * base + rc.g * refl + spec * 220;
      b = baseCol.b * lit * base + rc.b * refl + spec * 255;

      // Fresnel: more reflective at grazing angles
      const fresnel = Math.pow(1 - Math.abs(dx * nx + dy * ny + dz * nz), 3) * 0.3;
      r += rc.r * fresnel;
      g += rc.g * fresnel;
      b += rc.b * fresnel;
    }

    // Apply fog
    r = r * (1 - fogT) + fogR * fogT;
    g = g * (1 - fogT) + fogG * fogT;
    b = b * (1 - fogT) + fogB * fogT;

    return { r, g, b };
  }

  _sky(dy, time) {
    // Gradient sky with subtle animation
    const t = clamp01(dy);
    const pulse = Math.sin(time * 0.3) * 0.1 + 0.9;
    return {
      r: 5 + COPILOT_PURPLE.r * 0.25 * t * t * pulse,
      g: 3 + COPILOT_PURPLE.g * 0.15 * t * t * pulse,
      b: 18 + COPILOT_PURPLE.b * 0.5 * t * t * pulse + t * 35,
    };
  }

  resize(canvas = this.canvas, ctx = this.ctx) {
    this.canvas = canvas || this.canvas;
    this.ctx = ctx || this.ctx;

    if (!this.canvas || !this.bufferCanvas || !this.bufferCtx) return;

    const nextW = Math.max(1, Math.floor(this.canvas.width * RENDER_SCALE));
    const nextH = Math.max(1, Math.floor(this.canvas.height * RENDER_SCALE));

    this.bufferWidth = nextW;
    this.bufferHeight = nextH;
    this.bufferCanvas.width = nextW;
    this.bufferCanvas.height = nextH;
    this.imageData = this.bufferCtx.createImageData(nextW, nextH);
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.bufferCtx = null;
    this.bufferCanvas = null;
    this.imageData = null;
    this.edgeTex = null;
    this.copilotTex = null;
    this.texturesReady = false;
  }
}
