const BACKGROUND = '#0A0A0A';
const BRAND_COLORS = ['#0078D4', '#7B61FF', '#00B7C3', '#00FFFF', '#FF00FF'];
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };
const DIRECTIONS = [
  { x: 1, y: 0, z: 0, axis: 'x' },
  { x: -1, y: 0, z: 0, axis: 'x' },
  { x: 0, y: 1, z: 0, axis: 'y' },
  { x: 0, y: -1, z: 0, axis: 'y' },
  { x: 0, y: 0, z: 1, axis: 'z' },
  { x: 0, y: 0, z: -1, axis: 'z' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  const copy = list.slice();

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixRgb(from, to, amount) {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  };
}

function rgba(rgb, alpha = 1) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function cloneCell(cell) {
  return { x: cell.x, y: cell.y, z: cell.z };
}

function cellKey(cell) {
  return `${cell.x},${cell.y},${cell.z}`;
}

function edgeKey(a, b) {
  const start = cellKey(a);
  const end = cellKey(b);
  return start < end ? `${start}|${end}` : `${end}|${start}`;
}

function sameCell(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function tracePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

export class PipesEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;

    this.background = BACKGROUND;
    this.palette = BRAND_COLORS.map((hex) => this.buildColorSet(hex));

    this.gridX = 0;
    this.gridY = 0;
    this.gridZ = 0;
    this.totalCells = 0;

    this.cellX = 0;
    this.cellY = 0;
    this.cellZ = 0;
    this.originX = 0;
    this.originY = 0;
    this.baseThickness = 10;

    this.activePipes = [];
    this.finishedPipes = [];
    this.occupiedCells = new Set();
    this.occupiedEdges = new Set();

    this.colorIndex = 0;
    this.elapsed = 0;
    this.cycleDuration = 17;
    this.activeCount = 4;
    this.spawnFailures = 0;

    this.fade = 0;
    this.fadeState = 'idle';
    this.fadeOutDuration = 1.35;
    this.fadeInDuration = 0.7;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.configureGeometry();
    this.resetScene(false);
  }

  update(dt) {
    if (!this.canvas) {
      return;
    }

    const step = clamp(dt || 1 / 60, 1 / 240, 1 / 20);
    this.elapsed += step;

    for (let i = this.activePipes.length - 1; i >= 0; i -= 1) {
      this.updatePipe(this.activePipes[i], i, step);
    }

    this.fillActivePipes();

    if (this.fadeState === 'idle' && this.shouldFadeOut()) {
      this.fadeState = 'fadingOut';
      this.fade = 0;
    }

    if (this.fadeState === 'fadingOut') {
      this.fade = clamp(this.fade + step / this.fadeOutDuration, 0, 1);
      if (this.fade >= 1) {
        this.resetScene(true);
      }
    } else if (this.fadeState === 'fadingIn') {
      this.fade = clamp(this.fade - step / this.fadeInDuration, 0, 1);
      if (this.fade <= 0.001) {
        this.fade = 0;
        this.fadeState = 'idle';
      }
    }
  }

  render(ctx = this.ctx) {
    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);

    const drawables = [];

    for (const pipe of this.finishedPipes) {
      drawables.push({ pipe, points: pipe.points, sortKey: pipe.sortKey });
    }

    for (const pipe of this.activePipes) {
      drawables.push({
        pipe,
        ...this.getActivePipeGeometry(pipe),
      });
    }

    drawables
      .sort((left, right) => left.sortKey - right.sortKey)
      .forEach(({ pipe, points }) => {
        if (points.length > 1) {
          this.drawPipe(ctx, pipe, points, pipe.active);
        }
      });

    if (this.fade > 0) {
      ctx.fillStyle = `rgba(10, 10, 10, ${this.fade})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  resize(canvas = this.canvas, ctx = this.ctx) {
    this.canvas = canvas || this.canvas;
    this.ctx = ctx || this.ctx;

    if (!this.canvas) {
      return;
    }

    this.configureGeometry();
    this.resetScene(false);
  }

  destroy() {
    this.activePipes = [];
    this.finishedPipes = [];
    this.occupiedCells.clear();
    this.occupiedEdges.clear();
    this.canvas = null;
    this.ctx = null;
  }

  buildColorSet(hex) {
    const base = hexToRgb(hex);
    return {
      hex,
      base,
      outline: rgba(mixRgb(base, BLACK, 0.58), 0.78),
      body: rgba(base, 0.98),
      inner: rgba(mixRgb(base, WHITE, 0.16), 0.98),
      highlight: rgba(mixRgb(base, WHITE, 0.62), 0.86),
      specular: rgba(mixRgb(base, WHITE, 0.86), 0.78),
      shadow: rgba(mixRgb(base, BLACK, 0.54), 0.62),
      glow: rgba(mixRgb(base, WHITE, 0.18), 0.46),
    };
  }

  configureGeometry() {
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    const minDimension = Math.max(240, Math.min(this.width, this.height));
    this.baseThickness = clamp(minDimension * 0.018, 8, 12);

    const unit = clamp(minDimension * 0.07, 22, 34);
    this.cellX = unit;
    this.cellY = unit * 0.55;
    this.cellZ = unit * 0.95;

    const margin = this.baseThickness * 4;
    const minDepth = 5;
    const maxWidthCount = Math.floor((this.width - margin * 2) / (this.cellX * 2));
    const maxHeightCount = Math.floor((this.height - margin * 2 - minDepth * this.cellZ) / (this.cellY * 2));
    const planeCount = clamp(Math.min(maxWidthCount, maxHeightCount), 5, 11);

    this.gridX = planeCount;
    this.gridY = planeCount;

    const verticalRoom = this.height - margin * 2 - (this.gridX + this.gridY - 2) * this.cellY;
    this.gridZ = clamp(Math.floor(verticalRoom / this.cellZ) + 1, 5, 9);
    this.totalCells = this.gridX * this.gridY * this.gridZ;

    const verticalSpan = (this.gridZ - 1) * this.cellZ + (this.gridX + this.gridY - 2) * this.cellY;
    this.originX = this.width * 0.5;
    this.originY = Math.max(this.baseThickness * 2.5, (this.height - verticalSpan) * 0.5) + (this.gridZ - 1) * this.cellZ;
  }

  resetScene(withFadeIn) {
    this.activePipes = [];
    this.finishedPipes = [];
    this.occupiedCells.clear();
    this.occupiedEdges.clear();

    this.colorIndex = randInt(0, this.palette.length - 1);
    this.elapsed = 0;
    this.cycleDuration = 15 + Math.random() * 5;
    this.activeCount = randInt(3, 5);
    this.spawnFailures = 0;

    this.fadeState = withFadeIn ? 'fadingIn' : 'idle';
    this.fade = withFadeIn ? 1 : 0;

    this.fillActivePipes();
  }

  shouldFadeOut() {
    if (this.totalCells <= 0) {
      return false;
    }

    const fillRatio = this.occupiedCells.size / this.totalCells;
    const visualDensity = this.finishedPipes.length + this.activePipes.length;

    return (
      this.elapsed >= this.cycleDuration ||
      fillRatio >= 0.38 ||
      (this.spawnFailures >= 8 && visualDensity >= this.activeCount)
    );
  }

  fillActivePipes() {
    let attempts = 0;

    while (this.activePipes.length < this.activeCount && attempts < this.activeCount * 4) {
      if (!this.spawnPipe()) {
        this.spawnFailures += 1;
        break;
      }
      attempts += 1;
    }
  }

  spawnPipe() {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const cell = {
        x: randInt(0, this.gridX - 1),
        y: randInt(0, this.gridY - 1),
        z: randInt(0, this.gridZ - 1),
      };

      if (this.occupiedCells.has(cellKey(cell))) {
        continue;
      }

      const directions = shuffle(DIRECTIONS).filter((direction) => this.isMoveAvailable(cell, direction, null));
      if (!directions.length) {
        continue;
      }

      const direction = directions[0];
      const point = this.projectCell(cell);
      const color = this.palette[this.colorIndex % this.palette.length];
      this.colorIndex += 1;

      const pipe = {
        active: true,
        color,
        thickness: clamp(this.baseThickness * (0.92 + Math.random() * 0.18), 8, 12),
        speed: 1.9 + Math.random() * 1.8,
        segmentRemaining: randInt(2, 6),
        currentCell: cloneCell(cell),
        direction,
        targetCell: null,
        targetPoint: null,
        points: [point],
        joints: [],
        isoTotal: cell.x + cell.y + cell.z,
        sortKey: cell.x + cell.y + cell.z,
      };

      this.occupiedCells.add(cellKey(cell));

      if (!this.prepareNextMove(pipe)) {
        this.occupiedCells.delete(cellKey(cell));
        continue;
      }

      this.activePipes.push(pipe);
      return true;
    }

    return false;
  }

  updatePipe(pipe, index, dt) {
    pipe.progress = (pipe.progress || 0) + dt * pipe.speed;

    while (pipe.progress >= 1) {
      if (!this.commitPipeStep(pipe)) {
        this.finishPipe(index, pipe);
        return;
      }

      pipe.progress -= 1;
    }
  }

  commitPipeStep(pipe) {
    if (!pipe.targetCell || !this.isMoveAvailable(pipe.currentCell, pipe.direction, pipe)) {
      return false;
    }

    const nextCell = cloneCell(pipe.targetCell);
    this.occupiedEdges.add(edgeKey(pipe.currentCell, nextCell));
    this.occupiedCells.add(cellKey(nextCell));

    pipe.currentCell = nextCell;
    pipe.points.push(this.projectCell(nextCell));
    pipe.isoTotal += nextCell.x + nextCell.y + nextCell.z;
    pipe.segmentRemaining -= 1;

    if (pipe.segmentRemaining <= 0) {
      const nextDirection = this.pickTurnDirection(pipe);
      if (!nextDirection) {
        pipe.sortKey = pipe.isoTotal / pipe.points.length;
        return false;
      }

      if (nextDirection.axis !== pipe.direction.axis) {
        pipe.joints.push(pipe.points[pipe.points.length - 1]);
      }

      pipe.direction = nextDirection;
      pipe.segmentRemaining = randInt(2, 6);
    }

    if (!this.prepareNextMove(pipe)) {
      pipe.sortKey = pipe.isoTotal / pipe.points.length;
      return false;
    }

    return true;
  }

  finishPipe(index, pipe) {
    pipe.active = false;
    pipe.progress = 0;
    pipe.targetCell = null;
    pipe.targetPoint = null;
    pipe.sortKey = pipe.isoTotal / Math.max(1, pipe.points.length);

    if (pipe.points.length > 1) {
      this.finishedPipes.push(pipe);
    }

    this.activePipes.splice(index, 1);
    this.fillActivePipes();
  }

  prepareNextMove(pipe) {
    if (!this.isMoveAvailable(pipe.currentCell, pipe.direction, pipe)) {
      return false;
    }

    pipe.targetCell = {
      x: pipe.currentCell.x + pipe.direction.x,
      y: pipe.currentCell.y + pipe.direction.y,
      z: pipe.currentCell.z + pipe.direction.z,
    };
    pipe.targetPoint = this.projectCell(pipe.targetCell);
    return true;
  }

  pickTurnDirection(pipe) {
    const perpendicular = shuffle(DIRECTIONS).filter(
      (direction) => direction.axis !== pipe.direction.axis && this.isMoveAvailable(pipe.currentCell, direction, pipe)
    );

    if (perpendicular.length) {
      return perpendicular[0];
    }

    if (this.isMoveAvailable(pipe.currentCell, pipe.direction, pipe)) {
      return pipe.direction;
    }

    return null;
  }

  isMoveAvailable(from, direction, pipe) {
    const to = {
      x: from.x + direction.x,
      y: from.y + direction.y,
      z: from.z + direction.z,
    };

    if (!this.isInsideGrid(to)) {
      return false;
    }

    if (this.occupiedCells.has(cellKey(to))) {
      return false;
    }

    const moveKey = edgeKey(from, to);
    if (this.occupiedEdges.has(moveKey)) {
      return false;
    }

    for (const other of this.activePipes) {
      if (other === pipe) {
        continue;
      }

      if (sameCell(other.targetCell, to)) {
        return false;
      }

      if (other.currentCell && other.targetCell && edgeKey(other.currentCell, other.targetCell) === moveKey) {
        return false;
      }
    }

    return true;
  }

  isInsideGrid(cell) {
    return (
      cell.x >= 0 && cell.x < this.gridX &&
      cell.y >= 0 && cell.y < this.gridY &&
      cell.z >= 0 && cell.z < this.gridZ
    );
  }

  projectCell(cell) {
    return {
      x: this.originX + (cell.x - cell.y) * this.cellX,
      y: this.originY + (cell.x + cell.y) * this.cellY - cell.z * this.cellZ,
      iso: cell.x + cell.y + cell.z,
    };
  }

  getActivePipeGeometry(pipe) {
    const points = pipe.points.slice();
    let sortTotal = pipe.isoTotal;
    let count = pipe.points.length;

    if (pipe.targetPoint && pipe.progress > 0) {
      const lastPoint = pipe.points[pipe.points.length - 1];
      const headPoint = {
        x: lerp(lastPoint.x, pipe.targetPoint.x, pipe.progress),
        y: lerp(lastPoint.y, pipe.targetPoint.y, pipe.progress),
        iso: lerp(lastPoint.iso, pipe.targetPoint.iso, pipe.progress),
      };
      points.push(headPoint);
      sortTotal += headPoint.iso;
      count += 1;
    }

    return {
      points,
      sortKey: sortTotal / Math.max(1, count),
    };
  }

  drawPipe(ctx, pipe, points, active) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowColor = pipe.color.glow;
    ctx.shadowBlur = pipe.thickness * 0.95;
    ctx.strokeStyle = pipe.color.outline;
    ctx.lineWidth = pipe.thickness + 2;
    tracePath(ctx, points);
    ctx.stroke();

    ctx.shadowBlur = pipe.thickness * 0.6;
    ctx.strokeStyle = pipe.color.body;
    ctx.lineWidth = pipe.thickness;
    tracePath(ctx, points);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = pipe.color.inner;
    ctx.lineWidth = pipe.thickness * 0.78;
    tracePath(ctx, points);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, pipe.thickness * 0.16);
    ctx.strokeStyle = pipe.color.shadow;
    ctx.lineWidth = pipe.thickness * 0.5;
    tracePath(ctx, points);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -pipe.thickness * 0.18);
    ctx.strokeStyle = pipe.color.highlight;
    ctx.lineWidth = pipe.thickness * 0.34;
    tracePath(ctx, points);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -pipe.thickness * 0.32);
    ctx.strokeStyle = pipe.color.specular;
    ctx.lineWidth = Math.max(1.1, pipe.thickness * 0.12);
    tracePath(ctx, points);
    ctx.stroke();
    ctx.restore();

    for (const joint of pipe.joints) {
      this.drawJoint(ctx, pipe, joint.x, joint.y, 1);
    }

    if (active && points.length) {
      const head = points[points.length - 1];
      this.drawJoint(ctx, pipe, head.x, head.y, 0.94);
    }

    ctx.restore();
  }

  drawJoint(ctx, pipe, x, y, scale) {
    const radius = pipe.thickness * 0.58 * scale;

    ctx.save();
    ctx.shadowColor = pipe.color.glow;
    ctx.shadowBlur = radius * 1.1;
    ctx.fillStyle = pipe.color.outline;
    ctx.beginPath();
    ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = radius * 0.8;
    ctx.fillStyle = pipe.color.body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = pipe.color.inner;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pipe.color.shadow;
    ctx.beginPath();
    ctx.arc(x, y + pipe.thickness * 0.16, radius * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pipe.color.highlight;
    ctx.beginPath();
    ctx.arc(x, y - pipe.thickness * 0.18, radius * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pipe.color.specular;
    ctx.beginPath();
    ctx.arc(x - radius * 0.08, y - pipe.thickness * 0.3, Math.max(0.9, radius * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
