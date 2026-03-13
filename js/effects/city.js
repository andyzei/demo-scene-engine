// City — 2D pixel-art cyberpunk skyline, built from scratch

const EDGE_BLUE   = { r: 0,   g: 120, b: 212 };
const COPILOT_PUR = { r: 123, g: 97,  b: 255 };
const NEON_CYAN   = { r: 0,   g: 255, b: 255 };
const NEON_MAG    = { r: 255, g: 0,   b: 255 };
const ELEC_GREEN  = { r: 57,  g: 255, b: 20  };

const ACCENTS = [NEON_CYAN, COPILOT_PUR, EDGE_BLUE, NEON_MAG, ELEC_GREEN];
const BUILD_TIME = 5;

// Deterministic PRNG so the city is stable across frames
function prng(seed) {
  let s = seed | 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; };
}

export class CityEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.edgeImg = null;
    this.copilotImg = null;
    this.logosReady = false;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this._generate();
    if (!this.logosReady) this._loadLogos();
  }

  // ── Scene generation ────────────────────────────────────────

  _generate() {
    const c = this.canvas;
    this.ps = Math.max(2, Math.floor(c.height / 180));
    this.cols = Math.floor(c.width / this.ps);
    this.rows = Math.floor(c.height / this.ps);
    this.groundY = Math.floor(this.rows * 0.83);

    const r = prng(31337);
    const { cols, groundY } = this;

    // Stars
    this.stars = Array.from({ length: 140 }, () => ({
      x: Math.floor(r() * cols),
      y: Math.floor(r() * groundY * 0.55),
      speed: 1 + r() * 3,
      phase: r() * 6.28,
      bright: 0.3 + r() * 0.7,
    }));

    // Far silhouette layer
    this.farBuildings = [];
    for (let x = 0; x < cols;) {
      const w = 8 + Math.floor(r() * 18);
      const h = 6 + Math.floor(r() * groundY * 0.35);
      this.farBuildings.push({ x, w, h });
      x += w + Math.floor(r() * 4);
    }

    // Main buildings
    this.buildings = [];
    for (let x = 1; x < cols - 4;) {
      const w = 5 + Math.floor(r() * 14);
      const h = 14 + Math.floor(r() * groundY * 0.72);
      const accent = ACCENTS[Math.floor(r() * ACCENTS.length)];

      // Roof: 0=flat 1=stepped 2=spire 3=antenna 4=dome
      const roof = Math.floor(r() * 5);

      // Window grid
      const winCols = Math.max(1, Math.floor((w - 2) / 3));
      const winRows = Math.floor((h - 3) / 3);
      const wins = [];
      for (let i = 0; i < winCols * winRows; i++) {
        const warm = r() > 0.45;
        wins.push({
          on: r() > 0.3,
          timer: 4 + r() * 18,
          color: warm
            ? { r: 200 + (r() * 55 | 0), g: 185 + (r() * 50 | 0), b: 80 + (r() * 90 | 0) }
            : accent,
        });
      }

      const shade = 14 + Math.floor(r() * 22);
      this.buildings.push({
        x, w, h, roof, accent,
        winCols, winRows, wins,
        delay: r() * BUILD_TIME * 0.55,
        body: { r: shade + (r() * 10 | 0), g: shade, b: shade + 15 + (r() * 20 | 0) },
        billboard: r() > 0.6 && w >= 8 ? 3 + Math.floor(r() * Math.max(1, h * 0.3)) : 0,
        dataStream: r() > 0.65,
      });

      x += w + 1 + Math.floor(r() * 3);
    }

    // Street lamps
    this.lamps = [];
    for (let lx = 5; lx < cols; lx += 10 + Math.floor(r() * 8))
      this.lamps.push(lx);

    // Traffic
    this.cars = Array.from({ length: 7 }, () => ({
      x: r() * cols, spd: 10 + r() * 22, dir: r() > 0.5 ? 1 : -1, lane: r() * 2 | 0,
    }));

    // Drones
    this.drones = Array.from({ length: 3 }, () => ({
      x: r() * cols, y: 4 + r() * groundY * 0.25,
      spd: 4 + r() * 8, blink: 2 + r() * 3, phase: r() * 6.28,
    }));

    // Pick two tall, wide, well-separated buildings for the logos
    const candidates = this.buildings
      .map((b, i) => ({ i, score: b.h * 0.7 + b.w * 0.3 }))
      .filter((_, i) => this.buildings[i].w >= 7)
      .sort((a, b) => b.score - a.score);
    this.edgeBldg = -1;
    this.copilotBldg = -1;
    if (candidates.length >= 1) {
      this.edgeBldg = candidates[0].i;
      // Second logo: pick next tallest that's far enough away
      for (let k = 1; k < candidates.length; k++) {
        const dist = Math.abs(this.buildings[candidates[k].i].x - this.buildings[this.edgeBldg].x);
        if (dist > cols * 0.2) { this.copilotBldg = candidates[k].i; break; }
      }
    }
  }

  _loadLogos() {
    let loaded = 0;
    const onLoad = () => { if (++loaded >= 2) this.logosReady = true; };

    this.edgeImg = new Image();
    this.copilotImg = new Image();
    this.edgeImg.onload = onLoad;
    this.copilotImg.onload = onLoad;
    this.edgeImg.src = 'img/edge-logo.svg';
    this.copilotImg.src = 'img/copilot-logo.svg';
  }

  // ── Update ──────────────────────────────────────────────────

  update(dt) {
    this.time += dt;

    for (const car of this.cars) {
      car.x += car.spd * car.dir * dt;
      if (car.x > this.cols + 6) car.x = -6;
      if (car.x < -6) car.x = this.cols + 6;
    }

    for (const d of this.drones) {
      d.x += d.spd * dt;
      if (d.x > this.cols + 10) d.x = -10;
    }

    for (const b of this.buildings) {
      for (const w of b.wins) {
        w.timer -= dt;
        if (w.timer <= 0) { w.on = !w.on; w.timer = 4 + Math.random() * 14; }
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────

  render(ctx = this.ctx) {
    if (!ctx || !this.canvas) return;
    const { canvas, ps, cols, rows, groundY, time } = this;
    const cw = canvas.width, ch = canvas.height;

    const px = (x, y, w, h) => {
      ctx.fillRect(x * ps, y * ps, (w || 1) * ps, (h || 1) * ps);
    };
    const rgb  = (r, g, b) => `rgb(${r},${g},${b})`;
    const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;
    const col  = (c, a) => a != null ? rgba(c.r, c.g, c.b, a) : rgb(c.r, c.g, c.b);

    // ── Sky ──
    const sky = ctx.createLinearGradient(0, 0, 0, groundY * ps);
    sky.addColorStop(0,    '#050510');
    sky.addColorStop(0.45, '#0a0a28');
    sky.addColorStop(0.8,  '#10082e');
    sky.addColorStop(1,    '#1a0a38');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // ── Stars ──
    for (const s of this.stars) {
      const b = s.bright * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
      if (b < 0.15) continue;
      const v = 130 * b + 80 | 0;
      ctx.fillStyle = rgb(v, v, Math.min(255, v + 35));
      px(s.x, s.y);
    }

    // ── Far buildings ──
    const globalProg = Math.min(1, time / BUILD_TIME);
    for (const fb of this.farBuildings) {
      const bh = fb.h * Math.min(1, globalProg * 1.3) | 0;
      if (bh <= 0) continue;
      ctx.fillStyle = '#0e1524';
      px(fb.x, groundY - bh, fb.w, bh);
      // Faint windows
      for (let wy = groundY - bh + 2; wy < groundY - 1; wy += 3) {
        for (let wx = fb.x + 1; wx < fb.x + fb.w - 1; wx += 3) {
          if (Math.sin(wx * 7.1 + wy * 4.3 + time * 0.08) > 0.55) {
            ctx.fillStyle = '#1a2440';
            px(wx, wy);
          }
        }
      }
    }

    // ── Main buildings ──
    for (const b of this.buildings) {
      const elapsed = Math.max(0, time - b.delay);
      const frac = Math.min(1, elapsed / 1.8);
      const bh = b.h * frac | 0;
      if (bh <= 0) continue;

      const topY = groundY - bh;

      // Body
      ctx.fillStyle = col(b.body);
      px(b.x, topY, b.w, bh);

      // Edge shading
      ctx.fillStyle = rgb(b.body.r + 14, b.body.g + 10, b.body.b + 22);
      px(b.x, topY, 1, bh);
      ctx.fillStyle = rgb(Math.max(0, b.body.r - 8), Math.max(0, b.body.g - 6), Math.max(0, b.body.b - 4));
      px(b.x + b.w - 1, topY, 1, bh);

      // Roof accent line
      ctx.fillStyle = col(b.accent, 0.65);
      px(b.x, topY, b.w, 1);

      // Roof structures (when fully built)
      if (frac >= 1) this._drawRoof(ctx, px, b, topY, time);

      // Windows
      let wi = 0;
      for (let ry = 0; ry < b.winRows; ry++) {
        const wy = groundY - b.h + 2 + ry * 3;
        if (wy < topY) { wi += b.winCols; continue; }
        for (let cx = 0; cx < b.winCols; cx++) {
          const win = b.wins[wi++];
          const wx = b.x + 1 + cx * 3;
          if (wx + 1 >= b.x + b.w) continue;
          ctx.fillStyle = win.on ? col(win.color, 0.85) : 'rgba(8,8,18,0.6)';
          px(wx, wy, 2, 2);
        }
      }

      // Billboard
      if (b.billboard && frac >= 1) {
        const bw = Math.min(b.w - 2, 6);
        const bx = b.x + ((b.w - bw) / 2 | 0);
        const by = groundY - b.h + b.billboard;
        if (by > topY && by + 3 < groundY) {
          const pulse = 0.55 + 0.45 * Math.sin(time * 2.2 + b.x);
          ctx.fillStyle = col(b.accent, pulse);
          px(bx, by, bw, 3);
          // Scrolling highlight
          ctx.fillStyle = rgba(255, 255, 255, 0.75);
          px(bx + (time * 6 | 0) % bw, by + 1);
        }
      }

      // Data stream
      if (b.dataStream && frac >= 1) {
        const sx = b.x + (b.w / 2 | 0);
        for (let sy = topY + 1; sy < groundY; sy += 2) {
          const v = Math.sin(sy * 0.5 - time * 5 + b.x) * 0.5 + 0.5;
          if (v > 0.6) { ctx.fillStyle = col(b.accent, v * 0.35); px(sx, sy); }
        }
      }

      // Construction sparks
      if (frac > 0 && frac < 1) {
        for (let si = 0; si < 4; si++) {
          const sx = b.x + (Math.random() * b.w | 0);
          const sy = topY + (Math.random() * 2 | 0);
          const br = Math.random();
          ctx.fillStyle = rgba(255, 180 + (br * 75 | 0), 40 + (br * 120 | 0), br);
          px(sx, sy);
        }
      }
    }

    // ── Holographic logo projections ──
    if (this.logosReady) {
      this._drawLogo(ctx, ps, time, this.edgeBldg, this.edgeImg, NEON_CYAN);
      this._drawLogo(ctx, ps, time, this.copilotBldg, this.copilotImg, COPILOT_PUR);
    }

    // ── Wet-street reflections ──
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.translate(0, (groundY * 2 + 4) * ps);
    ctx.scale(1, -1);
    for (const b of this.buildings) {
      const elapsed = Math.max(0, time - b.delay);
      const bh = b.h * Math.min(1, elapsed / 1.8) | 0;
      if (bh <= 0) continue;
      const reflH = Math.min(bh, rows - groundY - 2);
      ctx.fillStyle = col(b.accent, 0.5);
      ctx.fillRect(b.x * ps, (groundY - bh) * ps, b.w * ps, reflH * ps);
    }
    ctx.restore();

    // ── Ground ──
    ctx.fillStyle = '#141418';
    px(0, groundY, cols, rows - groundY);
    ctx.fillStyle = '#222230';
    px(0, groundY, cols, 1);
    for (let lx = 0; lx < cols; lx += 4) { ctx.fillStyle = '#444'; px(lx, groundY + 2, 2, 1); }

    // Street lamps
    for (const lx of this.lamps) {
      ctx.fillStyle = '#333';
      px(lx, groundY - 3, 1, 3);
      const g = 0.65 + 0.35 * Math.sin(time * 0.4 + lx);
      ctx.fillStyle = rgba(255, 220, 140, g);
      px(lx, groundY - 4);
      ctx.fillStyle = rgba(255, 200, 100, g * 0.12);
      px(lx - 1, groundY - 5, 3, 2);
    }

    // Cars
    for (const car of this.cars) {
      const cx = car.x | 0;
      const cy = groundY + 1 + car.lane;
      if (cx < 0 || cx >= cols) continue;
      ctx.fillStyle = car.dir > 0 ? '#fff' : '#f44';
      px(cx + car.dir, cy);
      ctx.fillStyle = car.dir > 0 ? '#f44' : '#fff';
      px(cx - car.dir, cy);
    }

    // ── Drones ──
    for (const d of this.drones) {
      const dx = d.x | 0;
      const dy = (d.y + Math.sin(time * 1.5 + d.phase) * 2) | 0;
      if (dx < 1 || dx >= cols - 1 || dy < 0) continue;
      ctx.fillStyle = Math.sin(time * d.blink) > 0 ? '#0ff' : '#044';
      px(dx, dy);
      ctx.fillStyle = '#a00';
      px(dx - 1, dy);
      px(dx + 1, dy);
    }

    // ── Floating data particles ──
    for (let i = 0; i < 25; i++) {
      const px2 = (Math.sin(i * 73.7 + time * 0.3) * 0.5 + 0.5) * cols | 0;
      const py2 = ((i * 17.3 + time * 4) % (groundY * 0.9)) | 0;
      const a = 0.15 + 0.15 * Math.sin(time * 2 + i);
      ctx.fillStyle = col(ACCENTS[i % ACCENTS.length], a);
      px(px2, groundY - py2 - 1);
    }

    // ── Scanline overlay ──
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < ch; y += ps * 2) ctx.fillRect(0, y, cw, ps);
  }

  _drawRoof(ctx, px, b, topY, time) {
    const mid = b.x + (b.w / 2 | 0);
    const { accent } = b;
    const rgb  = (r, g, b) => `rgb(${r},${g},${b})`;
    const col  = (c, a) => a != null ? `rgba(${c.r},${c.g},${c.b},${a})` : `rgb(${c.r},${c.g},${c.b})`;

    switch (b.roof) {
      case 1: // Stepped
        if (b.w >= 8) {
          const sw = b.w * 0.6 | 0;
          const sx = b.x + ((b.w - sw) / 2 | 0);
          ctx.fillStyle = rgb(b.body.r + 6, b.body.g + 4, b.body.b + 12);
          px(sx, topY - 3, sw, 3);
          ctx.fillStyle = col(accent, 0.5);
          px(sx, topY - 3, sw, 1);
        }
        break;
      case 2: { // Spire
        const sh = Math.min(7, b.h * 0.15 | 0);
        ctx.fillStyle = '#3c3c50';
        px(mid, topY - sh, 1, sh);
        ctx.fillStyle = Math.sin(time * 4) > 0 ? col(accent) : '#300';
        px(mid, topY - sh);
        break;
      }
      case 3: // Antenna
        ctx.fillStyle = '#3a3a4c';
        px(mid, topY - 5, 1, 5);
        px(mid - 1, topY - 3, 3, 1);
        px(mid - 2, topY - 4, 5, 1);
        ctx.fillStyle = Math.sin(time * 3 + b.x) > 0.2 ? '#ff2828' : '#400';
        px(mid, topY - 5);
        break;
      case 4: { // Dome
        const dw = Math.min(3, b.w / 3 | 0);
        ctx.fillStyle = col(accent, 0.35);
        px(mid - dw, topY - 1, dw * 2 + 1, 1);
        px(mid - dw + 1, topY - 2, Math.max(1, dw * 2 - 1), 1);
        break;
      }
    }
  }

  _drawLogo(ctx, ps, time, bldgIdx, img, tint) {
    if (bldgIdx < 0 || !img) return;
    const b = this.buildings[bldgIdx];
    const elapsed = Math.max(0, time - b.delay);
    if (elapsed / 1.8 < 1) return; // wait until fully built

    const topY = this.groundY - b.h;
    const logoW = b.w * ps;
    const logoH = logoW; // square aspect for the logo
    const lx = b.x * ps;
    const ly = topY * ps - logoH - 4 * ps;
    const bob = Math.sin(time * 1.2 + bldgIdx) * ps * 1.5;

    ctx.save();

    // Glow halo behind logo
    const pulse = 0.25 + 0.15 * Math.sin(time * 2 + bldgIdx * 3);
    const grad = ctx.createRadialGradient(
      lx + logoW / 2, ly + logoH / 2 + bob, logoW * 0.1,
      lx + logoW / 2, ly + logoH / 2 + bob, logoW * 0.8,
    );
    grad.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},${pulse})`);
    grad.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(lx - logoW * 0.3, ly - logoH * 0.3 + bob, logoW * 1.6, logoH * 1.6);

    // Projection beam (vertical lines from roof to logo)
    const beamAlpha = 0.06 + 0.04 * Math.sin(time * 3 + bldgIdx);
    ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${beamAlpha})`;
    const beamW = logoW * 0.6;
    ctx.fillRect(lx + (logoW - beamW) / 2, ly + logoH + bob, beamW, 4 * ps);

    // Holographic scanline flicker
    const holoAlpha = 0.7 + 0.3 * Math.sin(time * 1.8 + bldgIdx * 2);
    ctx.globalAlpha = holoAlpha;
    ctx.drawImage(img, lx, ly + bob, logoW, logoH);

    // Additive-ish color tint pass
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 2.5);
    ctx.drawImage(img, lx, ly + bob, logoW, logoH);
    ctx.globalCompositeOperation = 'source-over';

    // Horizontal scanlines across the logo for hologram feel
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#000';
    for (let sy = 0; sy < logoH; sy += ps * 2) {
      ctx.fillRect(lx, ly + bob + sy, logoW, ps);
    }

    ctx.restore();
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this._generate();
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.buildings = null;
    this.farBuildings = null;
    this.stars = null;
    this.cars = null;
    this.drones = null;
    this.lamps = null;
    this.edgeImg = null;
    this.copilotImg = null;
    this.logosReady = false;
  }
}
