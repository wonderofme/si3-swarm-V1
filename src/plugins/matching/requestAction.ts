/**
 * Match Request Actions
 * Handles requesting, approving, and rejecting match requests
 */

import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';
import { getUserProfile } from '../onboarding/utils.js';
import { findMatches } from '../../services/matchingEngine.js';
import { 
  createMatchRequest, 
  approveRequest, 
  rejectRequest, 
  cancelRequest,
  getPendingRequests 
} from '../../services/matchRequestService.js';

// Telegram notification helper
async function sendTelegramNotification(chatId: string | number, text: string): Promise<void> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    console.error('[Match Request] TELEGRAM_BOT_TOKEN not found');
    return;
  }
  
  try {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (error) {
    console.error('[Match Request] Error sending Telegram notification:', error);
  }
}

/**
 * Action to request a match with a user
 */
export const requestMatchAction: Action = {
  name: 'REQUEST_MATCH',
  description: 'Request a match with a specific user from the top matches list.',
  similes: ['REQUEST_CONNECTION', 'ASK_TO_CONNECT', 'SEND_MATCH_REQUEST'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content.text || '').toLowerCase();
    return text.includes('request match') || 
           text.includes('request with') ||
           text.match(/request\s+(match\s+)?(with\s+)?\d+/i) !== null ||
           text.match(/request\s+\d+/i) !== null;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const text = message.content.text || '';
    const userId = message.userId;
    const roomId = message.roomId;

    // Get user profile
    const myProfile = await getUserProfile(runtime, userId);
    if (!myProfile.isConfirmed) {
      if (callback) callback({ text: "I need to get to know you first! Let's finish onboarding." });
      return true;
    }

    // Parse request - could be "request match with Alice" or "request 1, 3, 5"
    const matchNumbers = text.match(/\d+/g);
    const nameMatch = text.match(/request\s+(?:match\s+)?(?:with\s+)?([a-zA-Z\s]+)/i);

    if (matchNumbers && matchNumbers.length > 0) {
      // Request by number(s) from top matches list
      const numbers = matchNumbers.map(n => parseInt(n) - 1); // Convert to 0-based index
      
      // Get top matches
      const matches = await findMatches(runtime, userId, myProfile);
      if (matches.length === 0) {
        if (callback) callback({ text: "No matches found. Try saying 'find matches' first!" });
        return true;
      }

      const results: string[] = [];
      for (const num of numbers) {
        if (num < 0 || num >= matches.length) {
          results.push(`Invalid match number ${num + 1}. Please use numbers 1-${matches.length}.`);
          continue;
        }

        const match = matches[num];
        const matchProfile = match.profile;

        // Check if already has pending request
        if (match.hasPendingRequest) {
          results.push(`${matchProfile.name || 'This user'}: You already have a pending request.`);
          continue;
        }

        // Create request
        const result = await createMatchRequest(
          runtime,
          userId,
          match.userId,
          match.score,
          match.reason || match.icebreaker || 'Match request'
        );

        if (result.success && result.requestId) {
          // Check if this was auto-approved (bidirectional match)
          // If bidirectional, the request was auto-approved, so check if match was created
          // We can check by seeing if the request still exists as pending
          const { getPendingRequests } = await import('../../services/matchRequestService.js');
          const pendingRequests = await getPendingRequests(runtime, userId, 'sent');
          const wasAutoApproved = !pendingRequests.find(r => r.id === result.requestId);
          
          if (wasAutoApproved) {
            results.push(`🎉 Mutual interest detected! You're now connected with ${matchProfile.name || 'this user'}!`);
            // Send mutual match notification to both users
            await sendMutualMatchNotification(runtime, userId, match.userId, matchProfile);
          } else {
            results.push(`✅ Match request sent to ${matchProfile.name || 'this user'}! They'll be notified.`);
            // Send notification to requested user
            await sendMatchRequestNotification(
              runtime, 
              userId, 
              match.userId, 
              matchProfile, 
              match.score, 
              match.reason || match.icebreaker || 'Match request'
            );
          }
        } else {
          // Check if error indicates bidirectional match (already matched)
          if (result.error?.includes('already matched') || result.error?.includes('Mutual interest')) {
            results.push(`🎉 Mutual interest detected! You're now connected with ${matchProfile.name || 'this user'}!`);
            await sendMutualMatchNotification(runtime, userId, match.userId, matchProfile);
          } else {
            results.push(`${matchProfile.name || 'This user'}: ${result.error || 'Failed to send request'}`);
          }
        }
      }

      if (callback) callback({ text: results.join('\n\n') });
      return true;
    } else if (nameMatch) {
      // Request by name - would need to search matches first
      // For now, suggest using numbers
      if (callback) callback({ text: "To request a match, first say 'find matches' to see your top matches, then reply with 'request 1' or 'request 1, 3, 5' for multiple." });
      return true;
    } else {
      if (callback) callback({ text: "To request a match, first say 'find matches' to see your top matches, then reply with 'request 1' or 'request 1, 3, 5' for multiple." });
      return true;
    }
  },
  examples: []
};

