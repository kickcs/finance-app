import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectLocale } from './detectLocale';

function mockNavLang(value: string | undefined) {
  vi.stubGlobal('navigator', { language: value });
}

afterEach(() => vi.unstubAllGlobals());

describe('detectLocale', () => {
  it('returns "en" for English browser locales', () => {
    mockNavLang('en-US');
    expect(detectLocale()).toBe('en');
  });
  it('returns "ru" for Russian browser locales', () => {
    mockNavLang('ru-RU');
    expect(detectLocale()).toBe('ru');
  });
  it('falls back to "ru" for any other locale', () => {
    mockNavLang('de-DE');
    expect(detectLocale()).toBe('ru');
  });
  it('falls back to "ru" when navigator.language is missing', () => {
    mockNavLang(undefined);
    expect(detectLocale()).toBe('ru');
  });
});
