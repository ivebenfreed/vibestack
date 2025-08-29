#!/bin/bash
# Create Ubuntu development VM using VirtualBox (more reliable)

set -e

VM_NAME="VibeStack-Dev"
ISO_PATH="/tmp/ubuntu-24.04.1-live-server-amd64.iso"

echo "📦 Creating VirtualBox VM for development..."

# Stop KVM to avoid conflicts
sudo rmmod kvm_intel kvm 2>/dev/null || echo "KVM not loaded"

# Create VirtualBox VM
VBoxManage createvm --name "$VM_NAME" --ostype "Ubuntu_64" --register

# Configure VM
VBoxManage modifyvm "$VM_NAME" \
    --memory 4096 \
    --cpus 2 \
    --vram 32 \
    --graphicscontroller vmsvga \
    --audio-driver pulse \
    --audiocontroller hda

# Create and attach disk
VBoxManage createhd --filename "$HOME/VirtualBox VMs/$VM_NAME/$VM_NAME.vdi" --size 20480 --format VDI
VBoxManage storagectl "$VM_NAME" --name "SATA Controller" --add sata --controller IntelAhci
VBoxManage storageattach "$VM_NAME" --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium "$HOME/VirtualBox VMs/$VM_NAME/$VM_NAME.vdi"

# Add DVD drive for ISO
VBoxManage storagectl "$VM_NAME" --name "IDE Controller" --add ide
VBoxManage storageattach "$VM_NAME" --storagectl "IDE Controller" --port 1 --device 0 --type dvddrive --medium "$ISO_PATH"

# Configure network with port forwarding
VBoxManage modifyvm "$VM_NAME" \
    --natpf1 "SSH,tcp,,2222,,22" \
    --natpf1 "Web,tcp,,5173,,5173" \
    --natpf1 "API,tcp,,8787,,8787"

echo "🚀 Starting VirtualBox VM..."
VBoxManage startvm "$VM_NAME" --type gui

echo "✅ VirtualBox VM started!"
echo "📋 Install Ubuntu Server with these settings:"
echo "   Username: developer"
echo "   Password: developer"
echo "   Install OpenSSH server: YES"
echo ""
echo "After installation, run: ./scripts/setup-ubuntu-dev.sh"