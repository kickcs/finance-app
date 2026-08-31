import { createContext, useContext } from "react";

export type Lang = "ru" | "en";

type Scene = { headline: string; kicker: string };

export type Copy = {
  morning: { line: string };
  bankImport: Scene;
  quickAdd: Scene;
  scanReceipt: Scene;
  split: Scene;
  debts: Scene;
  history: Scene;
  analytics: Scene;
  budget: Scene;
  everywhere: { headline: string; items: [string, string, string, string] };
  cta: { note: string };
};

// Подписи вынесены сюда целиком, а не разложены по сценам: только так видно
// ролик как текст — можно прочесть подряд одиннадцать строк и заметить, что
// две сцены обещают одно и то же. Раскладка от языка не зависит: английские
// строки подобраны короче русских, чтобы влезать в те же боксы без переносов
// (проверено замером в scripts/measure-copy.mjs).
export const COPY: Record<Lang, Copy> = {
  ru: {
    morning: { line: "Ты просто пересылаешь его боту" },
    bankImport: {
      headline: "Не вводишь — подтверждаешь",
      kicker: "сумма, магазин и дата уже разобраны",
    },
    quickAdd: {
      headline: "Наличные — в два тапа",
      kicker: "сумма, категория — и готово",
    },
    scanReceipt: {
      headline: "Поужинали вчетвером",
      kicker: "сфоткал чек — позиции разобраны",
    },
    split: { headline: "Кто что ел", kicker: "поровну или по позициям" },
    debts: {
      headline: "Кто кому — одной цифрой",
      kicker: "встречные долги схлопываются в нетто",
    },
    history: {
      headline: "Каждый день с итогом",
      kicker: "и фильтры по типу операции",
    },
    analytics: {
      headline: "Видно, куда уходит",
      kicker: "по категориям, за любой период",
    },
    budget: {
      headline: "И сколько можно тратить",
      kicker: "в день, до конца месяца",
    },
    everywhere: {
      headline: "И на компьютере",
      items: ["счета в разных валютах", "подписки и регулярные платежи", "работает офлайн", "ставится как приложение"],
    },
    cta: { note: "демо без регистрации" },
  },
  en: {
    morning: { line: "You just forward it to the bot" },
    bankImport: {
      headline: "No typing. Just confirm.",
      kicker: "amount, merchant and date are already parsed",
    },
    quickAdd: {
      headline: "Cash in two taps",
      kicker: "amount, category — done",
    },
    scanReceipt: {
      headline: "Dinner for four",
      kicker: "snap the receipt — line items parsed",
    },
    split: { headline: "Who ate what", kicker: "evenly, or item by item" },
    debts: {
      headline: "Who owes whom, in one number",
      kicker: "debts in both directions cancel out",
    },
    history: {
      headline: "Every day with its total",
      kicker: "and filters by transaction type",
    },
    analytics: {
      headline: "You see where it goes",
      kicker: "by category, over any period",
    },
    budget: {
      headline: "And how much you can spend",
      kicker: "per day, until the month ends",
    },
    everywhere: {
      headline: "And on the desktop",
      items: ["accounts in several currencies", "subscriptions and recurring bills", "works offline", "installs like an app"],
    },
    cta: { note: "live demo, no sign-up" },
  },
};

export const LangContext = createContext<Lang>("ru");

export const useCopy = (): Copy => COPY[useContext(LangContext)];
