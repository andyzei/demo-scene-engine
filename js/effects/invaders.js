// Invaders — 2-player Space Invaders homage with Copilot & Edge vs software bugs

const BUG_COLS = 11;
const BUG_ROWS = 5;
const BUG_SIZE = 28;
const BUG_PAD = 12;
const PLAYER_SIZE = 48;
const BULLET_SPEED = 320;
const BUG_BULLET_SPEED = 180;
const BUG_MOVE_STEP_X = 18;
const BUG_DROP_Y = 18;
const SHOOT_COOLDOWN = 0.45;
const BUG_SHOOT_INTERVAL = 1.2;
const RESPAWN_DELAY = 2.5;

// Bug types per row (top to bottom): antennae, wings, crawler, crawler, tank
const BUG_TYPES = ['antenna', 'wings', 'crawler', 'crawler', 'tank'];
const BUG_POINTS = [30, 20, 20, 10, 10];

export class InvadersEffect {
  constructor() {
    this.time = 0;
  }

  init(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;

    // Load logos
    this.copilotImg = null;
    this.edgeImg = null;
    this._loadLogo('img/copilot-logo.svg', img => { this.copilotImg = img; });
    this._loadLogo('img/edge-logo.svg', img => { this.edgeImg = img; });

    this._reset();
  }

  _loadLogo(src, cb) {
    const img = new Image();
    img.onload = () => cb(img);
    img.src = src;
  }

  _reset() {
    this.time = 0;
    this.phase = 'playing'; // playing | victory | respawn
    this.respawnTimer = 0;
    this.stars = this._makeStars();

    // Players — AI-controlled (positioned above the branding overlay)
    const ground = this.h - 120;
    this.players = [
      { x: this.w * 0.3, y: ground, logo: 'copilot', score: 0, cooldown: 0,
        targetX: this.w * 0.3, moveDir: 1, alive: true },
      { x: this.w * 0.7, y: ground, logo: 'edge', score: 0, cooldown: 0,
        targetX: this.w * 0.7, moveDir: -1, alive: true },
    ];

    this.playerBullets = [];
    this.bugBullets = [];
    this.explosions = [];

    this._spawnBugs();
    this.bugDir = 1;
    this.bugMoveTimer = 0;
    this.bugMoveInterval = 0.6;
    this.bugShootTimer = 0;
  }

