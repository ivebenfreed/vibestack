#!/bin/bash
# Script to transfer setup files to the Alpine VM after installation

set -e

VM_USER="root"
VM_HOST="localhost"
VM_PORT="2222"

echo "🚀 Transferring setup scripts to Alpine VM..."

# Wait for SSH to be available
echo "⏳ Waiting for SSH service..."
until nc -z localhost 2222; do
    echo "Waiting for SSH on port 2222..."
    sleep 2
done

echo "📁 Creating scripts directory on VM..."
ssh -o StrictHostKeyChecking=no -p $VM_PORT $VM_USER@$VM_HOST "mkdir -p /tmp/setup"

echo "📤 Transferring setup scripts..."
scp -o StrictHostKeyChecking=no -P $VM_PORT \
    scripts/alpine-vm-setup.sh \
    scripts/claude-code-install.sh \
    scripts/alpine-desktop-setup.sh \
    scripts/alpine-autologin-setup.sh \
    $VM_USER@$VM_HOST:/tmp/setup/

echo "🔧 Making scripts executable..."
ssh -o StrictHostKeyChecking=no -p $VM_PORT $VM_USER@$VM_HOST \
    "chmod +x /tmp/setup/*.sh"

echo "✅ Scripts transferred successfully!"
echo ""
echo "🔗 SSH into VM: ssh -p 2222 root@localhost"
echo "📁 Scripts location: /tmp/setup/"
echo ""
echo "Next steps:"
echo "1. Complete Alpine installation in VM window"
echo "2. SSH into VM and run: /tmp/setup/alpine-vm-setup.sh"
echo "3. Run: /tmp/setup/alpine-desktop-setup.sh xfce"