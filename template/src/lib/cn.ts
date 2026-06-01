// Tiny classnames helper — the one shared dependency catalog components may import.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
