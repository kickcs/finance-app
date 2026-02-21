/**
 * Generates iOS PWA splash screen images.
 * Uses sharp to render logo SVG centered on light/dark backgrounds.
 *
 * Run: cd frontend && bun run scripts/generate-splash-screens.ts
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENS = [
  { name: '1320x2868', width: 1320, height: 2868 }, // iPhone 16 Pro Max
  { name: '1206x2622', width: 1206, height: 2622 }, // iPhone 16 Pro
  { name: '1290x2796', width: 1290, height: 2796 }, // iPhone 15 Pro Max / 16 Plus / 14 Pro Max
  { name: '1179x2556', width: 1179, height: 2556 }, // iPhone 15 Pro / 16
  { name: '1170x2532', width: 1170, height: 2532 }, // iPhone 14 / 15
  { name: '750x1334', width: 750, height: 1334 },   // iPhone SE 3rd
  { name: '1125x2436', width: 1125, height: 2436 }, // iPhone 12/13 mini / X / XS
  { name: '1242x2208', width: 1242, height: 2208 }, // iPhone 8 Plus
];

const THEMES = [
  { name: 'light', bg: '#FAFAFA' },
  { name: 'dark', bg: '#09090B' },
];

const OUTPUT_DIR = join(import.meta.dir, '../public/splash');
const LOGO_SVG = readFileSync(join(import.meta.dir, '../public/favicon.svg'));
const LOGO_SIZE_RATIO = 0.2; // Logo takes 20% of screen width

async function generateSplash(
  width: number,
  height: number,
  bgColor: string,
  outputPath: string,
) {
  const logoSize = Math.round(width * LOGO_SIZE_RATIO);

  const logoBuffer = await sharp(Buffer.from(LOGO_SVG))
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: logoBuffer,
        left: Math.round((width - logoSize) / 2),
        top: Math.round((height - logoSize) / 2),
      },
    ])
    .png({ quality: 90 })
    .toFile(outputPath);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const screen of SCREENS) {
    for (const theme of THEMES) {
      const filename = `apple-splash-${screen.name}-${theme.name}.png`;
      const outputPath = join(OUTPUT_DIR, filename);
      await generateSplash(screen.width, screen.height, theme.bg, outputPath);
      console.log(`Generated: ${filename}`);
    }
  }

  console.log(`\nDone! Generated ${SCREENS.length * THEMES.length} splash screens in public/splash/`);
}

main();
