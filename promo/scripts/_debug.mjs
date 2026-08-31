import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://app.ouro-finance.top";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("hasSeenOnboarding", "true");
  localStorage.setItem("theme", "dark");
  localStorage.setItem("push-banner-dismissed", "true");
  localStorage.setItem("pwa-install-dismissed", "true");
  localStorage.setItem("lastSeenChangelogVersion", "99.0.0");
});
await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle2" });
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Попробовать демо")).click();
});
await page.waitForFunction(() => Boolean(localStorage.getItem("access_token")), { timeout: 60000 });
console.log("logged in, url:", page.url());

for (const path of ["/debts", "/analytics", "/scan-receipt"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 4000));
  const t = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | ").slice(0, 300));
  console.log(`\n### ${path} -> ${page.url()}\n${t}`);
}

await browser.close();
