# ================================
# Stage 1: Install ALL dependencies (for build)
# ================================
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy package files
COPY backend/package.json backend/bun.lock* ./

# Install all dependencies (including dev for build)
RUN bun install --frozen-lockfile

# ================================
# Stage 2: Build application
# ================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY backend/ ./

# Build the NestJS application
RUN bun run build

# ================================
# Stage 3: Production dependencies only
# ================================
FROM oven/bun:1 AS prod-deps

WORKDIR /app

COPY backend/package.json backend/bun.lock* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# ================================
# Stage 4: Production runtime
# ================================
FROM node:26-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application and prod-only dependencies
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=512"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
