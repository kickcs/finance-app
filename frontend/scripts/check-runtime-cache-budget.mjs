#!/usr/bin/env node
/**
 * Вместимость рантайм-кэша чанков.
 *
 * Service worker кладёт всё, что не вошло в оболочку, в кэш `route-chunks`
 * (CacheFirst) с ограничением `maxEntries`. Когда файлов в сборке больше, чем
 * записей в кэше, workbox начинает вытеснять по LRU — и вытесняет именно то,
 * что открывают редко. Онлайн этого не видно: чанк просто перекачивается.
 * Офлайн редкая страница перестаёт открываться вовсе, а если под нож попал
 * чанк макета — не поднимается и само приложение.
 *
 * Регрессия здесь беззвучна и приходит не из кода, а из роста: каждая новая
 * страница добавляет свой чанк и свой CSS. Поэтому проверка отдельным шагом
 * после сборки, рядом с бюджетом бандла первой отрисовки.
 *
 * Числа берутся из собранного `sw.js`, а не дублируются здесь: и лимит, и
 * список каталогов заданы в `vite.config.ts` и попадают в воркер как есть.
 *
 * Запуск: node scripts/check-runtime-cache-budget.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');

// Правило CacheFirst для чанков целиком: каталоги из urlPattern и maxEntries
// его ExpirationPlugin. Минифицировано, поэтому шаблон жёсткий — и это
// намеренно: молча разошедшаяся регулярка дала бы вечный зелёный.
const rule = sw.match(
  /\/\^\\\/\(([^)]+)\)\\\/\/\.test\([^)]*\),new [\w$]+\.CacheFirst\(\{cacheName:"route-chunks",plugins:\[new [\w$]+\.ExpirationPlugin\(\{maxEntries:(\d+)/,
);

if (!rule) {
  console.error(
    'В dist/sw.js не найдено правило кэширования `route-chunks`.\n' +
      'Либо изменился конфиг workbox в vite.config.ts, либо его минификация —\n' +
      'проверка бесполезна, пока шаблон выше не починили.',
  );
  process.exit(1);
}

const [, dirs, maxEntriesRaw] = rule;
const maxEntries = Number(maxEntriesRaw);
const runtimePath = new RegExp(`^(${dirs})/`);

// Записи precache отдаются своим маршрутом workbox и до правила CacheFirst не
// доходят, хотя путями под него подходят.
const precached = new Set(
  [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1].replace(/^\//, '')),
);

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(relative(DIST, full));
  }
  return acc;
};

const cached = walk(DIST).filter(
  (file) =>
    runtimePath.test(file) &&
    !file.endsWith('.gz') &&
    !file.endsWith('.map') &&
    !precached.has(file),
);

console.log(`Рантайм-кэш чанков: ${cached.length} файлов при лимите ${maxEntries} записей`);

if (cached.length > maxEntries) {
  console.error(
    `\nФайлов больше, чем вмещает кэш: ${cached.length} > ${maxEntries}.\n` +
      'Вытеснение по LRU сломает офлайн у редко открываемых страниц.\n' +
      'Поднимите maxEntries у правила `route-chunks` в vite.config.ts.',
  );
  process.exit(1);
}

console.log(`\nВ бюджете: ${cached.length} / ${maxEntries}, запас ${maxEntries - cached.length}`);
