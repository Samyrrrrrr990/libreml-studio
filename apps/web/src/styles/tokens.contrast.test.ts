/**
 * @vitest-environment node
 *
 * Runs outside jsdom: this reads the stylesheet from disk and needs a real
 * file URL from `import.meta.url`, which jsdom rewrites to an http URL.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Contrast regression guard for the palette.
 *
 * Colour tokens are easy to nudge for aesthetic reasons and hard to re-verify
 * by eye, so the accessibility floor is asserted here rather than recorded in a
 * document that drifts. Every pair below is a combination the interface
 * actually renders; see docs/development/design-system.md.
 */

const TOKENS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

type Theme = 'light' | 'dark';

/**
 * Collect `--token: #hex;` declarations that apply under one theme.
 *
 * Each theme's values are spread over several blocks (the palette and the port
 * colours are declared separately), so this walks the blocks in source order
 * and keeps the ones whose selector applies, letting later declarations win as
 * the cascade would. Selecting by byte offset instead would let the dark port
 * colours leak into the light theme, since they are declared last.
 */
const readTokens = (theme: Theme): Map<string, string> => {
  const tokens = new Map<string, string>();

  for (const [, selector, body] of TOKENS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const scope = selector!;
    const isDark = scope.includes("data-theme='dark'");
    const isLight = scope.includes("data-theme='light'");
    // A bare `:root` block carries values shared by both themes.
    const applies = isDark ? theme === 'dark' : isLight ? theme === 'light' : true;
    if (!applies) continue;

    for (const [, name, value] of body!.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      tokens.set(name!, value!);
    }
  }

  return tokens;
};

const channel = (value: number): number =>
  value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
};

const contrast = (foreground: string, background: string): number => {
  const [a, b] = [luminance(foreground), luminance(background)];
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
};

/** Text pairs, held to WCAG AA for normal-size text. */
const TEXT_PAIRS: Array<[string, string]> = [
  ['ink', 'bg-surface'],
  ['ink', 'bg-raised'],
  ['ink', 'bg-sunken'],
  ['ink', 'accent-surface'],
  ['ink-soft', 'bg-surface'],
  ['ink-soft', 'bg-raised'],
  ['ink-soft', 'accent-surface'],
  ['muted', 'bg-surface'],
  ['muted', 'bg-raised'],
  ['muted', 'bg-sunken'],
  ['faint', 'bg-raised'],
  ['accent', 'bg-surface'],
  ['accent', 'accent-surface'],
  ['success', 'success-surface'],
  ['caution', 'caution-surface'],
  ['danger', 'danger-surface'],
  ['bg-raised', 'ink'],
  ['accent-contrast', 'accent'],
];

/**
 * Non-text indicators, held to WCAG 1.4.11 (3:1).
 *
 * Port handles are 9px dots. They reinforce labels that already name the type
 * rather than carrying the meaning alone, so the graphical-object floor is the
 * correct threshold here.
 */
const INDICATOR_PAIRS: Array<[string, string]> = [
  ['port-dataset', 'bg-canvas'],
  ['port-model', 'bg-canvas'],
  ['port-metrics', 'bg-canvas'],
  ['port-report', 'bg-canvas'],
];

describe.each<Theme>(['light', 'dark'])('%s theme contrast', (theme) => {
  const tokens = readTokens(theme);

  it('defines every token the pairs reference', () => {
    const referenced = new Set([...TEXT_PAIRS, ...INDICATOR_PAIRS].flat());
    const missing = [...referenced].filter((name) => !tokens.has(name));
    expect(missing).toEqual([]);
  });

  it.each(TEXT_PAIRS)('%s on %s meets AA for text', (foreground, background) => {
    const ratio = contrast(tokens.get(foreground)!, tokens.get(background)!);
    expect(ratio, `${foreground} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(INDICATOR_PAIRS)('%s on %s meets AA for graphical objects', (foreground, background) => {
    const ratio = contrast(tokens.get(foreground)!, tokens.get(background)!);
    expect(ratio, `${foreground} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});
