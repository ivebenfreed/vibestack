#!/bin/bash
# Complete Ubuntu development environment setup

set -e

echo "🛠️ Setting up Ubuntu development environment..."

# Wait for SSH to be available
echo "⏳ Waiting for Ubuntu VM to be ready..."
until nc -z localhost 2222 2>/dev/null; do
    echo "Waiting for SSH on port 2222..."
    sleep 3
done

echo "📡 SSH ready! Installing development environment..."

# SSH into VM and run setup
ssh -o StrictHostKeyChecking=no -p 2222 developer@localhost << 'REMOTE_SETUP'
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
sudo usermod -aG docker developer
sudo systemctl enable docker
sudo systemctl start docker

echo "🖥️ Installing XFCE desktop environment..."
sudo apt install -y \
    xfce4 xfce4-terminal \
    lightdm lightdm-gtk-greeter \
    firefox \
    xorg

# Configure auto-login
sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/50-autologin.conf << 'LIGHTDM_EOF'
[Seat:*]
autologin-user=developer
autologin-user-timeout=0
LIGHTDM_EOF

# Enable desktop manager
sudo systemctl enable lightdm

echo "🤖 Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | sh

echo "📁 Creating workspace directory..."
mkdir -p ~/workspace

echo "✅ Ubuntu development environment setup complete!"
echo "🔄 Rebooting to desktop environment..."
sudo reboot

REMOTE_SETUP

echo "🎉 Setup complete! VM will reboot into XFCE desktop."
echo "💡 Access: ssh -p 2222 developer@localhost (password: developer)"