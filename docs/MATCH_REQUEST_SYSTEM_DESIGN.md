# Match Request System Design

## Overview
Users can request their top 5 matches, select which ones to request, and the requested user must approve before a match is created.

---

## Core Flow

### 1. User Requests Top Matches
**Trigger:** "Show me my top matches" / "Find matches" / "Top 5 matches"

**Process:**
- Call `findMatches()` with limit 5 (instead of 3)
- Return top 5 matches with scores, reasons, icebreakers
- Display formatted list to user

**Display Format:**
```
Here are your top 5 matches! 🎯

1. **Alice** (Score: 92)
   Roles: Founder/Builder
   Interests: AI, Web3 Growth Marketing
   💡 Perfect complementary match - your goals align with their expertise!
   [Request Match] [View Profile]

2. **Bob** (Score: 87)
   Roles: Investor/Grant Program Operator
   Interests: AI, Cybersecurity
   💡 Strong complementary potential - your needs match their skills
   [Request Match] [View Profile]

... (up to 5)
```

---

### 2. User Selects Matches to Request
**Trigger:** User clicks "Request Match" or sends "Request match with [name]" or "Request 1, 3, 5"

**Process:**
- Create match request record in `match_requests` table
- Status: `pending`
- Send notification to requested user
- Confirm to requester

---

### 3. Requested User Receives Notification
**Notification Format:**
```
🎉 New Match Request!

Alice wants to connect with you!

About Alice:
- Roles: Founder/Builder
- Interests: AI, Web3 Growth Marketing
- Score: 92/100

Why they want to connect:
Perfect complementary match - your goals align with their expertise!

[Approve] [Reject] [View Full Profile]
```

---

### 4. Requested User Responds

#### A. Approve
- Create match in `matches` table (status: `pending`)
- Update `match_requests` status to `approved`
- Notify requester: "✅ Alice approved your match request! You're now connected."
- Notify requested user: "✅ You've approved the match with Alice. You're now connected!"
- Schedule follow-ups (3-day check-in, 7-day next match)

#### B. Reject
- Update `match_requests` status to `rejected`
- Notify requester: "Alice declined your match request."
- Notify requested user: "You've declined the match request from Alice."
- **No match created**

#### C. View Profile (Before Deciding)
- Show full profile (name, roles, interests, goals, events, socials, telegram handle)
- Then show approve/reject options again

---

## Database Schema

### New Table: `match_requests`

```sql
CREATE TABLE IF NOT EXISTS match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,           -- User who requested
  requested_id TEXT NOT NULL,           -- User being requested
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,             -- When approved/rejected
  response TEXT,                         -- 'approved' or 'rejected'
  match_score NUMERIC,                   -- Compatibility score
  match_reason TEXT,                     -- Why they matched
  expires_at TIMESTAMPTZ,                -- Optional: expire after 7 days
  CONSTRAINT unique_request UNIQUE(requester_id, requested_id)
);

CREATE INDEX idx_match_requests_requester ON match_requests(requester_id);
CREATE INDEX idx_match_requests_requested ON match_requests(requested_id);
CREATE INDEX idx_match_requests_status ON match_requests(status);
CREATE INDEX idx_match_requests_created_at ON match_requests(created_at);
```

**MongoDB Equivalent:**
```javascript
{
  id: UUID,
  requester_id: String,
  requested_id: String,
  status: 'pending' | 'approved' | 'rejected' | 'expired',
  created_at: Date,
  responded_at: Date,
  response: 'approved' | 'rejected',
  match_score: Number,
  match_reason: String,
  expires_at: Date
}
// Unique index on (requester_id, requested_id)
```

---

## Edge Cases & Scenarios

### 1. Duplicate Requests
**Scenario:** User A requests User B, then requests again before response

**Solution:**
- Check if pending request exists: `SELECT * FROM match_requests WHERE requester_id = $1 AND requested_id = $2 AND status = 'pending'`
- If exists: "You already have a pending request with Alice. Please wait for their response."
- Prevent duplicate requests

