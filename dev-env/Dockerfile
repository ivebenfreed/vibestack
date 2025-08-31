FROM ubuntu:22.04

# Set non-interactive frontend for apt
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (no nodejs from apt - we'll install newer version)
RUN apt-get update && apt-get install -y \
    curl wget git tmux nano htop \
    build-essential python3 python3-pip \
    openssh-server sudo \
    postgresql-client \
    ca-certificates \
    gnupg lsb-release \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x LTS (required for Wrangler)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally (now with Node.js 20+)
RUN npm install -g pnpm@9.15.1

# Create developer user with same UID as host (1000)
RUN useradd -m -s /bin/bash -u 1000 -G sudo developer && \
    echo 'developer:developer' | chpasswd && \
    echo 'developer ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Switch to developer user
USER developer
WORKDIR /home/developer

# Install Claude Code as developer user
RUN curl -fsSL https://claude.ai/install.sh | bash || echo "Claude Code install will retry"

# Ensure PATH includes local bin
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/developer/.bashrc

# Create workspace directory
RUN sudo mkdir -p /workspace && sudo chown -R developer:developer /workspace

# Set final working directory
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]