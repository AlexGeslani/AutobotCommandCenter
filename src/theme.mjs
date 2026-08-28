export const ACC_THEME_STORAGE_KEY = 'acc.presentation-theme.v1';
export const DEFAULT_THEME = 'current-dark';

export const STATUS_COLORS = Object.freeze({
  good: '#41e88a',
  warn: '#ffca62',
  bad: '#ff707b',
});

export const THEME_PRESENTATION = Object.freeze({
  'current-dark': Object.freeze({
    label: 'Current Dark',
    accentPrimary: '#54d9ff',
    accentSecondary: '#9dd8ff',
  }),
  matrix: Object.freeze({
    label: 'Matrix',
    accentPrimary: '#62ff72',
    accentSecondary: '#b7ff5a',
  }),
});

export function validateTheme(value) {
  return typeof value === 'string' && Object.hasOwn(THEME_PRESENTATION, value) ? value : DEFAULT_THEME;
}

export function loadStoredTheme(storage = globalThis.localStorage) {
  try {
    return validateTheme(storage?.getItem(ACC_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistTheme(value, storage = globalThis.localStorage) {
  const theme = validateTheme(value);
  try {
    storage?.setItem(ACC_THEME_STORAGE_KEY, theme);
  } catch {
    // A blocked localStorage implementation must not break the dashboard.
  }
  return theme;
}
