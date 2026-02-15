export const CURRENT_VERSION = '1.2.0';

export type ChangelogItemType = 'feature' | 'fix' | 'improvement';

export interface ChangelogItem {
  type: ChangelogItemType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: ChangelogItem[];
}

export const CHANGELOG_TYPE_CONFIG: Record<
  ChangelogItemType,
  { icon: string; colorClass: string }
> = {
  feature: { icon: 'auto_awesome', colorClass: 'text-primary bg-primary/10' },
  fix: { icon: 'bug_report', colorClass: 'text-danger bg-danger/10' },
  improvement: {
    icon: 'trending_up',
    colorClass: 'text-success bg-success/10',
  },
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-02-16',
    title: 'Импорт данных',
    items: [
      {
        type: 'feature',
        text: 'Импорт данных из MoneyLover — загрузите CSV файл и все транзакции появятся в приложении',
      },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-02-15',
    title: 'Приветственный экран',
    items: [
      {
        type: 'feature',
        text: 'Добавлен экран знакомства с приложением для новых пользователей',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-15',
    title: 'Долги, напоминания и аналитика',
    items: [
      {
        type: 'feature',
        text: 'Учёт долгов — кто кому должен, частичные выплаты',
      },
      { type: 'feature', text: 'Напоминания о платежах с гибким расписанием' },
      { type: 'feature', text: 'Расширенная аналитика расходов и доходов' },
      { type: 'improvement', text: 'Поиск по истории транзакций' },
      { type: 'fix', text: 'Исправлена работа pull-to-refresh на iOS' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-20',
    title: 'Первый релиз',
    items: [
      { type: 'feature', text: 'Мультивалютные счета с автоконвертацией' },
      { type: 'feature', text: 'Категории доходов и расходов с иконками' },
      { type: 'feature', text: 'Дашборд с обзором финансов' },
      { type: 'feature', text: 'Тёмная тема оформления' },
      { type: 'improvement', text: 'PWA — приложение работает офлайн' },
    ],
  },
];
