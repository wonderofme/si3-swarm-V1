/**
 * Loops Email Service
 * Integrates with Loops email marketing platform
 */

const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_API_URL = 'https://app.loops.so/api/v1';

/**
 * Add user to Loops email newsletter
 * Called after successful Si Her onboarding and payment
 */
export async function addToLoopsNewsletter(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  source?: string;
  userGroup?: string; // e.g., 'si-her-member'
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!LOOPS_API_KEY) {
      console.warn('[Loops Email] LOOPS_API_KEY not configured, skipping email addition');
      return { success: false, error: 'Loops API key not configured' };
    }

    const response = await fetch(`${LOOPS_API_URL}/contacts/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOOPS_API_KEY}`
      },
      body: JSON.stringify({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        userId: data.userId,
        source: data.source || 'si-her-onboarding',
        userGroup: data.userGroup || 'si-her-member',
        subscribed: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Loops Email] API error:', errorText);
      
      // If user already exists, try to update instead
      if (response.status === 409) {
        return await updateLoopsContact(data);
      }
      
      return { success: false, error: `Loops API error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[Loops Email] Successfully added to newsletter:', data.email);
    return { success: true };
  } catch (error: any) {
    console.error('[Loops Email] Error adding to newsletter:', error);
    return { success: false, error: error.message || 'Failed to add to newsletter' };
  }
}

/**
 * Update existing Loops contact
 */
async function updateLoopsContact(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  userGroup?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${LOOPS_API_URL}/contacts/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOOPS_API_KEY}`
      },
      body: JSON.stringify({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        userId: data.userId,
        userGroup: data.userGroup || 'si-her-member',
        subscribed: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Loops Email] Update error:', errorText);
      return { success: false, error: `Loops API error: ${response.status}` };
    }

    console.log('[Loops Email] Successfully updated contact:', data.email);
    return { success: true };
  } catch (error: any) {
    console.error('[Loops Email] Error updating contact:', error);
    return { success: false, error: error.message || 'Failed to update contact' };
  }
}

