# Multi-stage Dockerfile for IDP Backstage App
# This builds both frontend and backend in a single container for simplified deployment

# Build stage
FROM node:20-bookworm-slim AS build

# Set Python interpreter for node-gyp
ENV PYTHON=/usr/bin/python3

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml backstage.json ./
COPY .yarn ./.yarn

# Copy all package.json files for workspace resolution
COPY packages/app/package.json ./packages/app/
COPY packages/backend/package.json ./packages/backend/
COPY plugins/*/package.json ./plugins/*/

# Install dependencies
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

# Copy source code
COPY . .

# Build the application
RUN yarn tsc && yarn build:all

# Runtime stage
FROM node:20-bookworm-slim AS runtime

# Set Python interpreter for node-gyp
ENV PYTHON=/usr/bin/python3

# Install runtime dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 g++ build-essential \
        libsqlite3-dev \
        curl \
        dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Use non-root user
USER node
WORKDIR /app

# Copy yarn configuration
COPY --from=build --chown=node:node /app/.yarn ./.yarn
COPY --from=build --chown=node:node /app/.yarnrc.yml /app/package.json /app/yarn.lock /app/backstage.json ./

# Copy built application
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/plugins ./plugins
COPY --from=build --chown=node:node /app/examples ./examples
COPY --from=build --chown=node:node /app/app-config*.yaml ./

# Install production dependencies
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --all --production

# Environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:7007/api/unleash-feature-flags/health/status || exit 1

# Expose ports
EXPOSE 7007

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the backend
CMD ["node", "packages/backend", "--config", "app-config.yaml"]