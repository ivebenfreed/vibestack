#!/bin/bash
# Setup development environment on Ubuntu cloud image

set -e

echo "🌟 Setting up Ubuntu Minimal Cloud development environment..."

# Wait for SSH (cloud images take a moment to initialize)
echo "⏳ Waiting for Ubuntu cloud image to initialize..."
until nc -z localhost 2224 2>/dev/null; do
    echo "Waiting for SSH on port 2224..."
    sleep 5
done

echo "📡 SSH ready! Installing development environment..."

# The default user in Ubuntu cloud images is usually 'ubuntu'
# SSH with the cloud image
ssh -o StrictHostKeyChecking=no -p 2224 ubuntu@localhost << 'REMOTE_SETUP'
set -e

echo "🔄 Updating system..."
sudo apt update && sudo apt upgrade -y

echo "📦 Installing core development tools..."
sudo apt install -y \
    curl wget git tmux nano htop \
    build-essential python3 python3-pip \
    docker.io docker-compose \
    postgresql-client \
    chromium-browser \
    nodejs npm

# Install pnpm
sudo npm install -g pnpm@9.15.1

# Configure Docker
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

echo "🖥️ Installing XFCE desktop environment..."
sudo apt install -y \
    xfce4 xfce4-terminal \
    lightdm lightdm-gtk-greeter \
    firefox \
    xorg

# Configure auto-login for ubuntu user
sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/50-autologin.conf << 'LIGHTDM_EOF'
[Seat:*]
autologin-user=ubuntu
autologin-user-timeout=0
LIGHTDM_EOF

# Enable desktop manager
sudo systemctl enable lightdm

echo "🤖 Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | sh

echo "📁 Creating workspace directory..."
mkdir -p ~/workspace

echo "✅ Ubuntu minimal development environment setup complete!"
echo "🔄 Rebooting to desktop environment..."
sudo reboot

REMOTE_SETUP

echo "🎉 Setup complete! VM will reboot into XFCE desktop."
echo "💡 Access: ssh -p 2224 ubuntu@localhost"