# Agent Kaia - Testing Brief

## Overview

Agent Kaia is a Telegram bot designed to help users in the SI<3> Web3 community connect through intelligent matchmaking. This document provides comprehensive testing guidelines for the test group.

**Primary Focus:** Matchmaking and community connections  
**Knowledge Sharing:** Currently unavailable (shows "coming soon" message)

---

## Test Environment

### Access
- **Platform:** Telegram
- **Bot Username:** `@AgentKaiaBot` (or as configured)
- **Web API:** Available on port 3001 (if testing web integration

### Test Data
- Use test accounts with different profiles
- Test with various language preferences
- Create profiles with different interests/roles for matchmaking tests

---

## Key Features to Test

### 1. Onboarding Flow (11 Steps)
### 2. Profile Management
### 3. Matchmaking
### 4. Language Support
### 5. Feature Requests
### 6. Knowledge Questions (Expected: "Coming Soon")
### 7. Data Persistence
### 8. Web API (if applicable)

---

## Detailed Test Scenarios

### Test Suite 1: Onboarding Flow

#### TC-001: Start Onboarding
**Steps:**
1. Send `Hello` or `Hi` to the bot
2. Observe the greeting message

**Expected:**
- Bot greets with: "Hello! I'm Agent Kaia, created by SI<3>..."
- Privacy policy link is included
- Bot asks for preferred name

**Pass Criteria:** ✅ Greeting appears correctly, name question follows

---

#### TC-002: Name Input
**Steps:**
1. Respond with your name (e.g., "Test User")
2. Observe next question

**Expected:**
- Bot acknowledges name
- Bot asks for preferred language

**Pass Criteria:** ✅ Name is accepted, language question appears

---

#### TC-003: Language Selection
**Steps:**
1. Respond with a number (1-4) for language
2. Observe next question

**Options:**
- 1. English
- 2. Spanish
- 3. Portuguese
- 4. French

**Expected:**
- Bot accepts number selection
- Bot asks for location (optional)

**Pass Criteria:** ✅ Language selected, location question appears

**Edge Cases to Test:**
- Invalid number (e.g., 5, 0, text)
- Multiple numbers
- Non-numeric input

---

#### TC-004: Location (Optional)
**Steps:**
1. Option A: Provide location (e.g., "New York, USA")
2. Option B: Type `Next` to skip

**Expected:**
- Option A: Location saved, next question (Roles) appears
- Option B: Skipped, next question (Roles) appears

**Pass Criteria:** ✅ Both skip and provide work correctly

---

#### TC-005: Roles Selection
**Steps:**
1. Respond with numbers (e.g., "1, 4" or "1,4 and Designer")
2. Observe next question

**Options:**
- 1. Founder/Builder
- 2. Marketing/BD/Partnerships
- 3. DAO Council Member/Delegate
- 4. Community Leader
- 5. Investor/Grant Program Operator
- 6. Early Web3 Explorer
- 7. Media
- 8. Artist
- 9. Developer
- 10. Other

**Expected:**
- Bot accepts number selections
- Custom roles are accepted (e.g., "and Designer")
- Bot asks for interests

**Pass Criteria:** ✅ Roles saved, interests question appears

**Edge Cases:**
- Single role
- Multiple roles
- Custom roles
- Invalid numbers

---

#### TC-006: Interests Selection
**Steps:**
1. Respond with numbers (e.g., "2,3" or "2,3 and DevRel")
2. Observe next question

**Options:**
- 1. Web3 Growth Marketing
- 2. Sales, BD & Partnerships
- 3. Education 3.0
- 4. AI
- 5. Cybersecurity
- 6. DAO's
- 7. Tokenomics
- 8. Fundraising
- 9. DeepTech

**Expected:**
- Bot accepts selections
- Custom interests accepted
- Bot asks for connection goals

**Pass Criteria:** ✅ Interests saved, goals question appears

---

#### TC-007: Connection Goals
**Steps:**
1. Respond with numbers or custom goals
2. Observe next question

**Options:**
- 1. Startups to invest in
- 2. Investors/grant programs
- 3. Growth tools, strategies, and/or support
- 4. Sales/BD tools, strategies and/or support
- 5. Communities and/or DAO's to join
- 6. New job opportunities

**Expected:**
- Bot accepts selections
- Bot asks for events (optional)

**Pass Criteria:** ✅ Goals saved, events question appears

---

#### TC-008: Events (Optional)
**Steps:**
1. Option A: Provide event details
2. Option B: Type `Next` to skip

**Expected:**
- Option A: Events saved
- Option B: Skipped
- Bot asks for social media (optional)

**Pass Criteria:** ✅ Both options work

---

#### TC-009: Social Media (Optional)
**Steps:**
1. Option A: Provide social links
2. Option B: Type `Next` to skip

**Expected:**
- Option A: Links saved
- Option B: Skipped
- Bot asks for Telegram handle

**Pass Criteria:** ✅ Both options work

---

#### TC-010: Telegram Handle
**Steps:**
1. Provide Telegram handle (with or without @)
2. Observe next question

**Expected:**
- Handle accepted
- Bot asks for gender (optional)

**Pass Criteria:** ✅ Handle saved, gender question appears

---

#### TC-011: Gender (Optional)
**Steps:**
1. Option A: Respond with number (1-4)
2. Option B: Type `Next` to skip
3. Option C: Answer "Yes" to diversity research question (if applicable)

**Options:**
- 1. Female
- 2. Male
- 3. Non-binary
- 4. Prefer not to say

**Expected:**
- Option A: Gender saved
- Option B: Skipped
- Option C: Diversity research interest tracked
- Bot asks for notification preferences

**Pass Criteria:** ✅ All options work correctly

---

#### TC-012: Notifications
**Steps:**
1. Respond with number (1-3)

**Options:**
- 1. Daily
- 2. Weekly
- 3. Never

**Expected:**
- Notification preference saved
- Bot shows profile summary
- Bot asks for confirmation

**Pass Criteria:** ✅ Summary appears, confirmation requested

---

#### TC-013: Profile Confirmation
**Steps:**
1. Review profile summary
2. Option A: Type `Yes` or `Confirm`
3. Option B: Use edit commands to change fields

**Expected:**
- Option A: Onboarding completes
- Option B: Edit flow begins
- Completion message appears with profile summary

**Pass Criteria:** ✅ Onboarding completes successfully

---

### Test Suite 2: Profile Management

#### TC-014: View Profile
**Steps:**
1. After completing onboarding, say "my profile" or "show my history"
2. Observe response

**Expected:**
- Profile summary displayed
- Match history shown (if any)
- All profile fields visible

**Pass Criteria:** ✅ Profile displays correctly

---

#### TC-015: Edit Profile - Natural Language
**Steps:**
1. Say "edit", "edit my profile", "change my details", or "update profile"
2. Observe response

**Expected:**
- Bot presents numbered list of editable fields
- User can select field by number

**Pass Criteria:** ✅ Edit menu appears

---

#### TC-016: Edit Name
**Steps:**
1. Say "edit name" or select from edit menu
2. Provide new name
3. Verify change

**Expected:**
- Bot asks for new name
- Name updated
- Confirmation message

**Pass Criteria:** ✅ Name updated successfully

---

#### TC-017: Edit Location
**Steps:**
1. Say "edit location"
2. Provide new location or "Next" to clear
3. Verify change

**Expected:**
- Location updated or cleared
- Confirmation message

**Pass Criteria:** ✅ Location updated correctly

---

#### TC-018: Edit Roles
**Steps:**
1. Say "edit roles"
2. Provide new role selections
3. Verify change

**Expected:**
- Roles updated
- Confirmation message

**Pass Criteria:** ✅ Roles updated correctly

---

#### TC-019: Edit Interests
**Steps:**
1. Say "edit interests"
2. Provide new interest selections
3. Verify change

**Expected:**
- Interests updated
- Confirmation message

**Pass Criteria:** ✅ Interests updated correctly

---

#### TC-020: Edit Other Fields
**Test:** Edit Goals, Events, Socials, Telegram Handle, Gender, Notifications

**Expected:**
- Each field can be edited independently
- Changes persist
- Confirmation messages appear

**Pass Criteria:** ✅ All fields editable

---

### Test Suite 3: Matchmaking

#### TC-021: Find Match - Basic
**Steps:**
1. Complete onboarding with interests/roles
2. Say "find a match" or "match me"
3. Observe response

**Expected:**
- Bot searches for matches
- If match found: Introduces match with details
- Match saved to history

**Pass Criteria:** ✅ Match found and displayed

---

#### TC-022: Find Match - No Matches
**Steps:**
1. Complete onboarding (ensure unique interests if needed)
2. Say "find a match"
3. Observe response

**Expected:**
- Bot responds: "I couldn't find a match within the current pool..."
- Mentions SI<3> will explore broader network
- Directs to members@si3.space
- Email notification sent to members@si3.space (backend)

**Pass Criteria:** ✅ No-match message appears correctly

---

#### TC-023: Match History
**Steps:**
1. After finding matches, say "my history" or "show matches"
2. Observe response

**Expected:**
- All matches displayed with dates
- Match details visible
- Profile information shown

**Pass Criteria:** ✅ History displays correctly

---

#### TC-024: Real-Time Match Notifications
**Steps:**
1. User A completes onboarding
2. User B completes onboarding with matching interests
3. Observe if User A receives notification

**Expected:**
- User A receives match notification
- Notification includes User B's details
- Both users can see match in history

**Pass Criteria:** ✅ Real-time notifications work

---

### Test Suite 4: Language Support

#### TC-025: Change Language - Explicit
**Steps:**
1. Say "change language to Spanish" (or other language)
2. Continue conversation
3. Observe language

**Expected:**
- Language changes immediately
- All subsequent messages in new language
- Profile updated with language preference

**Pass Criteria:** ✅ Language changes correctly

---

#### TC-026: Language Persistence
**Steps:**
1. Change language
2. Restart conversation (new session)
3. Observe language

**Expected:**
- Language preference remembered
- Messages in selected language

**Pass Criteria:** ✅ Language persists

---

#### TC-027: Language - No Accidental Change
**Steps:**
1. Set language to English
2. Send message with Spanish/Portuguese words (e.g., link with "español")
3. Observe language

**Expected:**
- Language does NOT change
- Only changes with explicit command

**Pass Criteria:** ✅ Language stays unchanged

---

### Test Suite 5: Feature Requests

#### TC-028: Feature Request - With Details
**Steps:**
1. Say "I want you to be able to send emails"
2. Observe response

**Expected:**
- Bot immediately processes request
- Confirms: "Thank you for your suggestion..."
- Mentions tech@si3.space
- Request saved to database

**Pass Criteria:** ✅ Request processed immediately

---

#### TC-029: Feature Request - Without Details
**Steps:**
1. Say "I want to make a feature request"
2. Observe response
3. Provide details
4. Observe final response

**Expected:**
- Bot asks: "Great! I'd love to hear your suggestion..."
- After details provided, request sent to tech@si3.space
- Confirmation message

**Pass Criteria:** ✅ Multi-turn flow works

---

#### TC-030: Feature Request - Natural Language
**Steps:**
1. Ask for something bot can't do (e.g., "Can you send me daily reminders?")
2. Observe response

**Expected:**
- Bot responds: "I am not able to perform that request yet..."
- Offers to take feature request
- Processes request if user provides details

**Pass Criteria:** ✅ Natural language detection works

---

### Test Suite 6: Knowledge Questions

#### TC-031: Knowledge Question - Web3 Concept
**Steps:**
1. Ask "what is a DAO" or "explain blockchain"
2. Observe response

**Expected:**
- Bot responds: "Great question! 🧠"
- Mentions: "I'm activating my peer-to-peer knowledge-sharing capabilities soon..."
- Redirects to matchmaking: "Would you like me to find you a match?"
- Does NOT provide definition

**Pass Criteria:** ✅ "Coming soon" message appears, no definition

---

#### TC-032: Knowledge Question - Other Topics
**Steps:**
1. Ask various Web3/educational questions
2. Observe responses

**Expected:**
- All knowledge questions get "coming soon" response
- Consistent messaging
- Matchmaking redirect

**Pass Criteria:** ✅ Consistent behavior

---

### Test Suite 7: Restart & Recovery

#### TC-033: Restart Onboarding
**Steps:**
1. Complete onboarding
2. Say "restart" or "start over"
3. Observe behavior

**Expected:**
- Onboarding resets
- Can update profile information
- Previous data cleared or reset

**Pass Criteria:** ✅ Restart works correctly

---

#### TC-034: Data Persistence
**Steps:**
1. Complete onboarding
2. Note profile details
3. Wait for deployment/restart (if possible)
4. Check if profile persists

**Expected:**
- Profile data survives restarts
- Onboarding state remembered
- Matches preserved

**Pass Criteria:** ✅ Data persists (requires backend verification)

---

### Test Suite 8: Edge Cases & Error Handling

#### TC-035: Invalid Input - Numbers
**Steps:**
1. During onboarding, provide invalid numbers (e.g., 99, 0, -1)
2. Observe response

**Expected:**
- Bot handles gracefully
- Asks for valid input
- Does not crash

**Pass Criteria:** ✅ Error handling works

---

#### TC-036: Invalid Input - Text Where Numbers Expected
**Steps:**
1. During language/role selection, provide text instead of numbers
2. Observe response

**Expected:**
- Bot handles gracefully
- Provides guidance
- Allows retry

**Pass Criteria:** ✅ Error handling works

---

#### TC-037: Empty Messages
**Steps:**
1. Send empty message or only spaces
2. Observe response

**Expected:**
- Bot handles gracefully
- Asks for input
- Does not crash

**Pass Criteria:** ✅ Error handling works

---

#### TC-038: Rapid Messages
**Steps:**
1. Send multiple messages quickly
2. Observe responses

**Expected:**
- Bot processes messages correctly
- No duplicate responses
- State maintained correctly

**Pass Criteria:** ✅ Handles rapid input

---

#### TC-039: Long Input
**Steps:**
1. Provide very long text (e.g., 1000+ characters)
2. Observe response

**Expected:**
- Bot handles long input
- Truncates if necessary
- Processes correctly

**Pass Criteria:** ✅ Long input handled

---

### Test Suite 9: Web API (If Testing)

#### TC-040: POST /api/chat
**Steps:**
1. Send POST request to `/api/chat`
2. Include userId and message
3. Observe response

**Expected:**
- Same functionality as Telegram
- Returns JSON response
- Profile and onboarding status included

**Pass Criteria:** ✅ API works correctly

---

#### TC-041: GET /api/history/:userId
**Steps:**
1. Send GET request to `/api/history/:userId`
2. Observe response

**Expected:**
- Returns user profile
- Returns match history
- Returns onboarding status

**Pass Criteria:** ✅ History endpoint works

---

#### TC-042: API Authentication
**Steps:**
1. Test with valid API key
2. Test with invalid API key
3. Test without API key (if disabled)

**Expected:**
- Valid key: Request succeeds
- Invalid key: Request rejected
- No key: Behavior matches configuration

**Pass Criteria:** ✅ Authentication works

---

## Expected Behaviors Summary

### ✅ Should Work
- Complete onboarding flow (all 11 steps)
- Edit any profile field
- Find matches based on interests
- Change language explicitly
- Submit feature requests
- View profile and history
- Restart onboarding
- Handle optional fields (skip with "Next")
- Natural language commands ("edit", "change", "update")
- Multi-turn feature requests
- Real-time match notifications

### ❌ Should NOT Work (By Design)
- Knowledge-sharing definitions (shows "coming soon")
- Accidental language switching (only explicit commands)
- Duplicate name/language requests (skips if already provided)

---

## Known Limitations

1. **Knowledge Sharing:** Temporarily disabled, shows "coming soon" message
2. **Email Notifications:** Requires SMTP configuration (backend)
3. **Match Algorithm:** Based on interest overlap (2+ common interests)
4. **Language Detection:** Only changes with explicit command (by design)
5. **Database:** Requires MongoDB or PostgreSQL connection

---

## Bug Reporting Guidelines

### When Reporting Bugs, Include:

1. **Test Case ID** (e.g., TC-001)
2. **Steps to Reproduce:**
   - Exact messages sent
   - Order of actions
3. **Expected Behavior:**
   - What should have happened
4. **Actual Behavior:**
   - What actually happened
5. **Screenshots/Logs:**
   - Telegram conversation screenshots
   - Any error messages
6. **Environment:**
   - Language setting
   - Onboarding status
   - Profile state
7. **Frequency:**
   - Does it happen every time?
   - Intermittent?

### Bug Severity Levels

- **Critical:** Bot crashes, data loss, cannot complete onboarding
- **High:** Feature doesn't work, incorrect responses, data corruption
- **Medium:** Minor functionality issues, edge cases
- **Low:** UI/UX improvements, typos, minor inconsistencies

### Where to Report

- **Email:** tech@si3.space
- **Include:** Subject line with "Kaia Testing - [Severity] - [Brief Description]"

---

## Test Data Setup

### Recommended Test Profiles

**Profile 1: Complete Profile**
- Name: Test User 1
- Language: English
- Location: New York, USA
- Roles: Founder/Builder, Developer
- Interests: Web3 Growth Marketing, AI, DAO's
- Goals: Startups to invest in, Growth tools
- Events: ETHDenver 2024
- Socials: @testuser1
- Telegram: @testuser1
- Gender: Prefer not to say
- Notifications: Daily

**Profile 2: Minimal Profile**
- Name: Test User 2
- Language: Spanish
- Roles: Community Leader
- Interests: Education 3.0
- Goals: Communities to join
- Telegram: @testuser2
- Notifications: Weekly
- (Skip optional fields)

**Profile 3: Different Language**
- Name: Test User 3
- Language: Portuguese
- Roles: Artist, Media
- Interests: DeepTech, Cybersecurity
- Goals: New job opportunities
- Telegram: @testuser3
- Notifications: Never

---

## Testing Checklist

### Pre-Testing
- [ ] Access to test bot confirmed
- [ ] Test accounts created
- [ ] Understanding of test scenarios

### Onboarding
- [ ] TC-001: Start onboarding
- [ ] TC-002: Name input
- [ ] TC-003: Language selection
- [ ] TC-004: Location (optional)
- [ ] TC-005: Roles selection
- [ ] TC-006: Interests selection
- [ ] TC-007: Connection goals
- [ ] TC-008: Events (optional)
- [ ] TC-009: Social media (optional)
- [ ] TC-010: Telegram handle
- [ ] TC-011: Gender (optional)
- [ ] TC-012: Notifications
- [ ] TC-013: Profile confirmation

### Profile Management
- [ ] TC-014: View profile
- [ ] TC-015: Edit profile menu
- [ ] TC-016: Edit name
- [ ] TC-017: Edit location
- [ ] TC-018: Edit roles
- [ ] TC-019: Edit interests
- [ ] TC-020: Edit other fields

### Matchmaking
- [ ] TC-021: Find match (with matches)
- [ ] TC-022: Find match (no matches)
- [ ] TC-023: Match history
- [ ] TC-024: Real-time notifications

### Language
- [ ] TC-025: Change language
- [ ] TC-026: Language persistence
- [ ] TC-027: No accidental change

### Feature Requests
- [ ] TC-028: Request with details
- [ ] TC-029: Request without details
- [ ] TC-030: Natural language request

### Knowledge Questions
- [ ] TC-031: Web3 concept question
- [ ] TC-032: Other knowledge questions

### Edge Cases
- [ ] TC-033: Restart onboarding
- [ ] TC-034: Data persistence
- [ ] TC-035: Invalid numbers
- [ ] TC-036: Invalid text
- [ ] TC-037: Empty messages
- [ ] TC-038: Rapid messages
- [ ] TC-039: Long input

### Web API (if applicable)
- [ ] TC-040: POST /api/chat
- [ ] TC-041: GET /api/history
- [ ] TC-042: API authentication

---

## Success Criteria

### Overall Test Pass Rate
- **Minimum:** 90% of test cases pass
- **Critical:** 100% of critical test cases pass

### Key Metrics
- Onboarding completion rate
- Match accuracy
- Response time
- Error rate
- User satisfaction (qualitative)

---

## Questions & Support

### For Testing Questions
- **Email:** tech@si3.space
- **Subject:** "Kaia Testing - Question"

### For Technical Issues
- Check logs (if accessible)
- Document exact error messages
- Include user ID and timestamp

---

## Version History

- **v294** (Current) - Database persistence, web API, improved profile editing
- Previous versions: See git history
