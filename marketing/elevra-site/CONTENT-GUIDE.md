# 📝 Elevra Site Content Guide

## ✨ The Easy Way to Edit Content

All site content is now in **Markdown files** - just edit the text like you would in any document!

## 📁 Where Content Lives

```
src/content/
├── sections/       # Main page sections
│   ├── hero.md    # Hero section content
│   └── benefits.md # Benefits section
└── features/      # Feature cards
    ├── perfect-fit.md
    ├── customize.md
    ├── relationships.md
    └── lightning-fast.md
```

## 🎯 How to Edit Content

### 1. Edit the Hero Section

Open `src/content/sections/hero.md`:

```markdown
---
title: "Hero Section"
order: 1
---

# Relationship Problems?
# Meet **Elevra**

Custom tables that match your business perfectly.
```

Just change the text! The `#` symbols control heading sizes.

### 2. Edit Feature Cards

Open any file in `src/content/features/`:

```markdown
---
title: "Perfect-Fit Tables"
icon: "🎯"
order: 1
---

Your description text goes here...
```

- Change the `title` to update the card heading
- Change the `icon` to any emoji
- Edit the content below the `---` for the description

### 3. Add New Features

Create a new file like `src/content/features/new-feature.md`:

```markdown
---
title: "Your New Feature"
icon: "🌟"
order: 5
---

Description of your awesome new feature...
```

## 🎨 Formatting Options

In the markdown content, you can use:

- **Bold text** with `**text**`
- *Italic text* with `*text*`
- [Links](url) with `[text](url)`
- Lists with `-` or `1.`
- Headers with `#`, `##`, `###`

## 🚀 Benefits of This System

1. **No Code Knowledge Needed** - Just edit markdown files
2. **Version Control** - Git tracks all content changes
3. **Preview in VS Code** - Most editors show markdown preview
4. **Type Safety** - Astro validates your frontmatter
5. **Hot Reload** - See changes instantly in browser

## 📋 Quick Reference

### Frontmatter Fields

Each markdown file has frontmatter (the part between `---`):

- `title`: The display title
- `subtitle`: Optional subtitle text
- `order`: Number to control display order
- `icon`: Emoji icon (for feature cards)
- `enabled`: true/false to show/hide sections

### Common Edits

**Change main headline:**
Edit `src/content/sections/hero.md`

**Update feature cards:**
Edit files in `src/content/features/`

**Reorder features:**
Change the `order` number in frontmatter

**Hide a section:**
Set `enabled: false` in frontmatter

## 💡 Tips

- Use VS Code with markdown preview (Cmd/Ctrl + Shift + V)
- Keep descriptions concise and punchy
- Use emojis sparingly but effectively
- Test on mobile after making changes

## 🔄 Workflow

1. Open the `.md` file you want to edit
2. Change the content
3. Save the file
4. Browser auto-refreshes with your changes
5. Commit to git when happy

That's it! No build process, no complex configs - just edit and save.