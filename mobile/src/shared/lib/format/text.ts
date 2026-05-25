/**
 * Returns the first character of a name, uppercased.
 * Used for avatar initials throughout the app.
 */
export function getInitial(name: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}
