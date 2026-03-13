# Deployment Guide

Инструкция по настройке CI/CD и деплою Ouro Finance на VPS.

---

## Содержание

1. [Архитектура деплоя](#1-архитектура-деплоя)
2. [Настройка GitHub Secrets](#2-настройка-github-secrets)
3. [Подготовка VPS сервера](#3-подготовка-vps-сервера)
4. [Первый деплой](#4-первый-деплой)
5. [Настройка домена и HTTPS](#5-настройка-домена-и-https)
6. [Полезные команды](#6-полезные-команды)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Архитектура деплоя

### CI/CD Pipeline (`.github/workflows/deploy.yml`)

Один файл `deploy.yml` объединяет CI и CD:

```
push в master
  ├── 1. Detect changes (backend? frontend? infra?)
  ├── 2. Build Backend (lint + test + Docker build/push) — только если backend/ изменился
  ├── 3. Build Frontend (type-check + Vite build + Docker build/push) — только если frontend/ изменился
  └── 4. Deploy — только изменённые сервисы
       ├── rsync конфигов на сервер
       ├── миграции БД (если backend обновился)
       ├── docker compose up (selective)
       └── Telegram-уведомление
```

На PR: только lint + test + build (без Docker push и деплоя).

### Сервисы в продакшене (`docker-compose.prod.yml`)

| Сервис | Образ | Порт | Назначение |
|--------|-------|------|------------|
| **postgres** | `postgres:16-alpine` | внутренний | PostgreSQL с uuid-ossp |
| **backend** | `ghcr.io/.../backend:sha` | внутренний | NestJS API |
| **frontend** | `ghcr.io/.../frontend:sha` | 8080→80 | Vue SPA + nginx (проксирует `/api/` на backend) |
| **alloy** | `grafana/alloy:v1.13.2` | внутренний | Grafana Alloy — логи, метрики, трейсы |

Frontend nginx проксирует `/api/` запросы на backend — отдельный reverse proxy для API не нужен.

### Docker-образы

Multi-stage builds, хранятся в GitHub Container Registry (GHCR):
- **Backend**: `oven/bun` (deps + build) → `node:22-alpine` (runtime), non-root user `nestjs`
- **Frontend**: `oven/bun` (deps + build) → `nginx:alpine` (runtime), non-root user

---

## 2. Настройка GitHub Secrets

**Settings → Secrets and variables → Actions**

### Обязательные

| Secret | Описание |
|--------|----------|
| `SERVER_HOST` | IP сервера |
| `SERVER_USER` | SSH пользователь (`root` или `deploy`) |
| `SSH_PRIVATE_KEY` | Полный приватный SSH ключ |
| `DATABASE_PASSWORD` | Пароль PostgreSQL |
| `JWT_SECRET` | Секрет JWT (32+ символов) |
| `CORS_ORIGIN` | Разрешённый origin, например `https://app.ouro-finance.top` |

### Подписки (LemonSqueezy)

| Secret | Описание |
|--------|----------|
| `LEMONSQUEEZY_API_KEY` | API-ключ LemonSqueezy |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Секрет для проверки вебхуков |
| `LEMONSQUEEZY_STORE_ID` | ID магазина |
| `LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID` | ID месячной подписки |
| `LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID` | ID годовой подписки |

### AI (сканирование чеков)

| Secret | Описание |
|--------|----------|
| `OPENAI_API_KEY` | API-ключ OpenAI |

### Observability (Grafana Cloud)

| Secret | Описание |
|--------|----------|
| `GRAFANA_CLOUD_API_KEY` | API-ключ Grafana Cloud |
| `GRAFANA_CLOUD_PROMETHEUS_URL` | URL Prometheus endpoint |
| `GRAFANA_CLOUD_PROMETHEUS_USER` | User ID Prometheus |
| `GRAFANA_CLOUD_LOKI_URL` | URL Loki endpoint |
| `GRAFANA_CLOUD_LOKI_USER` | User ID Loki |
| `GRAFANA_CLOUD_TEMPO_URL` | URL Tempo endpoint |
| `GRAFANA_CLOUD_TEMPO_USER` | User ID Tempo |

### Уведомления

| Secret | Описание |
|--------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота для нотификаций |
| `TELEGRAM_CHAT_ID` | ID чата для уведомлений о деплое |

### Генерация SSH ключа

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Приватный ключ → GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/github_deploy

# Публичный ключ → на сервер в authorized_keys
cat ~/.ssh/github_deploy.pub
```

---

## 3. Подготовка VPS сервера

### Минимальные требования

- Ubuntu 22.04+ / Debian 12+
- 2 GB RAM
- 20 GB SSD
- Docker и Docker Compose

### Установка Docker

```bash
ssh user@YOUR_SERVER_IP

sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Перелогиньтесь
exit && ssh user@YOUR_SERVER_IP

docker --version
docker compose version
```

### Настройка пользователя для деплоя (опционально)

```bash
sudo adduser deploy
sudo usermod -aG docker deploy

sudo mkdir -p /home/deploy/.ssh
# Вставьте публичный ключ github_deploy.pub:
sudo nano /home/deploy/.ssh/authorized_keys

sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

### Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Директория приложения

```bash
mkdir -p ~/finance-app
```

---

## 4. Первый деплой

### Автоматический (через GitHub Actions)

После настройки всех секретов — push в master:

```bash
git push origin master
```

Pipeline автоматически:
1. Соберёт Docker-образы
2. Пушит в GHCR
3. Скопирует конфиги на сервер (`docker-compose.prod.yml`, `init.sql`, `config.alloy`)
4. Создаст `.env` из секретов
5. Запустит миграции (если обновился backend)
6. Поднимет/обновит контейнеры
7. Отправит уведомление в Telegram

### Ручной (для отладки)

```bash
cd ~/finance-app

# Создайте .env
cat > .env << 'EOF'
GITHUB_REPOSITORY=kickcs/finance-app
GHCR_IMAGE_TAG=latest
DATABASE_NAME=my_finance
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://app.ouro-finance.top
DATABASE_SYNCHRONIZE=false
EOF

chmod 600 .env

# Скачайте конфиги
curl -fsSL https://raw.githubusercontent.com/kickcs/finance-app/master/docker-compose.prod.yml -o docker-compose.prod.yml
mkdir -p docker/postgres docker/alloy
curl -fsSL https://raw.githubusercontent.com/kickcs/finance-app/master/docker/postgres/init.sql -o docker/postgres/init.sql
curl -fsSL https://raw.githubusercontent.com/kickcs/finance-app/master/docker/alloy/config.alloy -o docker/alloy/config.alloy

# Логин в GHCR
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Запуск
docker compose -f docker-compose.prod.yml up -d

# Миграции
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend \
  npx typeorm migration:run -d dist/config/data-source.js
```

### Проверка

```bash
# Health check
curl http://localhost:8080/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"...","uptime":...,"database":{"status":"ok"}}
```

---

## 5. Настройка домена и HTTPS

### DNS

A-запись: `app.ouro-finance.top → YOUR_SERVER_IP`

### Nginx + SSL (на хосте)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

sudo nano /etc/nginx/sites-available/app-ouro-finance
```

```nginx
server {
    listen 80;
    server_name app.ouro-finance.top;

    location / {
        proxy_pass http://localhost:8080;
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

```bash
sudo ln -s /etc/nginx/sites-available/app-ouro-finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d app.ouro-finance.top
```

---

## 6. Полезные команды

### Логи

```bash
# Все сервисы
docker compose -f docker-compose.prod.yml logs -f

# Конкретный сервис
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f alloy
```

### Управление

```bash
docker compose -f docker-compose.prod.yml ps          # Статус
docker compose -f docker-compose.prod.yml restart      # Перезапуск
docker compose -f docker-compose.prod.yml down         # Остановка
docker compose -f docker-compose.prod.yml down -v      # Остановка + удаление volumes (ДАННЫЕ!)
```

### Обновление вручную

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

### Миграции

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend \
  npx typeorm migration:run -d dist/config/data-source.js
```

### Backup БД

```bash
# Создать
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres my_finance > backup_$(date +%Y%m%d).sql

# Восстановить
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres my_finance < backup_20260313.sql
```

### SQL-запрос к проду

```bash
ssh root@YOUR_SERVER_IP "docker exec \$(docker ps -q -f name=postgres) psql -U postgres -d my_finance -c \"SELECT ...\""
```

---

## 7. Troubleshooting

### Контейнеры не запускаются

```bash
docker compose -f docker-compose.prod.yml logs
docker images | grep finance-app
```

### Cannot connect to database

```bash
docker compose -f docker-compose.prod.yml ps postgres
docker compose -f docker-compose.prod.yml logs postgres
docker compose -f docker-compose.prod.yml exec backend env | grep DATABASE
```

### Health check failed

```bash
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:3000/api/health
docker compose -f docker-compose.prod.yml logs backend
```

### GitHub Actions не может подключиться к серверу

1. Проверьте SSH ключ в секретах (полный, включая `-----BEGIN...` и `-----END...`)
2. Публичный ключ в `~/.ssh/authorized_keys` на сервере
3. Права: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`

### Permission denied при docker pull

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Проверьте видимость пакетов: GitHub → Settings → Packages.

---

## Структура файлов

```
├── .github/workflows/
│   └── deploy.yml              # CI/CD: lint, test, build, deploy
├── docker/
│   ├── backend/Dockerfile      # Multi-stage: bun → node:22-alpine
│   ├── frontend/
│   │   ├── Dockerfile          # Multi-stage: bun → nginx:alpine
│   │   └── nginx.conf          # Reverse proxy /api/ + SPA + rate limiting
│   ├── postgres/init.sql       # uuid-ossp extension
│   └── alloy/config.alloy      # Grafana Alloy (метрики, логи, трейсы)
├── docker-compose.yml          # Для локальной разработки
├── docker-compose.prod.yml     # Production (GHCR образы)
├── backend/.env.example        # Шаблон переменных
└── DEPLOYMENT.md               # Эта инструкция
```

---

## Чеклист

- [ ] GitHub Secrets настроены (минимум: SERVER_HOST, SERVER_USER, SSH_PRIVATE_KEY, DATABASE_PASSWORD, JWT_SECRET, CORS_ORIGIN)
- [ ] SSH ключ добавлен на сервер
- [ ] Docker установлен на сервере
- [ ] Firewall: порты 22, 80, 443
- [ ] DNS A-запись настроена
- [ ] Push в master → pipeline прошёл
- [ ] Health check: `curl http://YOUR_SERVER:8080/api/health` → `{"status":"ok"}`
- [ ] SSL сертификат получен (certbot)
- [ ] Telegram-уведомления приходят
