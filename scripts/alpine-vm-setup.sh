#!/bin/sh
# Alpine Linux Development VM Setup for VibeStack
# Run this script after fresh Alpine installation

set -e

echo "🏔️ Setting up Alpine Linux Development Environment..."

# Update package index
apk update

# Install core system utilities
echo "📦 Installing core utilities..."
apk add \
    curl \
    wget \
    bash \
    git \
    tmux \
    nano \
    htop \
    openssh-client \
    ca-certificates \
    shadow \
    sudo

# Install Docker and Docker Compose
echo "🐳 Installing Docker..."
apk add docker docker-compose docker-cli-compose
rc-update add docker default
service docker start

# Add user to docker group (replace 'developer' with your username)
addgroup developer docker

# Install Node.js and package managers
echo "📦 Installing Node.js development tools..."
apk add \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    linux-headers

# Install pnpm globally
npm install -g pnpm@9.15.1

# Install PostgreSQL client tools
echo "🗄️ Installing PostgreSQL client..."
apk add postgresql-client

# Install Chromium for Playwright
echo "🌐 Installing Chromium..."
apk add \
    chromium \
    chromium-chromedriver \
    xvfb

# Install development tools
echo "🛠️ Installing development tools..."
apk add \
    build-base \
    libc6-compat \
    gcompat

# Create development user if it doesn't exist
if ! id "developer" &>/dev/null; then
    adduser -D -s /bin/bash developer
    echo "developer:developer" | chpasswd
    addgroup developer wheel
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi

# Switch to bash as default shell
sed -i 's|/bin/ash|/bin/bash|g' /etc/passwd

# Create development directories
mkdir -p /home/developer/workspace
chown -R developer:developer /home/developer

echo "✅ Core Alpine setup complete!"
echo ""
echo "Next steps:"
echo "1. Install Claude Code"
echo "2. Optional: Install desktop environment"
echo "3. Clone VibeStack project"
echo "4. Create VM snapshot"