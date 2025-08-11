# Multi-stage Dockerfile for IDP Backstage App
# This builds both frontend and backend for a complete Backstage deployment

# ==========================================
# Build stage
# ==========================================
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

# Copy package files for workspace resolution
COPY package.json yarn.lock backstage.json ./

# Copy all package.json files for workspace resolution
COPY packages/*/package.json ./packages/*/
COPY plugins/*/package.json ./plugins/*/

# Enable Corepack for modern Yarn
RUN corepack enable

# Install dependencies
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

# Copy source code
COPY . .

# Build the application (both frontend and backend)
RUN yarn tsc && yarn build:all

# ==========================================
# Backend Runtime stage
# ==========================================
FROM node:20-bookworm-slim AS backend

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

# Copy build configuration
COPY --from=build --chown=node:node /app/package.json /app/yarn.lock /app/backstage.json ./

# Copy built backend and required files
COPY --from=build --chown=node:node /app/packages/backend/dist ./packages/backend/dist
COPY --from=build --chown=node:node /app/packages/backend/package.json ./packages/backend/
COPY --from=build --chown=node:node /app/plugins ./plugins
COPY --from=build --chown=node:node /app/examples ./examples
COPY --from=build --chown=node:node /app/app-config*.yaml ./

# Enable Corepack and install production dependencies
RUN corepack enable
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --production backend

# Environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:7007/api/unleash-feature-flags/health/status || exit 1

# Expose backend port
EXPOSE 7007

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the backend
CMD ["node", "packages/backend", "--config", "app-config.yaml"]

# ==========================================
# Frontend Runtime stage (Nginx + built static files)
# ==========================================
FROM nginx:alpine AS frontend

# Copy built frontend files
COPY --from=build /app/packages/app/dist /usr/share/nginx/html

# Create nginx configuration for Backstage frontend
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://backend:7007;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check for frontend
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Expose frontend port
EXPOSE 3000

# ==========================================
# Full-stack Runtime (Development/Single Container)
# ==========================================
FROM node:20-bookworm-slim AS fullstack

# Set Python interpreter for node-gyp
ENV PYTHON=/usr/bin/python3

# Install runtime dependencies including nginx for serving frontend
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 g++ build-essential \
        libsqlite3-dev \
        curl \
        nginx \
        supervisor \
        dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Use non-root user for app files, but supervisor runs as root
WORKDIR /app

# Copy build configuration
COPY --from=build --chown=node:node /app/package.json /app/yarn.lock /app/backstage.json ./

# Copy built backend
COPY --from=build --chown=node:node /app/packages/backend/dist ./packages/backend/dist
COPY --from=build --chown=node:node /app/packages/backend/package.json ./packages/backend/
COPY --from=build --chown=node:node /app/plugins ./plugins
COPY --from=build --chown=node:node /app/examples ./examples
COPY --from=build --chown=node:node /app/app-config*.yaml ./

# Copy built frontend to nginx directory
COPY --from=build /app/packages/app/dist /usr/share/nginx/html

# Enable Corepack and install production dependencies
RUN corepack enable
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --production backend

# Create nginx configuration
RUN cat > /etc/nginx/sites-available/backstage << 'EOF'
server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://localhost:7007;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Health check for frontend
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable the site
RUN ln -s /etc/nginx/sites-available/backstage /etc/nginx/sites-enabled/ && \
    rm /etc/nginx/sites-enabled/default

# Create supervisord configuration
RUN cat > /etc/supervisor/conf.d/backstage.conf << 'EOF'
[program:backend]
command=node packages/backend --config app-config.yaml
directory=/app
user=node
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=NODE_ENV=production,NODE_OPTIONS="--no-node-snapshot"

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Health check for both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:3000/health && curl -f http://localhost:7007/api/unleash-feature-flags/health/status || exit 1

# Expose both ports
EXPOSE 3000 7007

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start both frontend and backend using supervisord
CMD ["supervisord", "-n"]