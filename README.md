# Ouro Finance

A personal finance management application. A mobile-friendly PWA for tracking your money.

## Features

- Income and expense tracking by accounts and categories
- Multi-currency support (UZS, USD, EUR, RUB, GBP, CNY) with automatic conversion
- Expense analytics with charts and statistics
- Debt tracking with partial payments
- Financial goals and reminders
- Per-category budgeting
- Split expenses between friends
- Transaction import from Money Lover (CSV)
- Dark / light theme
- PWA — works like a native app on your phone

## Tech Stack

### Frontend
- **Vue 3** (Composition API, `<script setup>`)
- **TypeScript**
- **TanStack Vue Query** — caching and server state
- **Tailwind CSS v4** — styling
- **Reka UI** — headless UI components
- **Feature-Sliced Design** — frontend architecture
- **vite-plugin-pwa** — Progressive Web App

### Backend
- **NestJS 11** — framework
- **TypeORM** + **PostgreSQL** — database
- **CQRS** + **DDD** — architecture
- **JWT + Passport** — authentication
- **LemonSqueezy** — subscriptions and payments

## Getting Started

### Requirements

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Installation

```bash
# Clone the repository
git clone https://github.com/kickcs/finance-app.git
cd finance-app

# Install dependencies (root tooling + backend + frontend)
bun install
bun run install:all

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Start PostgreSQL
docker compose up -d postgres

# Run migrations
cd backend && bun run migration:run && cd ..
```

### Running

```bash
# Start frontend + backend together
bun run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

### Build

```bash
bun run build
```

## Project Structure

```
├── backend/                 # NestJS API
│   └── src/
│       ├── modules/         # Bounded Contexts (DDD)
│       │   ├── identity/    # Authentication, profiles
│       │   ├── accounting/  # Accounts, transactions, categories
│       │   ├── debt/        # Debts
│       │   ├── planning/    # Goals, reminders
│       │   ├── exchange/    # Currency rates
│       │   └── subscription/# Subscriptions, payments
│       └── shared/          # DDD base classes
├── frontend/                # Vue 3 SPA
│   └── src/
│       ├── app/             # Router, styles, entry point
│       ├── pages/           # Pages
│       ├── widgets/         # Composite UI blocks
│       ├── features/        # User actions
│       ├── entities/        # Business entities + API layer
│       └── shared/          # UI components, utilities, API client
└── docker-compose.yml       # Docker for local development
```

## License

This project is licensed under the [MIT License](./LICENSE).
