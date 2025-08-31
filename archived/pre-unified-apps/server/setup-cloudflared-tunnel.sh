#!/bin/bash

echo "🚀 Setting up cloudflared tunnel for Polar webhook development..."
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 cloudflared not found. Installing..."
    
    # Download and install cloudflared
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "🐧 Installing for Linux..."
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍎 Installing for macOS..."
        brew install cloudflared
    else
        echo "❌ Unsupported OS. Please install cloudflared manually from:"
        echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/"
        exit 1
    fi
else
    echo "✅ cloudflared is already installed"
fi

echo "📋 cloudflared version: $(cloudflared --version)"
echo ""

# Check if user is logged in
echo "🔐 Checking Cloudflare authentication..."
if ! cloudflared tunnel list &> /dev/null; then
    echo "🔑 Please log in to Cloudflare first:"
    echo "   Running: cloudflared tunnel login"
    echo ""
    cloudflared tunnel login
    echo ""
fi

# Create tunnel for VibeStack development
TUNNEL_NAME="vibestack-dev"
echo "🔗 Setting up tunnel: $TUNNEL_NAME"

# Check if tunnel already exists
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "✅ Tunnel '$TUNNEL_NAME' already exists"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    echo "🆕 Creating new tunnel: $TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP 'Created tunnel \K[a-f0-9-]+')
    echo "✅ Created tunnel with ID: $TUNNEL_ID"
fi

echo "🔍 Tunnel ID: $TUNNEL_ID"

# Create cloudflared config file
CONFIG_FILE="$HOME/.cloudflared/config.yml"
echo "📝 Creating tunnel configuration at $CONFIG_FILE..."

mkdir -p "$HOME/.cloudflared"

cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  # Route codevibesmatter.com to local development server
  - hostname: codevibesmatter.com
    service: http://localhost:8787
    originRequest:
      httpHostHeader: codevibesmatter.com
  
  # Route www.codevibesmatter.com to local development server  
  - hostname: www.codevibesmatter.com
    service: http://localhost:8787
    originRequest:
      httpHostHeader: www.codevibesmatter.com
      
  # Route webhooks subdomain (if needed)
  - hostname: webhooks.codevibesmatter.com  
    service: http://localhost:8787
    originRequest:
      httpHostHeader: webhooks.codevibesmatter.com
  
  # Catch-all rule (required)
  - service: http_status:404

EOF

echo "✅ Configuration created"
echo ""

# Show the config
echo "📋 Tunnel configuration:"
cat "$CONFIG_FILE"
echo ""

# Instructions for DNS setup
echo "🌐 DNS Configuration Required:"
echo ""
echo "   You need to add these DNS records in your Cloudflare dashboard:"
echo "   1. codevibesmatter.com -> CNAME -> $TUNNEL_ID.cfargotunnel.com"
echo "   2. www.codevibesmatter.com -> CNAME -> $TUNNEL_ID.cfargotunnel.com"
echo "   3. webhooks.codevibesmatter.com -> CNAME -> $TUNNEL_ID.cfargotunnel.com"
echo ""
echo "   Or run this command to set them up automatically:"
echo "   cloudflared tunnel route dns $TUNNEL_NAME codevibesmatter.com"
echo "   cloudflared tunnel route dns $TUNNEL_NAME www.codevibesmatter.com"  
echo "   cloudflared tunnel route dns $TUNNEL_NAME webhooks.codevibesmatter.com"
echo ""

# Ask if user wants to set up DNS automatically
read -p "🤖 Set up DNS records automatically? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Setting up DNS records..."
    cloudflared tunnel route dns "$TUNNEL_NAME" codevibesmatter.com
    cloudflared tunnel route dns "$TUNNEL_NAME" www.codevibesmatter.com
    cloudflared tunnel route dns "$TUNNEL_NAME" webhooks.codevibesmatter.com
    echo "✅ DNS records configured"
else
    echo "⚠️  Please set up DNS records manually in your Cloudflare dashboard"
fi

echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Start your local development server:"
echo "   pnpm dev"
echo ""
echo "2. In another terminal, start the tunnel:"
echo "   cloudflared tunnel run $TUNNEL_NAME"
echo ""  
echo "3. Test the webhook endpoint:"
echo "   curl https://codevibesmatter.com/api/polar/health"
echo ""
echo "4. Your Polar webhook is already configured to use:"
echo "   https://codevibesmatter.com/api/polar/webhooks"
echo ""
echo "✅ Setup complete! Your local server will be accessible via codevibesmatter.com"