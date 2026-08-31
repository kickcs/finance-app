// Замер ширины подписей настоящим Inter в настоящем Chrome. Нужен потому, что
// перенос строки в headline ломает раскладку молча: блок выровнен по нижнему
// краю, вторая строка уезжает вверх и наезжает на кадр.
import puppeteer from "puppeteer-core";
import { COPY } from "../src/copy.ts";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Бокс = ширина контейнера в сцене, за вычетом паддинга и рамки.
const BOXES = {
  headline: { size: 72, weight: 700, spacing: -1.5, box: 1180 },
  kicker: { size: 34, weight: 500, spacing: 0, box: 1180 },
  morningLine: { size: 52, weight: 600, spacing: -1, box: 1200 },
  everywhereHeadline: { size: 60, weight: 700, spacing: -1.5, box: 1400 },
  // Плитки в «И на компьютере» переносятся по замыслу — русская вторая
  // плитка занимает две строки с самого начала. Ограничение здесь на число
  // строк, а не на ширину.
  everywhereItem: { size: 28, weight: 500, spacing: 0, box: 330, lines: 2 },
  ctaNote: { size: 34, weight: 500, spacing: 0, box: 1200 },
};

const jobs = [];
for (const [lang, c] of Object.entries(COPY)) {
  jobs.push([lang, "morning.line", "morningLine", c.morning.line]);
  for (const key of ["bankImport", "quickAdd", "scanReceipt", "split", "debts", "history", "analytics", "budget"]) {
    jobs.push([lang, `${key}.headline`, "headline", c[key].headline]);
    jobs.push([lang, `${key}.kicker`, "kicker", c[key].kicker]);
  }
  jobs.push([lang, "everywhere.headline", "everywhereHeadline", c.everywhere.headline]);
  c.everywhere.items.forEach((t, i) => jobs.push([lang, `everywhere.items[${i}]`, "everywhereItem", t]));
  jobs.push([lang, "cta.note", "ctaNote", c.cta.note]);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setContent(
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=block&subset=latin,cyrillic"><body style="margin:0">`,
);
await page.evaluate(() => document.fonts.ready);

const rows = await page.evaluate(
  (jobs, boxes) => {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;white-space:nowrap;font-family:Inter";
    document.body.appendChild(el);
    return jobs.map(([lang, id, kind, text]) => {
      const b = boxes[kind];
      el.style.fontSize = b.size + "px";
      el.style.fontWeight = b.weight;
      el.style.letterSpacing = b.spacing + "px";
      el.style.whiteSpace = "nowrap";
      el.style.width = "auto";
      el.textContent = text;
      const w = Math.round(el.getBoundingClientRect().width);
      if (!b.lines) return { lang, id, w, box: b.box, lines: 1, max: 1, text };
      // Ширина самого длинного слова: оно не переносится и задаёт минимум бокса.
      let word = 0;
      for (const t of text.split(" ")) {
        el.textContent = t;
        word = Math.max(word, Math.round(el.getBoundingClientRect().width));
      }
      el.style.whiteSpace = "normal";
      el.style.width = b.box + "px";
      el.textContent = text;
      const lines = Math.round(el.getBoundingClientRect().height / (b.size * 1.3));
      return { lang, id, w: word, box: b.box, lines, max: b.lines, text };
    });
  },
  jobs,
  BOXES,
);

await browser.close();

let bad = 0;
for (const r of rows) {
  const over = r.w > r.box || r.lines > r.max;
  if (over) bad++;
  const pct = Math.round((r.w / r.box) * 100);
  if (over || process.argv.includes("--all")) {
    const shape = r.max > 1 ? `${r.lines}/${r.max} стр` : "";
    console.log(
      `${over ? "✗" : "·"} ${r.lang} ${r.id.padEnd(24)} ${String(r.w).padStart(5)} / ${r.box}  ${String(pct).padStart(3)}% ${shape.padEnd(8)} «${r.text}»`,
    );
  }
}
console.log(bad ? `\n✗ ${bad} строк не влезают в бокс` : `\n✓ все ${rows.length} строк умещаются в отведённые боксы`);
process.exit(bad ? 1 : 0);
