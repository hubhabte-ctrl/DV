/**
 * WS3-2: Automated contrast audit (WCAG AA) over token pairs.
 * Evaluates contrast ratios for text vs background color tokens.
 * WCAG AA thresholds:
 * - Normal text (primary/secondary/onAccent): >= 4.5:1
 * - Large text / UI elements / muted text: >= 3.0:1
 */
// @ts-ignore - vitest runner types resolved at test execution (Doc 08)
import { describe, expect, it } from 'vitest';
import tokens from './tokens.json';

/**
 * Converts OKLCH color string to relative luminance (0..1) per WCAG specifications.
 * Format: oklch(L% C H) or oklch(L% C H / A) or hex #rrggbb
 */
function oklchToLuminance(colorStr: string): number {
  if (colorStr.startsWith('#')) {
    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  }

  const match = colorStr.match(/oklch\(\s*([\d\.]+%?)\s+([\d\.]+)\s+([\d\.]+)/i);
  if (!match) {
    throw new Error(`Unable to parse color string: ${colorStr}`);
  }

  const rawL = match[1];
  const L = rawL.endsWith('%') ? parseFloat(rawL) / 100 : parseFloat(rawL);
  const C = parseFloat(match[2]);
  const H = (parseFloat(match[3]) * Math.PI) / 180;

  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 0.1291007796 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const clamp = (val: number) => Math.max(0, Math.min(1, val));
  return 0.2126 * clamp(rLin) + 0.7152 * clamp(gLin) + 0.0722 * clamp(bLin);
}

function contrastRatio(color1: string, color2: string): number {
  const lum1 = oklchToLuminance(color1);
  const lum2 = oklchToLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WS3-2 WCAG AA Contrast Audit', () => {
  const text = tokens.color.text;
  const bg = tokens.color.bg;
  const accent = tokens.color.accent;

  it('verifies Primary Text (normal text >= 4.5:1) on dark surfaces', () => {
    expect(contrastRatio(text.primary, bg.app)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.primary, bg.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.primary, bg.panelRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.primary, bg.inset)).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies Secondary Text (normal text >= 4.5:1) on panel backgrounds', () => {
    expect(contrastRatio(text.secondary, bg.app)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.secondary, bg.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text.secondary, bg.panelRaised)).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies Muted Text (ui/large/secondary text >= 3.0:1) on panel backgrounds', () => {
    expect(contrastRatio(text.muted, bg.app)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(text.muted, bg.panel)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(text.muted, bg.panelRaised)).toBeGreaterThanOrEqual(3.0);
  });

  it('verifies Text on Accent Button (onAccent vs accent.primary >= 3.0:1 for UI components)', () => {
    expect(contrastRatio(text.onAccent, accent.primary)).toBeGreaterThanOrEqual(3.0);
  });

  it('verifies Inverse Text (inverse vs light raised surfaces >= 4.5:1)', () => {
    expect(contrastRatio(text.inverse, text.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * T3 (DS-alignment plan): per-studio category color coding   " WCAG 1.4.11.
 * `--studio-accent` values (global.css [data-studio] blocks) must hold >= 3:1
 * against the surface they annotate, in BOTH themes. Values mirror the token
 * layer: dark uses Forma category tokens as-is; light uses the re-tuned
 * darker variants defined in global.css.
 */
describe('T3 Per-studio accent contrast (WCAG 1.4.11 >= 3:1)', () => {
  const DARK_SURFACE = 'oklch(0.205 0.009 264)'; // --surface (dark)
  const LIGHT_SURFACE = 'oklch(1 0 0)'; // --surface (light)

  const darkStudioAccents = {
    dom: 'oklch(0.66 0.17 274)', // --accent (dark)
    '3d': 'oklch(0.68 0.1 200)', // --teal
    material: 'oklch(0.63 0.15 44)', // --bs-color-accent-clay (Spec 07   2 ruling E-B)
    timeline: 'oklch(0.56 0.16 300)', // --violet
    asset: 'oklch(0.74 0.13 70)', // --amber
  };

  const lightStudioAccents = {
    dom: 'oklch(0.54 0.17 274)', // --accent (light)
    '3d': 'oklch(0.5 0.1 200)', // light re-tune (global.css T3 block)
    material: 'oklch(0.55 0.15 44)', // light clay re-tune (global.css T3 block, E-B)
    timeline: 'oklch(0.56 0.16 300)', // --violet passes untouched
    asset: 'oklch(0.55 0.13 70)', // light re-tune (global.css T3 block)
  };

  for (const [studio, color] of Object.entries(darkStudioAccents)) {
    it(`dark theme: ${studio} accent >= 3:1 on --surface`, () => {
      expect(contrastRatio(color, DARK_SURFACE)).toBeGreaterThanOrEqual(3.0);
    });
  }

  for (const [studio, color] of Object.entries(lightStudioAccents)) {
    it(`light theme: ${studio} accent >= 3:1 on --surface`, () => {
      expect(contrastRatio(color, LIGHT_SURFACE)).toBeGreaterThanOrEqual(3.0);
    });
  }
});
