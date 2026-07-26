#!/usr/bin/env node
/**
 * Бюджет бандла первой отрисовки.
 *
 * Считает всё, что index.html грузит до того, как приложение что-либо покажет:
 * входной чанк, его modulepreload-зависимости и блокирующий CSS. Размер берётся
 * по .gz — именно эти файлы раздаёт nginx (gzip_static).
 *
 * Регрессия здесь обычно не выглядит регрессией в коде: достаточно импорта из
 * barrel'а в модуле, до которого дотягивается App.vue, — и в старт уезжает
 * лишняя сотня килобайт. Поэтому проверка отдельным шагом после сборки.
 *
 * Запуск: node scripts/check-eager-bundle.mjs [--budget=<КБ>]
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const DEFAULT_BUDGET_KB = 250;

const budgetKb = Number(
  process.argv.find((arg) => arg.startsWith('--budget='))?.split('=')[1] ?? DEFAULT_BUDGET_KB,
);

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

// Входной <script type="module">, его modulepreload и render-blocking <link rel="stylesheet">
const eager = new Set(
  [
    ...html.matchAll(
      /<(?:script[^>]*\ssrc|link[^>]*\srel="(?:modulepreload|stylesheet)"[^>]*\shref)="([^"]+)"/g,
    ),
  ]
    .map((match) => match[1])
    .filter((url) => url.startsWith('/')),
);

// Проверка, которая ничего не нашла, — это молчаливый зелёный, а не «в бюджете»:
// стоит Vite поменять порядок атрибутов в теге, и регулярка перестанет ловить
// вообще всё. Входной <script type="module"> обязан быть в index.html всегда.
if (![...eager].some((url) => /\.js$/.test(url))) {
  console.error(
    'Не найден ни один JS в index.html — разметка изменилась, регулярка ниже устарела.\n' +
      'Проверка бесполезна, пока её не починили.',
  );
  process.exit(1);
}

let totalGzip = 0;
const rows = [];

for (const url of eager) {
  const path = join(DIST, url);
  const gzipPath = `${path}.gz`;
  // Без .gz (мелкие файлы плагин не жмёт) берём исходный размер — nginx сожмёт на лету
  const size = statSync(existsOrNull(gzipPath) ?? path).size;
  totalGzip += size;
  rows.push([url, size]);
}

function existsOrNull(path) {
  try {
    statSync(path);
    return path;
  } catch {
    return null;
  }
}

rows.sort((a, b) => b[1] - a[1]);

const totalKb = totalGzip / 1024;
console.log(`Бандл первой отрисовки: ${rows.length} файлов, ${totalKb.toFixed(1)} КБ gzip`);
for (const [url, size] of rows.slice(0, 10)) {
  console.log(`  ${(size / 1024).toFixed(1).padStart(7)} КБ  ${url}`);
}

if (totalKb > budgetKb) {
  console.error(
    `\nПревышен бюджет: ${totalKb.toFixed(1)} КБ > ${budgetKb} КБ.\n` +
      'Проверьте, не утёк ли в стартовый граф импорт из barrel’а ' +
      '(frontend/CLAUDE.md → «Eager import graph»).',
  );
  process.exit(1);
}

console.log(`\nВ бюджете: ${totalKb.toFixed(1)} / ${budgetKb} КБ`);
