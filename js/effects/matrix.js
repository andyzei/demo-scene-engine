const ASCII_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=<>[]{}()/\\|~?;:!';
const KATAKANA_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
const GLYPHS = `${ASCII_GLYPHS}${KATAKANA_GLYPHS}`;
const BRAND_STRINGS = ['COPILOT', 'EDGE', 'HACKATHON', '31337', 'MICROSOFT'];
const BRAND_COLORS = {
  COPILOT:   { r: 123, g: 97,  b: 255 }, // Copilot Purple
  EDGE:      { r: 0,   g: 120, b: 212 }, // Edge Blue
  HACKATHON: { r: 0,   g: 183, b: 195 }, // Teal
  '31337':   { r: 0,   g: 255, b: 255 }, // Neon Cyan
  MICROSOFT: { r: 0,   g: 120, b: 212 }, // Edge Blue
};

export class MatrixEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.columns = [];
    this.fontFamily = '"Cascadia Code", "Consolas", "Courier New", monospace';
    this.fontSize = 18;
    this.columnWidth = 16;
    this.visibleRows = 0;
    this.fadeAlpha = 0.16;
    this.brandTimer = 1;
    this.alive = false;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.alive = true;
    this.resize(canvas, ctx);
    this.clearCanvas(this.ctx);
  }

  update(dt) {
    if (!this.alive || !this.columns.length) {
      return;
    }

    const delta = Math.max(0, Math.min(dt || 0, 0.1));
    this.brandTimer -= delta;

    if (this.brandTimer <= 0) {
      const burstCount = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < burstCount; i++) {
        this.injectBrandString();
      }
      this.brandTimer = this.randomRange(0.9, 2.4);
    }

    for (const column of this.columns) {
      column.y += column.speed * delta;

      const headRow = Math.floor(column.y);
      while (column.lastRow < headRow) {
        column.lastRow += 1;
        column.trail.unshift(this.nextGlyph(column));
        if (column.trail.length > column.trailLength) {
          column.trail.length = column.trailLength;
        }
      }

      column.changeTimer += delta;
      if (column.changeTimer >= column.changeRate) {
        const mutations = Math.min(4, Math.floor(column.changeTimer / column.changeRate));
        column.changeTimer -= mutations * column.changeRate;
        this.mutateTrail(column, Math.max(1, mutations));
      }

      if (column.y - column.trailLength > this.visibleRows + 4) {
        this.resetColumn(column);
      }
    }
  }

  render(ctx) {
    const context = ctx || this.ctx;
    if (!this.alive || !context || !this.canvas) {
      return;
    }

    context.save();
    context.fillStyle = `rgba(10, 10, 10, ${this.fadeAlpha})`;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    context.font = `${this.fontSize}px ${this.fontFamily}`;
    context.textBaseline = 'top';
    context.textAlign = 'left';

    for (const column of this.columns) {
      for (let i = column.trail.length - 1; i >= 0; i--) {
        const row = Math.floor(column.y) - i;
        const y = row * this.fontSize;
        if (y < -this.fontSize || y > this.canvas.height) {
          continue;
        }

        const step = column.trail[i];
        if (!step) {
          continue;
        }

        if (i === 0) {
          context.shadowBlur = 14;
          if (step.brand && step.brandColor) {
            context.shadowColor = `rgb(${step.brandColor.r},${step.brandColor.g},${step.brandColor.b})`;
            context.fillStyle = '#FFFFFF';
          } else {
            context.shadowColor = '#39FF14';
            context.fillStyle = '#D8FFD2';
          }
        } else {
          const fade = 1 - i / column.trailLength;
          const alpha = Math.max(0.06, fade * fade * 0.95);
          context.shadowBlur = i < 3 ? 6 : 0;
          if (step.brand && step.brandColor) {
            const bc = step.brandColor;
            context.shadowColor = `rgb(${bc.r},${bc.g},${bc.b})`;
            context.fillStyle = `rgba(${bc.r},${bc.g},${bc.b},${Math.min(0.95, alpha + 0.15)})`;
          } else {
            context.shadowColor = '#39FF14';
            context.fillStyle = `rgba(57, 255, 20, ${alpha})`;
          }
        }

        context.fillText(step.char, column.x, y);
      }
    }

    context.restore();
  }

  resize(canvas, ctx) {
    this.canvas = canvas || this.canvas;
    this.ctx = ctx || this.ctx;
    if (!this.canvas || !this.ctx) {
      return;
    }

    const minDimension = Math.min(this.canvas.width || 0, this.canvas.height || 0);
    this.fontSize = Math.max(16, Math.min(26, Math.round(minDimension * 0.024) || 18));
    this.columnWidth = Math.max(14, Math.floor(this.fontSize * 0.9));
    this.visibleRows = Math.ceil(this.canvas.height / this.fontSize) + 2;

    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';

    const columnCount = Math.max(1, Math.ceil(this.canvas.width / this.columnWidth));
    const nextColumns = new Array(columnCount);

    for (let i = 0; i < columnCount; i++) {
      const existing = this.columns[i];
      nextColumns[i] = existing ? this.reflowColumn(existing, i) : this.createColumn(i);
    }

    this.columns = nextColumns;
    this.brandTimer = Math.min(this.brandTimer || this.randomRange(0.4, 1.4), 1.4);
    this.clearCanvas(this.ctx);
  }

  destroy() {
    this.columns = [];
    this.canvas = null;
    this.ctx = null;
    this.alive = false;
  }

  createColumn(index) {
    const trailLength = Math.max(12, Math.floor(this.randomRange(16, 34)));
    const y = this.randomRange(-this.visibleRows, this.visibleRows * 0.35);

    return {
      x: index * this.columnWidth,
      y,
      lastRow: Math.floor(y),
      speed: this.randomRange(9, 26),
      trailLength,
      changeRate: this.randomRange(0.04, 0.18),
      changeTimer: this.randomRange(0, 0.12),
      trail: Array.from({ length: trailLength }, () => this.makeGlyph()),
      brand: null,
    };
  }

  reflowColumn(column, index) {
    return {
      ...column,
      x: index * this.columnWidth,
      trailLength: Math.min(Math.max(column.trailLength, 12), this.visibleRows + 8),
      trail: column.trail.slice(0, Math.min(column.trail.length, this.visibleRows + 8)).map((step) => ({ ...step })),
    };
  }

  resetColumn(column) {
    const next = this.createColumn(Math.round(column.x / this.columnWidth));
    column.x = next.x;
    column.y = this.randomRange(-this.visibleRows * 1.25, -2);
    column.lastRow = Math.floor(column.y);
    column.speed = next.speed;
    column.trailLength = next.trailLength;
    column.changeRate = next.changeRate;
    column.changeTimer = next.changeTimer;
    column.trail = next.trail;
    column.brand = null;
  }

  injectBrandString() {
    if (!this.columns.length) {
      return;
    }

    const phrase = BRAND_STRINGS[Math.floor(Math.random() * BRAND_STRINGS.length)];
    const candidates = this.columns.filter((column) => !column.brand && column.y > -column.trailLength && column.y < this.visibleRows + 2);
    const pool = candidates.length ? candidates : this.columns.filter((column) => !column.brand);
    const target = pool[Math.floor(Math.random() * pool.length)] || this.columns[Math.floor(Math.random() * this.columns.length)];

    if (!target) {
      return;
    }

    target.brand = { text: phrase, index: 0, color: BRAND_COLORS[phrase] || BRAND_COLORS.EDGE };
    target.speed = Math.min(28, target.speed * this.randomRange(1.04, 1.18));
  }

  nextGlyph(column) {
    if (column.brand && column.brand.index < column.brand.text.length) {
      const char = column.brand.text[column.brand.index];
      column.brand.index += 1;
      const brandColor = column.brand.color;
      if (column.brand.index >= column.brand.text.length) {
        column.brand = null;
      }
      return { char, brand: true, brandColor };
    }

    return this.makeGlyph();
  }

  mutateTrail(column, amount) {
    if (column.trail.length < 2) {
      return;
    }

    for (let i = 0; i < amount; i++) {
      const index = 1 + Math.floor(Math.random() * (column.trail.length - 1));
      const step = column.trail[index];
      if (!step || (step.brand && Math.random() < 0.85)) {
        continue;
      }
      column.trail[index] = this.makeGlyph();
    }
  }

  makeGlyph() {
    return {
      char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      brand: false,
    };
  }

  clearCanvas(ctx) {
    if (!ctx || !this.canvas) {
      return;
    }

    ctx.save();
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  }
}
