// Shared color palette — Microsoft Edge/Copilot brand + classic demo neon accents
export const PALETTE = {
  edgeBlue:      '#0078D4',
  copilotPurple: '#7B61FF',
  teal:          '#00B7C3',
  neonCyan:      '#00FFFF',
  neonMagenta:   '#FF00FF',
  electricGreen: '#39FF14',
  deepBlack:     '#0A0A0A',
  white:         '#FFFFFF',
};

// Pre-parsed RGB values for perf-critical rendering
export const RGB = {};
for (const [name, hex] of Object.entries(PALETTE)) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  RGB[name] = { r, g, b };
}

// Interpolate between two RGB colors (t in 0..1)
export function lerpColor(c1, c2, t) {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

// Build a 256-entry palette array from color stops [{color, pos}]
export function buildGradient(stops) {
  const palette = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j].pos && t <= stops[j + 1].pos) {
        s0 = stops[j];
        s1 = stops[j + 1];
        break;
      }
    }
    const localT = s1.pos === s0.pos ? 0 : (t - s0.pos) / (s1.pos - s0.pos);
    palette[i] = lerpColor(s0.color, s1.color, localT);
  }
  return palette;
}

// Convert {r,g,b} to CSS string
export function rgbCSS(c, a = 1) {
  return a < 1 ? `rgba(${c.r},${c.g},${c.b},${a})` : `rgb(${c.r},${c.g},${c.b})`;
}
