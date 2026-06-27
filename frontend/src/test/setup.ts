import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';
import { setI18nLocale } from '@/shared/i18n';

// Force the i18n locale to 'ru' for all tests: navigator.language detection in
// jsdom is unreliable, and component tests assert against Russian source text.
setI18nLocale('ru');

// jsdom stubs — shared across all test files
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollTo = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
