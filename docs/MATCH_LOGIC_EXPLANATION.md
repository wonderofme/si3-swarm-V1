# Match Logic Explanation

## Overview
The matching engine uses a **weighted compatibility scoring system** that evaluates users based on three main factors: **Intent Matching**, **Interest Overlap**, and **Event Synchronization**.

---

## Scoring Components

### 1. Intent Score (Weight: 60% - Most Important)
**Purpose:** Matches users based on complementary needs (what one seeks vs. what the other offers).

**How it works:**
- **Transactional Matching (Bidirectional):**
  - User A's goals → User B's roles (50 points if match)
  - User B's goals → User A's roles (50 points if match)
  - Maximum: 100 points (both directions match)

- **Peer Matching (Fallback):**
  - If no transactional match found (score < 50)
  - Users with same roles get 50 points
  - Example: Two founders, two developers, etc.

**Intent Matrix:**
```
User A's Goal → Looks for User B's Role:
- "Startups to invest in" → ["Founder/Builder"]
- "Investors/grant programs" → ["Investor/Grant Program Operator"]
- "Growth tools, strategies, and/or support" → ["Marketing/BD/Partnerships", "Media", "Community Leader"]
- "Sales/BD tools, strategies and/or support" → ["Marketing/BD/Partnerships", "Community Leader"]
- "Communities and/or DAO's to join" → ["Community Leader", "DAO Council Member/Delegate"]
- "New job opportunities" → ["Founder/Builder", "Investor/Grant Program Operator"]
```

**Example:**
- User A: Goal = "Investors/grant programs", Role = "Founder/Builder"
- User B: Goal = "Startups to invest in", Role = "Investor/Grant Program Operator"
- **Result:** Perfect match! User A seeks investors (User B is investor), User B seeks startups (User A is founder)
- **Score:** 100 points (50 + 50)

---

### 2. Interest Score (Weight: 30%)
**Purpose:** Measures shared interests using Jaccard Similarity.

**How it works:**
- **Jaccard Similarity:** `|Common Interests| / |Union of All Interests|`
- **Flexible Matching:** Uses substring matching (e.g., "AI" matches "Artificial Intelligence")
- **Scoring:**
  - Base: `similarity * 100`
  - Bonus: If 3+ common interests → 100% multiplier
  - Bonus: If 1-2 common interests → 80% multiplier
  - Maximum: 100 points

**Example:**
- User A: ["AI", "Web3 Growth Marketing", "Cybersecurity"]
- User B: ["AI", "Cybersecurity", "DAOs"]
- **Common:** ["AI", "Cybersecurity"]
- **Union:** ["AI", "Web3 Growth Marketing", "Cybersecurity", "DAOs"] = 4
- **Similarity:** 2/4 = 0.5
- **Score:** 0.5 * 100 * 0.8 = 40 points (2 common interests)

---

### 3. Event Score (Weight: 10%)
**Purpose:** Matches users attending the same events.

**How it works:**
- **Direct Match:** Exact event name match
- **Fuzzy Match:** Substring match with year check (prevents "Consensus 2023" matching "Consensus 2024")
- **Score:** 100 points if events match, 0 otherwise
- **Override:** If events match, total score is boosted to minimum 85

**Example:**
- User A: ["Consensus 2024", "ETHDenver 2024"]
- User B: ["Consensus 2024", "Devcon"]
- **Shared:** ["Consensus 2024"]
- **Score:** 100 points
- **Total Score Boost:** Minimum 85 (even if other scores are low)

---

## Total Score Calculation

```
Total Score = 
  (Intent Score × 0.6) +
  (Interest Score × 0.3) +
  (Event Score × 0.1) +
  15 (Base points for any completed profile)
```

**Event Override:**
- If events match → Total score = max(totalScore, 85)

**Example Calculation:**
- Intent Score: 100
- Interest Score: 40
- Event Score: 0
- **Total:** (100 × 0.6) + (40 × 0.3) + (0 × 0.1) + 15 = 60 + 12 + 0 + 15 = **87 points**

---

## Thresholds & Filters

### Minimum Score Threshold
- **Default:** 60 points
- **Purpose:** Only matches above this threshold are returned
- **Configurable:** Can be adjusted per request

### High-Demand Roles
- **Roles:** ["Investor/Grant Program Operator"]
- **Threshold:** 75 points (higher than default)
- **Purpose:** Investors are in high demand, so require better matches

### Platform Filtering
**Rules:**
1. **Grow3dge-only members** (role: "partner") → Only match with other Grow3dge members
2. **SI Her-only members** (role: "team") → Only match with other SI Her members
3. **Users with both roles** → Can match with anyone
4. **Users with no platform roles** → Can match with anyone (default flow)

**Example:**
- User A: Grow3dge-only → Can only match with Grow3dge members
- User B: SI Her-only → Can only match with SI Her members
- User C: Both platforms → Can match with anyone

---

## User Filtering

### Excluded Users
- **Self:** User cannot match with themselves
- **Already Matched:** Users in `excludeUserIds` array
- **Incomplete Profiles:** Only users with `step === 'COMPLETED'`
- **Opted Out:** Users with `notifications === 'No'` or `'Not sure yet'`

