import { useEffect } from 'react';

import { useWorkspaceStore, type ThemePreference } from '../store/workspace';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Resolve a stored preference to the theme that should actually be painted. */
export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' => {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
};

/**
 * Applies the resolved theme to the document element.
 *
 * The attribute is written to `<html>` rather than a React-rendered wrapper so
 * that portalled surfaces (dialogs, the toast region, React Flow's own layers)
 * inherit the same tokens. When the preference is `system`, the media query is
 * kept subscribed: the operating system can switch appearance while the app is
 * open, and a research session can easily outlast a sunset.
 */
export function useTheme(): void {
  const theme = useWorkspaceStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
    };

    apply();

    if (theme !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
