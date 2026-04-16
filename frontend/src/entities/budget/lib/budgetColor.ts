/**
 * Returns a CSS color string for a budget percentage:
 * - 0-50%: success (green)
 * - 50-75%: blends from success to warning (yellow)
 * - 75-100%+: blends from warning to danger (red)
 */
export function getBudgetColor(percentage: number): string {
  if (percentage <= 50) return 'var(--color-success)';
  if (percentage <= 75) {
    const ratio = Math.round((1 - (percentage - 50) / 25) * 100);
    return `color-mix(in srgb, var(--color-success) ${ratio}%, var(--color-warning))`;
  }
  const ratio = Math.round((1 - Math.min((percentage - 75) / 25, 1)) * 100);
  return `color-mix(in srgb, var(--color-warning) ${ratio}%, var(--color-danger))`;
}
