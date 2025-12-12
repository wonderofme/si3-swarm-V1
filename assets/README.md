# Kaia Avatar Assets

This directory contains the visual assets for Kaia's character representation.

## Profile Picture

- **File**: `kaia-avatar.png`
- **Recommended Dimensions**: 640x640 pixels (square)
- **Format**: PNG (with transparency) or JPG
- **Max File Size**: Under 300KB (optimized for web)

## Image Preparation Instructions

1. **Resize your image** to 640x640 pixels (square format)
2. **Optimize the file** to keep it under 300KB
3. **Save as PNG** (preferred for transparency) or JPG
4. **Place the file** in this `assets/` directory as `kaia-avatar.png`

## Alternative: Using a URL

If you prefer to host the image externally (CDN, GitHub, etc.), you can update `characters/kaia.character.json`:

```json
{
  "image": "https://your-domain.com/kaia-avatar.png"
}
```

## Notes

- The image will be automatically set as the bot's profile picture when the bot starts
- Telegram displays profile pictures as circles, so ensure important content is centered
- The circular frame in your illustration should work perfectly with Telegram's circular avatar display