/**
 * Action to approve a match request
 */
export const approveMatchRequestAction: Action = {
  name: 'APPROVE_MATCH_REQUEST',
  description: 'Approve a pending match request from another user.',
  similes: ['ACCEPT_MATCH', 'APPROVE_CONNECTION', 'ACCEPT_REQUEST'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content.text || '').toLowerCase();
    return text.includes('approve') && text.includes('request') ||
           text.includes('accept') && text.includes('request') ||
           text.includes('approve match') ||
           text.includes('accept match');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;
    const roomId = message.roomId;

    // Get pending requests for this user
    const pendingRequests = await getPendingRequests(runtime, userId, 'received');
    
    if (pendingRequests.length === 0) {
      if (callback) callback({ text: "You don't have any pending match requests." });
      return true;
    }

    // Try to parse which request to approve
    const text = (message.content.text || '').toLowerCase();
    const nameMatch = text.match(/(?:approve|accept)\s+(?:request\s+)?(?:from\s+)?([a-zA-Z\s]+)/i);
    
    if (nameMatch && pendingRequests.length > 1) {
      // Multiple requests - need to specify which one
      const requesterName = nameMatch[1].trim();
      const request = pendingRequests.find(r => {
        // Would need to fetch requester profile to match name
        // For now, approve first one if name matches
        return true; // Simplified
      });
      
      if (request) {
        const result = await approveRequest(runtime, request.id, userId);
        if (result.success) {
          // Get requester profile for notification
          const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
          await sendMatchApprovalNotification(runtime, userId, request.requesterId, requesterProfile);
          
          if (callback) callback({ text: `✅ You've approved the match request from ${requesterProfile.name || 'this user'}! You're now connected. 🎉` });
        } else {
          if (callback) callback({ text: `Failed to approve request: ${result.error}` });
        }
        return true;
      }
    }

    // Approve first pending request (if only one)
    if (pendingRequests.length === 1) {
      const request = pendingRequests[0];
      const result = await approveRequest(runtime, request.id, userId);
      
      if (result.success) {
        // Get requester profile for notification
        const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
        await sendMatchApprovalNotification(runtime, userId, request.requesterId, requesterProfile);
        
        if (callback) callback({ text: `✅ You've approved the match request from ${requesterProfile.name || 'this user'}! You're now connected. 🎉` });
      } else {
        if (callback) callback({ text: `Failed to approve request: ${result.error}` });
      }
      return true;
    }

    // Multiple requests - show list
    let responseText = `You have ${pendingRequests.length} pending match requests:\n\n`;
    for (let i = 0; i < pendingRequests.length; i++) {
      const request = pendingRequests[i];
      const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
      responseText += `${i + 1}. ${requesterProfile.name || 'Anonymous'}\n`;
      responseText += `   Score: ${request.matchScore || 'N/A'}\n`;
      responseText += `   ${request.matchReason || ''}\n\n`;
    }
    responseText += `To approve, say "approve request from [name]" or "approve 1"`;

    if (callback) callback({ text: responseText });
    return true;
  },
  examples: []
};

/**
 * Action to reject a match request
 */
