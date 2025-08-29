#!/bin/bash
# Create Ubuntu VM with UEFI boot for better compatibility

set -e

VM_NAME="VibeStack-Ubuntu-Dev"
VM_DIR="$HOME/VMs/vibestack-ubuntu"
MEMORY="4096"
CPUS="2"

echo "🐧 Creating Ubuntu VM with UEFI boot (fixes kernel issues)..."

# Stop existing VM
pkill -f qemu-system-x86_64 2>/dev/null || true

# Recreate VM directory
mkdir -p "$VM_DIR"
rm -f "$VM_DIR/ubuntu-dev.qcow2"

# Create disk
qemu-img create -f qcow2 "$VM_DIR/ubuntu-dev.qcow2" 25G

echo "🚀 Starting Ubuntu VM with UEFI..."

# Start with UEFI firmware (fixes boot issues)
qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc,accel=kvm \
    -cpu host \
    -smp $CPUS \
    -m $MEMORY \
    -drive file="$VM_DIR/ubuntu-dev.qcow2",if=virtio \
    -drive if=pflash,format=raw,readonly=on,file=/usr/share/ovmf/OVMF_CODE.fd \
    -drive if=pflash,format=raw,file="$VM_DIR/OVMF_VARS.fd" \
    -cdrom /tmp/ubuntu-24.04.1-live-server-amd64.iso \
    -boot d \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::5432-:5432 \
    -device virtio-net,netdev=net0 \
    -vga virtio \
    -display gtk \
    -daemonize

echo "✅ Ubuntu VM with UEFI started!"
echo "💡 This should fix the kernel installation issue"