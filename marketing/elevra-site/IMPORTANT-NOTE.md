# IMPORTANT: Template System Status

## Current State

The site has TWO content systems set up:

1. **Config files for easy editing** (NOT ACTIVE YET):
   - `src/config/site-content.js` - JavaScript config with all copy
   - `src/content/site-copy.md` - Markdown version of the copy
   - `src/components/ContentSection.astro` - Template component

2. **Hardcoded content in components** (CURRENTLY ACTIVE):
   - All Astro components have the text hardcoded directly
   - This is what you see on the site right now

## Why Two Systems?

We set up the config files to make future editing easier, but the components haven't been refactored to use them yet. 

## To Edit Content NOW:

Edit the actual component files directly:
- `src/components/HeroSection.astro`
- `src/components/PainPointsSection.astro`
- `src/components/FeaturesSection.astro`
- `src/components/ComparisonSection.astro`

## To Activate the Template System:

The components would need to be refactored to import and use the config:

```javascript
---
import siteContent from '../config/site-content.js';
const { hero } = siteContent;
---

<h1>{hero.headline.line1}</h1>
```

This refactoring hasn't been done yet. The config files are ready but not connected.