### Primary User ID Resolution
- **Purpose:** Handles users who onboarded on multiple platforms (Telegram + Web)
- **Process:** Resolves to primary userId to prevent duplicate matches
- **Example:** User onboarded on Telegram (userId: "123") and Web (userId: "456") → Both resolve to primary "123"

---

## Match Reason Generation

**Priority Order:**
1. **Intent Score ≥ 80:** "Perfect complementary match - your goals align with their expertise!"
2. **Intent Score ≥ 50:** "Strong complementary potential - your needs match their skills"
3. **3+ Common Interests:** "Shared deep interests: [interest1], [interest2], [interest3]"
4. **1-2 Common Interests:** "Shared interests: [interest1], [interest2]"
5. **Fallback:** "Potential peer connection"

**Event Addition:**
- If events match → Reason += " | Both attending: [event1], [event2]"

---

## Icebreaker Generation

**Process:**
1. **Top 3 Matches Only:** Icebreakers generated only for top 3 candidates (to save tokens/latency)
2. **AI-Generated:** Uses OpenAI GPT-4o-mini to create personalized introduction
3. **Fallback:** If AI fails, uses match reason

**Prompt Includes:**
- Both users' profiles (name, location, roles, goals, interests)
- Match reason
- Common interests
- Shared events

**Output:**
- 2-3 sentences
- Mentions complementary needs or shared interests
- Highlights specific topic
- Suggests first step (e.g., "Exchange Telegram handles" or "Connect before [Event]")
- Warm, professional, Web3-focused
- Minimal emojis (💜, 🤝)

---

## Return Value

**Returns:**
- **Top 3 matches** (sorted by score, highest first)
- **Each match includes:**
  - `userId`: Matched user's ID
  - `profile`: Full user profile
  - `score`: Total compatibility score (0-100+)
  - `intentScore`: Intent matching score (0-100)
  - `interestScore`: Interest overlap score (0-100)
  - `eventScore`: Event synchronization score (0 or 100)
  - `reason`: Human-readable match reason
  - `commonInterests`: Array of shared interests
  - `sharedEvents`: Array of shared events
  - `icebreaker`: AI-generated introduction message
  - `platform`: Platform membership ("Grow3dge", "SI Her", "Both", or undefined)

---

## Example Match Flow

**User A Profile:**
- Name: "Alice"
- Roles: ["Founder/Builder"]
- Goals: ["Investors/grant programs"]
- Interests: ["AI", "Web3 Growth Marketing"]
- Events: ["Consensus 2024"]

**User B Profile:**
- Name: "Bob"
- Roles: ["Investor/Grant Program Operator"]
- Goals: ["Startups to invest in"]
- Interests: ["AI", "Cybersecurity"]
- Events: ["Consensus 2024"]

**Calculation:**
1. **Intent Score:**
   - Alice seeks investors → Bob is investor → +50
   - Bob seeks startups → Alice is founder → +50
   - **Total: 100**

2. **Interest Score:**
   - Common: ["AI"]
   - Union: ["AI", "Web3 Growth Marketing", "Cybersecurity"] = 3
   - Similarity: 1/3 = 0.33
   - **Score: 0.33 × 100 × 0.8 = 26.4**

3. **Event Score:**
   - Shared: ["Consensus 2024"]
   - **Score: 100**

4. **Total Score:**
   - (100 × 0.6) + (26.4 × 0.3) + (100 × 0.1) + 15
   - = 60 + 7.92 + 10 + 15
   - = **92.92 points**

5. **Result:**
   - ✅ Above threshold (60) → Match found!
   - ✅ Above high-demand threshold (75) → Passes investor filter
   - **Reason:** "Perfect complementary match - your goals align with their expertise! | Both attending: Consensus 2024"
   - **Icebreaker:** AI-generated personalized introduction

---

## Configuration

**Default Config:**
```typescript
{
  minScoreThreshold: 60,        // Minimum score to match
  intentWeight: 0.6,            // 60% weight for intent
  interestWeight: 0.3,          // 30% weight for interests
  eventWeight: 0.1,             // 10% weight for events
  highDemandRoles: ['Investor/Grant Program Operator'],
  highDemandThreshold: 75        // Higher threshold for investors
}
```

**Configurable Per Request:**
- Can override `minScoreThreshold` (e.g., background checks use 60, manual requests might use 75)

---

## Key Features

1. **Weighted Scoring:** Intent is most important (60%), interests secondary (30%), events bonus (10%)
2. **Complementary Matching:** Focuses on what users need vs. what others offer
3. **Platform Isolation:** Grow3dge and SI Her members only match within their platforms
4. **Event Boost:** Attending same events guarantees minimum 85 score
5. **High-Demand Filtering:** Investors require higher scores to prevent spam
6. **AI Icebreakers:** Personalized introductions for top 3 matches
7. **Primary User Resolution:** Prevents duplicate matches across platforms
8. **Flexible Interest Matching:** Substring matching handles variations

---

## Performance Optimizations

1. **Top 3 Limiting:** Only generates icebreakers for top 3 matches
2. **Early Exits:** Skips users below threshold immediately
3. **Primary User Resolution:** Prevents duplicate processing
4. **Database Queries:** Efficient filtering at database level

---

This matching system prioritizes **complementary connections** (what you need vs. what they offer) over simple similarity, making it ideal for a professional networking platform! 🚀


