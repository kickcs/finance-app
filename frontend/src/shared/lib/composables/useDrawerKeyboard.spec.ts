import { describe, it, expect } from 'vitest';
import { computeKeyboardGeometry } from './useDrawerKeyboard';

describe('computeKeyboardGeometry', () => {
  it('клавиатура закрыта → keyboardVisible false, offset 0', () => {
    const result = computeKeyboardGeometry(800, 800, 0);
    expect(result.keyboardVisible).toBe(false);
    expect(result.offset).toBe(0);
  });

  it('Safari/PWA без пана → visible, offset 300', () => {
    const result = computeKeyboardGeometry(800, 500, 0);
    expect(result.keyboardVisible).toBe(true);
    expect(result.offset).toBe(300);
  });

  it('Telegram полный пан → visible, offset 0', () => {
    const result = computeKeyboardGeometry(800, 500, 300);
    expect(result.keyboardVisible).toBe(true);
    expect(result.offset).toBe(0);
  });

  it('частичный пан → offset 200', () => {
    const result = computeKeyboardGeometry(800, 500, 100);
    expect(result.offset).toBe(200);
  });

  it('offsetTop больше сжатия → offset 0 (clamp)', () => {
    const result = computeKeyboardGeometry(800, 700, 150);
    expect(result.offset).toBe(0);
  });
});
