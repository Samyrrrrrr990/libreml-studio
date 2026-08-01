import { describe, expect, it } from 'vitest';

import { resolveTheme } from './useTheme';

describe('resolveTheme', () => {
  it('follows the operating system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the operating system once the user picks a theme explicitly', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
