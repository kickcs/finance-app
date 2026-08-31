import { loadFont } from "@remotion/google-fonts/Inter";

// Пакет блокирует рендер, пока шрифт не готов, — иначе первые кадры
// уедут на подменном шрифте. Кириллица нужна для всех надписей.
export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
});
