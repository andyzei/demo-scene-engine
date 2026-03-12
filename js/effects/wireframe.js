const NEON_CYAN = { r: 0, g: 255, b: 255 };
const NEON_MAGENTA = { r: 255, g: 0, b: 255 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function multiplyMatrices(a, b) {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2],
    ],
    [
      a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
      a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
      a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2],
    ],
  ];
}

function multiplyMatrixVector(matrix, vector) {
  return {
    x: matrix[0][0] * vector.x + matrix[0][1] * vector.y + matrix[0][2] * vector.z,
    y: matrix[1][0] * vector.x + matrix[1][1] * vector.y + matrix[1][2] * vector.z,
    z: matrix[2][0] * vector.x + matrix[2][1] * vector.y + matrix[2][2] * vector.z,
  };
}

function normalizeVertices(vertices) {
  const center = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.x,
      y: acc.y + vertex.y,
      z: acc.z + vertex.z,
    }),
    { x: 0, y: 0, z: 0 }
  );

  center.x /= vertices.length;
  center.y /= vertices.length;
  center.z /= vertices.length;

  const centered = vertices.map((vertex) => ({
    x: vertex.x - center.x,
    y: vertex.y - center.y,
    z: vertex.z - center.z,
  }));

  const maxRadius = centered.reduce((max, vertex) => {
    const radius = Math.hypot(vertex.x, vertex.y, vertex.z);
    return Math.max(max, radius);
  }, 1);

  return centered.map((vertex) => ({
    x: vertex.x / maxRadius,
    y: vertex.y / maxRadius,
    z: vertex.z / maxRadius,
  }));
}

function buildCube() {
  return {
    name: 'cube',
    vertices: normalizeVertices([
      { x: -1, y: -1, z: -1 },
      { x: 1, y: -1, z: -1 },
      { x: 1, y: 1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },
      { x: 1, y: -1, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: -1, y: 1, z: 1 },
    ]),
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
  };
}

function buildTorus(majorSegments = 18, minorSegments = 12, majorRadius = 0.68, minorRadius = 0.28) {
  const vertices = [];
  const edges = [];

  for (let uIndex = 0; uIndex < majorSegments; uIndex += 1) {
    const u = (uIndex / majorSegments) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    for (let vIndex = 0; vIndex < minorSegments; vIndex += 1) {
      const v = (vIndex / minorSegments) * Math.PI * 2;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);
      const ring = majorRadius + minorRadius * cosV;

      vertices.push({
        x: ring * cosU,
        y: ring * sinU,
        z: minorRadius * sinV,
      });
    }
  }

  for (let uIndex = 0; uIndex < majorSegments; uIndex += 1) {
    for (let vIndex = 0; vIndex < minorSegments; vIndex += 1) {
      const current = uIndex * minorSegments + vIndex;
      const nextU = ((uIndex + 1) % majorSegments) * minorSegments + vIndex;
      const nextV = uIndex * minorSegments + ((vIndex + 1) % minorSegments);

      edges.push([current, nextU]);
      edges.push([current, nextV]);
    }
  }

  return {
    name: 'torus',
    vertices: normalizeVertices(vertices),
    edges,
  };
}

function buildIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = normalizeVertices([
    { x: -1, y: phi, z: 0 },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: 1, y: -phi, z: 0 },
    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: -phi },
    { x: 0, y: 1, z: -phi },
    { x: phi, y: 0, z: -1 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: 1 },
  ]);

  let minDistance = Infinity;

  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const dx = vertices[i].x - vertices[j].x;
      const dy = vertices[i].y - vertices[j].y;
      const dz = vertices[i].z - vertices[j].z;
      minDistance = Math.min(minDistance, Math.hypot(dx, dy, dz));
    }
  }

  const edges = [];
  const threshold = minDistance * 1.05;

  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const dx = vertices[i].x - vertices[j].x;
      const dy = vertices[i].y - vertices[j].y;
      const dz = vertices[i].z - vertices[j].z;
      if (Math.hypot(dx, dy, dz) <= threshold) {
        edges.push([i, j]);
      }
    }
  }

  return {
    name: 'icosahedron',
    vertices,
    edges,
  };
}

