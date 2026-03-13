# Ouro Finance

Приложение для управления личными финансами. PWA с поддержкой мобильных устройств.

## Возможности

- Учёт доходов и расходов по счетам и категориям
- Мультивалютность (UZS, USD, EUR, RUB, GBP, CNY) с автоматической конвертацией
- Аналитика расходов с графиками и статистикой
- Учёт долгов и частичных платежей
- Финансовые цели и напоминания
- Бюджетирование по категориям
- Разделение расходов между друзьями
- Импорт транзакций из Money Lover (CSV)
- Тёмная/светлая тема
- PWA — работает как нативное приложение на телефоне

## Стек технологий

### Frontend
- **Vue 3** (Composition API, `<script setup>`)
- **TypeScript**
- **TanStack Vue Query** — кеширование и серверное состояние
- **Tailwind CSS v4** — стилизация
- **Reka UI** — headless UI-компоненты
- **Feature-Sliced Design** — архитектура фронтенда
- **vite-plugin-pwa** — Progressive Web App

### Backend
- **NestJS 11** — фреймворк
- **TypeORM** + **PostgreSQL** — база данных
- **CQRS** + **DDD** — архитектура
- **JWT + Passport** — аутентификация
- **LemonSqueezy** — подписки и платежи

## Быстрый старт

### Требования

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (для PostgreSQL)

### Установка

```bash
# Клонировать репозиторий
git clone git@git-hackathon.mbabm.uz:mna-team-1386b2/ouro-finance.git
cd ouro-finance

# Установить зависимости
bun run install:all

# Скопировать .env
cp backend/.env.example backend/.env

# Запустить PostgreSQL
docker compose up -d postgres

# Применить миграции
cd backend && bun run migration:run && cd ..
```

### Запуск

```bash
# Запустить frontend + backend одновременно
bun run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

### Сборка

```bash
bun run build
```

## Структура проекта

```
├── backend/                 # NestJS API
│   └── src/
│       ├── modules/         # Bounded Contexts (DDD)
│       │   ├── identity/    # Аутентификация, профили
│       │   ├── accounting/  # Счета, транзакции, категории
│       │   ├── debt/        # Долги
│       │   ├── planning/    # Цели, напоминания
│       │   ├── exchange/    # Курсы валют
│       │   └── subscription/# Подписки, платежи
│       └── shared/          # DDD базовые классы
├── frontend/                # Vue 3 SPA
│   └── src/
│       ├── app/             # Роутер, стили, точка входа
│       ├── pages/           # Страницы
│       ├── widgets/         # Составные UI-блоки
│       ├── features/        # Пользовательские действия
│       ├── entities/        # Бизнес-сущности + API слой
│       └── shared/          # UI-компоненты, утилиты, API-клиент
└── docker-compose.yml       # Docker для локальной разработки
```

## Команда

**MNA Team** — Hackathon 2026