export const rejectMatchRequestAction: Action = {
  name: 'REJECT_MATCH_REQUEST',
  description: 'Reject a pending match request from another user.',
  similes: ['DECLINE_MATCH', 'REJECT_CONNECTION', 'DECLINE_REQUEST'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content.text || '').toLowerCase();
    return text.includes('reject') && text.includes('request') ||
           text.includes('decline') && text.includes('request') ||
           text.includes('reject match') ||
           text.includes('decline match');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;

    // Get pending requests for this user
    const pendingRequests = await getPendingRequests(runtime, userId, 'received');
    
    if (pendingRequests.length === 0) {
      if (callback) callback({ text: "You don't have any pending match requests." });
      return true;
    }

    // Try to parse which request to reject
    const text = (message.content.text || '').toLowerCase();
    const nameMatch = text.match(/(?:reject|decline)\s+(?:request\s+)?(?:from\s+)?([a-zA-Z\s]+)/i);
    
    if (nameMatch && pendingRequests.length > 1) {
      // Multiple requests - need to specify which one
      const requesterName = nameMatch[1].trim();
      const request = pendingRequests.find(r => {
        return true; // Simplified
      });
      
      if (request) {
        const result = await rejectRequest(runtime, request.id, userId);
        if (result.success) {
          // Get requester profile for notification
          const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
          await sendMatchRejectionNotification(runtime, userId, request.requesterId, requesterProfile);
          
          if (callback) callback({ text: `You've declined the match request from ${requesterProfile.name || 'this user'}.` });
        } else {
          if (callback) callback({ text: `Failed to reject request: ${result.error}` });
        }
        return true;
      }
    }

    // Reject first pending request (if only one)
    if (pendingRequests.length === 1) {
      const request = pendingRequests[0];
      const result = await rejectRequest(runtime, request.id, userId);
      
      if (result.success) {
        // Get requester profile for notification
        const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
        await sendMatchRejectionNotification(runtime, userId, request.requesterId, requesterProfile);
        
        if (callback) callback({ text: `You've declined the match request from ${requesterProfile.name || 'this user'}.` });
      } else {
        if (callback) callback({ text: `Failed to reject request: ${result.error}` });
      }
      return true;
    }

    // Multiple requests - show list
    let responseText = `You have ${pendingRequests.length} pending match requests:\n\n`;
    for (let i = 0; i < pendingRequests.length; i++) {
      const request = pendingRequests[i];
      const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
      responseText += `${i + 1}. ${requesterProfile.name || 'Anonymous'}\n`;
    }
    responseText += `\nTo reject, say "reject request from [name]" or "reject 1"`;

    if (callback) callback({ text: responseText });
    return true;
  },
  examples: []
};

/**
 * Action to show pending requests
 */
export const showPendingRequestsAction: Action = {
  name: 'SHOW_PENDING_REQUESTS',
  description: 'Show all pending match requests (sent and received).',
  similes: ['MY_REQUESTS', 'PENDING_REQUESTS', 'SHOW_REQUESTS'],
  
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content.text || '').toLowerCase();
    return text.includes('show') && text.includes('request') ||
           text.includes('pending request') ||
           text.includes('my requests');
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: any, callback?: HandlerCallback) => {
    const userId = message.userId;

    const sentRequests = await getPendingRequests(runtime, userId, 'sent');
    const receivedRequests = await getPendingRequests(runtime, userId, 'received');

    if (sentRequests.length === 0 && receivedRequests.length === 0) {
      if (callback) callback({ text: "You don't have any pending match requests." });
      return true;
    }

    let responseText = '';

    if (receivedRequests.length > 0) {
      responseText += `📥 **Received Requests (${receivedRequests.length}):**\n\n`;
      for (let i = 0; i < receivedRequests.length; i++) {
        const request = receivedRequests[i];
        const requesterProfile = await getUserProfile(runtime, request.requesterId as any);
        responseText += `${i + 1}. ${requesterProfile.name || 'Anonymous'}\n`;
        responseText += `   Score: ${request.matchScore || 'N/A'}\n`;
        responseText += `   ${request.matchReason || ''}\n`;
        responseText += `   [Approve] [Reject]\n\n`;
      }
    }

    if (sentRequests.length > 0) {
      responseText += `📤 **Sent Requests (${sentRequests.length}):**\n\n`;
      for (let i = 0; i < sentRequests.length; i++) {
        const request = sentRequests[i];
        const requestedProfile = await getUserProfile(runtime, request.requestedId as any);
        responseText += `${i + 1}. ${requestedProfile.name || 'Anonymous'} - ⏳ Pending\n\n`;
      }
    }

    if (callback) callback({ text: responseText });
    return true;
  },
  examples: []
};

