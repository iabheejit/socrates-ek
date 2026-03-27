# Multi-stage build for optimized production image

# Stage 1: Base image with dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Install build dependencies for native modules (canvas, etc.)
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    build-base \
    g++ \
    pixman-dev

# Copy package files
COPY package*.json ./

# Stage 2: Development dependencies
FROM base AS development
RUN npm ci

# Stage 3: Production dependencies only
FROM base AS production-deps
RUN npm ci --only=production

# Stage 4: Build stage (if needed for TypeScript or other build steps)
FROM development AS build
COPY . .
# Add any build steps here if needed
# RUN npm run build

# Stage 5: Production image
FROM node:18-alpine AS production
WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

# Create logs directory
RUN mkdir -p logs && chown -R node:node logs

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=node:node . .

# Use non-root user for security
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
