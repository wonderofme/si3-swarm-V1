/**
 * Service for setting the Telegram bot's profile picture
 * Uses Telegram Bot API's setChatPhoto method
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sets the bot's profile picture from a local file or URL
 * @param botToken - Telegram bot token
 * @param imagePath - Path to image file (local) or URL
 * @param isUrl - Whether imagePath is a URL (default: false)
 */
export async function setBotProfilePicture(
  botToken: string,
  imagePath: string,
  isUrl: boolean = false
): Promise<void> {
  try {
    const Telegraf = (await import('telegraf')).Telegraf;
    const bot = new Telegraf(botToken);

    let photoSource: any;

    if (isUrl) {
      // If it's a URL, use it directly
      photoSource = imagePath;
    } else {
      // If it's a local file, read it
      const absolutePath = imagePath.startsWith('/') 
        ? imagePath 
        : join(__dirname, '..', '..', imagePath);
      
      console.log(`[Bot Profile Picture] Reading image from: ${absolutePath}`);
      const imageBuffer = await readFile(absolutePath);
      photoSource = { source: imageBuffer };
    }

    // Get bot info
    const botInfo = await bot.telegram.getMe();
    console.log(`[Bot Profile Picture] Setting profile picture for bot: ${botInfo.username} (ID: ${botInfo.id})`);
    
    // Note: setChatPhoto can only be used to set a group/supergroup/channel photo
    // For setting a bot's own profile picture, you need to use BotFather or set it manually
    // However, we'll try using the bot's user ID - if this fails, the user will need to set it via BotFather
    // The bot's chat ID for its own profile is typically the bot's user ID
    const botChatId = botInfo.id;
    
    try {
      // Attempt to set the profile picture
      // This may fail if the bot doesn't have permission - in that case, set it manually via BotFather
      await bot.telegram.setChatPhoto(botChatId, photoSource);
    } catch (error: any) {
      // If setChatPhoto fails (common for bot profile pictures), provide helpful instructions
      if (error.response?.error_code === 400 || error.response?.error_code === 403) {
        console.warn('[Bot Profile Picture] ⚠️ Could not set profile picture programmatically.');
        console.warn('[Bot Profile Picture] This is normal - bot profile pictures must be set via BotFather.');
        console.warn('[Bot Profile Picture] Instructions:');
        console.warn('[Bot Profile Picture] 1. Open BotFather on Telegram');
        console.warn('[Bot Profile Picture] 2. Send /setuserpic');
        console.warn('[Bot Profile Picture] 3. Select your bot');
        console.warn(`[Bot Profile Picture] 4. Upload the image from: ${imagePath}`);
        throw new Error('Bot profile pictures must be set via BotFather. See console for instructions.');
      }
      throw error;
    }
    
    console.log(`[Bot Profile Picture] ✅ Successfully set profile picture from ${isUrl ? 'URL' : 'file'}: ${imagePath}`);
  } catch (error: any) {
    console.error('[Bot Profile Picture] ❌ Error setting profile picture:', error);
    
    if (error.response) {
      console.error('[Bot Profile Picture] Telegram API error:', error.response.description);
      console.error('[Bot Profile Picture] Error code:', error.response.error_code);
    }
    
    throw error;
  }
}

/**
 * Sets the bot's profile picture from the character's image field
 * @param botToken - Telegram bot token
 * @param characterImage - Image URL or path from character JSON
 */
export async function setProfilePictureFromCharacter(
  botToken: string,
  characterImage: string
): Promise<void> {
  const isUrl = characterImage.startsWith('http://') || characterImage.startsWith('https://');
  await setBotProfilePicture(botToken, characterImage, isUrl);
}

