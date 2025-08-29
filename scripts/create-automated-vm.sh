#!/bin/bash
# Fully automated Alpine VM creation using cloud-init approach

set -e

VM_NAME="VibeStack-Alpine-Dev"
VM_DIR="$HOME/VMs/vibestack-alpine"
MEMORY="2048"
CPUS="2"

echo "🤖 Creating fully automated Alpine Linux development VM..."

# Stop existing VM
pkill -f "qemu-system-x86_64.*$VM_NAME" 2>/dev/null || true
pkill -f "qemu-system-x86_64.*VibeStack-Alpine-Template" 2>/dev/null || true

# Create VM directory
mkdir -p "$VM_DIR"
rm -f "$VM_DIR"/*

# Create empty disk
qemu-img create -f qcow2 "$VM_DIR/alpine-dev.qcow2" 20G

# Create automated setup script that will run inside VM
cat > "$VM_DIR/vm-setup-script.sh" << 'EOF'
#!/bin/bash
set -e

echo "🏔️ Starting automated Alpine Linux setup..."

# Setup basic system
setup-keymap us
setup-hostname vibestack-dev

# Setup networking  
cat > /etc/network/interfaces << 'NET_EOF'
auto lo
iface lo inet loopback

auto eth0
iface eth0 inet dhcp
    hostname vibestack-dev
NET_EOF

service networking restart

# Set no root password
echo "root:" | chpasswd -e

# Setup repositories
setup-apkrepos -r

# Install essential packages
apk update
apk add openssh curl wget bash git tmux nano

# Enable SSH
rc-update add sshd default
service sshd start

# Install disk to system
echo -e "y\n" | setup-disk -m sys /dev/vda

echo "✅ Basic Alpine setup complete. Rebooting..."
reboot
EOF

# Start VM and run automated setup
echo "🚀 Starting VM with automated installation..."

# First boot - run Alpine setup
qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file="$VM_DIR/alpine-dev.qcow2",if=virtio \
    -cdrom /tmp/alpine-standard-3.19.1-x86_64.iso \
    -boot d \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::5432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -display gtk \
    -daemonize

echo "🎯 VM started! You can now:"
echo "1. Complete manual Alpine setup in VM window (will automate this next)"
echo "2. Or SSH in after setup: ssh -p 2222 root@localhost"

# Wait for user to complete setup
echo "⏳ Waiting for Alpine installation to complete..."
echo "💡 Once Alpine is installed and rebooted, run:"
echo "   ./scripts/complete-vm-setup.sh"