import { useContext } from "react";
import { LangContext } from "./copy";
import en from "../public/shots/en/boxes.json";
import ru from "../public/shots/boxes.json";

/** Рамка элемента в координатах источника (CSS-пиксель × DPR 3). */
export type Box = { left: number; top: number; width: number; height: number };

// Скриншоты и замеры к ним снимаются на каждый язык отдельно: английские
// подписи другой длины, и чипы, строки чека и участники встают иначе. Поэтому
// сцены не держат координат: они спрашивают их у того же файла, который пишет
// `npm run capture`. Пересняли — сцены поехали за экраном сами.
const SHOTS: Record<string, { dir: string; boxes: Record<string, Record<string, Box | Box[]>> }> = {
  ru: { dir: "shots", boxes: ru as never },
  en: { dir: "shots/en", boxes: en as never },
};

export const useShots = () => {
  const lang = useContext(LangContext);
  const { dir, boxes } = SHOTS[lang] ?? SHOTS.ru;

  // Пустая рамка вместо падения была бы хуже: оверлей молча уехал бы в угол,
  // и это заметили бы уже на смонтированном ролике.
  const raw = (screen: string, label: string) => {
    const found = boxes[screen]?.[label];
    if (!found) throw new Error(`Нет замера «${screen}.${label}» для языка «${lang}» — пересними: npm run capture`);
    return found;
  };
  const box = (screen: string, label: string): Box => {
    const found = raw(screen, label);
    if (Array.isArray(found)) throw new Error(`Замер «${screen}.${label}» — список, нужен s.list()`);
    return found;
  };
  const list = (screen: string, label: string): Box[] => {
    const found = raw(screen, label);
    if (!Array.isArray(found)) throw new Error(`Замер «${screen}.${label}» — одна рамка, нужен s.box()`);
    return found;
  };

  return {
    /** Путь к скриншоту для `staticFile`. */
    file: (name: string) => `${dir}/${name}`,
    box,
    list,
    /** Положение лупы, при котором элемент оказывается в её середине. */
    loupeTop: (screen: string, label: string) => {
      const b = box(screen, label);
      return Math.max(0, Math.min(1836, Math.round(b.top + b.height / 2 - 360)));
    },
  };
};
