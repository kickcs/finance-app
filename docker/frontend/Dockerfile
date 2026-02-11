# ================================
# Stage 1: Install dependencies
# ================================
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/bun.lock* frontend/yarn.lock* ./

# Install dependencies (prefer bun, fallback to yarn if yarn.lock exists)
RUN if [ -f yarn.lock ]; then \
        bun install --frozen-lockfile; \
    else \
        bun install; \
    fi

# ================================
# Stage 2: Build application
# ================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Build argument for API URL (required at build time for Vite)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY frontend/ ./

# Build the Vue application
RUN bun run build

# ================================
# Stage 3: Production runtime (nginx)
# ================================
FROM nginx:alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-app nginx-app && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
