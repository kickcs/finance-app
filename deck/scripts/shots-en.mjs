// Словарь для английских кадров: локализация приложения ещё не выкачена
// (2 слайса из 80), поэтому снять настоящий английский интерфейс нечем.
// capture.mjs подменяет текст прямо в DOM между двумя снимками одного экрана.
//
// DICT — точное совпадение всей строки, RULES — регулярки поверх результата.
// Всё, что не нашлось ни там, ни там, прогон печатает списком и падает: молча
// оставить русское слово в английском деке хуже, чем не собрать его.
import { readFileSync } from "node:fs";

const I18N = new URL("../../backend/src/i18n/", import.meta.url);
const load = (lang, file) => JSON.parse(readFileSync(new URL(`${lang}/${file}`, I18N), "utf8"));

/** Разворачивает два одинаковых по форме дерева переводов в плоский ru→en. */
function pair(ru, en, into = {}) {
  if (typeof ru === "string") {
    if (typeof en === "string") into[ru] = en;
  } else if (Array.isArray(ru)) {
    ru.forEach((item, i) => pair(item, en?.[i], into));
  } else if (ru && en) {
    for (const key of Object.keys(ru)) pair(ru[key], en[key], into);
  }
  return into;
}

// Категории, счета, контакты и подписи операций демо-юзера берём из переводов
// бэкенда: сид случайный, и руками этот список пришлось бы дополнять после
// каждого прогона.
const SEED = {
  ...pair(load("ru", "categories.json"), load("en", "categories.json")),
  ...pair(load("ru", "demo.json"), load("en", "demo.json")),
};

// Хром фронтенда: его строки в бэкендовых переводах не лежат.
const UI = {
  // Одиночные буквы: инициалы на аватарах и переключатель день/месяц/год
  "А": "A",
  "В": "Y",
  "Г": "Y",
  "Д": "D",
  "К": "K",
  "М": "M",

  // Навигация и разделы
  "Главная": "Home",
  "Аналитика": "Analytics",
  "История": "History",
  "Долги": "Debts",
  "Профиль": "Profile",
  "Счета": "Accounts",
  "К счетам": "Accounts",
  "Подписки": "Subscriptions",
  "Перейти к содержимому": "Skip to content",

  // Дашборд
  "Доброе утро": "Good morning",
  "Добрый день": "Good afternoon",
  "Добрый вечер": "Good evening",
  "Доброй ночи": "Good night",
  "Баланс": "Balance",
  "Расход/дн": "Spend/day",
  "Безопасно": "Safe",
  "Осталось": "Left",
  "Последние операции": "Recent transactions",
  "Расходы за месяц": "Spending this month",
  "Детали": "Details",
  "Настроить вид": "Customize",
  "Настроить вид дашборда": "Customize dashboard",
  "Настроить быстрые действия": "Set up quick actions",
  "Добавить операцию": "Add transaction",
  "Нет бюджета на месяц": "No monthly budget",
  "Контролируйте свои траты": "Keep spending in check",
  "Установить лимит расходов": "Set a spending limit",
  "Нет активных подписок": "No active subscriptions",
  "Отслеживайте регулярные списания": "Track recurring charges",
  "Добавить подписку": "Add subscription",
  "Зарплата не 1-го? Настройте начало месяца": "Paid mid-month? Set your month start",

  // Аналитика
  "Доходы": "Income",
  "Расходы": "Expenses",
  "Всего": "Total",
  "В день": "Per day",
  "Расход за период": "Spent this period",
  "расход к доходу": "spend vs income",
  "Сравнение": "Comparison",
  "По дням": "By day",
  "Все валюты": "All currencies",

  // Долги
  "Активные": "Active",
  "Закрытые": "Closed",
  "Итог по всем": "Net across all",
  "Вам должны": "They owe you",
  "Вы должны": "You owe",
  "вы должны": "you owe",
  "должен вам": "owes you",
  "должны вам": "owe you",
  "По людям": "By person",
  "Без срока": "No due date",
  "без срока": "no due date",

  // Новая операция
  "Новая транзакция": "New transaction",
  "Расход": "Expense",
  "Доход": "Income",
  "Долг": "Debt",
  "Категория": "Category",
  "Комментарий": "Note",
  "Добавить расход": "Add expense",
  "Разделить расход": "Split expense",
  "Скан чека": "Scan receipt",

  // Чек и разделение
  "Сканировать чек": "Scan receipt",
  "Позиция": "Item",
  "Сбор": "Charge",
  "Итого": "Total",
  "Изменить": "Edit",
  "На всех": "Everyone",
  "Вы": "You",
  "Все": "All",
  "все": "all",
  "Поровну на всех": "Split evenly",
  "Выберите участника и отмечайте его позиции тапом": "Pick a person, then tap their items",
  "Далее — Участники": "Next — People",
  "Далее — Итог": "Next — Summary",

  // Позиции засеянного черновика чека (лежат в capture.mjs)
  "Шашлык из баранины": "Lamb kebab",
  "Салат «Ачик-чучук»": "Achik-chuchuk salad",
  "Лепёшка тандырная": "Tandoor bread",
  "Чай зелёный": "Green tea",
  "Лагман": "Lagman",
  "Компот": "Compote",
  "Ужин в Chorsu Grill": "Dinner at Chorsu Grill",

  "сўм": "UZS",
};

export const DICT = { ...SEED, ...UI };

// Порядок важен: правила идут после словаря и друг за другом, поэтому частные
// формулировки стоят раньше общих единиц измерения.
// \b после кириллицы не срабатывает — граница слова считается по ASCII,
// поэтому конец слова проверяется через (?![а-яё]).
export const RULES = [
  ["^Останется (.+)$", "$1 left"],
  ["^Можно потратить (.+)/день$", "Spend up to $1/day"],
  ["осталось (\\d+) дн\\.", "$1 days left"],
  ["Шаг (\\d+) из (\\d+) · Позиции", "Step $1 of $2 · Items"],
  ["Шаг (\\d+) из (\\d+) · Участники", "Step $1 of $2 · People"],
  ["Назначено (\\d+) из (\\d+)", "Assigned $1 of $2"],
  ["Позиции чека · (\\d+)", "Receipt items · $1"],
  ["Все категории \\((\\d+)\\)", "All categories ($1)"],
  ["Ещё (\\d+)", "$1 more"],
  ["(\\d+) долг(?:а|ов)?(?![а-яё])", "$1 debts"],
  ["Август (\\d{4})", "August $1"],

  // Единицы, разряды и даты
  ["(\\d),(\\d)", "$1.$2"],
  ["\\s?тыс\\.", "k"],
  ["\\s?млн", "M"],
  ["сўм", "UZS"],
  ["шт\\.", "pcs"],
  ["чел\\.", "pp"],
  ["(\\d+) дн(?![а-яё])", "$1 d"],
  ["янв\\.", "Jan"],
  ["фев\\.", "Feb"],
  ["мар\\.", "Mar"],
  ["апр\\.", "Apr"],
  ["мая", "May"],
  ["июн\\.", "Jun"],
  ["июл\\.", "Jul"],
  ["авг\\.", "Aug"],
  ["сен\\.", "Sep"],
  ["окт\\.", "Oct"],
  ["ноя\\.", "Nov"],
  ["дек\\.", "Dec"],
];
