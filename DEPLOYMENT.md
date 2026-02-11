# Deployment Guide

Пошаговая инструкция по настройке CI/CD и деплою finance-app на VPS.

---

## Содержание

1. [Подготовка GitHub репозитория](#1-подготовка-github-репозитория)
2. [Настройка GitHub Secrets](#2-настройка-github-secrets)
3. [Подготовка VPS сервера](#3-подготовка-vps-сервера)
4. [Первый деплой](#4-первый-деплой)
5. [Настройка домена и HTTPS](#5-настройка-домена-и-https)
6. [Полезные команды](#6-полезные-команды)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Подготовка GitHub репозитория

### 1.1 Создайте приватный репозиторий на GitHub

```bash
# Инициализируйте git (если еще не сделано)
cd /path/to/finance-app
git init

# Добавьте remote
git remote add origin git@github.com:YOUR_USERNAME/finance-app.git

# Первый коммит
git add .
git commit -m "Initial commit: Docker + CI/CD setup"
git branch -M master
git push -u origin master
```

### 1.2 Включите GitHub Container Registry

GitHub Container Registry (GHCR) включен по умолчанию для всех репозиториев. Образы будут публиковаться в:
- `ghcr.io/YOUR_USERNAME/finance-app/backend:latest`
- `ghcr.io/YOUR_USERNAME/finance-app/frontend:latest`

---

## 2. Настройка GitHub Secrets

Перейдите в **Settings → Secrets and variables → Actions** вашего репозитория.

### 2.1 Создайте Environment "production"

1. **Settings → Environments → New environment**
2. Название: `production`
3. (Опционально) Добавьте protection rules

### 2.2 Добавьте следующие секреты

| Secret | Описание | Пример |
|--------|----------|--------|
| `SERVER_HOST` | IP или hostname вашего VPS | `123.45.67.89` |
| `SERVER_USER` | SSH пользователь | `deploy` или `root` |
| `SSH_PRIVATE_KEY` | Приватный SSH ключ (полностью) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `API_URL` | URL API для frontend (с /api) | `https://finance.example.com/api` |
| `DATABASE_PASSWORD` | Пароль PostgreSQL | `your-secure-db-password` |
| `JWT_SECRET` | Секрет для JWT токенов (32+ символов) | `your-super-secret-jwt-key-min-32-chars` |
| `CORS_ORIGIN` | Разрешенный origin для CORS | `https://finance.example.com` |

### 2.3 Генерация SSH ключа (если нужен новый)

```bash
# На локальной машине
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Скопируйте приватный ключ в GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/github_deploy

# Публичный ключ добавьте на сервер (см. раздел 3)
cat ~/.ssh/github_deploy.pub
```

---

## 3. Подготовка VPS сервера

### 3.1 Минимальные требования

- Ubuntu 22.04+ / Debian 12+
- 2 GB RAM (минимум)
- 20 GB SSD
- Docker и Docker Compose

### 3.2 Установка Docker

```bash
# Подключитесь к серверу
ssh user@YOUR_SERVER_IP

# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com | sh

# Добавьте пользователя в группу docker
sudo usermod -aG docker $USER

# Перелогиньтесь для применения изменений
exit
ssh user@YOUR_SERVER_IP

# Проверьте установку
docker --version
docker compose version
```

### 3.3 Создайте пользователя для деплоя (рекомендуется)

```bash
# Создайте пользователя
sudo adduser deploy
sudo usermod -aG docker deploy

# Настройте SSH ключ
sudo mkdir -p /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
# Вставьте публичный ключ (github_deploy.pub)

sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

### 3.4 Настройте firewall

```bash
# Разрешите SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3.5 Создайте директорию для приложения

```bash
# От имени deploy пользователя
sudo -u deploy mkdir -p /home/deploy/finance-app
```

---

## 4. Первый деплой

### 4.1 Автоматический деплой (через GitHub Actions)

После настройки секретов, просто сделайте push в master:

```bash
git add .
git commit -m "Configure deployment"
git push origin master
```

GitHub Actions автоматически:
1. Соберет Docker образы
2. Запушит их в GHCR
3. Подключится к серверу по SSH
4. Запустит контейнеры

### 4.2 Ручной деплой (первый раз или для отладки)

```bash
# На сервере
cd ~/finance-app

# Создайте .env файл
cat > .env << EOF
GITHUB_REPOSITORY=YOUR_USERNAME/finance-app
GHCR_IMAGE_TAG=latest
DATABASE_NAME=my_finance
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your-secure-db-password
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://finance.example.com
EOF

# Скачайте docker-compose.prod.yml
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/finance-app/master/docker-compose.prod.yml -o docker-compose.prod.yml

# Создайте директорию для init.sql
mkdir -p docker/postgres
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/finance-app/master/docker/postgres/init.sql -o docker/postgres/init.sql

# Залогиньтесь в GHCR
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Запустите
docker compose -f docker-compose.prod.yml up -d

# Проверьте статус
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 4.3 Проверка работоспособности

```bash
# Health check
curl http://localhost/api/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"...","uptime":...,"database":{"status":"ok"}}
```

---

## 5. Настройка домена и HTTPS

### 5.1 Настройте DNS

Добавьте A-запись в DNS вашего домена:
```
finance.example.com → YOUR_SERVER_IP
```

### 5.2 Установите Nginx как reverse proxy с SSL

```bash
# Установите Nginx и Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Создайте конфиг для сайта
sudo nano /etc/nginx/sites-available/finance-app
```

Содержимое конфига:

```nginx
server {
    listen 80;
    server_name finance.example.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активируйте конфиг
sudo ln -s /etc/nginx/sites-available/finance-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Получите SSL сертификат
sudo certbot --nginx -d finance.example.com
```

### 5.3 Альтернатива: Traefik (рекомендуется для Docker)

Для автоматического SSL с Let's Encrypt, рассмотрите использование Traefik. Это потребует модификации docker-compose.prod.yml.

---

## 6. Полезные команды

### Логи

```bash
# Все логи
docker compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Управление контейнерами

```bash
# Статус
docker compose -f docker-compose.prod.yml ps

# Перезапуск
docker compose -f docker-compose.prod.yml restart

# Остановка
docker compose -f docker-compose.prod.yml down

# Полная очистка (включая volumes!)
docker compose -f docker-compose.prod.yml down -v
```

### Обновление вручную

```bash
# Подтянуть новые образы
docker compose -f docker-compose.prod.yml pull

# Перезапустить с новыми образами
docker compose -f docker-compose.prod.yml up -d

# Очистить старые образы
docker image prune -f
```

### Миграции БД

```bash
# Подключиться к backend контейнеру
docker compose -f docker-compose.prod.yml exec backend sh

# Внутри контейнера (если нужно выполнить миграции)
# Примечание: миграции должны быть скомпилированы и включены в образ
```

### Backup базы данных

```bash
# Создать backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres my_finance > backup_$(date +%Y%m%d).sql

# Восстановить из backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres my_finance < backup_20240101.sql
```

---

## 7. Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Проверьте логи
docker compose -f docker-compose.prod.yml logs

# Проверьте, что образы скачались
docker images | grep finance-app
```

### Проблема: Cannot connect to database

```bash
# Проверьте, что postgres контейнер работает
docker compose -f docker-compose.prod.yml ps postgres

# Проверьте логи postgres
docker compose -f docker-compose.prod.yml logs postgres

# Проверьте переменные окружения
docker compose -f docker-compose.prod.yml exec backend env | grep DATABASE
```

### Проблема: Health check failed

```bash
# Проверьте, что backend отвечает
docker compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:3000/api/health

# Проверьте логи backend
docker compose -f docker-compose.prod.yml logs backend
```

### Проблема: GitHub Actions не может подключиться к серверу

1. Проверьте, что SSH ключ правильно добавлен в секреты
2. Проверьте, что публичный ключ добавлен в `~/.ssh/authorized_keys` на сервере
3. Проверьте права доступа:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

### Проблема: Permission denied при docker pull

```bash
# Убедитесь, что GHCR логин работает
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Проверьте видимость пакетов в GitHub
# Settings → Packages → Visibility должен быть доступен для репозитория
```

---

## Чеклист перед деплоем

- [ ] GitHub репозиторий создан
- [ ] Все секреты добавлены в GitHub
- [ ] SSH ключ настроен на сервере
- [ ] Docker установлен на сервере
- [ ] Firewall настроен (порты 22, 80, 443)
- [ ] DNS записи настроены (если нужен домен)
- [ ] Сделан push в master ветку
- [ ] CI/CD pipeline прошел успешно
- [ ] Health check возвращает `{"status":"ok"}`

---

## Структура файлов

```
finance-app/
├── .github/workflows/
│   ├── ci.yml              # CI: lint, test, build на PR
│   └── deploy.yml          # CD: build → GHCR → deploy на push в master
├── docker/
│   ├── backend/Dockerfile  # Multi-stage build для NestJS
│   ├── frontend/
│   │   ├── Dockerfile      # Multi-stage build для Vue + nginx
│   │   └── nginx.conf      # Nginx конфиг с proxy и SPA fallback
│   └── postgres/init.sql   # Инициализация БД
├── docker-compose.yml      # Для локальной разработки
├── docker-compose.prod.yml # Для production (использует GHCR образы)
├── .dockerignore
├── .env.example
└── DEPLOYMENT.md           # Эта инструкция
```
