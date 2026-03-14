let nextId = 0;

export function uid(): string {
  return `r_${++nextId}_${Date.now()}`;
}
