# PWA Icon Generation Guide

## Overview

The OurBlock PWA requires two icon sizes:
- **192x192px** - Standard app icon
- **512x512px** - High-resolution icon for splash screens

## Current Status

📝 **Placeholders created** - You need to replace these with actual designs

## Design Requirements

### Brand Guidelines
- **Primary Color:** #4a90e2 (Blue)
- **Background:** White (#ffffff)
- **Style:** Modern, friendly, community-focused
- **Elements:** Consider incorporating:
  - House/building icon (neighborhood theme)
  - Connected nodes/network (decentralized theme)
  - People/community symbols

### Technical Requirements
- **Format:** PNG with transparency
- **Aspect Ratio:** 1:1 (square)
- **Safe Zone:** Keep important elements 10% away from edges
- **Background:** Can be transparent or solid color

## Generation Options

### Option 1: Online Tools (Easiest)
1. Use https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 base image
3. Generate all required sizes automatically

### Option 2: Design Tools
**Figma:**
1. Create 512x512 artboard
2. Design icon with safe zone guides
3. Export as PNG at 1x and 0.375x (192px)

**Canva:**
1. Use "Custom Size" → 512x512px
2. Design using templates or from scratch
3. Download as PNG
4. Resize copy to 192x192 in Canva or external tool

**Adobe Illustrator/Photoshop:**
1. Create at vector resolution or 512x512px
2. Export PNG at both sizes

### Option 3: AI Generation
**Midjourney/DALL-E:**
- Prompt: "Modern app icon for neighborhood community app, blue and white, minimalist, connected houses, 512x512px"
- Download and resize as needed

## File Placement

Place generated files here:
```
ui/public/
├── icon-192.png (192x192px)
└── icon-512.png (512x512px)
```

## Verification

After adding icons:
1. Build the UI: `npm run build`
2. Serve: `npx serve dist`
3. Open Chrome DevTools → Application → Manifest
4. Verify icons appear correctly
5. Test install prompt

## Current Placeholders

The current placeholder icons are:
- Simple blue square with "OB" text
- Temporary solution until real icons are designed

**Action Required:** Replace `icon-192.png` and `icon-512.png` with professional designs before production launch.

## Additional Sizes (Optional)

For best experience across all devices, consider:
- 72x72px - Android home screen
- 96x96px - Android launcher
- 128x128px - Progressive web app
- 144x144px - Android Chrome
- 152x152px - iOS Safari
- 384x384px - Android splash screen
- 512x512px - iOS splash screen

Use PWA Builder's image generator for automatic creation of all sizes.
