#!/bin/bash
# Fully automated Alpine Linux VM creation and setup

set -e

VM_NAME="VibeStack-Alpine-Template"
VM_DIR="$HOME/VMs/vibestack-alpine"
DISK_SIZE="20G"
MEMORY="2048"
CPUS="2"

echo "🏔️ Creating fully automated Alpine Linux development VM..."

# Kill any existing VM
pkill -f "qemu-system-x86_64.*$VM_NAME" 2>/dev/null || true

# Create VM directory
mkdir -p "$VM_DIR"

# Create disk image
echo "💿 Creating disk image..."
qemu-img create -f qcow2 "$VM_DIR/vibestack-alpine.qcow2" "$DISK_SIZE"

# Create automated installation answer file
echo "📝 Creating installation answer file..."
cat > "$VM_DIR/answerfile" << 'EOF'
KEYMAPOPTS="us us"
HOSTNAMEOPTS="-n vibestack-dev"
INTERFACESOPTS="auto lo
iface lo inet loopback

auto eth0
iface eth0 inet dhcp
    hostname vibestack-dev
"
DNSOPTS="-d local 8.8.8.8"
TIMEZONEOPTS="-z UTC"
PROXYOPTS="none"
APKREPOSOPTS="-r"
SSHDOPTS="-c openssh"
NTPOPTS="-c chrony"
DISKOPTS="-m sys /dev/vda"
ROOTPASSWORD=""
USEROPTS="-a -u -g audio,video,netdev developer"
USERPASSWORD="developer"
EOF

# Create post-install setup script
echo "🔧 Creating post-install script..."
cat > "$VM_DIR/post-install.sh" << 'EOF'
#!/bin/bash
set -e

echo "🚀 Running post-install setup..."

# Update package index
apk update

# Install essential packages
apk add \
    curl wget bash git tmux nano htop \
    docker docker-compose docker-cli-compose \
    nodejs npm python3 make g++ linux-headers \
    postgresql-client chromium xvfb \
    build-base libc6-compat gcompat \
    openssh-client ca-certificates sudo shadow

# Install pnpm
npm install -g pnpm@9.15.1

# Configure Docker
rc-update add docker default
service docker start
addgroup developer docker

# Configure sudo for developer
echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install XFCE desktop
apk add \
    xfce4 xfce4-terminal xfce4-screensaver \
    lightdm lightdm-gtk-greeter \
    chromium firefox \
    dbus

# Configure auto-login for XFCE
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

# Create developer .xinitrc
su - developer -c 'echo "exec startxfce4" > ~/.xinitrc && chmod +x ~/.xinitrc'

# Install Claude Code
su - developer -c 'curl -fsSL https://claude.ai/install.sh | sh'

echo "✅ Post-install setup complete!"
EOF

chmod +x "$VM_DIR/post-install.sh"

# Start VM with automated installation
echo "🚀 Starting VM with automated installation..."
expect << EOF
spawn qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file=$VM_DIR/vibestack-alpine.qcow2,if=virtio \
    -cdrom /tmp/alpine-standard-3.19.1-x86_64.iso \
    -boot d \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::5432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -nographic

expect "login:"
send "root\r"

expect "#"
send "setup-alpine -f <(cat << 'SETUP_EOF'
KEYMAPOPTS=\"us us\"
HOSTNAMEOPTS=\"-n vibestack-dev\"
INTERFACESOPTS=\"auto lo
iface lo inet loopback

auto eth0
iface eth0 inet dhcp
    hostname vibestack-dev
\"
DNSOPTS=\"-d local 8.8.8.8\"
TIMEZONEOPTS=\"-z UTC\"
PROXYOPTS=\"none\"
APKREPOSOPTS=\"-r\"
SSHDOPTS=\"-c openssh\"
NTPOPTS=\"-c chrony\"
DISKOPTS=\"-m sys /dev/vda\"
SETUP_EOF
)\r"

expect "Installation is complete"
send "poweroff\r"
expect eof
EOF

echo "✅ Automated Alpine installation complete!"

# Restart VM for post-install setup
echo "🔄 Restarting VM for post-install setup..."
qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file=$VM_DIR/vibestack-alpine.qcow2,if=virtio \
    -boot c \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::5432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -display gtk \
    -daemonize

echo "🎉 VM is ready! Connect with: ssh -p 2222 developer@localhost"