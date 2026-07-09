const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_EXTENSION = /\.(heic|heif)$/i;

/** HEIC/HEIF по mime-типу или, при пустом типе (iOS «Файлы»), по расширению. */
export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true;
  return file.type === '' && HEIC_EXTENSION.test(file.name);
}

/** Изображение, которое мы берём в работу: любой image/* или HEIC без mime-типа. */
export function isAcceptableImage(file: File): boolean {
  return file.type.startsWith('image/') || isHeicFile(file);
}

async function canDecodeNatively(file: File): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Гарантирует, что файл сможет декодировать <img>: HEIC без нативной поддержки
 * конвертируется в JPEG лениво подгружаемым wasm-декодером, остальное — как есть.
 */
export async function ensureJpegDecodable(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  if (await canDecodeNatively(file)) return file;

  const { heicTo } = await import('heic-to');
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}