/**
 * Send notification to requested user about new match request
 */
async function sendMatchRequestNotification(
  runtime: IAgentRuntime,
  requesterId: string,
  requestedId: string,
  requesterProfile: any,
  matchScore: number,
  matchReason: string
): Promise<void> {
  const requestedProfile = await getUserProfile(runtime, requestedId as any);
  const userLang = requestedProfile.language || 'en';

  const notificationMessages: Record<string, string> = {
    en: `🎉 New Match Request!\n\n${requesterProfile.name || 'Someone'} wants to connect with you!\n\nAbout ${requesterProfile.name || 'them'}:\n- Roles: ${(requesterProfile.roles || []).join(', ') || 'Not specified'}\n- Interests: ${(requesterProfile.interests || []).slice(0, 3).join(', ') || 'Not specified'}\n- Score: ${matchScore}/100\n\nWhy they want to connect:\n${matchReason}\n\nSay "approve request from ${requesterProfile.name || 'them'}" to approve, or "reject request from ${requesterProfile.name || 'them'}" to decline.`,
    es: `🎉 ¡Nueva Solicitud de Conexión!\n\n${requesterProfile.name || 'Alguien'} quiere conectarse contigo!\n\nSobre ${requesterProfile.name || 'ellos'}:\n- Roles: ${(requesterProfile.roles || []).join(', ') || 'No especificado'}\n- Intereses: ${(requesterProfile.interests || []).slice(0, 3).join(', ') || 'No especificado'}\n- Puntuación: ${matchScore}/100\n\nPor qué quieren conectarse:\n${matchReason}\n\nDi "aprobar solicitud de ${requesterProfile.name || 'ellos'}" para aprobar, o "rechazar solicitud de ${requesterProfile.name || 'ellos'}" para rechazar.`,
    pt: `🎉 Nova Solicitação de Conexão!\n\n${requesterProfile.name || 'Alguém'} quer se conectar com você!\n\nSobre ${requesterProfile.name || 'eles'}:\n- Funções: ${(requesterProfile.roles || []).join(', ') || 'Não especificado'}\n- Interesses: ${(requesterProfile.interests || []).slice(0, 3).join(', ') || 'Não especificado'}\n- Pontuação: ${matchScore}/100\n\nPor que querem se conectar:\n${matchReason}\n\nDiga "aprovar solicitação de ${requesterProfile.name || 'eles'}" para aprovar, ou "rejeitar solicitação de ${requesterProfile.name || 'eles'}" para rejeitar.`,
    fr: `🎉 Nouvelle Demande de Connexion!\n\n${requesterProfile.name || 'Quelqu\'un'} veut se connecter avec vous!\n\nÀ propos de ${requesterProfile.name || 'eux'}:\n- Rôles: ${(requesterProfile.roles || []).join(', ') || 'Non spécifié'}\n- Intérêts: ${(requesterProfile.interests || []).slice(0, 3).join(', ') || 'Non spécifié'}\n- Score: ${matchScore}/100\n\nPourquoi ils veulent se connecter:\n${matchReason}\n\nDites "approuver demande de ${requesterProfile.name || 'eux'}" pour approuver, ou "rejeter demande de ${requesterProfile.name || 'eux'}" pour rejeter.`
  };

  const notificationText = notificationMessages[userLang] || notificationMessages.en;
  
  // Get chat ID from userId (for Telegram, chat_id = user_id)
  await sendTelegramNotification(requestedId, notificationText);
}

