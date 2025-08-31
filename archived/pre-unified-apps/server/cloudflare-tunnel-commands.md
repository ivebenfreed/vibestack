# Cloudflare Tunnel Setup Commands

Since you've authorized the zone, here are the exact commands to set up the tunnel:

## 1. Authenticate (if not done already)
```bash
./cloudflared-extract/usr/bin/cloudflared tunnel login
```
Visit the URL shown and authorize the `codevibesmatter.com` zone.

## 2. Create the webhook tunnel
```bash
./cloudflared-extract/usr/bin/cloudflared tunnel create webhooks-vibestack
```

## 3. Create DNS record for the subdomain
```bash
./cloudflared-extract/usr/bin/cloudflared tunnel route dns webhooks-vibestack webhooks.codevibesmatter.com
```

## 4. Run the tunnel
```bash
./cloudflared-extract/usr/bin/cloudflared tunnel run --url http://localhost:8787 webhooks-vibestack
```

## 5. Test the webhook endpoint
```bash
curl -X GET https://webhooks.codevibesmatter.com/api/polar/health
```

## Configuration for Polar Dashboard
- **Webhook URL**: `https://webhooks.codevibesmatter.com/api/polar/webhooks`
- **Webhook Secret**: `whsec_8a643f4687a03292bfdc86310af19f6d2ba505c434df83f859648635246095ac`
- **Organization**: elevra (31d0a084-9f39-4f3c-bce5-bd0041ebec1c)

## Events to Select in Polar
- customer.created
- subscription.created  
- subscription.updated
- subscription.cancelled
- subscription.ended
- payment.succeeded
- payment.failed
- invoice.created
- invoice.updated

## Run as Background Service (optional)
To keep the tunnel running persistently:
```bash
./cloudflared-extract/usr/bin/cloudflared tunnel run --url http://localhost:8787 webhooks-vibestack &
```

Once the tunnel is running, the webhook endpoint will be stable and accessible at `https://webhooks.codevibesmatter.com/api/polar/webhooks`.