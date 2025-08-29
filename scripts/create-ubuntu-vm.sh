#!/bin/bash
# Create Ubuntu Server VM with automated setup

set -e

VM_NAME="VibeStack-Ubuntu-Dev"
VM_DIR="$HOME/VMs/vibestack-ubuntu"
MEMORY="4096"
CPUS="2"

echo "🐧 Creating Ubuntu Server development VM..."

# Stop any existing VMs
pkill -f qemu-system-x86_64 2>/dev/null || true

# Create VM directory
mkdir -p "$VM_DIR"
rm -rf "$VM_DIR"/*

# Create 25GB disk for Ubuntu
qemu-img create -f qcow2 "$VM_DIR/ubuntu-dev.qcow2" 25G

echo "🚀 Starting Ubuntu VM..."
echo "💡 Use the GUI installer with these settings:"
echo "   - Username: developer"
echo "   - Password: developer"
echo "   - Install OpenSSH server: YES"
echo "   - Minimal installation: YES"

# Start VM with Ubuntu installer
qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file="$VM_DIR/ubuntu-dev.qcow2",if=virtio \
    -cdrom /tmp/ubuntu-24.04.1-live-server-amd64.iso \
    -boot d \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::5432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -display gtk \
    -daemonize

echo "✅ Ubuntu VM started!"
echo "📋 Installation checklist:"
echo "  1. Select 'Try or Install Ubuntu Server'"
echo "  2. Choose language (English)"
echo "  3. Choose keyboard layout"
echo "  4. Network config: accept defaults (DHCP)"
echo "  5. Proxy: leave blank"
echo "  6. Mirror: accept default"
echo "  7. Storage: Use entire disk"
echo "  8. Profile setup:"
echo "     - Name: Developer"
echo "     - Server name: vibestack-dev"
echo "     - Username: developer"  
echo "     - Password: developer"
echo "  9. SSH: Install OpenSSH server ✓"
echo " 10. Snaps: Skip all"
echo " 11. Install and reboot"
echo ""
echo "After installation, run: ./scripts/setup-ubuntu-dev.sh"