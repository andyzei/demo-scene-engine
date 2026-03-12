// Engine — main loop, effect manager, transitions, keyboard controls

import { GlitchTransition } from './glitch.js';
import { Overlay } from './overlay.js';

// Import all effects
import { PlasmaEffect } from './effects/plasma.js';
import { StarfieldEffect } from './effects/starfield.js';
import { FireEffect } from './effects/fire.js';
import { RotozoomEffect } from './effects/rotozoom.js';
import { MetaballsEffect } from './effects/metaballs.js';

import { MatrixEffect } from './effects/matrix.js';
import { SineScrollEffect } from './effects/sinescroll.js';
import { MoireEffect } from './effects/moire.js';
import { FractalEffect } from './effects/fractal.js';
import { WireframeEffect } from './effects/wireframe.js';
import { ParticlesEffect } from './effects/particles.js';
import { PipesEffect } from './effects/pipes.js';

const EFFECTS = [
  { name: 'Plasma',         cls: PlasmaEffect,     duration: 45 },
  { name: 'Starfield',      cls: StarfieldEffect,   duration: 45 },
  { name: 'Fire',           cls: FireEffect,         duration: 40 },
  { name: 'Rotozoom',       cls: RotozoomEffect,     duration: 35 },
  { name: 'Metaballs',      cls: MetaballsEffect,    duration: 45 },

  { name: 'Matrix Rain',    cls: MatrixEffect,       duration: 50 },
  { name: 'Sine Scroll',    cls: SineScrollEffect,   duration: 40 },
  { name: 'Moiré Patterns', cls: MoireEffect,        duration: 35 },
  { name: 'Fractal Zoom',   cls: FractalEffect,      duration: 60 },
  { name: '3D Wireframe',   cls: WireframeEffect,    duration: 40 },
  { name: 'Particle Swarm', cls: ParticlesEffect,    duration: 50 },
  { name: '3D Pipes',       cls: PipesEffect,        duration: 45 },
];

class Engine {
  constructor() {
    this.canvas = document.getElementById('demo');
    this.ctx = this.canvas.getContext('2d');
    this.resize();

    this.effects = EFFECTS;
    this.currentIndex = 0;
    this.currentEffect = null;
    this.effectTimer = 0;
    this.paused = false;
    this.lastTime = 0;

    this.glitch = new GlitchTransition(this.canvas, this.ctx);
    this.overlay = new Overlay();
    this.transitioning = false;

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.loadEffect(0);
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.currentEffect && this.currentEffect.resize) {
      this.currentEffect.resize(this.canvas, this.ctx);
    }
  }

  loadEffect(index) {
    if (this.currentEffect && this.currentEffect.destroy) {
      this.currentEffect.destroy();
    }
    this.currentIndex = ((index % this.effects.length) + this.effects.length) % this.effects.length;
    const entry = this.effects[this.currentIndex];
    this.currentEffect = new entry.cls();
    this.currentEffect.init(this.canvas, this.ctx);
    this.effectTimer = 0;
    this.overlay.setEffectName(`[${this.currentIndex + 1}/${this.effects.length}] ${entry.name}`);
  }

  switchEffect(direction) {
    if (this.transitioning) return;
    this.transitioning = true;
    const nextIndex = this.currentIndex + direction;
    this.glitch.start(() => {
      this.loadEffect(nextIndex);
      this.transitioning = false;
    });
  }

  onKey(e) {
    switch (e.key) {
      case 'ArrowRight':
        this.switchEffect(1);
        break;
      case 'ArrowLeft':
        this.switchEffect(-1);
        break;
      case 'b':
      case 'B':
        this.overlay.toggle();
        break;
      case 'f':
      case 'F':
      case 'F11':
        e.preventDefault();
        this.toggleFullscreen();
        break;
      case ' ':
        e.preventDefault();
        this.paused = !this.paused;
        break;
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  loop(timestamp) {
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.1) : 0.016;
    this.lastTime = timestamp;

    // Update transition if active
    if (this.glitch.active) {
      this.glitch.update(dt);
      this.glitch.render();
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    if (!this.paused && this.currentEffect) {
      this.currentEffect.update(dt);
      this.currentEffect.render(this.ctx);

      // Auto-advance timer
      this.effectTimer += dt;
      const duration = this.effects[this.currentIndex].duration;
      this.overlay.updateTimer(this.effectTimer, duration);
      if (this.effectTimer >= duration) {
        this.switchEffect(1);
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => new Engine());
