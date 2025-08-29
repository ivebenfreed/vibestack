#!/bin/bash
# Configure Alpine Linux for auto-login without password prompts

set -e

echo "🔓 Configuring Alpine Linux auto-login..."

# Create developer user with no password
adduser -D -s /bin/bash developer
adduser developer wheel

# Allow developer to use sudo without password
echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Configure auto-login on console
# Edit /etc/inittab to auto-login developer on tty1
sed -i 's/tty1::respawn:\/sbin\/getty 38400 tty1/tty1::respawn:\/sbin\/agetty --autologin developer --noclear 38400 tty1 linux/' /etc/inittab

# For XFCE auto-login, configure LightDM
mkdir -p /etc/lightdm
cat > /etc/lightdm/lightdm.conf << 'EOF'
[Seat:*]
autologin-user=developer
autologin-user-timeout=0
greeter-session=lightdm-gtk-greeter
EOF

# Create .bash_profile for developer to auto-start XFCE
mkdir -p /home/developer
cat > /home/developer/.bash_profile << 'EOF'
# Auto-start XFCE if on tty1 and DISPLAY is not set
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx
fi
EOF

# Create .xinitrc for XFCE
cat > /home/developer/.xinitrc << 'EOF'
#!/bin/sh
exec startxfce4
EOF

# Make files executable
chmod +x /home/developer/.xinitrc
chown -R developer:developer /home/developer

# Enable services for auto-login
rc-update add dbus default

echo "✅ Auto-login configured!"
echo "💡 Developer user will auto-login and start XFCE"
echo "💡 No passwords required for sudo operations"