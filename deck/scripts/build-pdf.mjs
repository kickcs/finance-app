// Печатает deck/src/index.html в PDF системным Chrome.
//
// Страница отдаётся по http, а не открывается как file://: при file:// Chrome
// отказывается грузить шрифты из соседней папки, и весь дек уезжает на
// подменный шрифт — молча, уже в готовом PDF.
//
//   node scripts/build-pdf.mjs                  → out/ouro-finance-deck.pdf
//   node scripts/build-pdf.mjs --lang=en        → out/ouro-finance-deck-en.pdf
//   node scripts/build-pdf.mjs --png            → плюс превью в out/preview/<дек>/
//
// Превью снимаются С ГОТОВОГО PDF, а не со страницы в браузере. Разница не
// косметическая: box-shadow браузер размывает, а печать рисует сплошной серой
// плашкой — снимок страницы такую беду показывает «правильной».
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = new URL("../", import.meta.url);
const OUT = new URL("../out/", import.meta.url);
const WITH_PNG = process.argv.includes("--png");

// Русский и английский дек — два разных src/index*.html на одном deck.css и на
// одних скриншотах: интерфейс на кадрах русский в обоих случаях.
const LANG = process.argv.find((a) => a.startsWith("--lang="))?.slice(7) ?? "ru";
const SRC = LANG === "ru" ? "/src/index.html" : `/src/index.${LANG}.html`;
const NAME = LANG === "ru" ? "ouro-finance-deck" : `ouro-finance-deck-${LANG}`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  try {
    const body = await readFile(new URL(`.${path}`, ROOT));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.goto(`${origin}${SRC}`, { waitUntil: "networkidle0" });

// Шрифты объявлены с font-display: block, поэтому текст не отрисуется
// подменным начертанием — но дождаться загрузки всё равно надо до печати.
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})));
});

// Имя семейства в fonts.css и в deck.css однажды разошлись, и весь основной
// текст молча уехал на системный шрифт — в браузере это почти незаметно.
// document.fonts.check() такое НЕ ловит: для незнакомого семейства он берёт
// подменный шрифт и всё равно отвечает true. Спрашиваем список загруженного.
const loaded = await page.evaluate(() =>
  [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
);
const absent = ["Golos Text", "IBM Plex Mono", "Inter Var"].filter((f) => !loaded.includes(f));
if (absent.length) {
  throw new Error(`Шрифты не загрузились: ${absent.join(", ")}. Проверьте public/fonts/fonts.css или запустите bun run fonts`);
}

const slides = await page.$$(".slide");
console.log(`Слайдов: ${slides.length}`);

const pdf = new URL(`${NAME}.pdf`, OUT).pathname;
await page.pdf({
  path: pdf,
  printBackground: true,
  preferCSSPageSize: true,
  pageRanges: `1-${slides.length}`,
});

// Превью: каждый слайд печатается отдельным одностраничным PDF и рендерится
// системным Quick Look. Медленнее снимка страницы, зато показывает ровно то,
// что увидит получатель файла.
if (WITH_PNG) {
  const dir = new URL(`preview/${NAME}/`, OUT);
  await mkdir(dir, { recursive: true });
  for (let i = 1; i <= slides.length; i++) {
    await page.evaluate((keep) => {
      document.querySelectorAll(".slide").forEach((s, j) => j !== keep - 1 && s.remove());
    }, i);
    const one = new URL(`p${i}.pdf`, dir).pathname;
    await page.pdf({ path: one, printBackground: true, preferCSSPageSize: true });
    execFileSync("qlmanage", ["-t", "-s", "1920", "-o", dir.pathname, one], { stdio: "ignore" });
    execFileSync("sips", ["-s", "format", "png", `${one}.png`, "--out", new URL(`${String(i).padStart(2, "0")}.png`, dir).pathname], { stdio: "ignore" });
    await rm(one);
    await rm(`${one}.png`);
    await page.goto(`${origin}${SRC}`, { waitUntil: "networkidle0" });
  }
  console.log(`Превью с готового PDF: out/preview/${NAME}/01…${String(slides.length).padStart(2, "0")}.png`);
}

await browser.close();
server.close();

// Последняя проверка — по самому файлу, а не по странице: если у гарнитуры не
// оказалось нужного знака, Chrome подставит системный шрифт и вошьёт его в PDF.
// Так в деке однажды появился Menlo — из-за стрелки, которой нет в подмножестве.
const bytes = await readFile(pdf);
const ALLOWED = ["GolosText", "IBMPlexMono", "Inter"];
const used = [...new Set([...bytes.toString("latin1").matchAll(/\/FontName\s*\/(?:[A-Z]{6}\+)?([^\s/\]>\r\n]+)/g)].map((m) => m[1]))];
const strangers = used.filter((f) => !ALLOWED.some((a) => f.startsWith(a)));
if (strangers.length) {
  throw new Error(`В PDF попали посторонние шрифты: ${strangers.join(", ")}. Ищите знак, которого нет в подмножестве.`);
}

const { size } = await stat(pdf);
console.log(`✓ out/${NAME}.pdf — ${(size / 1024 / 1024).toFixed(1)} МБ, шрифты: ${ALLOWED.join(", ")}`);
