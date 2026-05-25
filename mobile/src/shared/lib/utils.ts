import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isNonEmpty(val: unknown): boolean {
  return val !== null && val !== undefined && val !== '';
}

/** Strip undefined/null/empty values from an object for stable serialization */
export function cleanUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => isNonEmpty(v))) as Partial<T>;
}
