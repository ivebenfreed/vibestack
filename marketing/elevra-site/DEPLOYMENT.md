# Elevra Site Deployment Guide

## Option 1: Cloudflare Workers (Recommended)

### Prerequisites
1. Cloudflare account with getelevra.com domain configured
2. Cloudflare API token with permissions:
   - Workers:Edit
   - Zone:Read
   - Account:Read

### Deploy Steps

1. **Set API Token:**
   ```bash
   export CLOUDFLARE_API_TOKEN="your_api_token_here"
   ```

2. **Deploy to production:**
   ```bash
   npx wrangler deploy --env production
   ```

3. **Deploy to staging:**
   ```bash
   npx wrangler deploy --env staging
   ```

### Domain Setup
The following routes are configured in `wrangler.toml`:
- **Production**: getelevra.com, www.getelevra.com
- **Staging**: dev.getelevra.com

## Option 2: Cloudflare Pages

### Steps
1. Go to Cloudflare Dashboard → Pages
2. Create new project from Git repository
3. Connect this repository
4. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `marketing/elevra-site`

5. Configure custom domain: getelevra.com

## Manual Deployment (Alternative)

If automated deployment fails:

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Upload dist/ folder** to Cloudflare Workers via dashboard
3. **Configure routes** for getelevra.com in the dashboard

## Environment Variables

Set these in Cloudflare Dashboard → Workers → Settings → Variables:

- `ENVIRONMENT`: "production" or "staging"
- `RESEND_API_KEY`: (if using email functionality)

## Verification

After deployment, verify:
- [ ] https://getelevra.com loads correctly
- [ ] Lead capture form works
- [ ] All pages render properly
- [ ] Performance is optimal

## Rollback

If issues occur:
```bash
npx wrangler rollback --env production
```

## Support

- Site structure follows Astro + Cloudflare Workers pattern
- All build errors have been resolved
- Local development tested and working