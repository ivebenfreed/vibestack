#!/bin/bash
# Alpine Linux Post-Installation Setup - Fixed version
# Run this INSIDE the Alpine VM after basic installation

set -e

echo "🔧 Alpine Linux Post-Installation Setup (Fixed)"

# Update package index
echo "📦 Updating package index..."
apk update

# Enable community repository for additional packages
echo "📦 Enabling community repository..."
echo "http://mirrors.edge.kernel.org/alpine/v3.19/community" >> /etc/apk/repositories
apk update

# Install essential development tools first
echo "🛠️ Installing core development tools..."
apk add --no-cache \
    bash \
    curl \
    wget \
    git \
    nano \
    tmux \
    htop \
    openssh-client \
    ca-certificates \
    doas \
    shadow

# Configure bash as default shell for developer user
echo "🐚 Setting up bash shell..."
if ! id "developer" &>/dev/null; then
    adduser -D -s /bin/bash developer
    echo "developer:developer" | chpasswd
    addgroup developer wheel
fi

# Configure doas (Alpine's sudo alternative)
echo "permit :wheel" > /etc/doas.d/doas.conf

# Install Node.js and npm
echo "📦 Installing Node.js..."
apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    linux-headers \
    pkgconfig

# Install pnpm
echo "📦 Installing pnpm..."
npm install -g pnpm@9.15.1

# Install Docker
echo "🐳 Installing Docker..."
apk add --no-cache \
    docker \
    docker-compose \
    docker-cli-compose

# Configure Docker
rc-update add docker default
service docker start
addgroup developer docker

# Install PostgreSQL client
echo "🗄️ Installing PostgreSQL client..."
apk add --no-cache postgresql-client

# Install browser for Playwright
echo "🌐 Installing Chromium..."
apk add --no-cache \
    chromium \
    xvfb \
    font-noto

# Install build tools
echo "🔨 Installing build tools..."
apk add --no-cache \
    build-base \
    libc6-compat \
    gcompat

# Create development workspace
mkdir -p /home/developer/workspace
chown -R developer:developer /home/developer

# Configure SSH
echo "🔐 Configuring SSH..."
# Set root password for SSH access
echo "root:P4ssiveH0use!" | chpasswd
# Allow root SSH login
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
rc-update add sshd default
service sshd restart

# Install minimal desktop (optional)
read -p "Install minimal desktop environment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🖥️ Installing minimal desktop..."
    apk add --no-cache \
        xfce4-panel \
        xfce4-session \
        xfce4-settings \
        xfce4-terminal \
        xorg-server \
        lightdm \
        lightdm-gtk-greeter \
        dbus
    
    # Configure auto-login
    mkdir -p /etc/lightdm
    cat > /etc/lightdm/lightdm.conf << 'EOF'
[Seat:*]
autologin-user=developer
autologin-user-timeout=0
EOF
    
    # Enable services
    rc-update add lightdm default
    rc-update add dbus default
    
    # Configure .xinitrc for developer
    su - developer -c 'echo "exec startxfce4" > ~/.xinitrc && chmod +x ~/.xinitrc'
fi

echo ""
echo "✅ Post-installation setup complete!"
echo ""
echo "Next steps:"
echo "1. Reboot: reboot"
echo "2. Test SSH: ssh -i ~/.ssh/alpine_vm_key -p 2222 root@localhost"
echo "3. Install Claude Code: curl -fsSL https://claude.ai/install.sh | sh"
echo "4. Clone VibeStack project"
echo ""
echo "VM ports forwarded:"
echo "  SSH:  localhost:2222 -> vm:22"
echo "  Dev:  localhost:5173 -> vm:5173"
echo "  API:  localhost:8787 -> vm:8787" 
echo "  DB:   localhost:15432 -> vm:5432"
echo ""
echo "Note: Use 'doas' instead of 'sudo' on Alpine Linux"