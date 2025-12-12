# Setting Up Kaia's Profile Picture

This guide explains how to set the Kaia illustration as the bot's profile picture on Telegram.

## Overview

The Kaia character illustration you have is perfect for a Telegram bot avatar! The circular frame in your design will work beautifully with Telegram's circular avatar display.

## Image Preparation

### Step 1: Prepare Your Image

1. **Resize to 640x640 pixels** (square format)
   - Use an image editor (Photoshop, GIMP, Canva, etc.)
   - Ensure the image is exactly square (1:1 aspect ratio)
   - The circular frame in your illustration should be centered

2. **Optimize the file**
   - Keep file size under 300KB for fast loading
   - Use PNG format (supports transparency) or JPG
   - Compress if needed using tools like TinyPNG or ImageOptim

3. **Save the file**
   - Name it: `kaia-avatar.png` (or `.jpg`)
   - Place it in the `assets/` directory

### Step 2: Update Character Configuration

The character JSON already has the image field configured:
```json
{
  "image": "./assets/kaia-avatar.png"
}
```

If you're hosting the image externally (CDN, GitHub, etc.), you can use a URL instead:
```json
{
  "image": "https://your-domain.com/kaia-avatar.png"
}
```

## Setting the Profile Picture

### Option 1: Via BotFather (Recommended)

Telegram bots can only set their own profile pictures through BotFather:

1. **Open BotFather** on Telegram (`@BotFather`)
2. **Send the command**: `/setuserpic`
3. **Select your bot** (KaiaSwarmBot)
4. **Upload your image** (`assets/kaia-avatar.png`)
5. **Done!** The profile picture will be set immediately

### Option 2: Programmatic (Limited Support)

The code includes a service (`src/services/botProfilePicture.ts`) that attempts to set the profile picture automatically when the bot starts. However, Telegram's API has limitations:

- `setChatPhoto` only works for groups/channels where the bot is an admin
- Bot profile pictures typically require BotFather
- The service will log helpful instructions if automatic setting fails

## Verification

After setting the profile picture:

1. **Check Telegram**: Open a chat with your bot and verify the avatar appears
2. **Check Bot Info**: The profile picture should show in the bot's info page
3. **Test in Groups**: If your bot is in groups, verify the avatar appears there too

## Troubleshooting

### Image Not Appearing
- Verify the image file exists at the specified path
- Check file permissions (readable)
- Ensure the image is a valid PNG/JPG format
- Verify file size is under Telegram's limits

### BotFather Method Not Working
- Make sure you're using the correct bot token
- Verify you're the bot's owner/creator
- Try uploading a smaller file (< 100KB)
- Check that the image is square (1:1 aspect ratio)

### Programmatic Method Failing
- This is expected - bot profile pictures usually require BotFather
- Check the console logs for specific error messages
- The service will provide instructions if it fails

## Design Tips

Since Telegram displays avatars as circles:

✅ **Do:**
- Keep important elements (face, logo) centered
- Use the circular frame in your design (perfect for Telegram!)
- Ensure good contrast for visibility at small sizes
- Test how it looks at 64x64 and 128x128 pixels

❌ **Avoid:**
- Important details near the edges
- Text that might be cut off
- Low contrast colors
- Very fine details that won't show at small sizes

## Your Illustration

Based on the description of your Kaia illustration:
- ✅ Already has a circular frame - perfect!
- ✅ Bold, contrasting colors - great for visibility
- ✅ Centered character - ideal for circular display
- ✅ "SI<3>" logo visible - brand recognition maintained

The illustration should work beautifully as a Telegram bot avatar!

