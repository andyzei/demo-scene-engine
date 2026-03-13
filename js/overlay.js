// Branding overlay — toggled with 'B' key
export class Overlay {
  constructor() {
    this.el = document.getElementById('overlay');
    this.visible = true;
    if (this.el) this.el.classList.add('visible');
    this.effectNameEl = this.el?.querySelector('.effect-name');
    this.timerEl = this.el?.querySelector('.timer');
  }

  toggle() {
    this.visible = !this.visible;
    if (this.el) {
      this.el.classList.toggle('visible', this.visible);
    }
  }

  setEffectName(name) {
    if (this.effectNameEl) {
      this.effectNameEl.textContent = name;
    }
  }

  updateTimer(elapsed, duration) {
    if (!this.timerEl) return;
    const remaining = Math.max(0, Math.ceil(duration - elapsed));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    this.timerEl.textContent = min > 0
      ? `${min}:${String(sec).padStart(2, '0')}`
      : `0:${String(sec).padStart(2, '0')}`;
  }
}
