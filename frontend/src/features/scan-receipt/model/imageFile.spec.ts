import { describe, it, expect } from 'vitest';
import { isHeicFile, isAcceptableImage } from './imageFile';

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

describe('isHeicFile', () => {
  it('детектит по mime-типу image/heic и image/heif', () => {
    expect(isHeicFile(makeFile('photo.heic', 'image/heic'))).toBe(true);
    expect(isHeicFile(makeFile('photo.heif', 'image/heif'))).toBe(true);
  });

  it('детектит по расширению при пустом mime-типе (iOS «Файлы»)', () => {
    expect(isHeicFile(makeFile('IMG_0001.HEIC', ''))).toBe(true);
    expect(isHeicFile(makeFile('IMG_0001.heif', ''))).toBe(true);
  });

  it('не считает HEIC обычный jpeg и файлы с чужим типом', () => {
    expect(isHeicFile(makeFile('photo.jpg', 'image/jpeg'))).toBe(false);
    expect(isHeicFile(makeFile('doc.heic', 'application/octet-stream'))).toBe(false);
    expect(isHeicFile(makeFile('notes.txt', ''))).toBe(false);
  });
});

describe('isAcceptableImage', () => {
  it('принимает любые image/*', () => {
    expect(isAcceptableImage(makeFile('a.png', 'image/png'))).toBe(true);
    expect(isAcceptableImage(makeFile('a.webp', 'image/webp'))).toBe(true);
  });

  it('принимает HEIC без mime-типа', () => {
    expect(isAcceptableImage(makeFile('a.heic', ''))).toBe(true);
  });

  it('отклоняет не-изображения', () => {
    expect(isAcceptableImage(makeFile('a.pdf', 'application/pdf'))).toBe(false);
    expect(isAcceptableImage(makeFile('a.txt', ''))).toBe(false);
  });
});
