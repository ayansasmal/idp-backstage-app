# Multi-stage Dockerfile for Backstage Application
# Optimized for production deployment with IDP Platform

# Stage 1: Build stage
FROM node:20-bullseye-slim AS build

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json yarn.lock ./
COPY packages packages
COPY plugins plugins

# Install dependencies
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy source code
COPY . .

# Build the application
RUN yarn build:all

# Stage 2: Runtime stage
FROM node:20-bullseye-slim AS runtime

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1001 --gid 0 --shell /bin/bash --create-home backstage

# Copy built application from build stage
COPY --from=build --chown=1001:0 /app/packages/backend/dist /app/packages/backend/dist
COPY --from=build --chown=1001:0 /app/node_modules /app/node_modules

# Copy configuration files
COPY --chown=1001:0 app-config*.yaml ./
COPY --chown=1001:0 examples ./examples

# Set user and permissions
USER 1001

# Expose port
EXPOSE 7007

# Set environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7007/api/app/health || exit 1

# Start command
CMD ["node", "packages/backend/dist/index.js"]