  _makeStars() {
    const stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.6,
        twinkleSpeed: 1 + Math.random() * 2,
      });
    }
    return stars;
  }

  _spawnBugs() {
    this.bugs = [];
    const gridW = BUG_COLS * (BUG_SIZE + BUG_PAD);
    const startX = (this.w - gridW) / 2 + BUG_SIZE / 2;
    const startY = 60;

    for (let row = 0; row < BUG_ROWS; row++) {
      for (let col = 0; col < BUG_COLS; col++) {
        this.bugs.push({
          x: startX + col * (BUG_SIZE + BUG_PAD),
          y: startY + row * (BUG_SIZE + BUG_PAD),
          type: BUG_TYPES[row],
          points: BUG_POINTS[row],
          alive: true,
          frame: 0,
        });
      }
    }
  }

  update(dt) {
    this.time += dt;

    if (this.phase === 'respawn') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this._spawnBugs();
        this.bugDir = 1;
        this.bugMoveInterval = 0.6;
        this.bugMoveTimer = 0;
        this.bugShootTimer = 0;
        this.bugBullets = [];
        this.players[0].alive = true;
        this.players[1].alive = true;
        this.phase = 'playing';
      }
      this._updateExplosions(dt);
      return;
    }

    if (this.phase === 'victory') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this._spawnBugs();
        this.bugDir = 1;
        this.bugMoveInterval = 0.6;
        this.bugMoveTimer = 0;
        this.bugShootTimer = 0;
        this.phase = 'playing';
      }
      this._updateExplosions(dt);
      return;
    }

    // AI movement
    this._updateAI(dt);

    // Player bullets
    for (const b of this.playerBullets) b.y -= BULLET_SPEED * dt;
    this.playerBullets = this.playerBullets.filter(b => b.y > -10);

    // Bug bullets
    for (const b of this.bugBullets) b.y += BUG_BULLET_SPEED * dt;
    this.bugBullets = this.bugBullets.filter(b => b.y < this.h + 10);

    // Bug movement — classic step pattern
    this.bugMoveTimer += dt;
    if (this.bugMoveTimer >= this.bugMoveInterval) {
      this.bugMoveTimer = 0;
      let hitEdge = false;
      for (const bug of this.bugs) {
        if (!bug.alive) continue;
        bug.x += BUG_MOVE_STEP_X * this.bugDir;
        bug.frame = (bug.frame + 1) % 2;
        if (bug.x < BUG_SIZE || bug.x > this.w - BUG_SIZE) hitEdge = true;
      }
      if (hitEdge) {
        this.bugDir *= -1;
        for (const bug of this.bugs) {
          if (bug.alive) bug.y += BUG_DROP_Y;
        }
      }
      // Speed up as fewer bugs remain
      const alive = this.bugs.filter(b => b.alive).length;
      this.bugMoveInterval = Math.max(0.05, 0.6 * (alive / (BUG_COLS * BUG_ROWS)));
    }

    // Bug shooting
    this.bugShootTimer += dt;
    if (this.bugShootTimer >= BUG_SHOOT_INTERVAL) {
      this.bugShootTimer = 0;
      this._bugShoot();
    }

    // Collision: player bullets vs bugs
    for (const b of this.playerBullets) {
      if (b.dead) continue;
      for (const bug of this.bugs) {
        if (!bug.alive) continue;
        if (Math.abs(b.x - bug.x) < BUG_SIZE / 2 && Math.abs(b.y - bug.y) < BUG_SIZE / 2) {
          bug.alive = false;
          b.dead = true;
          this.players[b.owner].score += bug.points;
          this._addExplosion(bug.x, bug.y, '#39FF14');
          break;
        }
      }
    }
    this.playerBullets = this.playerBullets.filter(b => !b.dead);

    // Collision: bug bullets vs players
    for (const b of this.bugBullets) {
      if (b.dead) continue;
      for (const p of this.players) {
        if (!p.alive) continue;
        if (Math.abs(b.x - p.x) < PLAYER_SIZE / 2 && Math.abs(b.y - p.y) < PLAYER_SIZE / 2) {
          b.dead = true;
          p.alive = false;
          this._addExplosion(p.x, p.y, p.logo === 'copilot' ? '#7B61FF' : '#0078D4');
        }
      }
    }
    this.bugBullets = this.bugBullets.filter(b => !b.dead);

    // Check bug reached player row
    for (const bug of this.bugs) {
      if (bug.alive && bug.y >= this.players[0].y - PLAYER_SIZE / 2) {
        for (const p of this.players) p.alive = false;
        this.phase = 'respawn';
        this.respawnTimer = RESPAWN_DELAY;
        break;
      }
    }

    // Victory: all bugs dead
    if (this.bugs.every(b => !b.alive)) {
      this.phase = 'victory';
      this.respawnTimer = RESPAWN_DELAY;
    }

    // Both players dead
    if (this.players.every(p => !p.alive)) {
      this.phase = 'respawn';
      this.respawnTimer = RESPAWN_DELAY;
    }

    this._updateExplosions(dt);
  }

  _updateAI(dt) {
    const isCopilot = (p) => p.logo === 'copilot';
    const otherPlayer = (p) => this.players[isCopilot(p) ? 1 : 0];

    for (const p of this.players) {
      if (!p.alive) continue;
      p.cooldown -= dt;

      const aliveBugs = this.bugs.filter(b => b.alive);
      if (aliveBugs.length === 0) continue;

      let targetBug = null;

      if (isCopilot(p)) {
        // Copilot — targets nearest bug (simple but reliable)
        let bestDist = Infinity;
        for (const bug of aliveBugs) {
          const dist = Math.abs(bug.x - p.x);
          if (dist < bestDist) { bestDist = dist; targetBug = bug; }
        }
      } else {
        // Edge — smarter targeting: prioritize the lowest (most dangerous) bug,
        // break ties by proximity, and dodge incoming bullets
        let bestScore = -Infinity;
        for (const bug of aliveBugs) {
          // Heavily weight bugs closer to the bottom (more threatening)
          const dangerScore = bug.y * 3;
          // Prefer bugs close horizontally for quick kills
          const proxScore = -Math.abs(bug.x - p.x) * 0.5;
          // Prefer high-value targets
          const valueScore = bug.points * 2;
          // Avoid targeting bugs the other player is already aiming at
          const other = otherPlayer(p);
          const otherAiming = other.alive && Math.abs(bug.x - other.targetX) < BUG_SIZE;
          const overlapPenalty = otherAiming ? -80 : 0;

          const score = dangerScore + proxScore + valueScore + overlapPenalty;
          if (score > bestScore) { bestScore = score; targetBug = bug; }
        }

        // Dodge incoming bug bullets — override target if a bullet is close
        for (const b of this.bugBullets) {
          const timeToHit = (p.y - b.y) / BUG_BULLET_SPEED;
          if (timeToHit > 0 && timeToHit < 0.6 && Math.abs(b.x - p.x) < PLAYER_SIZE * 1.2) {
            // Strafe away from the bullet
            const dodgeDir = b.x > p.x ? -1 : 1;
            p.targetX = p.x + dodgeDir * PLAYER_SIZE * 1.5;
            targetBug = null;
            break;
          }
        }
      }

      if (targetBug) {
        const offset = isCopilot(p) ? -15 : 0;
        p.targetX = targetBug.x + offset;
      }

      // Movement speed: Edge is faster and more responsive
      const speed = isCopilot(p) ? 200 : 310;
      const deadzone = isCopilot(p) ? 4 : 2;
      const dx = p.targetX - p.x;
      if (Math.abs(dx) > deadzone) {
        p.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      }

      // Clamp
      p.x = Math.max(PLAYER_SIZE / 2, Math.min(this.w - PLAYER_SIZE / 2, p.x));

      // Shooting: Edge fires faster and leads its shots
      const cooldownBase = isCopilot(p) ? SHOOT_COOLDOWN : SHOOT_COOLDOWN * 0.65;
      if (p.cooldown <= 0 && targetBug) {
        // Edge leads shots — aim where the bug will be
        let aimX = targetBug.x;
        if (!isCopilot(p)) {
          const bulletTravelTime = (p.y - targetBug.y) / BULLET_SPEED;
          aimX += this.bugDir * BUG_MOVE_STEP_X * (bulletTravelTime / Math.max(0.05, this.bugMoveInterval));
        }

        // Only fire when reasonably aligned
        if (Math.abs(p.x - aimX) < BUG_SIZE * 0.8) {
          p.cooldown = cooldownBase + Math.random() * 0.1;
          this.playerBullets.push({
            x: p.x,
            y: p.y - PLAYER_SIZE / 2,
            owner: this.players.indexOf(p),
          });
        }
      }
    }
  }

  _bugShoot() {
    // Find bottom-most alive bug in each column and randomly pick one to shoot
    const bottomBugs = [];
    for (let col = 0; col < BUG_COLS; col++) {
      let bottom = null;
      for (let row = BUG_ROWS - 1; row >= 0; row--) {
        const bug = this.bugs[row * BUG_COLS + col];
        if (bug && bug.alive) { bottom = bug; break; }
      }
      if (bottom) bottomBugs.push(bottom);
    }
    if (bottomBugs.length > 0) {
      const shooter = bottomBugs[Math.floor(Math.random() * bottomBugs.length)];
      this.bugBullets.push({ x: shooter.x, y: shooter.y + BUG_SIZE / 2, dead: false });
    }
  }

  _addExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.explosions.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.5 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  _updateExplosions(dt) {
    for (const e of this.explosions) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
    }
    this.explosions = this.explosions.filter(e => e.life > 0);
  }

  render(ctx = this.ctx) {
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, this.w, this.h);

    // Stars
    for (const s of this.stars) {
      const twinkle = Math.sin(this.time * s.twinkleSpeed + s.x) * 0.3 + 0.7;
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Ground line / defense barrier
    const groundY = this.h - 95;
    ctx.strokeStyle = '#0078D4';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.w, groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Bugs
    for (const bug of this.bugs) {
      if (!bug.alive) continue;
      this._drawBug(ctx, bug);
    }

    // Players
    for (const p of this.players) {
      if (!p.alive) continue;
      this._drawPlayer(ctx, p);
    }

    // Player bullets
    for (const b of this.playerBullets) {
      const color = b.owner === 0 ? '#7B61FF' : '#00FFFF';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
      ctx.shadowBlur = 0;
    }

    // Bug bullets — zigzag style
    for (const b of this.bugBullets) {
      ctx.fillStyle = '#FF5544';
      ctx.shadowColor = '#FF5544';
      ctx.shadowBlur = 4;
      const zig = Math.sin(b.y * 0.15) * 3;
      ctx.fillRect(b.x + zig - 2, b.y - 4, 4, 8);
      ctx.shadowBlur = 0;
    }

    // Explosions
    for (const e of this.explosions) {
      ctx.globalAlpha = e.life / e.maxLife;
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
    }
    ctx.globalAlpha = 1;

    // HUD — scores
    this._drawHUD(ctx);

    // Phase overlays
    if (this.phase === 'victory') {
      this._drawCenterText(ctx, 'BUGS SQUASHED!', '#39FF14');
    } else if (this.phase === 'respawn') {
      this._drawCenterText(ctx, 'SYSTEM COMPROMISED', '#FF5544');
    }
  }

  _drawPlayer(ctx, p) {
    const img = p.logo === 'copilot' ? this.copilotImg : this.edgeImg;
    if (img) {
      ctx.drawImage(img, p.x - PLAYER_SIZE / 2, p.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    } else {
      // Fallback rectangle
      ctx.fillStyle = p.logo === 'copilot' ? '#7B61FF' : '#0078D4';
      ctx.fillRect(p.x - PLAYER_SIZE / 2, p.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    }

    // Glow under player
    ctx.save();
    const glow = ctx.createRadialGradient(p.x, p.y + PLAYER_SIZE / 2, 0, p.x, p.y + PLAYER_SIZE / 2, PLAYER_SIZE);
    glow.addColorStop(0, p.logo === 'copilot' ? 'rgba(123,97,255,0.25)' : 'rgba(0,120,212,0.25)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - PLAYER_SIZE, p.y, PLAYER_SIZE * 2, PLAYER_SIZE);
    ctx.restore();
  }

  _drawBug(ctx, bug) {
    const s = BUG_SIZE / 2;
    const x = bug.x;
    const y = bug.y;
    const f = bug.frame; // 0 or 1 for animation

    ctx.save();
    ctx.translate(x, y);

    switch (bug.type) {
      case 'antenna': this._drawAntennaBug(ctx, s, f); break;
      case 'wings':   this._drawWingsBug(ctx, s, f); break;
      case 'crawler': this._drawCrawlerBug(ctx, s, f); break;
      case 'tank':    this._drawTankBug(ctx, s, f); break;
    }

    ctx.restore();
  }

  _drawAntennaBug(ctx, s, f) {
    // Top-tier bug: bright red with antennae
    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FF6666';
    ctx.lineWidth = 1.5;

    // Body — diamond-ish
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.4);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s * 0.5);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s * 0.3, -s * 0.2, 3, 3);
    ctx.fillRect(s * 0.15, -s * 0.2, 3, 3);

    // Antennae — animated
    const anim = f === 0 ? -1 : 1;
    ctx.strokeStyle = '#FF6666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.4);
    ctx.lineTo(-s * 0.5 + anim * 3, -s * 0.9);
    ctx.moveTo(s * 0.2, -s * 0.4);
    ctx.lineTo(s * 0.5 - anim * 3, -s * 0.9);
    ctx.stroke();

    // Antenna tips
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    ctx.arc(-s * 0.5 + anim * 3, -s * 0.9, 2, 0, Math.PI * 2);
    ctx.arc(s * 0.5 - anim * 3, -s * 0.9, 2, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 1;
    const legOff = f === 0 ? 2 : -2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.1);
    ctx.lineTo(-s * 0.9, s * 0.5 + legOff);
    ctx.moveTo(s * 0.5, s * 0.1);
    ctx.lineTo(s * 0.9, s * 0.5 - legOff);
    ctx.moveTo(-s * 0.4, s * 0.3);
    ctx.lineTo(-s * 0.8, s * 0.7 - legOff);
    ctx.moveTo(s * 0.4, s * 0.3);
    ctx.lineTo(s * 0.8, s * 0.7 + legOff);
    ctx.stroke();
  }

  _drawWingsBug(ctx, s, f) {
    // Winged bug — orange/yellow
    ctx.fillStyle = '#FF8800';

    // Body — oval
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.35, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings — animated open/close
    const wingSpread = f === 0 ? 0.8 : 0.5;
    ctx.fillStyle = 'rgba(255, 170, 0, 0.5)';
    ctx.strokeStyle = '#FFAA00';
    ctx.lineWidth = 1;

    // Left wing
    ctx.beginPath();
    ctx.ellipse(-s * wingSpread, -s * 0.1, s * 0.5, s * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.ellipse(s * wingSpread, -s * 0.1, s * 0.5, s * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s * 0.15, -s * 0.25, 3, 3);
    ctx.fillRect(s * 0.05, -s * 0.25, 3, 3);

    // Mandibles
    ctx.strokeStyle = '#CC6600';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.45);
    ctx.lineTo(-s * 0.2, s * 0.7);
    ctx.moveTo(s * 0.1, s * 0.45);
    ctx.lineTo(s * 0.2, s * 0.7);
    ctx.stroke();
  }

  _drawCrawlerBug(ctx, s, f) {
    // Centipede-like — green
    ctx.fillStyle = '#44DD44';

    // Segmented body
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.35, 0, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outline
    ctx.strokeStyle = '#22AA22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(s * 0.7, 0);
    ctx.stroke();

    // Eyes on front segment
    ctx.fillStyle = '#fff';
    ctx.fillRect(s * 0.25, -s * 0.15, 2.5, 2.5);
    ctx.fillRect(s * 0.45, -s * 0.15, 2.5, 2.5);

    // Legs — animated
    ctx.strokeStyle = '#33BB33';
    ctx.lineWidth = 1;
    const legOff = f === 0 ? 3 : -3;
    for (let i = -1; i <= 1; i++) {
      const bx = i * s * 0.35;
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.15, s * 0.2);
      ctx.lineTo(bx - s * 0.35, s * 0.55 + legOff);
      ctx.moveTo(bx + s * 0.15, s * 0.2);
      ctx.lineTo(bx + s * 0.35, s * 0.55 - legOff);
      ctx.stroke();
    }
  }

  _drawTankBug(ctx, s, f) {
    // Heavy/tank bug — armored, dark purple
    ctx.fillStyle = '#8844CC';

    // Shell — rounded rectangle
    const hw = s * 0.7, hh = s * 0.4;
    ctx.beginPath();
    ctx.moveTo(-hw + 4, -hh);
    ctx.lineTo(hw - 4, -hh);
    ctx.quadraticCurveTo(hw, -hh, hw, -hh + 4);
    ctx.lineTo(hw, hh - 4);
    ctx.quadraticCurveTo(hw, hh, hw - 4, hh);
    ctx.lineTo(-hw + 4, hh);
    ctx.quadraticCurveTo(-hw, hh, -hw, hh - 4);
    ctx.lineTo(-hw, -hh + 4);
    ctx.quadraticCurveTo(-hw, -hh, -hw + 4, -hh);
    ctx.closePath();
    ctx.fill();

    // Armor plates
    ctx.strokeStyle = '#AA66EE';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.3, -hh);
    ctx.lineTo(-hw * 0.3, hh);
    ctx.moveTo(hw * 0.3, -hh);
    ctx.lineTo(hw * 0.3, hh);
    ctx.stroke();

    // Eyes — menacing slits
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(-s * 0.25, -s * 0.1, 5, 2);
    ctx.fillRect(s * 0.1, -s * 0.1, 5, 2);

    // Pincers
    const pAnim = f === 0 ? 2 : -2;
    ctx.strokeStyle = '#6622AA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hw, s * 0.15);
    ctx.lineTo(-hw - 6, s * 0.4 + pAnim);
    ctx.moveTo(hw, s * 0.15);
    ctx.lineTo(hw + 6, s * 0.4 - pAnim);
    ctx.stroke();
  }

  _drawHUD(ctx) {
    const fontSize = Math.max(14, Math.min(20, this.w * 0.018));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    // Player 1 — Copilot
    ctx.fillStyle = '#7B61FF';
    ctx.textAlign = 'left';
    ctx.fillText(`COPILOT: ${this.players[0].score}`, 16, 12);

    // Player 2 — Edge
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'right';
    ctx.fillText(`EDGE: ${this.players[1].score}`, this.w - 16, 12);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.4;
    ctx.font = `${Math.max(10, fontSize * 0.7)}px monospace`;
    ctx.fillText('BUG INVADERS', this.w / 2, 14);
    ctx.globalAlpha = 1;
  }

  _drawCenterText(ctx, text, color) {
    const size = Math.max(24, Math.min(48, this.w * 0.04));
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pulsing glow
    const pulse = Math.sin(this.time * 4) * 0.3 + 0.7;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillText(text, this.w / 2, this.h / 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  resize(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.stars = this._makeStars();

    // Reposition players above the branding overlay
    const ground = this.h - 120;
    for (const p of this.players) {
      p.y = ground;
      p.x = Math.min(p.x, this.w - PLAYER_SIZE / 2);
    }
  }

  destroy() {
    this.bugs = [];
    this.playerBullets = [];
    this.bugBullets = [];
    this.explosions = [];
    this.canvas = null;
    this.ctx = null;
  }
}