### 2. Bidirectional Requests (Mutual Interest)
**Scenario:** User A requests User B, User B also requests User A

**Solution A (Auto-Approve):**
- When User B requests User A, check if reverse request exists
- If exists: Auto-approve both requests, create match immediately
- Notify both: "🎉 Mutual interest detected! You're now connected with Alice!"

**Solution B (Show Mutual Interest):**
- Show both users: "Alice also requested to connect with you! [Approve Both]"
- If one approves, auto-approve the other

**Recommendation:** Solution A (auto-approve) - simpler UX

### 3. Already Matched
**Scenario:** User A requests User B, but they're already matched

**Solution:**
- Check `matches` table: `SELECT * FROM matches WHERE (user_id = $1 AND matched_user_id = $2) OR (user_id = $2 AND matched_user_id = $1)`
- If exists: "You're already connected with Alice! Check your matches."
- Prevent duplicate match creation

### 4. Request Expiration
**Scenario:** Request pending for 7+ days

**Solution:**
- Set `expires_at = created_at + 7 days` when creating request
- Background job checks expired requests daily
- Update status to `expired`
- Notify requester: "Your match request to Alice has expired. You can request again."
- Allow re-requesting after expiration

### 5. User Opted Out of Notifications
**Scenario:** Requested user has `notifications = 'No'`

**Solution:**
- Still create request (they might check manually)
- Don't send push notification
- Show in "Pending Requests" when they check profile
- Or send email notification (if email available)

### 6. User Deleted Account / Incomplete Profile
**Scenario:** Requested user deleted account or profile incomplete

**Solution:**
- When processing request, check if profile exists and is completed
- If not: Update request status to `rejected` with reason "User profile no longer available"
- Notify requester: "Alice's profile is no longer available."

### 7. Multiple Requests to Same User
**Scenario:** User A requests User B, User C also requests User B

**Solution:**
- Allow multiple pending requests to same user
- When User B views requests, show all pending requests
- User B can approve/reject each independently
- Display: "You have 3 pending match requests"

### 8. Requesting Already Rejected User
**Scenario:** User A requests User B, gets rejected, then requests again

**Solution A (Block Re-Request):**
- Check if previous request was rejected
- If rejected: "You previously requested Alice and they declined. Please respect their decision."
- Prevent re-requesting

**Solution B (Allow After Time):**
- Allow re-requesting after 30 days
- Check: `SELECT * FROM match_requests WHERE requester_id = $1 AND requested_id = $2 AND status = 'rejected' AND responded_at < NOW() - INTERVAL '30 days'`
- If old rejection exists: Allow new request

**Recommendation:** Solution B (allow after 30 days) - people change, give second chance

### 9. Request Limit
**Scenario:** User spams requests to many people

**Solution:**
- Limit: Max 10 pending requests per user
- Check: `SELECT COUNT(*) FROM match_requests WHERE requester_id = $1 AND status = 'pending'`
- If >= 10: "You have 10 pending requests. Please wait for responses before requesting more."
- Or: Allow unlimited, but show warning after 10

### 10. Viewing Request History
**Scenario:** User wants to see sent/received requests

**Solution:**
- **Sent Requests:** `SELECT * FROM match_requests WHERE requester_id = $1 ORDER BY created_at DESC`
- **Received Requests:** `SELECT * FROM match_requests WHERE requested_id = $1 AND status = 'pending' ORDER BY created_at DESC`
- Display with status, dates, actions

### 11. Canceling Own Request
**Scenario:** User A requests User B, then wants to cancel

**Solution:**
- Allow canceling pending requests
- Update status to `cancelled`
- Notify requested user: "Alice cancelled their match request."
- Remove from their pending requests list

### 12. Profile Privacy
**Scenario:** User wants to see requester's profile before approving

**Solution:**
- Show basic info in notification (name, roles, interests, score)
- "View Full Profile" button shows complete profile
- After viewing, show approve/reject options

