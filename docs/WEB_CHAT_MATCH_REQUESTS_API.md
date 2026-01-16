# Web Chat Match Requests API Documentation

## Overview

The match request system is now fully integrated into the web chat API. All endpoints use the same backend service as Telegram, ensuring consistency across platforms.

---

## Endpoints

### 1. Create Match Request

**Endpoint:** `POST /api/match/request`

**Request Body:**
```json
{
  "userId": "user-123",
  "requestedUserId": "user-456",
  "matchScore": 85,
  "matchReason": "Shared interests in AI and Web3"
}
```

**Response (Success):**
```json
{
  "success": true,
  "requestId": "request-uuid",
  "message": "Match request created successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "You already have a pending request with this user"
}
```

**Possible Errors:**
- `Missing required fields: userId, requestedUserId`
- `Cannot request match with yourself`
- `You are already matched with this user`
- `You already have a pending request with this user`
- `You have 10 pending requests. Please wait for responses before requesting more.`
- `You previously requested this user and they declined. Please wait 30 days before requesting again.`

---

### 2. Approve Match Request

**Endpoint:** `POST /api/match/approve/:requestId`

**URL Parameters:**
- `requestId`: The ID of the match request to approve

**Request Body:**
```json
{
  "userId": "user-456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "matchId": "match-uuid",
  "message": "Match request approved successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "You are not authorized to approve this request"
}
```

**Possible Errors:**
- `Missing required field: userId`
- `Request not found`
- `You are not authorized to approve this request`
- `You are already matched with this user`

---

### 3. Reject Match Request

**Endpoint:** `POST /api/match/reject/:requestId`

**URL Parameters:**
- `requestId`: The ID of the match request to reject

**Request Body:**
```json
{
  "userId": "user-456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Match request rejected successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "You are not authorized to reject this request"
}
```

**Possible Errors:**
- `Missing required field: userId`
- `Request not found`
- `You are not authorized to reject this request`

**Note:** Rejected requests trigger a 30-day cooldown period before the requester can request again.

---

### 4. Cancel Own Request

**Endpoint:** `POST /api/match/cancel/:requestId`

**URL Parameters:**
- `requestId`: The ID of the match request to cancel

**Request Body:**
```json
{
  "userId": "user-123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Match request cancelled successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "You are not authorized to cancel this request"
}
```

**Possible Errors:**
- `Missing required field: userId`
- `Request not found`
- `You are not authorized to cancel this request`

---

### 5. Get Pending Requests

**Endpoint:** `GET /api/match/requests?userId=...&type=...`

**Query Parameters:**
- `userId` (required): The user ID to get requests for
- `type` (optional): `'all'` | `'sent'` | `'received'` (default: `'all'`)

**Example Requests:**
```
GET /api/match/requests?userId=user-123&type=sent
GET /api/match/requests?userId=user-123&type=received
GET /api/match/requests?userId=user-123&type=all
```

**Response (Success):**
```json
{
  "success": true,
  "count": 2,
  "requests": [
    {
      "id": "request-uuid-1",
      "requesterId": "user-123",
      "requestedId": "user-456",
      "status": "pending",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "matchScore": 85,
      "matchReason": "Shared interests",
      "expiresAt": "2026-01-22T10:00:00.000Z",
      "requesterName": "Alice",
      "requestedName": "Bob",
      "requesterProfile": {
        "name": "Alice",
        "roles": ["Founder", "Developer"],
        "interests": ["AI", "Web3", "Blockchain"],
        "telegramHandle": "alice"
      },
      "requestedProfile": {
        "name": "Bob",
        "roles": ["Investor"],
        "interests": ["Web3", "DeFi"],
        "telegramHandle": "bob"
      }
    }
  ]
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Missing required query parameter: userId"
}
```

---

## Features

### Automatic Bidirectional Approval

If two users request each other simultaneously:
- Both requests are automatically approved
- A match is created immediately
- Both users are notified

### Request Limits

- **Max 10 pending requests** per user
- Users must wait for responses before requesting more

### Rejection Cooldown

- **30-day cooldown** after rejection
- Prevents spam requests
- User cannot request the same person again for 30 days

### Request Expiration

- **7-day expiration** for pending requests
- Expired requests are automatically cancelled
- Background service runs daily to clean up expired requests

---

## Frontend Integration Example

### React/Next.js Example

```typescript
// Create match request
async function requestMatch(userId: string, requestedUserId: string, score: number, reason: string) {
  const response = await fetch('/api/match/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      requestedUserId,
      matchScore: score,
      matchReason: reason
    })
  });
  return await response.json();
}

// Get pending requests
async function getPendingRequests(userId: string, type: 'all' | 'sent' | 'received' = 'all') {
  const response = await fetch(`/api/match/requests?userId=${userId}&type=${type}`);
  return await response.json();
}

// Approve request
async function approveRequest(requestId: string, userId: string) {
  const response = await fetch(`/api/match/approve/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return await response.json();
}

// Reject request
async function rejectRequest(requestId: string, userId: string) {
  const response = await fetch(`/api/match/reject/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return await response.json();
}
```

### UI Flow Example

1. **Show Matches:**
   - User clicks "Find Matches"
   - Frontend calls existing match endpoint
   - Display top 5 matches with "Request Match" buttons

2. **Request Match:**
   - User clicks "Request Match" on a match card
   - Frontend calls `POST /api/match/request`
   - Button changes to "Request Pending" or "Request Sent"

3. **View Requests:**
   - User clicks "My Requests"
   - Frontend calls `GET /api/match/requests?userId=...&type=all`
   - Display list with approve/reject buttons

4. **Approve/Reject:**
   - User clicks "Approve" or "Reject"
   - Frontend calls `POST /api/match/approve/:id` or `POST /api/match/reject/:id`
   - Update UI to show new status

---

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  success: false,
  error: "Error message here",
  message?: "Detailed error message"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (missing fields, validation errors)
- `401`: Unauthorized (if API key is required)
- `500`: Internal Server Error

---

## Notes

1. **User IDs:** All user IDs are automatically resolved to primary user IDs (for cross-platform consistency)

2. **Notifications:** Match request notifications are sent via Telegram if the user has a Telegram handle. Web notifications would need to be implemented separately (WebSocket/polling).

3. **Real-time Updates:** For real-time updates in web chat, consider:
   - WebSocket connection for push notifications
   - Polling `/api/match/requests` periodically
   - Server-Sent Events (SSE)

4. **Consistency:** These endpoints use the same backend service as Telegram, ensuring consistent behavior across platforms.

---

## Testing

### Using cURL

```bash
# Create request
curl -X POST http://localhost:3000/api/match/request \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","requestedUserId":"user-456","matchScore":85}'

# Get requests
curl "http://localhost:3000/api/match/requests?userId=user-123&type=all"

# Approve request
curl -X POST http://localhost:3000/api/match/approve/request-uuid \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-456"}'
```

---

## Status

✅ **Complete and Ready for Use**

All endpoints are implemented and integrated with the existing match request service. The web chat now has full match request functionality matching the Telegram implementation.


