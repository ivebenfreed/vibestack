#!/bin/bash

# VibeStack Development Tunnel Manager
# Manages cloudflared tunnel for local development with codevibesmatter.com

TUNNEL_NAME="vibestack-dev"
TUNNEL_ID="9caf1167-d6ce-4422-9db1-e5ab8fbbe32c"
LOCAL_SERVER="http://localhost:8787"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if cloudflared is installed
check_cloudflared() {
    if ! command -v cloudflared &> /dev/null; then
        print_error "cloudflared not installed. Run setup-cloudflared-tunnel.sh first"
        exit 1
    fi
}

# Check if tunnel exists and credentials are valid
check_tunnel() {
    if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        print_error "Tunnel '$TUNNEL_NAME' not found. Run setup-cloudflared-tunnel.sh first"
        exit 1
    fi
    
    CREDENTIALS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"
    if [ ! -f "$CREDENTIALS_FILE" ]; then
        print_error "Tunnel credentials not found at $CREDENTIALS_FILE"
        exit 1
    fi
    
    print_success "Tunnel '$TUNNEL_NAME' exists and credentials are valid"
}

# Check if local server is running
check_local_server() {
    print_status "Checking if local server is running on port 8787..."
    
    if curl -s "$LOCAL_SERVER/api/health" > /dev/null 2>&1; then
        print_success "Local server is running at $LOCAL_SERVER"
        return 0
    else
        print_warning "Local server not responding at $LOCAL_SERVER"
        print_status "Make sure to start your development server with: pnpm dev"
        return 1
    fi
}

# Start the tunnel
start_tunnel() {
    print_status "Starting cloudflared tunnel: $TUNNEL_NAME"
    
    # Check if tunnel is already running
    if pgrep -f "cloudflared.*$TUNNEL_NAME" > /dev/null; then
        print_warning "Tunnel is already running"
        show_status
        return 0
    fi
    
    # Start tunnel in background
    nohup cloudflared tunnel run "$TUNNEL_NAME" > /tmp/cloudflared-$TUNNEL_NAME.log 2>&1 &
    TUNNEL_PID=$!
    
    # Wait a moment for startup
    sleep 2
    
    # Check if it started successfully
    if pgrep -f "cloudflared.*$TUNNEL_NAME" > /dev/null; then
        print_success "Tunnel started successfully (PID: $TUNNEL_PID)"
        print_status "Log file: /tmp/cloudflared-$TUNNEL_NAME.log"
        
        # Test the endpoints
        test_endpoints
    else
        print_error "Failed to start tunnel. Check log: /tmp/cloudflared-$TUNNEL_NAME.log"
        tail -10 /tmp/cloudflared-$TUNNEL_NAME.log
    fi
}

# Stop the tunnel
stop_tunnel() {
    print_status "Stopping cloudflared tunnel: $TUNNEL_NAME"
    
    PIDS=$(pgrep -f "cloudflared.*$TUNNEL_NAME")
    if [ -z "$PIDS" ]; then
        print_warning "No tunnel processes found"
        return 0
    fi
    
    for PID in $PIDS; do
        kill $PID
        print_success "Stopped tunnel process (PID: $PID)"
    done
    
    # Clean up log file
    rm -f /tmp/cloudflared-$TUNNEL_NAME.log
}

# Show tunnel status
show_status() {
    print_status "Tunnel Status for: $TUNNEL_NAME"
    echo ""
    
    # Check if tunnel process is running
    if pgrep -f "cloudflared.*$TUNNEL_NAME" > /dev/null; then
        TUNNEL_PID=$(pgrep -f "cloudflared.*$TUNNEL_NAME")
        print_success "Tunnel is RUNNING (PID: $TUNNEL_PID)"
    else
        print_warning "Tunnel is STOPPED"
    fi
    
    # Check local server
    check_local_server
    
    echo ""
    print_status "Available endpoints:"
    echo "   🌐 Main site: https://codevibesmatter.com"
    echo "   🌐 WWW: https://www.codevibesmatter.com"  
    echo "   🪝 Webhooks: https://webhooks.codevibesmatter.com"
    echo "   📡 Polar webhook: https://codevibesmatter.com/api/polar/webhooks"
    echo ""
}

# Test the webhook endpoints
test_endpoints() {
    print_status "Testing endpoints..."
    sleep 3  # Give tunnel time to fully start
    
    # Test health endpoint
    if curl -s --max-time 10 "https://codevibesmatter.com/api/health" > /dev/null 2>&1; then
        print_success "Main endpoint working: https://codevibesmatter.com/api/health"
    else
        print_warning "Main endpoint not responding (tunnel may still be starting up)"
    fi
    
    # Test Polar webhook health
    if curl -s --max-time 10 "https://codevibesmatter.com/api/polar/health" > /dev/null 2>&1; then
        print_success "Polar webhook endpoint working: https://codevibesmatter.com/api/polar/health"
    else
        print_warning "Polar webhook endpoint not responding"
    fi
}

# Show logs
show_logs() {
    LOG_FILE="/tmp/cloudflared-$TUNNEL_NAME.log"
    if [ -f "$LOG_FILE" ]; then
        print_status "Showing tunnel logs (last 20 lines):"
        tail -20 "$LOG_FILE"
    else
        print_warning "No log file found at $LOG_FILE"
    fi
}

# Main script logic
case "$1" in
    start)
        check_cloudflared
        check_tunnel
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    restart)
        stop_tunnel
        sleep 2
        check_cloudflared
        check_tunnel  
        start_tunnel
        ;;
    status)
        check_cloudflared
        check_tunnel
        show_status
        ;;
    test)
        test_endpoints
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "VibeStack Development Tunnel Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|test|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the tunnel (connects codevibesmatter.com to localhost:8787)"
        echo "  stop    - Stop the tunnel"
        echo "  restart - Restart the tunnel"  
        echo "  status  - Show tunnel and server status"
        echo "  test    - Test webhook endpoints"
        echo "  logs    - Show recent tunnel logs"
        echo ""
        echo "🌐 When running, your local server will be accessible at:"
        echo "   https://codevibesmatter.com"
        echo "   https://codevibesmatter.com/api/polar/webhooks (Polar webhook endpoint)"
        echo ""
        exit 1
        ;;
esac