/**
 * Form Integration Service
 * Handles submissions to Fibery forms and other external services
 * 
 * Fibery API Documentation: https://fibery.io/features/api
 * Authentication: Token-based (not Bearer)
 * Endpoint: https://{account}.fibery.io/api/commands
 */

const FIBERY_ACCOUNT = process.env.FIBERY_ACCOUNT || 'si3.fibery.io';
const FIBERY_API_KEY = process.env.FIBERY_API_KEY || '';
const FIBERY_API_URL = `https://${FIBERY_ACCOUNT}/api/commands`;

/**
 * Submit Si Her Guide onboarding form to Fibery
 * Form URL: https://si3.fibery.io/Si_Her_Guide_CRM/Si-Her-Guide-Onboarding-Form-480
 * 
 * Creates a new entity in the Si Her Guide CRM workspace
 */
export async function submitSiHerForm(data: {
  name: string;
  email: string;
  walletAddress?: string;
  userId?: string;
  [key: string]: any;
}): Promise<{ success: boolean; formId?: string; error?: string }> {
  try {
    if (!FIBERY_API_KEY) {
      console.warn('[Form Integration] FIBERY_API_KEY not configured, skipping form submission');
      return { success: false, error: 'Fibery API key not configured' };
    }

    // Fibery API uses commands to create/update entities
    // Entity type: "Si Her Guide Onboarding Form" or similar (adjust based on your Fibery schema)
    const command = {
      command: 'entity.create',
      type: 'Si Her Guide Onboarding Form', // Adjust to match your Fibery entity type name
      entity: {
        'Name': data.name,
        'Email': data.email,
        'Wallet Address': data.walletAddress || '',
        'User ID': data.userId || '',
        'Submitted At': new Date().toISOString(),
        // Include any additional fields from data
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => 
            !['name', 'email', 'walletAddress', 'userId'].includes(key.toLowerCase())
          )
        )
      }
    };

    const response = await fetch(FIBERY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${FIBERY_API_KEY}` // Fibery uses Token, not Bearer
      },
      body: JSON.stringify([command]) // Fibery commands API expects an array
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Form Integration] Fibery API error:', errorText);
      return { success: false, error: `Fibery API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    // Fibery returns an array of results, one per command
    const entityId = result[0]?.id || result[0]?.entity?.id;
    return { success: true, formId: entityId || 'submitted' };
  } catch (error: any) {
    console.error('[Form Integration] Error submitting Si Her form:', error);
    return { success: false, error: error.message || 'Failed to submit form' };
  }
}

/**
 * Submit Grow3dge inquiry form to Fibery
 * Creates a new entity in the Grow3dge workspace
 */
export async function submitGrow3dgeForm(data: {
  name: string;
  companyName: string;
  companyEmail: string;
  role: string;
  interest: string;
  details: string;
  userId?: string;
}): Promise<{ success: boolean; formId?: string; error?: string }> {
  try {
    if (!FIBERY_API_KEY) {
      console.warn('[Form Integration] FIBERY_API_KEY not configured, skipping form submission');
      return { success: false, error: 'Fibery API key not configured' };
    }

    const command = {
      command: 'entity.create',
      type: 'Grow3dge Inquiry Form', // Adjust to match your Fibery entity type name
      entity: {
        'Name': data.name,
        'Company Name': data.companyName,
        'Company Email': data.companyEmail,
        'Role': data.role,
        'Interest': data.interest,
        'Details': data.details,
        'User ID': data.userId || '',
        'Submitted At': new Date().toISOString()
      }
    };

    const response = await fetch(FIBERY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${FIBERY_API_KEY}`
      },
      body: JSON.stringify([command])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Form Integration] Fibery API error:', errorText);
      return { success: false, error: `Fibery API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    const entityId = result[0]?.id || result[0]?.entity?.id;
    return { success: true, formId: entityId || 'submitted' };
  } catch (error: any) {
    console.error('[Form Integration] Error submitting Grow3dge form:', error);
    return { success: false, error: error.message || 'Failed to submit form' };
  }
}

/**
 * Submit Well-Being inquiry form to Fibery
 * Uses same fields as Grow3dge form
 * Creates a new entity in the Well-Being workspace
 */
export async function submitWellBeingForm(data: {
  name: string;
  companyName: string;
  companyEmail: string;
  role: string;
  interest: string;
  details: string;
  userId?: string;
}): Promise<{ success: boolean; formId?: string; error?: string }> {
  try {
    if (!FIBERY_API_KEY) {
      console.warn('[Form Integration] FIBERY_API_KEY not configured, skipping form submission');
      return { success: false, error: 'Fibery API key not configured' };
    }

    const command = {
      command: 'entity.create',
      type: 'Well-Being Inquiry Form', // Adjust to match your Fibery entity type name
      entity: {
        'Name': data.name,
        'Company Name': data.companyName,
        'Company Email': data.companyEmail,
        'Role': data.role,
        'Interest': data.interest,
        'Details': data.details,
        'User ID': data.userId || '',
        'Submitted At': new Date().toISOString()
      }
    };

    const response = await fetch(FIBERY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${FIBERY_API_KEY}`
      },
      body: JSON.stringify([command])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Form Integration] Fibery API error:', errorText);
      return { success: false, error: `Fibery API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    const entityId = result[0]?.id || result[0]?.entity?.id;
    return { success: true, formId: entityId || 'submitted' };
  } catch (error: any) {
    console.error('[Form Integration] Error submitting Well-Being form:', error);
    return { success: false, error: error.message || 'Failed to submit form' };
  }
}

/**
 * Alternative: Use Fibery webhook if API is not available
 * This can be called from the frontend or backend
 */
export async function submitToFiberyWebhook(webhookUrl: string, data: any): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Form Integration] Webhook error:', errorText);
      return { success: false, error: `Webhook error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Form Integration] Error calling webhook:', error);
    return { success: false, error: error.message || 'Failed to call webhook' };
  }
}

