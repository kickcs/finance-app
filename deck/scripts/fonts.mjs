// Скачивает woff2 из Google Fonts и складывает рядом с готовым fonts.css.
// Шрифты лежат в репозитории, а не тянутся с сети при сборке: PDF должен
// собираться офлайн, и набор не должен молча поехать при обновлении семейства.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../public/fonts/", import.meta.url);

// Chrome отдаёт woff2 только «браузерному» UA; без него gstatic вернёт ttf.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FAMILIES = [
  { css: "Golos+Text:wght@500;700;900", name: "Golos Text", slug: "golos" },
  { css: "IBM+Plex+Mono:wght@400;600", name: "IBM Plex Mono", slug: "plexmono" },
];

// Кириллица обязательна, латиница — для цифр, валют и латинских названий.
const WANTED = new Set(["cyrillic", "latin"]);

await mkdir(OUT, { recursive: true });

const faces = [];

for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.css}&display=swap`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

  // В ответе каждый блок предваряется комментарием с именем подмножества:
  // /* cyrillic */ @font-face { ... }
  const blocks = css.split("/*").slice(1);

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf("*/")).trim();
    if (!WANTED.has(subset)) continue;

    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const src = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!weight || !src || !range) throw new Error(`Не разобрал @font-face ${family.name} / ${subset}`);

    const file = `${family.slug}-${subset}-${weight}.woff2`;
    const bytes = await (await fetch(src, { headers: { "User-Agent": UA } })).arrayBuffer();
    await writeFile(new URL(file, OUT), Buffer.from(bytes));
    faces.push({ family: family.name, weight, file, range });
    console.log(`✓ ${file} ${(bytes.byteLength / 1024).toFixed(1)} КБ`);
  }
}

// Inter уже лежит в node_modules фронта — тот же файл, что и в приложении,
// чтобы подписи рядом со скриншотами были набраны тем же шрифтом.
const INTER = new URL("../../frontend/node_modules/@fontsource-variable/inter/files/", import.meta.url);
for (const subset of ["cyrillic", "latin"]) {
  const bytes = await readFile(new URL(`inter-${subset}-wght-normal.woff2`, INTER));
  const file = `inter-${subset}.woff2`;
  await writeFile(new URL(file, OUT), bytes);
  faces.push({
    family: "Inter Var",
    weight: "100 900",
    file,
    range:
      subset === "cyrillic"
        ? "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
        : "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  });
  console.log(`✓ ${file} ${(bytes.byteLength / 1024).toFixed(1)} КБ`);
}

const css = faces
  .map(
    (f) => `@font-face {
  font-family: "${f.family}";
  font-style: normal;
  font-weight: ${f.weight};
  font-display: block;
  src: url("./${f.file}") format("woff2");
  unicode-range: ${f.range};
}`,
  )
  .join("\n\n");

await writeFile(new URL("fonts.css", OUT), `${css}\n`);
console.log(`\n${faces.length} начертаний → public/fonts/fonts.css`);
