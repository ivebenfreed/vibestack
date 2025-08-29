#!/bin/bash
# Optional Desktop Environment Setup for Alpine Linux VM
# Choose your preference: minimal, xfce, or i3wm

set -e

DESKTOP_TYPE=${1:-"minimal"}

case $DESKTOP_TYPE in
    "minimal")
        echo "🪟 Installing minimal window management (OpenBox)..."
        apk add \
            xorg-server \
            xinit \
            openbox \
            xterm \
            chromium \
            thunar \
            firefox
        
        # Basic OpenBox config
        mkdir -p ~/.config/openbox
        cat > ~/.config/openbox/menu.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu>
  <menu id="root-menu" label="Openbox 3">
    <item label="Terminal"><action name="Execute"><execute>xterm</execute></action></item>
    <item label="Chromium"><action name="Execute"><execute>chromium</execute></action></item>
    <item label="File Manager"><action name="Execute"><execute>thunar</execute></action></item>
    <separator />
    <item label="Exit"><action name="Exit"></action></item>
  </menu>
</openbox_menu>
EOF
        
        echo "startx" >> ~/.bashrc
        ;;
        
    "xfce")
        echo "🖥️ Installing XFCE Desktop Environment..."
        apk add \
            xfce4 \
            xfce4-terminal \
            xfce4-screensaver \
            lightdm \
            chromium \
            firefox
        
        rc-update add lightdm default
        echo "exec startxfce4" > ~/.xinitrc
        ;;
        
    "i3wm")
        echo "🗂️ Installing i3 Window Manager..."
        apk add \
            i3wm \
            i3status \
            dmenu \
            xterm \
            chromium
        
        echo "exec i3" > ~/.xinitrc
        ;;
        
    *)
        echo "❌ Invalid desktop type. Choose: minimal, xfce, or i3wm"
        exit 1
        ;;
esac

echo "✅ Desktop environment ($DESKTOP_TYPE) installed!"
echo "💡 Use 'startx' to start the desktop environment"