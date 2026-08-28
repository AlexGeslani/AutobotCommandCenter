export const ACC_THEME_STORAGE_KEY = 'acc.presentation-theme.v1';
export const DEFAULT_THEME = 'g1-console';

export const STATUS_COLORS = Object.freeze({
  good: '#41e88a',
  warn: '#ffca62',
  bad: '#ff707b',
});

export const THEME_PRESENTATION = Object.freeze({
  'g1-console': Object.freeze({
    label: 'Teletraan1',
    accentPrimary: '#ffb23e',
    accentSecondary: '#58d9ef',
  }),
  'current-dark': Object.freeze({
    label: 'Terminal Dark',
    accentPrimary: '#ffb454',
    accentSecondary: '#ffe0a3',
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
