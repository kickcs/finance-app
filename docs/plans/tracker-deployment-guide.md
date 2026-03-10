# Деплой Tracker на tracker.ouro-finance.top

Полная инструкция по CI/CD, Docker, PWA и обновлениям. Проект деплоится на тот же сервер (185.120.59.179), что и finance-app.

---

## Содержание

1. [Архитектура](#1-архитектура)
2. [DNS](#2-dns)
3. [Структура проекта](#3-структура-проекта)
4. [Docker Compose (production)](#4-docker-compose-production)
5. [Nginx внутри Docker](#5-nginx-внутри-docker-контейнера-frontend)
6. [Host-level Nginx + SSL](#6-host-level-nginx-на-сервере)
7. [GitHub Actions CI/CD](#7-github-actions-cicd)
8. [Dockerfiles](#8-dockerfiles)
9. [PWA конфигурация](#9-pwa-конфигурация)
10. [PWA обновление](#10-pwa-обновление-composable)
11. [Стратегия кеширования](#11-стратегия-кеширования-для-pwa)
12. [GitHub Secrets](#12-github-secrets)
13. [Первый деплой — чеклист](#13-первый-деплой--чеклист)
14. [Полезные команды](#14-полезные-команды)

---

## 1. Архитектура

```
Internet (HTTPS)
    ↓
Host Nginx (port 80/443, Let's Encrypt)
    ├── app.ouro-finance.top     → localhost:8080 (finance-app)
    └── tracker.ouro-finance.top → localhost:8081 (tracker-app)  ← NEW
         ↓
    Docker Compose stack (tracker-app)
         ├── frontend (nginx:80 → mapped :8081)
         ├── backend  (NestJS:3000, internal)
         └── postgres (5432, internal)
```

---

## 2. DNS

Добавить A-запись:

```
tracker.ouro-finance.top → 185.120.59.179
```

---

## 3. Структура проекта

```
tracker-app/
├── .github/workflows/
│   └── deploy.yml
├── docker/
│   ├── backend/Dockerfile
│   ├── frontend/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   └── postgres/init.sql
├── docker-compose.yml          # local dev
├── docker-compose.prod.yml     # production
├── backend/
├── frontend/
└── DEPLOYMENT.md
```

---

## 4. Docker Compose (production)

**`docker-compose.prod.yml`**

Критически важные отличия от finance-app:
- `name: tracker-app` — уникальное имя проекта
- Порт `8081` (finance-app занял `8080`)
- Имена контейнеров, volume и network — все с префиксом `tracker-`
- Другая база данных: `tracker_db`

```yaml
name: tracker-app

services:
  postgres:
    image: postgres:16-alpine
    container_name: tracker-postgres
    environment:
      POSTGRES_DB: tracker_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - tracker_postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - tracker-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d tracker_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "0.5"
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}/backend:${GHCR_IMAGE_TAG:-latest}
    container_name: tracker-backend
    environment:
      NODE_ENV: production
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: tracker_db
      DATABASE_USERNAME: postgres
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_SYNCHRONIZE: "false"
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN: ${JWT_REFRESH_EXPIRES_IN:-7d}
      CORS_ORIGIN: ${CORS_ORIGIN}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - tracker-network
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 768m
          cpus: "1.0"
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    image: ghcr.io/${GITHUB_REPOSITORY}/frontend:${GHCR_IMAGE_TAG:-latest}
    container_name: tracker-frontend
    ports:
      - "8081:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - tracker-network
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/health"]
      interval: 5s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256m
          cpus: "0.5"
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  tracker_postgres_data:

networks:
  tracker-network:
    driver: bridge
```

---

## 5. Nginx внутри Docker-контейнера frontend

**`docker/frontend/nginx.conf`**

```nginx
upstream backend_pool {
    server backend:3000;
    keepalive 16;
}

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

server {
    listen 80;
    server_name _;
    root /app/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml
               application/wasm font/woff2;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # API proxy
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://backend_pool;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10m;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        proxy_connect_timeout 10s;
    }

    # Service Worker — НИКОГДА не кешировать
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri =404;
    }

    # PWA manifest — короткий кеш
    location = /manifest.webmanifest {
        add_header Cache-Control "public, max-age=3600, must-revalidate";
        try_files $uri =404;
    }

    # Hashed static assets — долгий иммутабельный кеш
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Root assets (favicon, icons) — короткий кеш
    location ~* ^/[^/]+\.(ico|png|webp|svg)$ {
        add_header Cache-Control "public, max-age=3600, must-revalidate";
        try_files $uri =404;
    }

    # SPA fallback
    location / {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 6. Host-level Nginx на сервере

**`/etc/nginx/sites-available/tracker-ouro-finance`**

```nginx
server {
    listen 80;
    server_name tracker.ouro-finance.top;

    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10m;
    }
}
```

Активация и SSL:

```bash
sudo ln -s /etc/nginx/sites-available/tracker-ouro-finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL сертификат
sudo certbot --nginx -d tracker.ouro-finance.top
```

---

## 7. GitHub Actions CI/CD

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/master' }}

permissions:
  contents: read
  packages: write

jobs:
  changes:
    name: Detect changes
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
              - 'docker/backend/**'
            frontend:
              - 'frontend/**'
              - 'docker/frontend/**'

  build-backend:
    name: Build Backend
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U postgres"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install & lint
        working-directory: backend
        run: |
          bun install --frozen-lockfile
          bun run lint

      - name: Run tests
        working-directory: backend
        env:
          DATABASE_HOST: localhost
          DATABASE_PORT: 5432
          DATABASE_NAME: test_db
          DATABASE_USERNAME: postgres
          DATABASE_PASSWORD: test_password
          JWT_SECRET: test-jwt-secret-for-ci-pipeline
          NODE_ENV: test
        run: bun run test

      - name: Build & push Docker image
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          IMAGE=ghcr.io/${{ github.repository }}/backend
          docker build -f docker/backend/Dockerfile -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      - name: Pre-pull on server
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker pull ghcr.io/${{ github.repository }}/backend:${{ github.sha }}

  build-frontend:
    name: Build Frontend
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install & type-check
        working-directory: frontend
        run: |
          bun install --frozen-lockfile
          bun run vue-tsc --noEmit

      - name: Build
        working-directory: frontend
        run: bun run build
        env:
          VITE_API_URL: http://localhost/api

      - name: Build & push Docker image
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          IMAGE=ghcr.io/${{ github.repository }}/frontend
          docker build -f docker/frontend/Dockerfile \
            --build-arg VITE_API_URL=http://localhost/api \
            -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      - name: Pre-pull on server
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker pull ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}

  deploy:
    name: Deploy to Production
    needs: [changes, build-backend, build-frontend]
    if: |
      always() &&
      github.event_name == 'push' && github.ref == 'refs/heads/master' &&
      !contains(needs.*.result, 'failure') &&
      (needs.changes.outputs.backend == 'true' || needs.changes.outputs.frontend == 'true')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Copy configs to server
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete
          path: docker-compose.prod.yml docker/postgres/
          remote_path: ~/tracker-app/
          remote_host: ${{ secrets.SERVER_HOST }}
          remote_user: ${{ secrets.SERVER_USER }}
          remote_key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Deploy
        uses: appleboy/ssh-action@v1
        env:
          BACKEND_CHANGED: ${{ needs.changes.outputs.backend }}
          FRONTEND_CHANGED: ${{ needs.changes.outputs.frontend }}
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          envs: BACKEND_CHANGED,FRONTEND_CHANGED
          script: |
            set -e
            cd ~/tracker-app

            # Write .env
            cat > .env << 'ENVEOF'
            GITHUB_REPOSITORY=${{ github.repository }}
            GHCR_IMAGE_TAG=${{ github.sha }}
            DATABASE_NAME=tracker_db
            DATABASE_USERNAME=postgres
            DATABASE_PASSWORD=${{ secrets.DATABASE_PASSWORD }}
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRES_IN=15m
            JWT_REFRESH_EXPIRES_IN=7d
            CORS_ORIGIN=${{ secrets.CORS_ORIGIN }}
            DATABASE_SYNCHRONIZE=false
            ENVEOF

            # Login to GHCR
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            # Set image tags (only update changed services)
            BACKEND_TAG="${{ github.sha }}"
            FRONTEND_TAG="${{ github.sha }}"

            if [ "$BACKEND_CHANGED" != "true" ]; then
              CURRENT=$(docker inspect tracker-backend --format='{{.Config.Image}}' 2>/dev/null | cut -d: -f2 || echo "latest")
              BACKEND_TAG="$CURRENT"
            fi

            if [ "$FRONTEND_CHANGED" != "true" ]; then
              CURRENT=$(docker inspect tracker-frontend --format='{{.Config.Image}}' 2>/dev/null | cut -d: -f2 || echo "latest")
              FRONTEND_TAG="$CURRENT"
            fi

            sed -i "s|\${GHCR_IMAGE_TAG:-latest}|${BACKEND_TAG}|1" docker-compose.prod.yml
            sed -i "s|\${GHCR_IMAGE_TAG:-latest}|${FRONTEND_TAG}|" docker-compose.prod.yml

            # Migrate if backend changed
            if [ "$BACKEND_CHANGED" = "true" ]; then
              echo "Running migrations..."
              docker compose -f docker-compose.prod.yml run --rm --no-deps backend \
                sh -c "until pg_isready -h postgres -U postgres; do sleep 1; done && \
                       npx typeorm migration:run -d dist/config/data-source.js" || true
            fi

            # Deploy
            docker compose -f docker-compose.prod.yml up -d --force-recreate --wait --wait-timeout 60

            # Cleanup old images
            docker image prune -f &

      - name: Notify Telegram (success)
        if: success()
        uses: appleboy/telegram-action@master
        with:
          to: ${{ secrets.TELEGRAM_CHAT_ID }}
          token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          format: markdown
          message: |
            ✅ *Tracker deployed*
            Commit: `${{ github.sha }}`
            By: ${{ github.actor }}

      - name: Notify Telegram (failure)
        if: failure()
        uses: appleboy/telegram-action@master
        with:
          to: ${{ secrets.TELEGRAM_CHAT_ID }}
          token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          format: markdown
          message: |
            ❌ *Tracker deploy FAILED*
            Commit: `${{ github.sha }}`
            [View logs](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
```

---

## 8. Dockerfiles

### Backend (`docker/backend/Dockerfile`)

```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
RUN bun run build

FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:22-alpine AS runner
RUN addgroup -g 1001 nestjs && adduser -u 1001 -G nestjs -s /bin/sh -D nestjs
WORKDIR /app
COPY --from=prod-deps --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/package.json ./
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
```

### Frontend (`docker/frontend/Dockerfile`)

```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost/api
ENV VITE_API_URL=$VITE_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .
RUN bun run build

FROM nginx:alpine AS runner
RUN addgroup -g 1001 nginx-app && adduser -u 1001 -G nginx-app -s /bin/sh -D nginx-app
RUN mkdir -p /app/dist && chown -R nginx-app:nginx-app /app
RUN chown -R nginx-app:nginx-app /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid && chown nginx-app:nginx-app /var/run/nginx.pid
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx-app:nginx-app /app/dist /app/dist
USER nginx-app
EXPOSE 80
HEALTHCHECK --interval=5s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

---

## 9. PWA конфигурация

**`frontend/vite.config.ts`** — ключевая часть:

```ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',  // показывать кнопку "Обновить"
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],

      manifest: {
        name: 'Tracker',
        short_name: 'Tracker',
        description: 'Описание приложения',
        theme_color: '#your-color',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'maskable'
          }
        ]
      },

      workbox: {
        // Кешировать все статические ассеты
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],

        // API-кеширование (NetworkFirst — сеть приоритетнее, fallback на кеш)
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 300  // 5 минут
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],

        // Не кешировать auth-запросы
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],

  build: {
    rollupOptions: {
      output: {
        // Code splitting для лучшего кеширования
        manualChunks: {
          'vue-core': ['vue', 'vue-router'],
          'tanstack': ['@tanstack/vue-query'],
        }
      }
    }
  }
})
```

---

## 10. PWA обновление (composable)

**`frontend/src/shared/lib/composables/usePwaUpdate.ts`**

```ts
import { watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useToast } from './useToast'

export function usePwaUpdate() {
  const { toast } = useToast()

  const {
    needRefresh,
    updateServiceWorker
  } = useRegisterSW({
    // Проверять обновления каждые 60 секунд
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    }
  })

  // Показать тост при доступном обновлении
  watch(needRefresh, (val) => {
    if (val) {
      toast({
        title: 'Доступно обновление',
        description: 'Нажмите чтобы обновить приложение',
        variant: 'info',
        duration: Infinity,  // не скрывать автоматически
        action: {
          label: 'Обновить',
          onClick: () => updateServiceWorker(true)
        }
      })
    }
  })

  return { needRefresh, updateServiceWorker }
}
```

В `App.vue`:

```ts
import { usePwaUpdate } from '@/shared/lib/composables/usePwaUpdate'

// В setup()
usePwaUpdate()
```

### Цикл обновления PWA

1. Пользователь открывает приложение → SW проверяет `sw.js` (no-cache)
2. Если `sw.js` изменился → новый SW устанавливается в фоне
3. `registerType: 'prompt'` → показывается тост "Доступно обновление"
4. Пользователь нажимает "Обновить" → `skipWaiting()` + `reload()`
5. Интервальная проверка каждые 60 секунд ловит обновления без перезагрузки

---

## 11. Стратегия кеширования для PWA

| Ресурс | Cache-Control | Почему |
|--------|---------------|--------|
| `sw.js` | `no-cache, no-store, must-revalidate` | Браузер всегда проверяет новую версию SW |
| `manifest.webmanifest` | `max-age=3600` | Обновляется редко, 1h достаточно |
| `/assets/*` (с хешем) | `max-age=31536000, immutable` | Хеш в имени файла = безопасный вечный кеш |
| `index.html` | `no-cache, must-revalidate` | Всегда свежий, содержит ссылки на актуальные ассеты |
| API (не auth) | NetworkFirst, 5min | Офлайн-доступ с откатом на кеш |
| API auth | Не кешировать | Безопасность |

---

## 12. GitHub Secrets

Перейти в **Settings → Secrets and variables → Actions** нового репозитория.

### Environment: `production`

| Secret | Значение |
|--------|----------|
| `SERVER_HOST` | `185.120.59.179` (тот же сервер) |
| `SERVER_USER` | `root` |
| `SSH_PRIVATE_KEY` | тот же SSH ключ что и для finance-app |
| `DATABASE_PASSWORD` | **новый** уникальный пароль |
| `JWT_SECRET` | **новый** уникальный секрет (32+ символов) |
| `CORS_ORIGIN` | `https://tracker.ouro-finance.top` |
| `TELEGRAM_BOT_TOKEN` | тот же бот |
| `TELEGRAM_CHAT_ID` | тот же чат |

---

## 13. Первый деплой — чеклист

```bash
# 1. На сервере: создать директорию
ssh root@185.120.59.179 "mkdir -p ~/tracker-app"

# 2. DNS: добавить A-запись
# tracker.ouro-finance.top → 185.120.59.179

# 3. На сервере: добавить host nginx конфиг
ssh root@185.120.59.179
sudo nano /etc/nginx/sites-available/tracker-ouro-finance
# (вставить конфиг из секции 6)
sudo ln -s /etc/nginx/sites-available/tracker-ouro-finance /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. SSL сертификат
sudo certbot --nginx -d tracker.ouro-finance.top

# 5. GitHub: добавить все secrets в новом репозитории

# 6. Push в master → CI/CD автоматически задеплоит

# 7. Проверка
curl https://tracker.ouro-finance.top/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"...","uptime":...,"database":{"status":"ok"}}
```

### Чеклист

- [ ] GitHub репозиторий создан
- [ ] Все secrets добавлены в GitHub
- [ ] SSH ключ работает (тот же что и для finance-app)
- [ ] DNS A-запись настроена
- [ ] Host nginx конфиг создан и активирован
- [ ] SSL сертификат получен через certbot
- [ ] Push в master выполнен
- [ ] CI/CD pipeline прошел успешно
- [ ] Health check возвращает `{"status":"ok"}`
- [ ] PWA устанавливается на телефон
- [ ] Обновление PWA работает (тост появляется)

---

## 14. Полезные команды

### Логи

```bash
cd ~/tracker-app
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Управление

```bash
# Статус
docker compose -f docker-compose.prod.yml ps

# Перезапуск
docker compose -f docker-compose.prod.yml restart

# Остановка
docker compose -f docker-compose.prod.yml down

# Полная очистка (включая volumes — ДАННЫЕ БУДУТ УДАЛЕНЫ)
docker compose -f docker-compose.prod.yml down -v
```

### Обновление вручную

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

### Backup БД

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres tracker_db > backup_tracker_$(date +%Y%m%d).sql
```

### Просмотр данных

```bash
ssh root@185.120.59.179 "docker exec \$(docker ps -q -f name=tracker-postgres) \
  psql -U postgres -d tracker_db -c \"SELECT * FROM your_table LIMIT 10;\""
```
