// Flying Toasters — homage to the classic After Dark screensaver

const TOASTER_COUNT = 14;
const TOAST_COUNT = 8;
const FRAME_W = 64;
const FRAME_H = 64;
const FRAME_COUNT = 4;
// Ping-pong sequence for smooth wing flap
const FRAME_SEQ = [0, 1, 2, 3, 2, 1];

export class ToastersEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.toasters = [];
    this.toasts = [];
    this.sprite = null;
    this.spriteReady = false;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.time = 0;
    this._populate();
    if (!this.spriteReady) this._loadSprite();
  }

  _loadSprite() {
    const img = new Image();
    img.onload = () => {
      this.sprite = img;
      this.spriteReady = true;
    };
    img.src = 'img/toasters.png';
  }

  _populate() {
    this.toasters = [];
    this.toasts = [];

    for (let i = 0; i < TOASTER_COUNT; i++) {
      this.toasters.push(this._spawnToaster(true));
    }
    for (let i = 0; i < TOAST_COUNT; i++) {
      this.toasts.push(this._spawnToast(true));
    }
  }

  _spawnToaster(randomize) {
    const scale = 0.8 + Math.random() * 1.6;
    const speed = (60 + Math.random() * 80) * scale;
    const flapSpeed = 6 + Math.random() * 6;
    const flapPhase = Math.random() * FRAME_SEQ.length;

    let x, y;
    if (randomize) {
      x = Math.random() * (this.width + 200) - 100;
      y = Math.random() * (this.height + 200) - 100;
    } else {
      if (Math.random() < 0.5) {
        x = this.width + FRAME_W * scale;
        y = Math.random() * this.height * 0.6 - 60;
      } else {
        x = this.width * 0.3 + Math.random() * this.width * 0.8;
        y = -FRAME_H * scale;
      }
    }

    return {
      x, y, scale, speed, flapSpeed, flapPhase,
      wobble: Math.random() * Math.PI * 2,
      wobbleAmp: 8 + Math.random() * 12,
      wobbleFreq: 0.4 + Math.random() * 0.6,
    };
  }

  _spawnToast(randomize) {
    const scale = 0.4 + Math.random() * 0.5;
    const speed = (40 + Math.random() * 50) * scale;

    let x, y;
    if (randomize) {
      x = Math.random() * (this.width + 100);
      y = Math.random() * (this.height + 100);
    } else {
      x = this.width + 40 * scale;
      y = Math.random() * this.height * 0.5;
    }

    return {
      x, y, scale, speed,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.5,
      wobble: Math.random() * Math.PI * 2,
    };
  }

  update(dt) {
    this.time += dt;

    for (const t of this.toasters) {
      t.x -= t.speed * dt * 0.7;
      t.y += t.speed * dt * 0.5;
      t.y += Math.sin(this.time * t.wobbleFreq + t.wobble) * t.wobbleAmp * dt;
    }

    for (const t of this.toasts) {
      t.x -= t.speed * dt * 0.5;
      t.y += t.speed * dt * 0.65;
      t.rotation += t.rotSpeed * dt;
      t.y += Math.sin(this.time * 0.8 + t.wobble) * 6 * dt;
    }

    // Recycle off-screen objects
    for (let i = 0; i < this.toasters.length; i++) {
      const t = this.toasters[i];
      if (t.x < -FRAME_W * t.scale || t.y > this.height + FRAME_H * t.scale) {
        this.toasters[i] = this._spawnToaster(false);
      }
    }
    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      if (t.x < -80 * t.scale || t.y > this.height + 80 * t.scale) {
        this.toasts[i] = this._spawnToast(false);
      }
    }
  }

  render(ctx = this.ctx) {
    if (!ctx) return;

    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, this.width, this.height);

    this._drawStars(ctx);

    // Sort everything by scale (small = far, draw first)
    const items = [
      ...this.toasters.map(t => ({ type: 'toaster', obj: t, depth: t.scale })),
      ...this.toasts.map(t => ({ type: 'toast', obj: t, depth: t.scale })),
    ];
    items.sort((a, b) => a.depth - b.depth);

    for (const item of items) {
      if (item.type === 'toaster') {
        this._drawToaster(ctx, item.obj);
      } else {
        this._drawToast(ctx, item.obj);
      }
    }
  }

  _drawStars(ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    let seed = 31337;
    for (let i = 0; i < 80; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const sx = (seed % this.width);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const sy = (seed % this.height);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const brightness = 0.15 + (seed % 100) / 200;
      const twinkle = Math.sin(this.time * 1.5 + i * 0.7) * 0.15 + 0.85;
      ctx.globalAlpha = brightness * twinkle;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  _drawToaster(ctx, t) {
    if (!this.spriteReady) return;

    // Pick animation frame via ping-pong sequence
    const seqPos = (this.time * t.flapSpeed + t.flapPhase) % FRAME_SEQ.length;
    const frameIdx = FRAME_SEQ[seqPos | 0];
    const srcX = frameIdx * FRAME_W;

    const drawW = FRAME_W * t.scale;
    const drawH = FRAME_H * t.scale;

    ctx.drawImage(
      this.sprite,
      srcX, 0, FRAME_W, FRAME_H,
      t.x - drawW / 2, t.y - drawH / 2, drawW, drawH,
    );
  }

  _drawToast(ctx, t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.scale(t.scale, t.scale);

    const w = 40, h = 48;

    // Toast shape (rectangle with rounded top)
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2 + 12);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 12, -h / 2);
    ctx.lineTo(w / 2 - 12, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 12);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();

    const tg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    tg.addColorStop(0, '#d4a043');
    tg.addColorStop(0.3, '#c89035');
    tg.addColorStop(0.7, '#b07828');
    tg.addColorStop(1, '#8a5a18');
    ctx.fillStyle = tg;
    ctx.fill();

    ctx.strokeStyle = '#7a4a10';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Crust (darker top edge)
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 3, -h / 2 + 14);
    ctx.quadraticCurveTo(-w / 2 + 3, -h / 2 + 3, -w / 2 + 14, -h / 2 + 3);
    ctx.lineTo(w / 2 - 14, -h / 2 + 3);
    ctx.quadraticCurveTo(w / 2 - 3, -h / 2 + 3, w / 2 - 3, -h / 2 + 14);
    ctx.strokeStyle = 'rgba(100, 55, 10, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Toast holes
    ctx.fillStyle = 'rgba(90, 60, 20, 0.35)';
    const holes = [[-8, -4, 3], [6, 2, 2.5], [-3, 10, 2], [10, -8, 2], [-12, 6, 1.8], [4, 14, 2.2]];
    for (const [hx, hy, hr] of holes) {
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  destroy() {
    this.toasters = [];
    this.toasts = [];
    this.canvas = null;
    this.ctx = null;
  }
}
