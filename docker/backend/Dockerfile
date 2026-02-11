# ================================
# Stage 1: Install dependencies
# ================================
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy package files
COPY backend/package.json backend/bun.lock* ./

# Install dependencies
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
# Stage 3: Production runtime
# ================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
