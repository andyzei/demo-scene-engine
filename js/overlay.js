// Branding overlay — toggled with 'B' key
export class Overlay {
  constructor() {
    this.el = document.getElementById('overlay');
    this.visible = false;
    this.effectNameEl = this.el?.querySelector('.effect-name');
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
}