### 13. Platform Filtering
**Scenario:** Grow3dge user requests SI Her user (shouldn't happen, but edge case)

**Solution:**
- Matching engine already filters by platform
- Top 5 matches will only include compatible platform users
- No additional filtering needed in request system

### 14. Primary User ID Resolution
**Scenario:** User onboarded on Telegram and Web, requests from one platform

**Solution:**
- Resolve to primary userId when creating request
- Resolve when checking for duplicates
- Resolve when approving/rejecting
- Use `resolvePrimaryUserId()` helper

### 15. Notification Delivery Failures
**Scenario:** Telegram notification fails to send

**Solution:**
- Log error, but still create request
- Request shows in "Pending Requests" when user checks
- Retry notification later (background job)
- Or: Email notification as fallback

### 16. Request While User is Offline
**Scenario:** User A requests User B, User B hasn't been online in days

**Solution:**
- Create request, send notification
- If notification fails, request still exists
- When User B returns, show in "Pending Requests"
- Or: Send email notification

### 17. Bulk Request Actions
**Scenario:** User wants to approve/reject multiple requests at once

**Solution:**
- Show list of pending requests with checkboxes
- "Approve Selected" / "Reject Selected" buttons
- Process each request individually
- Notify each requester

### 18. Request Analytics
**Scenario:** Track request success rate, response time

**Solution:**
- Track: request_count, approval_count, rejection_count, expiration_count
- Track: average_response_time
- Store in analytics table or calculate on-demand

---

## API Endpoints / Actions

### 1. Get Top 5 Matches
**Action:** `FIND_TOP_MATCHES` or extend `FIND_MATCH`

**Handler:**
```typescript
async function getTopMatches(runtime, userId, limit = 5) {
  const profile = await getUserProfile(runtime, userId);
  const matches = await findMatches(runtime, userId, profile, [], { minScoreThreshold: 60 });
  return matches.slice(0, 5); // Return top 5
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "userId": "user123",
      "name": "Alice",
      "score": 92,
      "roles": ["Founder/Builder"],
      "interests": ["AI", "Web3 Growth Marketing"],
      "reason": "Perfect complementary match...",
      "icebreaker": "AI-generated introduction...",
      "hasPendingRequest": false,
      "canRequest": true
    },
    // ... up to 5
  ]
}
```

### 2. Request Match
**Action:** `REQUEST_MATCH`

**Handler:**
```typescript
async function requestMatch(runtime, requesterId, requestedId, matchScore, matchReason) {
  // Check for duplicates
  // Check if already matched
  // Check request limit
  // Create request record
  // Send notification
  // Return success
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match request sent to Alice! They'll be notified.",
  "requestId": "req123"
}
```

### 3. Get Pending Requests
**Action:** `GET_PENDING_REQUESTS`

**Handler:**
```typescript
async function getPendingRequests(runtime, userId, type: 'sent' | 'received') {
  // Query match_requests table
  // Return formatted list
}
```

**Response:**
```json
{
  "success": true,
  "sent": [...],
  "received": [...]
}
```

### 4. Approve Request
**Action:** `APPROVE_MATCH_REQUEST`

**Handler:**
```typescript
async function approveRequest(runtime, requestId, userId) {
  // Verify user is the requested user
  // Check if already matched
  // Create match record
  // Update request status
  // Send notifications
  // Schedule follow-ups
}
```

### 5. Reject Request
**Action:** `REJECT_MATCH_REQUEST`

**Handler:**
```typescript
async function rejectRequest(runtime, requestId, userId) {
  // Verify user is the requested user
  // Update request status
  // Send notifications
}
```

### 6. Cancel Request
**Action:** `CANCEL_MATCH_REQUEST`

**Handler:**
```typescript
async function cancelRequest(runtime, requestId, userId) {
  // Verify user is the requester
  // Update request status to 'cancelled'
  // Notify requested user
}
```

---

## Telegram Integration

### Commands / Messages

1. **"Show me my top matches" / "Top 5 matches"**
   - Display formatted list with numbers
   - "Reply with the number(s) to request (e.g., 1, 3, 5)"

2. **"Request match with Alice" / "Request 1, 3, 5"**
   - Process requests
   - Confirm each request

3. **"Show my requests" / "Pending requests"**
   - Show sent and received requests
   - Format with approve/reject buttons (inline keyboard)

4. **"Approve request from Alice" / "Reject request from Alice"**
   - Process approval/rejection
   - Confirm action

### Inline Keyboard Buttons

```
[Approve] [Reject] [View Profile]
```

---

## Web Chat Integration

### UI Components

1. **Match List Component**
   - Display top 5 matches in cards
   - "Request Match" button on each
   - "View Profile" button

2. **Request Management Component**
   - Tabs: "Sent Requests" / "Received Requests"
   - List with status badges
   - Action buttons

3. **Request Notification Component**
   - Toast/Modal when request received
   - Show requester info
   - Approve/Reject buttons

---

## Notification System

### Telegram Notifications

**Request Received:**
```typescript
const message = `🎉 New Match Request!

${requesterName} wants to connect with you!

About ${requesterName}:
- Roles: ${roles.join(', ')}
- Interests: ${interests.slice(0, 3).join(', ')}
- Score: ${score}/100

Why they want to connect:
${matchReason}

[Approve] [Reject] [View Profile]`;
```

**Request Approved:**
```typescript
const message = `✅ ${requestedName} approved your match request! You're now connected. 🎉`;
```

**Request Rejected:**
```typescript
const message = `😔 ${requestedName} declined your match request.`;
```

### Email Notifications (Optional)

- Send email if Telegram notification fails
- Or: Always send email for important actions (approval/rejection)

---

## Background Jobs

### 1. Request Expiration Checker
**Frequency:** Daily

**Process:**
- Find requests with `status = 'pending'` and `expires_at < NOW()`
- Update status to `expired`
- Notify requester

### 2. Request Reminder (Optional)
**Frequency:** After 3 days if no response

**Process:**
- Find pending requests older than 3 days
- Send reminder to requested user: "You have pending match requests. Check them out!"

---

## Migration Plan

### Phase 1: Database
1. Create `match_requests` table
2. Add indexes
3. Test queries

### Phase 2: Core Logic
1. Create `matchRequestService.ts` with CRUD operations
2. Implement request creation
3. Implement approval/rejection
4. Test edge cases

### Phase 3: Matching Integration
1. Modify `findMatches()` to return top 5
2. Update `FIND_MATCH` action to show top 5
3. Add request selection logic

### Phase 4: Notifications
1. Add Telegram notification functions
2. Add email notification functions (optional)
3. Test notification delivery

### Phase 5: UI/UX
1. Update Telegram message formatting
2. Add inline keyboards
3. Update web chat UI
4. Test user flows

### Phase 6: Background Jobs
1. Implement expiration checker
2. Implement reminder system (optional)
3. Test scheduled jobs

---

## Testing Checklist

- [ ] Get top 5 matches returns correct results
- [ ] Request creation works
- [ ] Duplicate request prevention works
- [ ] Bidirectional request auto-approval works
- [ ] Already matched prevention works
- [ ] Request expiration works
- [ ] Approval creates match correctly
- [ ] Rejection doesn't create match
- [ ] Notifications sent correctly
- [ ] Request limit enforcement works
- [ ] Request cancellation works
- [ ] Primary user ID resolution works
- [ ] Profile viewing before approval works
- [ ] Request history display works
- [ ] Bulk actions work (if implemented)
- [ ] Edge cases handled correctly

---

## Future Enhancements

1. **Smart Matching:** Suggest matches based on request patterns
2. **Request Analytics:** Track success rates, popular matches
3. **Request Templates:** Pre-written messages with requests
4. **Group Requests:** Request multiple people at once
5. **Request Scheduling:** Schedule requests for later
6. **Request Insights:** Show why someone requested you
7. **Mutual Connections:** Show shared connections before approving

---

This design covers all edge cases and provides a robust match request system! 🚀


