# Elevra Marketing Site

A modern, high-performance landing page for Elevra built with Astro and deployed on Cloudflare Workers.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Add your Resend API key to .env
   ```

3. **Start development server:**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   # or
   pnpm build
   ```

## 🌟 Features

- **Astro Framework**: Fast, modern static site generator
- **Cloudflare Workers**: Serverless deployment with edge performance
- **React Components**: Interactive lead capture form
- **Email Integration**: Automated lead notifications via Resend
- **Responsive Design**: Mobile-first, accessible interface
- **Performance Optimized**: Minimal JavaScript, fast loading

## 📁 Project Structure

```
src/
├── assets/styles/     # Global CSS styles
├── components/        # Reusable Astro and React components
├── layouts/          # Page layouts
├── pages/            # Routes and API endpoints
│   ├── api/         # Serverless API functions
│   └── index.astro  # Homepage
└── env.d.ts         # TypeScript environment definitions
```

## 🔧 Configuration

### Environment Variables

- `RESEND_API_KEY`: API key for Resend email service
- `ENVIRONMENT`: Current environment (development/staging/production)
- `PUBLIC_SITE_URL`: Site URL (auto-detected in most cases)

### Deployment

The site is configured for Cloudflare Workers deployment with:

- **Production**: elevra.com
- **Staging**: dev.elevra.com
- **Preview**: Automatic preview deployments for PRs

## 📧 Email Setup

The site uses Resend for:
- Lead capture notifications to your team
- Welcome emails to new leads

Configure your Resend API key and update email addresses in `src/pages/api/leads.ts`.

## 🎨 Customization

- **Colors**: Update CSS custom properties in `src/assets/styles/global.css`
- **Content**: Modify components in `src/components/`
- **Layout**: Update base layout in `src/layouts/BaseLayout.astro`

## 🚀 Deployment

1. **Configure Cloudflare:**
   - Update `wrangler.toml` with your domain
   - Set environment variables in Cloudflare dashboard

2. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

## 📊 Analytics

The site is ready for analytics integration. Add your tracking code to `BaseLayout.astro`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.