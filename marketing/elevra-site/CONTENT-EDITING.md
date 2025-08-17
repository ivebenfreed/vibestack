# Content Editing Guide for Elevra Site

## Quick Start

All site copy is centralized in two places for easy editing:

### 1. JavaScript Configuration (Recommended)
**File**: `src/config/site-content.js`

This is the easiest way to update copy. Just edit the text in the JavaScript object:

```javascript
hero: {
  headline: {
    line1: "Your New Headline",
    line2: "Goes Here"
  }
}
```

### 2. Markdown File
**File**: `src/content/site-copy.md`

Alternative format if you prefer markdown. Contains all the same content in markdown format.

## How to Update Content

### Changing Headlines
In `src/config/site-content.js`:
```javascript
hero: {
  headline: {
    line1: "Relationship Problems?",  // <- Edit this
    line2: "Meet",                    // <- Edit this
    highlight: "Elevra"                // <- Edit this
  }
}
```

### Updating Feature Cards
In `src/config/site-content.js`:
```javascript
benefits: {
  cards: [
    {
      icon: "🎯",                      // <- Change emoji
      title: "8 Smart Templates",      // <- Edit title
      description: "Your text here"    // <- Edit description
    }
  ]
}
```

### Modifying Comparison Table
In `src/config/site-content.js`:
```javascript
comparison: {
  features: [
    {
      feature: "Feature Name",          // <- Feature being compared
      elevra: "✓ What Elevra offers",  // <- Elevra's capability
      airtable: "✗ Airtable limit",    // <- Competitor comparison
      // etc...
    }
  ]
}
```

## Common Edits

### Change the Main Value Proposition
Edit these in `src/config/site-content.js`:
- `hero.headline` - The main attention-grabbing headline
- `hero.subheading` - Supporting text under the headline
- `metadata.description` - SEO description

### Update the 3-Step Process
Edit `howItWorks.steps` array:
```javascript
steps: [
  {
    number: "1",
    title: "Your Step Title",
    description: "What happens in this step",
    features: ["Feature 1", "Feature 2"]
  }
]
```

### Add/Remove Benefit Cards
Add or remove objects from the `benefits.cards` array:
```javascript
cards: [
  // Add new card
  {
    icon: "🌟",
    title: "New Feature",
    description: "What it does"
  }
]
```

## Color Scheme

The site uses a dark blue/teal color scheme defined in `src/assets/styles/global.css`:

```css
--primary: #0EA5E9;      /* Sky blue */
--primary-dark: #0284C7; /* Darker blue */
--accent: #10B981;       /* Emerald green */
--dark: #0F172A;         /* Dark navy */
```

## Testing Changes

1. Make your edits in `src/config/site-content.js`
2. Save the file
3. The dev server will auto-reload
4. View changes at `http://localhost:4321`

## Tips

- Keep headlines short and punchy
- Use emojis sparingly but effectively
- Focus on benefits, not features
- Use "you/your" language to speak directly to users
- Test on mobile - text should be readable on small screens

## Need Different Structure?

If you need to change the layout or add new sections, you'll need to edit the Astro components in `src/components/`. The content configuration only changes the text, not the structure.