# Commands to run after Alpine Linux installation

## 1. Enable SSH and create development user
```bash
# Login as root with password: developer
apk update
apk add openssh bash curl wget

# Enable SSH
rc-update add sshd default
service sshd start

# Create developer user
adduser -s /bin/bash developer
adduser developer wheel
echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
```

## 2. Transfer setup scripts from host
```bash
# On your host machine, copy scripts to VM:
scp -P 2222 scripts/alpine-vm-setup.sh scripts/claude-code-install.sh scripts/alpine-desktop-setup.sh developer@localhost:~/

# In VM, make executable:
chmod +x ~/alpine-vm-setup.sh ~/claude-code-install.sh ~/alpine-desktop-setup.sh

# Run setup scripts:
sudo ./alpine-vm-setup.sh
./claude-code-install.sh  
./alpine-desktop-setup.sh xfce
```

## 3. Clone VibeStack project
```bash
cd ~
git clone https://github.com/your-repo/vibestack.git
cd vibestack
pnpm install
```