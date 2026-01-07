/**
 * SI U Name Service
 * Handles SI U name validation and claiming
 * TODO: Replace with actual SI U API calls when available
 */

import { findSiuUserBySiuName, isSiuNameAvailable } from './siuDatabaseService.js';

export interface SiuNameValidationResult {
  valid: boolean;
  formatted: string | null;
  error?: string;
}

export interface SiuNameClaimResult {
  success: boolean;
  siuName?: string;
  error?: string;
}

/**
 * Validate and format SI U name
 * Rules:
 * - Alphanumeric only (a-z, 0-9)
 * - 3-20 characters (before .siu)
 * - Case-insensitive
 * - Auto-adds .siu suffix
 */
export function validateSiuName(name: string): SiuNameValidationResult {
  // Remove @ and .siu if present
  let cleaned = name.trim()
    .replace('@', '')
    .replace('.siu', '')
    .toLowerCase();
  
  // Check for empty
  if (!cleaned) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U name cannot be empty' 
    };
  }

  // Validate: alphanumeric only
  if (!/^[a-z0-9]+$/.test(cleaned)) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U names can only contain letters and numbers (e.g., yourname.siu)' 
    };
  }
  
  // Length check
  if (cleaned.length < 3) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U name must be at least 3 characters' 
    };
  }
  
  if (cleaned.length > 20) {
    return { 
      valid: false, 
      formatted: null, 
      error: 'SI U name must be 20 characters or less' 
    };
  }
  
  // Format with .siu suffix
  return { 
    valid: true, 
    formatted: cleaned + '.siu' 
  };
}

/**
 * Check if SI U name is available
 * First checks local database, then can call SI U API
 */
export async function checkSiuNameAvailability(name: string): Promise<{
  available: boolean;
  message?: string;
}> {
  // Validate format first
  const validation = validateSiuName(name);
  if (!validation.valid) {
    return { 
      available: false, 
      message: validation.error 
    };
  }

  const formattedName = validation.formatted!;

  try {
    // Check local database first
    const isAvailable = await isSiuNameAvailable(formattedName);
    
    if (!isAvailable) {
      return { 
        available: false, 
        message: 'This SI U name is already taken. Please choose another.' 
      };
    }

    // TODO: Call SI U API to check availability
    // const response = await fetch(`${SIU_API_URL}/names/check?name=${formattedName}`);
    // const data = await response.json();
    // if (!data.available) {
    //   return { available: false, message: 'This SI U name is already taken.' };
    // }

    return { 
      available: true, 
      message: 'Name available!' 
    };
  } catch (error: any) {
    console.error('[SI U Name Service] Error checking availability:', error);
    // On error, assume available (optimistic) - actual claim will verify
    return { 
      available: true, 
      message: 'Unable to verify availability. Will check during claim.' 
    };
  }
}

/**
 * Claim SI U name
 * TODO: Implement actual SI U API call when available
 */
export async function claimSiuName(
  walletAddress: string | undefined,
  name: string
): Promise<SiuNameClaimResult> {
  // Validate format
  const validation = validateSiuName(name);
  if (!validation.valid) {
    return { 
      success: false, 
      error: validation.error 
    };
  }

  const formattedName = validation.formatted!;

  try {
    // Check availability
    const availability = await checkSiuNameAvailability(formattedName);
    if (!availability.available) {
      return { 
        success: false, 
        error: availability.message 
      };
    }

    // TODO: Call SI U API to claim name
    // if (walletAddress) {
    //   const response = await fetch(`${SIU_API_URL}/names/claim`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ walletAddress, name: formattedName })
    //   });
    //   
    //   if (!response.ok) {
    //     const data = await response.json();
    //     return { success: false, error: data.message || 'Failed to claim name' };
    //   }
    // }

    // For now, just return success (name will be saved to database on completion)
    return { 
      success: true, 
      siuName: formattedName 
    };
  } catch (error: any) {
    console.error('[SI U Name Service] Error claiming name:', error);
    return { 
      success: false, 
      error: 'Failed to claim SI U name. Please try again.' 
    };
  }
}

/**
 * Validate wallet address format
 * Ethereum: 0x + 40 hex characters
 */
export function validateWalletAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address) {
    return { valid: false, error: 'Wallet address is required' };
  }

  const trimmed = address.trim();

  // Check for 0x prefix
  if (!trimmed.startsWith('0x')) {
    return { valid: false, error: 'Wallet address must start with 0x' };
  }

  // Check length (0x + 40 chars = 42)
  if (trimmed.length !== 42) {
    return { valid: false, error: 'Wallet address must be 42 characters (0x + 40 hex chars)' };
  }

  // Check for valid hex characters
  if (!/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
    return { valid: false, error: 'Wallet address contains invalid characters' };
  }

  return { valid: true };
}

