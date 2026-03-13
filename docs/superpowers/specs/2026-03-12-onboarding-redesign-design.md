# Onboarding Redesign — Кинематографический лендинг

**Дата:** 2026-03-12
**Статус:** Draft

## Цель

Заменить текущий мобильный онбординг (карусель из 4 слайдов со свайпами) на полноэкранный лендинг со scroll-анимациями, адаптированный под web и mobile. Фокус — wow-эффект и демонстрация возможностей приложения.

## Решения

- **Формат:** Полноэкранные секции с scroll-анимациями (Apple/fintech-style)
- **CTA:** Только в конце лендинга + демо-кнопка рядом
- **Язык:** Только русский
- **Визуал:** Анимированные мокапы — цифры набегают, графики рисуются, элементы появляются при скролле
- **Scroll-анимации:** Нативные — Intersection Observer + CSS transitions, без внешних библиотек
- **CountUp:** Свой requestAnimationFrame-based counter (~30 строк)
- **Responsive:** CSS Grid + `clamp()` для fluid typography

## Структура лендинга (7 секций)

### ① Hero (100vh)

**Месседж:** "Ваши финансы. Под контролем."

**Layout:**
- Desktop (≥1024px): два столбца — текст слева, анимированная balance-карточка справа
- Mobile (<768px): вертикально — текст по центру, balance-карточка ниже, scroll-hint внизу

**Содержимое:**
- Логотип "Ouro Finance" (uppercase, letter-spacing)
- Заголовок: "Ваши финансы. Под контролем."
- Подзаголовок: "Управляйте счетами, отслеживайте расходы, контролируйте долги — всё в одном приложении"
- Мокап balance-карточки: общий баланс $12,450.00, карточки доход (+$3,200) и расход (−$1,850)
- Scroll-hint: пульсирующая стрелка "↓ Узнать больше"

