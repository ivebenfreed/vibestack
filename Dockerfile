# VibeStack Development Container
# Multi-service container for worktree isolation with PostgreSQL, Node.js apps, and Neon proxy

FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-14 \
    postgresql-client-14 \
    supervisor \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

# Set up PostgreSQL
RUN mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql

# Create app directory
WORKDIR /app

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/vibestack.conf

# Create necessary directories
RUN mkdir -p /var/log/supervisor

# Expose ports
# 5173 - Web app (Vite)
# 8787 - API server (Hono)
# 5432 - PostgreSQL
# 4444 - Neon HTTP proxy
EXPOSE 5173 8787 5432 4444

# Set up PostgreSQL user and permissions
USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER postgres;" && \
    psql --command "ALTER USER postgres CREATEDB;" && \
    psql --command "ALTER USER postgres WITH SUPERUSER;" && \
    createdb vibestack_dev

USER root

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build applications
RUN pnpm build

# Create startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Default command
CMD ["/usr/local/bin/docker-entrypoint.sh"]