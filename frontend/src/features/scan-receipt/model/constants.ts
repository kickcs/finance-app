/** ID виртуального участника «На всех» */
export const ALL_PARTICIPANTS_ID = 'ALL';

/** Цвет чипа «На всех» */
export const ALL_PARTICIPANTS_COLOR = '#8b5cf6';

/** Пресеты процентных сборов для быстрого добавления */
export const CHARGE_PRESETS = [
  { label: 'НДС', defaultPercent: 12 },
  { label: 'Обслуживание', defaultPercent: 10 },
  { label: 'Комиссия', defaultPercent: 5 },
] as const;

/** Пресеты сборов фиксированной суммой: подставляют имя, сумму вводит пользователь */
export const AMOUNT_CHARGE_PRESETS = ['Чаевые', 'Доставка'] as const;
