// Glitch transition between demo effects
// Captures current frame, applies RGB split + block displacement + scanlines over ~0.8s

export class GlitchTransition {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.active = false;
    this.duration = 800; // ms
    this.elapsed = 0;
    this.capturedFrame = null;
    this.onComplete = null;
  }

  start(onComplete) {
    this.active = true;
    this.elapsed = 0;
    this.onComplete = onComplete;
    // Capture current frame
    this.capturedFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  update(dt) {
    if (!this.active) return false;
    this.elapsed += dt * 1000;
    if (this.elapsed >= this.duration) {
      this.active = false;
      if (this.onComplete) this.onComplete();
      return false;
    }
    return true;
  }

  render() {
    if (!this.active || !this.capturedFrame) return;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const progress = this.elapsed / this.duration;

    // Put captured frame as base
    ctx.putImageData(this.capturedFrame, 0, 0);

    // Intensity ramps up then down
    const intensity = Math.sin(progress * Math.PI);

    // RGB channel split
    const splitAmount = Math.floor(intensity * 30);
    if (splitAmount > 0) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const src = imgData.data;
      const output = ctx.createImageData(w, h);
      const dst = output.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          // Red channel shifted right
          const rx = Math.min(w - 1, x + splitAmount);
          const ri = (y * w + rx) * 4;
          // Blue channel shifted left
          const bx = Math.max(0, x - splitAmount);
          const bi = (y * w + bx) * 4;

          dst[i]     = src[ri];     // R from shifted position
          dst[i + 1] = src[i + 1];  // G stays
          dst[i + 2] = src[bi + 2]; // B from shifted position
          dst[i + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
    }

    // Block displacement — random horizontal blocks
    const blockCount = Math.floor(intensity * 12);
    for (let i = 0; i < blockCount; i++) {
      const blockH = Math.floor(Math.random() * 40) + 5;
      const blockY = Math.floor(Math.random() * h);
      const shift = Math.floor((Math.random() - 0.5) * intensity * 80);
      try {
        const block = ctx.getImageData(0, blockY, w, Math.min(blockH, h - blockY));
        ctx.putImageData(block, shift, blockY);
      } catch (e) { /* ignore out of bounds */ }
    }

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Random color flashes
    if (Math.random() < intensity * 0.3) {
      const colors = ['rgba(0,120,212,0.1)', 'rgba(123,97,255,0.1)', 'rgba(0,255,255,0.08)'];
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(0, 0, w, h);
    }

    // White flash near the middle of transition
    if (progress > 0.4 && progress < 0.6) {
      const flashIntensity = 1 - Math.abs(progress - 0.5) / 0.1;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, flashIntensity * 0.5)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