/**
 * Send notification to requester about approval
 */
async function sendMatchApprovalNotification(
  runtime: IAgentRuntime,
  approverId: string,
  requesterId: string,
  approverProfile: any
): Promise<void> {
  const requesterProfile = await getUserProfile(runtime, requesterId as any);
  const userLang = requesterProfile.language || 'en';

  const notificationMessages: Record<string, string> = {
    en: `✅ ${approverProfile.name || 'They'} approved your match request! You're now connected. 🎉`,
    es: `✅ ${approverProfile.name || 'Ellos'} aprobaron tu solicitud de conexión! Ya están conectados. 🎉`,
    pt: `✅ ${approverProfile.name || 'Eles'} aprovaram sua solicitação de conexão! Vocês estão conectados agora. 🎉`,
    fr: `✅ ${approverProfile.name || 'Ils'} ont approuvé votre demande de connexion! Vous êtes maintenant connectés. 🎉`
  };

  const notificationText = notificationMessages[userLang] || notificationMessages.en;
  
  await sendTelegramNotification(requesterId, notificationText);
}

/**
 * Send notification to requester about rejection
 */
async function sendMatchRejectionNotification(
  runtime: IAgentRuntime,
  rejecterId: string,
  requesterId: string,
  rejecterProfile: any
): Promise<void> {
  const requesterProfile = await getUserProfile(runtime, requesterId as any);
  const userLang = requesterProfile.language || 'en';

  const notificationMessages: Record<string, string> = {
    en: `😔 ${rejecterProfile.name || 'They'} declined your match request.`,
    es: `😔 ${rejecterProfile.name || 'Ellos'} rechazaron tu solicitud de conexión.`,
    pt: `😔 ${rejecterProfile.name || 'Eles'} rejeitaram sua solicitação de conexão.`,
    fr: `😔 ${rejecterProfile.name || 'Ils'} ont rejeté votre demande de connexion.`
  };

  const notificationText = notificationMessages[userLang] || notificationMessages.en;
  
  await sendTelegramNotification(requesterId, notificationText);
}

/**
 * Send notification about mutual match (bidirectional auto-approval)
 */
async function sendMutualMatchNotification(
  runtime: IAgentRuntime,
  userId1: string,
  userId2: string,
  user2Profile: any
): Promise<void> {
  const user1Profile = await getUserProfile(runtime, userId1 as any);
  const user1Lang = user1Profile.language || 'en';
  const user2Lang = user2Profile.language || 'en';

  const messages1: Record<string, string> = {
    en: `🎉 Mutual interest detected! ${user2Profile.name || 'They'} also wanted to connect with you! You're now connected. 🎉`,
    es: `🎉 ¡Interés mutuo detectado! ${user2Profile.name || 'Ellos'} también quería conectarse contigo! Ya están conectados. 🎉`,
    pt: `🎉 Interesse mútuo detectado! ${user2Profile.name || 'Eles'} também queria se conectar com você! Vocês estão conectados agora. 🎉`,
    fr: `🎉 Intérêt mutuel détecté! ${user2Profile.name || 'Ils'} voulaient aussi se connecter avec vous! Vous êtes maintenant connectés. 🎉`
  };

  const messages2: Record<string, string> = {
    en: `🎉 Mutual interest detected! ${user1Profile.name || 'They'} also wanted to connect with you! You're now connected. 🎉`,
    es: `🎉 ¡Interés mutuo detectado! ${user1Profile.name || 'Ellos'} también quería conectarse contigo! Ya están conectados. 🎉`,
    pt: `🎉 Interesse mútuo detectado! ${user1Profile.name || 'Eles'} também queria se conectar com você! Vocês estão conectados agora. 🎉`,
    fr: `🎉 Intérêt mutuel détecté! ${user1Profile.name || 'Ils'} voulaient aussi se connecter avec vous! Vous êtes maintenant connectés. 🎉`
  };

  await sendTelegramNotification(userId1, messages1[user1Lang] || messages1.en);
  await sendTelegramNotification(userId2, messages2[user2Lang] || messages2.en);
}
