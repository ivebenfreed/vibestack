# ✏️ Edit Site Content Here

## Quick Start

**ALL site content is in ONE file:**
### 📄 `src/content/site-content.json`

Just edit the text in that JSON file and save - the site updates automatically!

## What's Currently Using the Template

✅ **Hero Section** - Fully templated
✅ **Final CTA** - Fully templated  
✅ **Page Metadata** - Fully templated

⚠️ **Still hardcoded** (not using template yet):
- Pain Points section
- Features section  
- Comparison table
- Footer

## How to Edit

### Change the main headline:
```json
"headline": {
  "line1": "Relationship Problems?",  // <- Edit this
  "line2": "Meet",                    // <- Edit this
  "highlight": "Elevra"                // <- Edit this
}
```

### Change the subheading:
```json
"subheading": {
  "words": ["Custom", "tables", "that", "match", "your", "business", "perfectly."],
  "accent": "real database relationships",  // <- The highlighted part
  "suffix": "that actually work."          // <- After the highlight
}
```

### Change the badges:
```json
"badges": [
  { "icon": "⚡", "text": "Instant Tables" },     // <- Edit icon or text
  { "icon": "🚀", "text": "Lightning Fast" },
  { "icon": "🔄", "text": "Always Synced" }
]
```

### Change the CTA:
```json
"cta": {
  "title": "Finally, Tables That Match Your Business",
  "subtitle": "Early access to custom data tables with real database power",
  "privacy": "We'll never spam. Unsubscribe anytime."
}
```

## To Convert Other Sections

The other sections (Pain Points, Features, Comparison) can be converted to use the JSON template too. They already have content defined in the JSON, but the components need to be updated to use it.

## Benefits of This System

1. **One file to edit** - All content in `site-content.json`
2. **No code changes** - Just edit text strings
3. **Instant updates** - Save and see changes immediately
4. **Easy to maintain** - Clear structure, easy to find what to change
5. **Version control friendly** - Track all copy changes in git

## Testing Changes

1. Edit `src/content/site-content.json`
2. Save the file
3. View at http://localhost:4321 (auto-reloads)