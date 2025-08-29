#!/bin/bash
# Fixed Alpine Linux VM Setup - Step by step approach
# Run this manually for better debugging

set -e

VM_NAME="VibeStack-Alpine-Dev"
VM_DIR="$HOME/VMs/vibestack-alpine"
DISK_SIZE="20G"
MEMORY="2048"
CPUS="2"
ISO_PATH="/tmp/alpine-standard-3.19.1-x86_64.iso"

echo "🏔️ Fixed Alpine Linux VM Setup"
echo "VM Directory: $VM_DIR"

# Check prerequisites
if ! command -v qemu-system-x86_64 &> /dev/null; then
    echo "❌ QEMU not found. Install with: sudo dnf install qemu-kvm qemu-system-x86"
    exit 1
fi

if [[ ! -f "$ISO_PATH" ]]; then
    echo "❌ Alpine ISO not found at $ISO_PATH"
    echo "Download from: https://alpinelinux.org/downloads/"
    exit 1
fi

# Kill any existing VM
pkill -f "qemu-system-x86_64.*$VM_NAME" 2>/dev/null || true

# Create VM directory
mkdir -p "$VM_DIR"

# Create disk image
if [[ ! -f "$VM_DIR/alpine.qcow2" ]]; then
    echo "💿 Creating disk image..."
    qemu-img create -f qcow2 "$VM_DIR/alpine.qcow2" "$DISK_SIZE"
fi

# Create Alpine setup answer file
echo "📝 Creating setup answer file..."
cat > "$VM_DIR/answers.txt" << 'EOF'
us
us
vibestack-dev
eth0
dhcp
n


8.8.8.8 8.8.4.4
UTC
1
y
openssh
chrony
sda
sys
developer
developer
developer
developer
y
EOF

echo ""
echo "🚀 Starting VM for manual setup..."
echo ""
echo "SETUP STEPS TO FOLLOW:"
echo "1. Boot and login as 'root' (no password)"
echo "2. Run: setup-alpine"
echo "3. Use these answers (or press Enter for defaults):"
echo "   - Keyboard: us"
echo "   - Variant: us" 
echo "   - Hostname: vibestack-dev"
echo "   - Interface: eth0"
echo "   - IP address: dhcp"
echo "   - Manual config: n"
echo "   - Root password: developer"
echo "   - Timezone: UTC"
echo "   - Proxy: none (Enter)"
echo "   - Mirror: 1 (fastest)"
echo "   - SSH: openssh"  
echo "   - NTP: chrony"
echo "   - Disk: sda"
echo "   - Usage: sys"
echo "   - Erase disk: y"
echo "4. After reboot, login as root and run the post-install script"
echo ""
echo "Starting VM in 5 seconds... (Ctrl+C to cancel)"
sleep 5

# Start VM for installation
qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file="$VM_DIR/alpine.qcow2",if=virtio \
    -cdrom "$ISO_PATH" \
    -boot d \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::15432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -display gtk

echo ""
echo "VM has shutdown. Next steps:"
echo "1. Run: ./scripts/alpine-post-install.sh"
echo "2. Or start the VM again with: ./scripts/start-alpine-vm.sh"