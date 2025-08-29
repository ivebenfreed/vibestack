# Alpine Linux Development VM Template Setup Guide

## Step-by-Step VM Creation

### 1. Download Alpine Linux
- Get Alpine Standard x86_64 ISO: https://alpinelinux.org/downloads/
- ~150MB download

### 2. Create VirtualBox VM
```
Name: VibeStack-Alpine-Template
Type: Linux
Version: Other Linux (64-bit)
Memory: 2048 MB (2GB)
Hard disk: 20GB VDI (dynamically allocated)
```

### 3. VM Settings
```
System → Processor: 2 CPUs
Network → Adapter 1: NAT (port forwarding later)
Storage → Add ISO to optical drive
```

### 4. Install Alpine Linux
1. Boot from ISO
2. Login as `root` (no password)
3. Run setup: `setup-alpine`
   - Keyboard: `us`
   - Hostname: `vibestack-dev`
   - Network: `dhcp`
   - Root password: `developer`
   - Timezone: your timezone
   - Disk: `sda` → `sys`

### 5. Post-Install Setup
After reboot, login as root and run:

```bash
# Copy our setup scripts to VM
# (Transfer via shared folder or wget from GitHub)

chmod +x alpine-vm-setup.sh claude-code-install.sh alpine-desktop-setup.sh

# Run core setup
./alpine-vm-setup.sh

# Switch to developer user
su - developer

# Install Claude Code
./claude-code-install.sh

# Optional: Install desktop environment
./alpine-desktop-setup.sh minimal  # or xfce, i3wm
```

### 6. VibeStack Project Setup
```bash
cd /home/developer/workspace
git clone https://github.com/your-repo/vibestack.git
cd vibestack
pnpm install
```

### 7. Configure Port Forwarding
In VirtualBox VM settings → Network → Advanced → Port Forwarding:
```
Name: SSH     | Host: 2222 | Guest: 22   | TCP
Name: Web     | Host: 5173 | Guest: 5173 | TCP  
Name: API     | Host: 8787 | Guest: 8787 | TCP
Name: DB      | Host: 5432 | Guest: 5432 | TCP
```

### 8. Create VM Template
1. Shutdown VM cleanly: `sudo poweroff`
2. In VirtualBox: Right-click VM → Clone
3. Name: `VibeStack-Golden-Master`
4. Clone type: `Full clone`
5. Snapshots: `Everything`

## Using the Template

### Create New Development Environment
```bash
# In VirtualBox
1. Right-click "VibeStack-Golden-Master" → Clone
2. Name: "VibeStack-Issue-123"
3. Generate new MAC addresses: ✓
4. Start the cloned VM

# Inside VM
cd /home/developer/workspace/vibestack
git worktree add worktrees/issue-123 -b issue-123
cd worktrees/issue-123
PR_NUMBER=123 ./scripts/setup-pr-env.sh
```

### Export/Share Template
```bash
# Export OVA file
VirtualBox → File → Export Appliance
Select: VibeStack-Golden-Master
Format: OVA
Save as: vibestack-dev-template.ova
```

## Window Management Options

### Terminal-Only (Default)
- **SSH from host**: `ssh -p 2222 developer@localhost`
- **tmux sessions**: Multiple terminal windows
- **VS Code Remote**: Code from host machine

### Minimal Desktop (OpenBox)
- **Ultra-light**: ~50MB RAM usage
- **Right-click menu**: Terminal, browser, file manager
- **Start**: `startx` after login

### Full Desktop (XFCE)
- **Traditional desktop**: Taskbar, menus, window decorations
- **Applications**: File manager, text editor, terminal
- **Auto-start**: Boots directly to desktop

## Resource Usage

| Configuration | RAM Usage | Disk Space | Boot Time |
|---------------|-----------|------------|-----------|
| Terminal Only | ~256MB    | ~2GB       | 15s       |
| Minimal (OpenBox) | ~300MB | ~2.2GB     | 20s       |
| XFCE Desktop | ~400MB    | ~2.5GB     | 25s       |

## Benefits

✅ **Instant environments**: Boot VM = ready to code
✅ **Perfect isolation**: Each issue gets own VM  
✅ **Team sharing**: Distribute OVA template
✅ **No setup time**: Claude Code + VibeStack pre-installed
✅ **Lightweight**: 10x smaller than Ubuntu VMs
✅ **Fast cloning**: 2GB VMs clone in seconds