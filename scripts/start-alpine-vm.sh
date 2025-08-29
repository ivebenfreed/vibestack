#!/bin/bash
# Start the Alpine VM after installation

VM_NAME="VibeStack-Alpine-Dev"  
VM_DIR="$HOME/VMs/vibestack-alpine"
MEMORY="2048"
CPUS="2"

if [[ ! -f "$VM_DIR/alpine.qcow2" ]]; then
    echo "❌ VM disk not found. Run ./scripts/fixed-alpine-setup.sh first"
    exit 1
fi

echo "🚀 Starting Alpine VM..."
echo "SSH: ssh -p 2222 developer@localhost"
echo "Web: http://localhost:5173"

qemu-system-x86_64 \
    -name "$VM_NAME" \
    -machine pc \
    -cpu qemu64 \
    -smp $CPUS \
    -m $MEMORY \
    -drive file="$VM_DIR/alpine.qcow2",if=ide \
    -boot c \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::5173-:5173,hostfwd=tcp::8787-:8787,hostfwd=tcp::15432-:5432 \
    -device rtl8139,netdev=net0 \
    -vga cirrus \
    -display sdl \
    -usb -device usb-tablet