export class WireframeEffect {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.baseScale = 0;
    this.cameraDistance = 3.6;
    this.projectionScale = 0;
    this.pointRadius = 1.5;
    this.background = '#0A0A0A';
    this.switchInterval = 12;
    this.showVertices = true;
    this.elapsed = 0;
    this.shapeTimer = 0;
    this.angleX = 0.4;
    this.angleY = 0.2;
    this.angleZ = 0;
    this.spin = {
      x: 0.58,
      y: 0.83,
      z: 0.37,
    };
    this.shapes = [];
    this.currentShapeIndex = 0;
    this.currentShape = null;
    this.frame = null;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.elapsed = 0;
    this.shapeTimer = 0;
    this.currentShapeIndex = 0;
    this.shapes = [buildCube(), buildTorus(), buildIcosahedron()];
    this.currentShape = this.shapes[this.currentShapeIndex] || null;
    this.resize(canvas, ctx);
    this.updateFrame();
  }

  update(dt) {
    if (!this.currentShape) {
      return;
    }

    this.elapsed += dt;
    this.shapeTimer += dt;

    while (this.shapeTimer >= this.switchInterval) {
      this.shapeTimer -= this.switchInterval;
      this.currentShapeIndex = (this.currentShapeIndex + 1) % this.shapes.length;
      this.currentShape = this.shapes[this.currentShapeIndex];
    }

    this.angleX += dt * this.spin.x;
    this.angleY += dt * this.spin.y;
    this.angleZ += dt * this.spin.z;
    this.updateFrame();
  }

  render(ctx = this.ctx) {
    if (!ctx || !this.canvas) {
      return;
    }

    ctx.save();
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.frame) {
      ctx.restore();
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'screen';

    for (const edge of this.frame.edges) {
      const from = this.frame.points[edge.a];
      const to = this.frame.points[edge.b];
      const color = this.getDepthColor(edge.depth, 0.78);

      ctx.strokeStyle = color.rgba;
      ctx.shadowColor = color.rgb;
      ctx.shadowBlur = 10 + color.mix * 18;
      ctx.lineWidth = 1 + color.mix * 1.5;
      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.stroke();
    }

    if (this.showVertices) {
      for (const point of this.frame.vertices) {
        const color = this.getDepthColor(point.z, 0.92);
        const radius = this.pointRadius * (0.85 + color.mix * 0.95);

        ctx.fillStyle = color.rgba;
        ctx.shadowColor = color.rgb;
        ctx.shadowBlur = 6 + color.mix * 14;
        ctx.beginPath();
        ctx.arc(point.sx, point.sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
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
    this.centerY = this.height * 0.5;
    this.baseScale = Math.min(this.width, this.height) * 0.34;
    this.projectionScale = this.baseScale * this.cameraDistance;
    this.pointRadius = Math.max(1.4, Math.min(this.width, this.height) * 0.0038);
    this.updateFrame();
  }

  destroy() {
    this.frame = null;
    this.currentShape = null;
    this.shapes = [];
    this.canvas = null;
    this.ctx = null;
  }

  updateFrame() {
    if (!this.currentShape || !this.canvas) {
      this.frame = null;
      return;
    }

    const wobbleX = this.angleX + Math.sin(this.elapsed * 0.41) * 0.16;
    const wobbleY = this.angleY + Math.cos(this.elapsed * 0.33) * 0.12;
    const wobbleZ = this.angleZ + Math.sin(this.elapsed * 0.27) * 0.08;
    const rotation = this.buildRotationMatrix(wobbleX, wobbleY, wobbleZ);
    const pulseScale = this.projectionScale * (1 + Math.sin(this.elapsed * 0.55) * 0.025);
    let zMin = Infinity;
    let zMax = -Infinity;

    const points = this.currentShape.vertices.map((vertex) => {
      const rotated = multiplyMatrixVector(rotation, vertex);
      const perspective = pulseScale / Math.max(0.35, this.cameraDistance - rotated.z);
      const point = {
        x: rotated.x,
        y: rotated.y,
        z: rotated.z,
        sx: this.centerX + rotated.x * perspective,
        sy: this.centerY + rotated.y * perspective,
      };

      zMin = Math.min(zMin, point.z);
      zMax = Math.max(zMax, point.z);
      return point;
    });

    const edges = this.currentShape.edges
      .map(([a, b]) => ({
        a,
        b,
        depth: (points[a].z + points[b].z) * 0.5,
      }))
      .sort((left, right) => left.depth - right.depth);

    const vertices = points
      .map((point, index) => ({ ...point, index }))
      .sort((left, right) => left.z - right.z);

    this.frame = {
      points,
      edges,
      vertices,
      zMin,
      zMax,
      depthRange: Math.max(0.0001, zMax - zMin),
    };
  }

  buildRotationMatrix(angleX, angleY, angleZ) {
    const sinX = Math.sin(angleX);
    const cosX = Math.cos(angleX);
    const sinY = Math.sin(angleY);
    const cosY = Math.cos(angleY);
    const sinZ = Math.sin(angleZ);
    const cosZ = Math.cos(angleZ);

    const rotationX = [
      [1, 0, 0],
      [0, cosX, -sinX],
      [0, sinX, cosX],
    ];

    const rotationY = [
      [cosY, 0, sinY],
      [0, 1, 0],
      [-sinY, 0, cosY],
    ];

    const rotationZ = [
      [cosZ, -sinZ, 0],
      [sinZ, cosZ, 0],
      [0, 0, 1],
    ];

    return multiplyMatrices(rotationZ, multiplyMatrices(rotationY, rotationX));
  }

  getDepthColor(depth, alpha) {
    const mix = clamp((depth - this.frame.zMin) / this.frame.depthRange, 0, 1);
    const red = Math.round(NEON_CYAN.r + (NEON_MAGENTA.r - NEON_CYAN.r) * mix);
    const green = Math.round(NEON_CYAN.g + (NEON_MAGENTA.g - NEON_CYAN.g) * mix);
    const blue = Math.round(NEON_CYAN.b + (NEON_MAGENTA.b - NEON_CYAN.b) * mix);

    return {
      mix,
      rgb: `rgb(${red}, ${green}, ${blue})`,
      rgba: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
    };
  }
}
