/**
 * Telegram Group Service
 * Handles Telegram group invitations for Si Her members
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SI_HER_TELEGRAM_GROUP_ID = process.env.SI_HER_TELEGRAM_GROUP_ID || '';
const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Send Telegram group invitation link to user
 * Note: Telegram Bot API doesn't support direct group invitations via API
 * Instead, we generate an invite link that can be sent to the user
 */
export async function generateTelegramGroupInvite(): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  try {
    if (!TELEGRAM_BOT_TOKEN || !SI_HER_TELEGRAM_GROUP_ID) {
      console.warn('[Telegram Group] Bot token or group ID not configured');
      return { success: false, error: 'Telegram configuration missing' };
    }

    // Create invite link using Telegram Bot API
    const response = await fetch(`${TELEGRAM_API_URL}${TELEGRAM_BOT_TOKEN}/createChatInviteLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: SI_HER_TELEGRAM_GROUP_ID,
        name: 'Si Her Guide Member',
        creates_join_request: false, // Direct join (set to true if approval needed)
        expire_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        member_limit: 1 // Single use link
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Telegram Group] API error:', errorText);
      return { success: false, error: `Telegram API error: ${response.status}` };
    }

    const result = await response.json();
    const inviteLink = result.result?.invite_link;
    
    if (!inviteLink) {
      return { success: false, error: 'Failed to generate invite link' };
    }

    console.log('[Telegram Group] Generated invite link');
    return { success: true, inviteLink };
  } catch (error: any) {
    console.error('[Telegram Group] Error generating invite:', error);
    return { success: false, error: error.message || 'Failed to generate invite link' };
  }
}

/**
 * Get permanent invite link for Si Her group
 * This can be configured as an environment variable for easier access
 */
export function getSiHerTelegramInviteLink(): string | null {
  const permanentLink = process.env.SI_HER_TELEGRAM_INVITE_LINK;
  if (permanentLink) {
    return permanentLink;
  }
  return null;
}

/**
 * Send invite link via email or return it for frontend to display
 * Since we can't send Telegram messages to users who haven't started the bot,
 * we return the link to be displayed in the UI or sent via email
 */
export async function getTelegramGroupInviteForUser(userId: string, email?: string): Promise<{
  success: boolean;
  inviteLink?: string;
  message?: string;
  error?: string;
}> {
  try {
    // Try to get permanent link first
    const permanentLink = getSiHerTelegramInviteLink();
    if (permanentLink) {
      return {
        success: true,
        inviteLink: permanentLink,
        message: 'Join the Si Her Guide Telegram group using this link!'
      };
    }

    // Otherwise generate a new invite link
    const result = await generateTelegramGroupInvite();
    if (result.success && result.inviteLink) {
      return {
        success: true,
        inviteLink: result.inviteLink,
        message: 'Join the Si Her Guide Telegram group using this link!'
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to get invite link'
    };
  } catch (error: any) {
    console.error('[Telegram Group] Error getting invite for user:', error);
    return {
      success: false,
      error: error.message || 'Failed to get invite link'
    };
  }
}