**Анимации:**
- Баланс — countUp от 0 до $12,450.00 (~1.5s)
- Доход/Расход карточки — slide-up + fade-in с delay 0.3s
- Текст — fade-in, подзаголовок чуть позже
- Scroll-hint — пульсирующая анимация (infinite)
- Фон — тёмный gradient (#0f0a2e → #1a1145)

### ② Мульти-валюта

**Месседж:** "Все валюты — один счёт"

**Содержимое:**
- 3 карточки счетов: Visa Gold ($4,200 + €1,850 + ₽25,000), Сбережения (€8,500), Наличные (500,000 сўм)
- Строка конвертации: "$1 = 12,850 сўм · €0.92 · ₽89.5 — Курсы обновляются автоматически"

**Анимации:**
- Карточки — stagger slide-up (delay 0.2s между карточками)
- Суммы — countUp на каждой карточке
- Мульти-валюта строка — fade-in с задержкой
- Конвертация — slide-up, цифры набегают
- Фон — тёмный gradient (#0c1222 → #111827)

### ③ Аналитика

**Месседж:** "Знайте, куда уходят деньги"

**Содержимое:**
- Donut-чарт с 5 сегментами: Продукты (35%), Транспорт (20%), Развлечения (15%), Рестораны (10%), Другое (20%)
- Центр чарта: $1,850 расходы
- Легенда справа с цветными точками и процентами
- Табы периодов: Неделя / Месяц / Год

**Анимации:**
- Donut сегменты — рисуются поочерёдно (stroke-dasharray transition)
- Центральная сумма — countUp от 0 до $1,850
- Легенда — каждая строка fade-in с stagger
- Проценты — набегают от 0% до значения
- Табы — slide-up последними
- Фон — тёмный зелёный gradient (#052e16 → #0a1f12)

### ④ Долги

**Месседж:** "Никто не забыт"

**Содержимое:**
- Карточка "Дал в долг": Ахмед, 500,000 сўм, прогресс 60% (300K/500K)
- Карточка "Взял в долг": Анна, $200, прогресс 25% ($50/$200)
- Прогресс-бары с процентами

**Анимации:**
- Карточки — slide-in слева и справа (встречный эффект)
- Прогресс-бары — заполняются от 0% до значения
- Суммы — countUp
- Аватары — scale-in с bounce
- Фон — тёмный amber gradient (#1c1108 → #1a1008)

### ⑤ Сканирование чеков

**Месседж:** "Фото → Транзакция → Долги"

**Содержимое:**
Трёхшаговый флоу:
1. **Фото чека** — мокап чека с позициями (Молоко 48₽, Хлеб 35₽, итого 83₽)
2. **AI-распознавание** — прогресс-бар, текст "Сумма, категория, дата"
3. **Результат** — готовая транзакция −83₽ (Продукты) + автоматически созданные долги для участников + сгенерированная выписка

**Ключевая деталь:** При сканировании можно сразу назначить позиции другим людям — автоматически создаются записи долгов и выписка для каждого участника.

**Анимации:**
- 3 шага появляются последовательно (delay 0.3s)
- Стрелки — fade-in + scale между шагами
- Чек — строки появляются одна за другой (typewriter-эффект)
- Прогресс-бар — заполняется на шаге "Распознаём"
- Финальная карточка — scale-in с bounce + зелёная галочка
- Долговые карточки — pop-in после транзакции
- Фон — тёмный красный gradient (#1a0a0a → #1c0f0f)

### ⑥ Split-expense, Категории, Quick Actions

**Месседж:** "Мелочи, которые решают"

**Содержимое — 3 мини-карточки:**

1. **Деление расходов** — "Ужин на 4? Разделите счёт в пару тапов". Доли: Вы $25, Ахмед $25, Анна $25. При делении автоматически создаются записи долгов для каждого участника.
2. **Свои категории** — "Настройте под себя — иконки, цвета, порядок". Чипсы: 🛒 Продукты, 🚗 Транспорт, 🎮 Игры, ☕ Кофе
3. **Быстрые действия** — "Одно нажатие — расход записан". Строки: 🚇 Метро −46₽, ☕ Кофе −250₽, 🥗 Обед −350₽

**Анимации:**
- Три карточки — stagger slide-up (delay 0.2s)
- Split доли — шкала делится анимированно
- Категории-чипсы — pop-in по одному
- Quick action строки — slide-in справа одна за другой
- Фон — тёмный фиолетовый gradient (#1a0a1e → #150d18)

### ⑦ CTA

**Месседж:** "Готовы взять финансы под контроль?"

**Содержимое:**
- Заголовок: "Готовы взять финансы под контроль?"
- Подзаголовок: "Присоединяйтесь бесплатно. Никаких скрытых платежей."
- Кнопка primary: "Начать бесплатно" → `/auth/login?mode=register` (страница логина с автопереключением на форму регистрации)
- Кнопка secondary: "Попробовать демо" → вызов `useAuth().signInAnonymously()` с обработкой ошибок (rate limiting, loading state), redirect на dashboard
- Подпись: "Регистрация за 30 секунд • Без привязки карты"

**Анимации:**
- Заголовок — fade-in + subtle scale
- Кнопка "Начать" — glow-пульсация тени (subtle)
- Кнопка "Демо" — fade-in чуть позже
- Фон — возвращается к hero gradient (#0f0a2e → #1e1b4b → #0f0a2e)

## Техническая архитектура

### Файловая структура

```
frontend/src/pages/onboarding/welcome/
├── WelcomePage.vue          ← полная замена текущего (лендинг-контейнер)
├── composables/
│   ├── useScrollAnimations.ts   ← Intersection Observer + CSS анимации
│   └── useCountUp.ts            ← requestAnimationFrame counter
├── sections/
│   ├── HeroSection.vue
│   ├── MultiCurrencySection.vue
│   ├── AnalyticsSection.vue
│   ├── DebtsSection.vue
│   ├── ReceiptScanSection.vue
│   ├── FeaturesSection.vue      ← split + categories + quick actions
│   └── CtaSection.vue
└── components/
    ├── BalanceCard.vue           ← animated balance mockup
    ├── DonutChart.vue            ← SVG donut с scroll-анимацией
    ├── DebtCard.vue              ← мокап карточки долга
    ├── ReceiptFlow.vue           ← 3-step receipt → transaction → debts
    ├── FeatureCard.vue           ← мини-карточка фичи
    └── ScrollHint.vue            ← пульсирующая стрелка
```

### Composables

**useScrollAnimations.ts:**
- Intersection Observer для отслеживания видимости секций
- Добавляет CSS-классы (`in-view`, `animate-in`) при появлении в viewport
- Threshold: 0.2 (20% секции видно → запуск анимации)
- Once: true (анимация срабатывает один раз)

**useCountUp.ts:**
- `countUp(target: number, duration: number, format?: (n: number) => string): Ref<string>`
- requestAnimationFrame-based, easeOutQuad
- Запускается по флагу `isVisible` от Intersection Observer
- Поддержка форматирования (валюты, проценты)

### CSS-анимации

```css
/* Базовые transitions для scroll-triggered анимаций */
.scroll-animate {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.scroll-animate.in-view {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger delays */
.stagger-1 { transition-delay: 0.1s; }
.stagger-2 { transition-delay: 0.2s; }
.stagger-3 { transition-delay: 0.3s; }

/* Slide variants */
.slide-left { transform: translateX(-40px); }
.slide-right { transform: translateX(40px); }
.slide-left.in-view, .slide-right.in-view { transform: translateX(0); }

/* Scale bounce */
.scale-in { transform: scale(0.8); }
.scale-in.in-view { transform: scale(1); }

/* Accessibility: disable animations for users with motion sensitivity */
@media (prefers-reduced-motion: reduce) {
  .scroll-animate,
  .slide-left,
  .slide-right,
  .scale-in {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### Тема

Лендинг всегда рендерится в тёмном режиме независимо от пользовательских настроек темы. На контейнере лендинга принудительно устанавливается класс `dark`. Это обусловлено тем, что все визуальные дизайны построены на тёмных gradient-фонах.

### Responsive breakpoints

- **Desktop:** ≥1024px — два столбца, горизонтальные layout-ы
- **Tablet:** 768–1023px — как mobile (вертикальный layout), но с увеличенными отступами и размерами шрифтов
- **Mobile:** <768px — вертикальный layout, все элементы стэкаются

### Роутинг

- Маршрут `/welcome` — заменяется новым лендингом
- `meta: { guestOnly: true }` — редирект авторизованных на dashboard
- Флаг `hasSeenOnboarding` устанавливается при клике на CTA ("Начать бесплатно" или "Попробовать демо"). Пока пользователь не кликнул CTA, флаг не ставится — при повторном визите он снова увидит лендинг
- После "Начать бесплатно" → `/auth/login?mode=register` → регистрация → `/onboarding/first-account` (как сейчас)
- После "Попробовать демо" → `useAuth().signInAnonymously()` → `/dashboard`
- Страница `/auth/login` должна поддерживать query-параметр `mode=register` для автопереключения формы на регистрацию

### Что удаляется

- `pages/onboarding/welcome/slides/` — все 4 слайда карусели (WelcomeSlide, AccountsSlide, DebtsSlide, AnalyticsSlide)
- Swipe-логика в WelcomePage.vue
- Dot-навигация карусели
- `CurrencySelectionPage.vue` (legacy cleanup — файл существует, но роут уже редиректит на first-account)

### Что остаётся без изменений

- `FirstAccountPage.vue` — создание первого счёта после регистрации
- Backend profile/onboarding logic (hasCompletedOnboarding flag)
- Router guards для onboarding completion
- localStorage keys (HAS_SEEN_ONBOARDING, ONBOARDING_COMPLETE)
- Demo mode backend (DemoInitializationService)

## Дизайн-токены

Все секции используют тёмный фон с уникальными gradient-ами для визуального разделения:

| Секция | Gradient |
|--------|----------|
| Hero | #0f0a2e → #1a1145 (indigo) |
| Мульти-валюта | #0c1222 → #111827 (slate) |
| Аналитика | #052e16 → #0a1f12 (green) |
| Долги | #1c1108 → #1a1008 (amber) |
| Сканирование | #1a0a0a → #1c0f0f (red) |
| Split/Категории | #1a0a1e → #150d18 (purple) |
| CTA | #0f0a2e → #1e1b4b → #0f0a2e (indigo, как hero) |

Accent-цвета секций: indigo (#6366f1), cyan (#38bdf8), green (#10b981/#34d399), amber (#fbbf24), red (#f87171), pink (#e879f9).

## Scope

**В scope:**
- Новый лендинг с 7 секциями и scroll-анимациями
- Responsive layout (desktop + tablet + mobile)
- Анимированные мокапы (countUp, fade-in, slide, stagger, donut draw)
- CTA с переходом на регистрацию и демо
- Удаление старой карусели

**Вне scope:**
- Изменения в FirstAccountPage (создание первого счёта)
- Изменения в backend
- i18n / мультиязычность
- Изменения в демо-режиме
- Premium/subscription упоминания в онбординге
