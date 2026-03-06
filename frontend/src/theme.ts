/**
 * Design tokens for the Journal app.
 *
 * Centralises colors, dimension labels, and helper functions
 * so components reference tokens, not hex codes.
 */

// ── Colors ────────────────────────────────────────────────────────

export const colors = {
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0EB',
  accent: '#C4704B',
  accentHover: '#B3603D',
  accentLight: '#F0DDD4',
  positive: '#7A8F6B',
  positiveLight: '#E8EDE4',
  negative: '#C47A6B',
  negativeLight: '#F5E4E0',
  amber: '#C4A04B',
  amberLight: '#F5EFE0',
  text: '#2C2C2C',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  border: '#E8E4E0',
  borderLight: '#F0EDE8',
} as const;

// ── Score color helper ────────────────────────────────────────────

/**
 * Returns a color for a 1-10 score:
 *   >= 7  → positive (olive green)
 *   >= 5  → amber
 *   < 5   → negative (clay red)
 */
export function scoreColor(score: number): string {
  if (score >= 7) return colors.positive;
  if (score >= 5) return colors.amber;
  return colors.negative;
}

/**
 * Returns a light background tint for a 1-10 score.
 */
export function scoreBgColor(score: number): string {
  if (score >= 7) return colors.positiveLight;
  if (score >= 5) return colors.amberLight;
  return colors.negativeLight;
}

/**
 * Returns Tailwind text-color class for a 1-10 score.
 */
export function scoreTextClass(score: number): string {
  if (score >= 7) return 'text-journal-positive';
  if (score >= 5) return 'text-journal-amber';
  return 'text-journal-negative';
}

// ── Life dimensions ───────────────────────────────────────────────

export interface LifeDimension {
  key: string;
  label: string;
  shortLabel: string;
}

export const LIFE_DIMENSIONS: LifeDimension[] = [
  { key: 'career', label: 'Career / Work', shortLabel: 'Career' },
  { key: 'relationship', label: 'Relationship', shortLabel: 'Relationship' },
  { key: 'family', label: 'Family', shortLabel: 'Family' },
  { key: 'health', label: 'Physical & Mental Health', shortLabel: 'Health' },
  { key: 'finance', label: 'Finance', shortLabel: 'Finance' },
  { key: 'social', label: 'Social', shortLabel: 'Social' },
  { key: 'purpose', label: 'Purpose', shortLabel: 'Purpose' },
];

export const DIMENSION_KEYS = LIFE_DIMENSIONS.map((d) => d.key);
