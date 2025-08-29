#!/bin/bash
# Complete VM setup after Alpine installation

set -e

echo "🔧 Completing Alpine VM development setup..."

# Wait for SSH to be available
echo "⏳ Waiting for VM to be ready..."
until nc -z localhost 2222 2>/dev/null; do
    echo "Waiting for SSH on port 2222..."
    sleep 3
done

echo "📡 VM is accessible! Running automated setup..."

# Transfer and run our setup scripts
ssh -o StrictHostKeyChecking=no -p 2222 root@localhost << 'REMOTE_SCRIPT'
set -e

echo "🏔️ Installing development tools..."

# Update packages
apk update

# Install core development stack
apk add \
    curl wget bash git tmux nano htop \
    docker docker-compose docker-cli-compose \
    nodejs npm python3 make g++ linux-headers \
    postgresql-client chromium xvfb \
    build-base libc6-compat gcompat \
    shadow sudo

# Install pnpm
npm install -g pnpm@9.15.1

# Configure Docker
rc-update add docker default
service docker start

# Create developer user
adduser -D -s /bin/bash developer
echo "developer:developer" | chpasswd
adduser developer wheel
adduser developer docker
echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install XFCE desktop
echo "🖥️ Installing XFCE desktop environment..."
apk add \
    xfce4 xfce4-terminal xfce4-screensaver \
    lightdm lightdm-gtk-greeter \
    firefox \
    dbus eudev

# Configure auto-login
mkdir -p /etc/lightdm
cat > /etc/lightdm/lightdm.conf << 'LIGHTDM_EOF'
[Seat:*]
autologin-user=developer
autologin-user-timeout=0
greeter-session=lightdm-gtk-greeter
LIGHTDM_EOF

# Enable services
rc-update add lightdm default
rc-update add dbus default
rc-update add udev default

# Configure developer user desktop
sudo -u developer bash << 'DEVELOPER_SETUP'
cd /home/developer

# Create .xinitrc for XFCE
echo "exec startxfce4" > .xinitrc
chmod +x .xinitrc

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | sh

# Clone VibeStack (placeholder)
echo "Ready for VibeStack project setup!"
DEVELOPER_SETUP

echo "✅ VM setup complete!"
echo "🎉 Alpine Linux development environment ready!"
echo ""
echo "VM Features:"
echo "- Auto-login as 'developer' user"  
echo "- XFCE desktop environment"
echo "- Docker, Node.js, pnpm pre-installed"
echo "- Claude Code installed"
echo "- Port forwarding: SSH(2222), Web(5173), API(8787), DB(5432)"
echo ""
echo "Reboot to start desktop environment..."
reboot

REMOTE_SCRIPT

echo "🎊 VM setup complete! The VM will reboot into XFCE desktop."
echo "💡 Access: ssh -p 2222 developer@localhost"