# Cloudflare Tunnel Setup for Polar Webhook Testing

## Installation

Download and install cloudflared:

```bash
# Download the latest release
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install (requires sudo)
sudo dpkg -i cloudflared.deb

# Or install via snap
sudo snap install cloudflared
```

## Quick Tunnel Setup (No Account Required)

For development testing, you can use a quick tunnel without authentication:

```bash
# Start a tunnel to your local development server
cloudflared tunnel --url http://localhost:8787
```

This will output a temporary URL like: `https://abc123.trycloudflare.com`

## Configured Tunnel Setup (Recommended for Persistent Testing)

### 1. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

### 2. Create a Tunnel

```bash
# Create a named tunnel
cloudflared tunnel create vibestack-polar-webhooks

# This will create a tunnel ID and credentials file
```

### 3. Configure the Tunnel

Create a configuration file at `~/.cloudflared/config.yml`:

```yaml
tunnel: vibestack-polar-webhooks
credentials-file: /home/user/.cloudflared/tunnel-id.json

ingress:
  - hostname: vibestack-webhooks.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

### 4. Create DNS Record

```bash
# Point your domain to the tunnel
cloudflared tunnel route dns vibestack-polar-webhooks vibestack-webhooks.yourdomain.com
```

### 5. Start the Tunnel

```bash
cloudflared tunnel run vibestack-polar-webhooks
```

## For Polar Webhook Testing

### Quick Development Setup

1. Start your development server:
```bash
pnpm dev:server
```

2. In another terminal, start the tunnel:
```bash
cloudflared tunnel --url http://localhost:8787
```

3. Copy the generated URL (e.g., `https://abc123.trycloudflare.com`)

4. Configure Polar webhook endpoint:
   - Go to your Polar organization settings
   - Set webhook URL to: `https://abc123.trycloudflare.com/api/polar/webhooks`
   - Set webhook secret in your `.env.local` file

### Testing the Setup

1. Create a test webhook endpoint:
```bash
curl -X POST https://abc123.trycloudflare.com/api/polar/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: test" \
  -d '{"type": "test", "data": {}}'
```

2. Check your server logs for webhook reception

## Environment Variables for Polar

Add to your `.env.local`:

```env
# Polar billing configuration (sandbox)
POLAR_ACCESS_TOKEN=polar_sandbox_your_actual_token_here
POLAR_WEBHOOK_SECRET=whsec_your_actual_secret_here
POLAR_ENVIRONMENT=sandbox
POLAR_WEBHOOK_URL=https://your-tunnel-url.trycloudflare.com/api/polar/webhooks
```

## Security Notes

- Quick tunnels (`--url`) are temporary and change on each restart
- For production, use a configured tunnel with your own domain
- Always use HTTPS for webhook endpoints
- Verify webhook signatures in your handler
- Use sandbox environment for testing