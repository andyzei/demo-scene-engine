// Fight — retro fighting game with two AI-controlled fighters

const DEG = Math.PI / 180;

const POSE_IDLE = {
  frontUpperArm: 120, frontForearm: 210,
  backUpperArm: 100, backForearm: 220,
  frontThigh: 15, frontShin: 5,
  backThigh: -10, backShin: -5,
  bodyX: 0, bodyY: 0, lean: 0,
};

const POSE_PUNCH = {
  frontUpperArm: 90, frontForearm: 90,
  backUpperArm: 110, backForearm: 215,
  frontThigh: 18, frontShin: 5,
  backThigh: -15, backShin: -3,
  bodyX: 8, bodyY: 0, lean: 5,
};

const POSE_KICK = {
  frontUpperArm: 130, frontForearm: 230,
  backUpperArm: 130, backForearm: 230,
  frontThigh: 85, frontShin: 85,
  backThigh: -15, backShin: -10,
  bodyX: -8, bodyY: 0, lean: -10,
};

const POSE_HIT = {
  frontUpperArm: 40, frontForearm: 60,
  backUpperArm: 320, backForearm: 300,
  frontThigh: -10, frontShin: 10,
  backThigh: -25, backShin: 15,
  bodyX: -15, bodyY: 0, lean: -15,
};

const POSE_BLOCK = {
  frontUpperArm: 130, frontForearm: 180,
  backUpperArm: 120, backForearm: 185,
  frontThigh: 10, frontShin: 3,
  backThigh: -8, backShin: -2,
  bodyX: -3, bodyY: 0, lean: -3,
};

const POSE_VICTORY = {
  frontUpperArm: 155, frontForearm: 165,
  backUpperArm: 205, backForearm: 195,
  frontThigh: 5, frontShin: 0,
  backThigh: -5, backShin: 0,
  bodyX: 0, bodyY: 0, lean: 0,
};

const POSE_DOWN = {
  frontUpperArm: 30, frontForearm: 340,
  backUpperArm: 330, backForearm: 300,
  frontThigh: 50, frontShin: 310,
  backThigh: 310, backShin: 50,
  bodyX: -30, bodyY: 40, lean: -80,
};

function lerpPose(a, b, t) {
  const r = {};
  for (const k of Object.keys(a)) r[k] = a[k] + (b[k] - a[k]) * t;
  return r;
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

export class FightEffect {
  constructor() {
    this.time = 0;
  }

  init(canvas, ctx) {
    this.w = canvas.width;
    this.h = canvas.height;
    this.scale = Math.min(this.w / 800, this.h / 600);
    this.groundY = this.h * 0.78;
    this.particles = [];
    this.shakeTimer = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.texts = [];
    this.round = 1;
    this.wins = [0, 0];
    this.resetRound();
  }

  resetRound() {
    this.fighters = [
      this.makeFighter('SONIA', this.w * 0.3, 1, {
        hair: '#FFD700', skin: '#FFCC99',
        outfit: '#0078D4', outfit2: '#00BFFF',
        boots: '#1a1a2e', gloves: '#0078D4',
      }),
      this.makeFighter('SHADE', this.w * 0.7, -1, {
        hair: '#2a2a2a', skin: '#DDBB99',
        outfit: '#8B0000', outfit2: '#FF4444',
        boots: '#1a1a1a', gloves: '#8B0000',
      }),
    ];
    this.state = 'intro';
    this.stateTimer = 0;
    this.introPhase = 0;
    this.particles = [];
    this.texts = [];
  }

  makeFighter(name, x, facing, colors) {
    return {
      name, x, facing, colors,
      health: 100,
      action: 'idle',
      actionTimer: 0,
      prevPose: { ...POSE_IDLE },
      targetPose: { ...POSE_IDLE },
      poseDuration: 0.1,
      bobPhase: facing === 1 ? 0 : Math.PI,
      hitCooldown: 0,
      attackCooldown: 0,
      hasHit: false,
      moveDir: 0,
      aiTimer: 0.3 + Math.random() * 0.3,
    };
  }

  // --- State machine ---

  update(dt) {
    this.time += dt;
    this.stateTimer += dt;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeTimer * 18 * this.scale;
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
    } else {
      this.shakeX = this.shakeY = 0;
    }

    this.updateParticles(dt);
    this.updateTexts(dt);

    for (const f of this.fighters) f.bobPhase += dt * 3.5;

    switch (this.state) {
      case 'intro': this.updateIntro(dt); break;
      case 'fight': this.updateFight(dt); break;
      case 'ko':    this.updateKO(dt);    break;
    }
  }

  updateIntro() {
    if (this.stateTimer > 0.8 && this.introPhase === 0) {
      this.introPhase = 1;
      this.showText(`ROUND ${this.round}`, 1.2, '#FFD700');
    }
    if (this.stateTimer > 2.0 && this.introPhase === 1) {
      this.introPhase = 2;
      this.showText('FIGHT!', 0.9, '#FF4444');
    }
    if (this.stateTimer > 3.0) {
      this.state = 'fight';
      this.stateTimer = 0;
    }
  }

  updateFight(dt) {
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      const o = this.fighters[1 - i];
      this.updateFighterAI(f, o, dt);
      this.updateFighterAction(f, o, dt);
    }
    this.clampFighters();

    for (const f of this.fighters) {
      if (f.health <= 0) {
        this.state = 'ko';
        this.stateTimer = 0;
        const wi = f === this.fighters[0] ? 1 : 0;
        this.winner = this.fighters[wi];
        this.loser = f;
        this.setAction(f, 'ko', POSE_DOWN, 0.7);
        this.setAction(this.winner, 'victory', POSE_VICTORY, 0.5);
        this.shakeTimer = 0.5;
        this.showText('K.O.!', 1.8, '#FF0000');
        break;
      }
    }
  }

  updateKO() {
    for (const f of this.fighters) f.actionTimer += 0;
    if (this.stateTimer > 4.0) {
      const wi = this.fighters.indexOf(this.winner);
      this.wins[wi]++;
      this.round++;
      if (this.round > 3 || this.wins[0] >= 2 || this.wins[1] >= 2) {
        this.round = 1;
        this.wins = [0, 0];
      }
      this.resetRound();
    }
  }

  // --- AI ---

  updateFighterAI(fighter, opponent, dt) {
    if (fighter.action === 'hit' || fighter.action === 'ko' || fighter.action === 'victory') {
      fighter.moveDir = 0;
      return;
    }

    fighter.hitCooldown = Math.max(0, fighter.hitCooldown - dt);
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);

    // Continuous movement
    if (fighter.action === 'idle' && fighter.moveDir !== 0) {
      const speed = fighter.moveDir === 1 ? 130 : 80;
      fighter.x += fighter.facing * fighter.moveDir * speed * this.scale * dt;
    }

    fighter.aiTimer -= dt;
    if (fighter.aiTimer > 0) return;
    fighter.aiTimer = 0.12 + Math.random() * 0.3;

    if (fighter.action !== 'idle') return;

    const dist = Math.abs(fighter.x - opponent.x);
    const attackRange = 75 * this.scale;

    if (dist < attackRange && fighter.attackCooldown <= 0) {
      // In range — attack, block, or back away
      if ((opponent.action === 'punch' || opponent.action === 'kick') && Math.random() < 0.4) {
        this.setAction(fighter, 'block', POSE_BLOCK, 0.35 + Math.random() * 0.25);
        fighter.moveDir = 0;
        return;
      }
      const r = Math.random();
      if (r < 0.35) {
        this.setAction(fighter, 'punch', POSE_PUNCH, 0.32);
        fighter.attackCooldown = 0.15;
        fighter.moveDir = 0;
      } else if (r < 0.6) {
        this.setAction(fighter, 'kick', POSE_KICK, 0.42);
        fighter.attackCooldown = 0.25;
        fighter.moveDir = 0;
      } else if (r < 0.75) {
        this.setAction(fighter, 'block', POSE_BLOCK, 0.3 + Math.random() * 0.2);
        fighter.moveDir = 0;
      } else {
        fighter.moveDir = -1;
      }
    } else {
      // Out of range — approach, idle, or retreat
      const r = Math.random();
      if (r < 0.6) fighter.moveDir = 1;
      else if (r < 0.85) fighter.moveDir = 0;
      else fighter.moveDir = -1;
    }
  }

  // --- Actions ---

  setAction(fighter, action, targetPose, duration) {
    fighter.prevPose = this.getCurrentPose(fighter);
    fighter.action = action;
    fighter.actionTimer = 0;
    fighter.targetPose = { ...targetPose };
    fighter.poseDuration = duration;
    fighter.hasHit = false;
    fighter.moveDir = 0;
  }

  updateFighterAction(fighter, opponent, dt) {
    if (fighter.action === 'idle' || fighter.action === 'victory' || fighter.action === 'ko') return;

    fighter.actionTimer += dt;

    if (fighter.action === 'punch') {
      if (fighter.actionTimer > 0.06 && fighter.actionTimer < 0.16 && !fighter.hasHit) {
        this.checkHit(fighter, opponent, 12);
      }
      if (fighter.actionTimer >= fighter.poseDuration) {
        this.setAction(fighter, 'idle', POSE_IDLE, 0.12);
      }
    } else if (fighter.action === 'kick') {
      if (fighter.actionTimer > 0.1 && fighter.actionTimer < 0.2 && !fighter.hasHit) {
        this.checkHit(fighter, opponent, 16);
      }
      if (fighter.actionTimer >= fighter.poseDuration) {
        this.setAction(fighter, 'idle', POSE_IDLE, 0.15);
      }
    } else if (fighter.action === 'hit') {
      if (fighter.actionTimer >= fighter.poseDuration) {
        this.setAction(fighter, 'idle', POSE_IDLE, 0.18);
      }
    } else if (fighter.action === 'block') {
      if (fighter.actionTimer >= fighter.poseDuration) {
        this.setAction(fighter, 'idle', POSE_IDLE, 0.12);
      }
    }
  }

  checkHit(attacker, defender, damage) {
    if (defender.hitCooldown > 0 || defender.action === 'ko') return;
    const dist = Math.abs(attacker.x - defender.x);
    if (dist > 70 * this.scale) return;

    attacker.hasHit = true;
    const hitX = (attacker.x + defender.x) / 2;
    const hitY = this.groundY - 50 * this.scale;

    if (defender.action === 'block') {
      defender.health = Math.max(0, defender.health - 2);
      this.spawnParticles(hitX, hitY, 5, '#FFFFFF');
      defender.hitCooldown = 0.12;
      this.shakeTimer = 0.06;
      return;
    }

    defender.health = Math.max(0, defender.health - damage);
    defender.hitCooldown = 0.35;
    defender.x -= attacker.facing * 25 * this.scale;
    this.setAction(defender, 'hit', POSE_HIT, 0.3);
    this.spawnParticles(hitX, hitY, 14, attacker.colors.outfit2);
    this.spawnParticles(hitX, hitY, 8, '#FFFFFF');
    this.shakeTimer = 0.15;
  }

  getCurrentPose(fighter) {
    const t = Math.min(fighter.actionTimer / Math.max(fighter.poseDuration, 0.01), 1);
    return lerpPose(fighter.prevPose, fighter.targetPose, easeOut(t));
  }

  clampFighters() {
    const margin = 35 * this.scale;
    for (const f of this.fighters) {
      f.x = Math.max(margin, Math.min(this.w - margin, f.x));
    }
    const minDist = 35 * this.scale;
    const dx = this.fighters[1].x - this.fighters[0].x;
    if (Math.abs(dx) < minDist) {
      const center = (this.fighters[0].x + this.fighters[1].x) / 2;
      this.fighters[0].x = center - minDist / 2;
      this.fighters[1].x = center + minDist / 2;
    }
    this.fighters[0].facing = this.fighters[0].x < this.fighters[1].x ? 1 : -1;
    this.fighters[1].facing = -this.fighters[0].facing;
  }

  // --- Particles ---

  spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const life = 0.25 + Math.random() * 0.35;
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 320 * this.scale,
        vy: (Math.random() - 0.7) * 280 * this.scale,
        life, maxLife: life,
        size: (2 + Math.random() * 4) * this.scale,
        color,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * this.scale * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // --- Text overlays ---

  showText(text, duration, color) {
    this.texts.push({ text, duration, timer: 0, color });
  }

  updateTexts(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].timer += dt;
      if (this.texts[i].timer >= this.texts[i].duration) this.texts.splice(i, 1);
    }
  }

  // === RENDERING ===

  render(ctx) {
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this.renderBackground(ctx);

    // Draw fighters back-to-front
    const sorted = [...this.fighters].sort((a, b) => {
      if (a.action === 'ko') return -1;
      if (b.action === 'ko') return 1;
      return 0;
    });
    for (const f of sorted) this.renderFighter(ctx, f);

    this.renderParticles(ctx);
    this.renderHealthBars(ctx);
    this.renderTextOverlays(ctx);

    ctx.restore();
  }

  renderBackground(ctx) {
    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    grad.addColorStop(0, '#08000e');
    grad.addColorStop(0.5, '#100018');
    grad.addColorStop(1, '#180024');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.groundY);

    // Floor
    const fg = ctx.createLinearGradient(0, this.groundY, 0, this.h);
    fg.addColorStop(0, '#2a1a0a');
    fg.addColorStop(0.4, '#1a1008');
    fg.addColorStop(1, '#0a0804');
    ctx.fillStyle = fg;
    ctx.fillRect(0, this.groundY, this.w, this.h - this.groundY);

    // Ground line
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2 * this.scale;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.w, this.groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Floor grid
    ctx.strokeStyle = 'rgba(255,200,100,0.06)';
    ctx.lineWidth = 1;
    const spacing = 35 * this.scale;
    for (let y = this.groundY + spacing; y < this.h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }

    // Pillars and fire
    this.renderPillar(ctx, this.w * 0.07);
    this.renderPillar(ctx, this.w * 0.93);
  }

  renderPillar(ctx, x) {
    const s = this.scale;
    const pillarH = this.h * 0.55;
    const pillarW = 18 * s;
    const top = this.groundY - pillarH;

    ctx.fillStyle = '#14101a';
    ctx.fillRect(x - pillarW / 2, top, pillarW, pillarH);

    // Edge highlight
    ctx.fillStyle = 'rgba(255,200,100,0.06)';
    ctx.fillRect(x - pillarW / 2, top, 2 * s, pillarH);
    ctx.fillRect(x + pillarW / 2 - 2 * s, top, 2 * s, pillarH);

    // Fire bowl
    ctx.fillStyle = '#221818';
    ctx.fillRect(x - pillarW * 0.7, top - 5 * s, pillarW * 1.4, 7 * s);

    // Fire
    const ft = this.time * 6 + x;
    for (let i = 0; i < 6; i++) {
      const fx = x + (Math.sin(ft + i * 1.3) * 6) * s;
      const fy = top - 8 * s - (8 + Math.sin(ft * 1.2 + i) * 5) * s;
      const fr = (2.5 + Math.sin(ft * 0.8 + i * 2) * 1.5) * s;
      const a = 0.35 + 0.25 * Math.sin(ft + i);
      ctx.fillStyle = i < 3
        ? `rgba(255,200,50,${a})`
        : `rgba(255,90,15,${a})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ambient glow
    const glowR = 60 * s;
    const gy = top - 10 * s;
    const flicker = 0.7 + 0.3 * Math.sin(ft * 1.1);
    const glow = ctx.createRadialGradient(x, gy, 0, x, gy, glowR * flicker);
    glow.addColorStop(0, 'rgba(255,110,20,0.2)');
    glow.addColorStop(0.6, 'rgba(255,50,10,0.06)');
    glow.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowR, gy - glowR, glowR * 2, glowR * 2);
  }

  renderFighter(ctx, fighter) {
    const s = this.scale;
    const pose = this.getCurrentPose(fighter);
    const bob = fighter.action === 'ko' ? 0 : Math.sin(fighter.bobPhase) * 2 * s;
    const c = fighter.colors;

    ctx.save();
    ctx.translate(fighter.x, this.groundY);
    if (fighter.facing === -1) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 20 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Apply body offset and lean
    ctx.save();
    ctx.translate(pose.bodyX * s, pose.bodyY * s + bob);
    ctx.rotate(pose.lean * DEG);

    // Back leg
    this.drawLimb(ctx,
      -6 * s, -35 * s,
      pose.backThigh, 18 * s,
      pose.backShin, 16 * s,
      9 * s, c.outfit, c.boots);

    // Back arm
    this.drawLimb(ctx,
      -8 * s, -60 * s,
      pose.backUpperArm, 14 * s,
      pose.backForearm, 12 * s,
      6 * s, c.skin, c.gloves);

    // Torso
    ctx.fillStyle = c.outfit;
    ctx.fillRect(-12 * s, -65 * s, 24 * s, 30 * s);

    // Belt
    ctx.fillStyle = c.outfit2;
    ctx.fillRect(-12 * s, -38 * s, 24 * s, 4 * s);

    // Collar detail
    ctx.fillStyle = c.outfit2;
    ctx.fillRect(-7 * s, -65 * s, 14 * s, 3 * s);

    // Head
    const hy = -74 * s;
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(0, hy, 10 * s, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.fillRect(4 * s, hy - 2 * s, 3 * s, 2.5 * s);

    // Hair top
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(0, hy - 2 * s, 10.5 * s, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.fill();

    // Extra hair by character
    if (fighter.name === 'SONIA') {
      ctx.fillStyle = c.hair;
      ctx.beginPath();
      ctx.moveTo(-7 * s, hy - 4 * s);
      ctx.quadraticCurveTo(-16 * s, hy + 2 * s, -13 * s, hy + 18 * s);
      ctx.quadraticCurveTo(-10 * s, hy + 12 * s, -8 * s, hy + 3 * s);
      ctx.fill();
    } else {
      // Short spiky hair
      ctx.fillStyle = c.hair;
      ctx.fillRect(-9 * s, hy - 12 * s, 18 * s, 6 * s);
    }

    // Front leg
    this.drawLimb(ctx,
      6 * s, -35 * s,
      pose.frontThigh, 18 * s,
      pose.frontShin, 16 * s,
      9 * s, c.outfit, c.boots);

    // Front arm
    this.drawLimb(ctx,
      8 * s, -60 * s,
      pose.frontUpperArm, 14 * s,
      pose.frontForearm, 12 * s,
      6 * s, c.skin, c.gloves);

    ctx.restore();
    ctx.restore();
  }

  drawLimb(ctx, sx, sy, ang1, len1, ang2, len2, thick, col1, col2) {
    const r1 = ang1 * DEG;
    const r2 = ang2 * DEG;
    const jx = sx + Math.sin(r1) * len1;
    const jy = sy + Math.cos(r1) * len1;
    const ex = jx + Math.sin(r2) * len2;
    const ey = jy + Math.cos(r2) * len2;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Upper segment
    ctx.strokeStyle = col1;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(jx, jy);
    ctx.stroke();

    // Lower segment
    ctx.strokeStyle = col2;
    ctx.lineWidth = thick * 0.85;
    ctx.beginPath();
    ctx.moveTo(jx, jy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Joint
    ctx.fillStyle = col1;
    ctx.beginPath();
    ctx.arc(jx, jy, thick * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // End (hand/foot)
    ctx.fillStyle = col2;
    ctx.beginPath();
    ctx.arc(ex, ey, thick * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  renderHealthBars(ctx) {
    const s = this.scale;
    const barW = this.w * 0.35;
    const barH = 16 * s;
    const barY = 18 * s;
    const margin = this.w * 0.05;

    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      const bx = i === 0 ? margin : this.w - margin - barW;

      // Background
      ctx.fillStyle = '#1a0808';
      ctx.fillRect(bx - 2, barY - 2, barW + 4, barH + 4);

      // Health fill
      const pct = Math.max(0, f.health / 100);
      const hw = barW * pct;

      const hg = ctx.createLinearGradient(bx, barY, bx, barY + barH);
      if (pct > 0.5) {
        hg.addColorStop(0, '#44FF44');
        hg.addColorStop(1, '#228822');
      } else if (pct > 0.2) {
        hg.addColorStop(0, '#FFFF44');
        hg.addColorStop(1, '#888822');
      } else {
        hg.addColorStop(0, '#FF4444');
        hg.addColorStop(1, '#882222');
      }
      ctx.fillStyle = hg;
      ctx.fillRect(i === 0 ? bx : bx + barW - hw, barY, hw, barH);

      // Border
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, barY, barW, barH);

      // Name
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${13 * s}px monospace`;
      ctx.textAlign = i === 0 ? 'left' : 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(f.name, i === 0 ? bx : bx + barW, barY - 3);

      // Win dots
      for (let w = 0; w < this.wins[i]; w++) {
        const dx = i === 0 ? bx + 8 * s + w * 14 * s : bx + barW - 8 * s - w * 14 * s;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(dx, barY + barH + 10 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Round label
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${14 * s}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`ROUND ${this.round}`, this.w / 2, barY);
  }

  renderTextOverlays(ctx) {
    for (const t of this.texts) {
      const p = t.timer / t.duration;
      let alpha = 1, sc = 1;

      if (p < 0.15) {
        sc = 0.3 + 0.7 * easeOut(p / 0.15);
        alpha = p / 0.15;
      } else if (p > 0.75) {
        alpha = 1 - (p - 0.75) / 0.25;
      }

      const fs = Math.floor(80 * this.scale * sc);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow
      ctx.fillStyle = '#000';
      ctx.fillText(t.text, this.w / 2 + 3 * this.scale, this.h * 0.38 + 3 * this.scale);

      // Outline
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4 * this.scale;
      ctx.strokeText(t.text, this.w / 2, this.h * 0.38);

      // Fill
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, this.w / 2, this.h * 0.38);

      ctx.restore();
    }
  }

  resize(canvas, ctx) {
    const oldW = this.w || canvas.width;
    this.w = canvas.width;
    this.h = canvas.height;
    this.scale = Math.min(this.w / 800, this.h / 600);
    this.groundY = this.h * 0.78;
    if (this.fighters) {
      for (const f of this.fighters) {
        f.x = (f.x / oldW) * this.w;
      }
    }
  }

  destroy() {}
}
