# Onboarding Flow Documentation

## Overview
The onboarding flow collects user information to create profiles and enable matchmaking. The flow has been updated to prioritize email collection early in the process to enable cross-platform profile continuity.

## Flow Order

### Primary Flow (New Users)
1. **ASK_LANGUAGE** → User selects language (1-4)
2. **ASK_NAME** → User provides their name
3. **ASK_EMAIL** → User provides email address
4. **ASK_PROFILE_CHOICE** (conditional) → If email exists, user chooses:
   - Continue with existing profile
   - Create new profile
5. **ASK_LOCATION** → User provides location (optional - can type "Next" to skip)
6. **ASK_ROLE** → User selects professional roles (multiple allowed)
7. **ASK_INTERESTS** → User selects interests (multiple allowed)
8. **ASK_CONNECTION_GOALS** → User selects connection goals (multiple allowed)
9. **ASK_EVENTS** → User provides events/conferences (optional - can type "Next" to skip)
10. **ASK_SOCIALS** → User provides social media links (optional - can type "Next" to skip)
11. **ASK_TELEGRAM_HANDLE** → User provides Telegram handle
12. **ASK_GENDER** → User provides gender (optional - can type "Next" to skip)
13. **ASK_NOTIFICATIONS** → User opts in/out of match notifications
14. **CONFIRMATION** → User reviews and confirms profile
15. **COMPLETED** → Onboarding complete

## Step Details

### 1. ASK_LANGUAGE
- **Question**: "What's your preferred language? 1. English 2. Spanish 3. Portuguese 4. French"
- **Input**: Number (1-4)
- **Next Step**: ASK_NAME
- **Validation**: Must be valid number 1-4

### 2. ASK_NAME
- **Question**: "What's your preferred name?"
- **Input**: Text (user's name)
- **Next Step**: ASK_EMAIL
- **Validation**: Any non-empty text

### 3. ASK_EMAIL
- **Question**: "To help us connect your profile with your SI<3> Her and/or Grow3dge account, please share the email address you registered with. What's your email address?"
- **Input**: Valid email address
- **Next Step**: 
  - If email exists for another user → ASK_PROFILE_CHOICE
  - If email is new → ASK_LOCATION
- **Validation**: Must match email regex pattern

### 4. ASK_PROFILE_CHOICE (Conditional)
- **Trigger**: Email provided matches an existing profile
- **Question**: "We found an existing Agent Kaia profile connected to this email address. Would you like to: 1. Continue with your existing profile 2. Create a new profile"
- **Input**: 
  - "1" or "continue" or "existing" → Loads existing profile, creates user mapping, sets to COMPLETED
  - "2" or "recreate" or "new" → Continues with ASK_LOCATION
- **Next Step**: 
  - Continue → COMPLETED (profile loaded)
  - Recreate → ASK_LOCATION

### 5. ASK_LOCATION
- **Question**: "What's your location (city and country)? 📍 (optional). To move on to the next question, type 'Next'"
- **Input**: Location text or "Next" to skip
- **Next Step**: ASK_ROLE
- **Validation**: Optional - can be skipped

### 6. ASK_ROLE
- **Question**: Lists 10 professional roles (Founder/Builder, Marketing/BD, DAO Council, Community Leader, Investor, Early Web3 Explorer, Media, Artist, Developer, Other)
- **Input**: Numbers separated by commas (e.g., "1, 4") or text for custom roles
- **Next Step**: ASK_INTERESTS
- **Validation**: At least one selection required

### 7. ASK_INTERESTS
- **Question**: Lists 9 interest topics (Web3 Growth Marketing, Sales/BD, Education 3.0, AI, Cybersecurity, DAOs, Tokenomics, Fundraising, DeepTech)
- **Input**: Numbers separated by commas (e.g., "2,3") or text for custom topics
- **Next Step**: ASK_CONNECTION_GOALS
- **Validation**: At least one selection required

### 8. ASK_CONNECTION_GOALS
- **Question**: Lists 6 connection goals (Startups to invest in, Investors/grant programs, Growth tools, Sales/BD tools, Communities/DAOs, Job opportunities)
- **Input**: Numbers separated by commas (e.g., "3, 4") or text for custom goals
- **Next Step**: ASK_EVENTS
- **Validation**: At least one selection required

### 9. ASK_EVENTS
- **Question**: "I am also able to match you with other Grow3dge members that are attending the same events and conferences. Can you share any events that you will be attending coming up (event name, date, and location)? (optional). To move on to the next question, type 'Next'"
- **Input**: Event details or "Next" to skip
- **Next Step**: ASK_SOCIALS
- **Validation**: Optional - can be skipped

### 10. ASK_SOCIALS
- **Question**: "Can you share your digital links and/or social media profiles so we can share those with your matches? (optional). To move on to the next question, type 'Next'"
- **Input**: Social media links or "Next" to skip
- **Next Step**: ASK_TELEGRAM_HANDLE
- **Validation**: Optional - can be skipped

### 11. ASK_TELEGRAM_HANDLE
- **Question**: "What's your Telegram handle? (optional)"
- **Input**: Telegram handle (with or without @)
- **Next Step**: ASK_GENDER
- **Validation**: Optional

### 12. ASK_GENDER
- **Question**: "What's your gender? (optional). To move on to the next question, type 'Next'"
- **Input**: Gender text or "Next" to skip
- **Next Step**: ASK_NOTIFICATIONS
- **Validation**: Optional - can be skipped

### 13. ASK_NOTIFICATIONS
- **Question**: "Would you like to receive notifications when I find matches for you? (Yes/No)"
- **Input**: "Yes" or "No"
- **Next Step**: CONFIRMATION
- **Validation**: Must be "Yes" or "No"

### 14. CONFIRMATION
- **Question**: Displays formatted profile summary with all collected information
- **Input**: 
  - "Yes" or "Confirm" → COMPLETED
  - "No" or "Update" → AWAITING_UPDATE_FIELD
  - Field name (e.g., "update name") → UPDATING_[FIELD]
- **Next Step**: COMPLETED or edit flow

### 15. COMPLETED
- **Status**: Onboarding complete
- **Actions**: User can request matches, view profile, update fields

## Cross-Platform Profile Continuity

### User Mapping System
When a user continues with an existing profile (via ASK_PROFILE_CHOICE), the system:
1. Creates a mapping in `user_mappings` table/collection:
   - `platform_user_id`: Current platform's userId (Telegram or Web)
   - `primary_user_id`: Original userId where profile is stored
   - `platform`: "telegram" or "web"
2. All subsequent operations (matching, follow-ups, analytics) use the `primary_user_id`
3. Profile updates are stored under the `primary_user_id`

### Flow Examples

#### Example 1: New User (Telegram)
```
NONE → ASK_LANGUAGE → ASK_NAME → ASK_EMAIL → ASK_LOCATION → ... → COMPLETED
```

#### Example 2: Existing User on New Platform (Web)
```
NONE → ASK_LANGUAGE → ASK_NAME → ASK_EMAIL → ASK_PROFILE_CHOICE → COMPLETED
(Profile loaded from original platform)
```

#### Example 3: User Chooses to Recreate Profile
```
NONE → ASK_LANGUAGE → ASK_NAME → ASK_EMAIL → ASK_PROFILE_CHOICE → ASK_LOCATION → ... → COMPLETED
(New profile created, email can be same but profile is separate)
```

## Profile Update Flow

Users can update their profile at any time after completion:
- Say "update" or "update [field name]"
- System transitions to `UPDATING_[FIELD]` state
- User provides new value
- System transitions to `CONFIRMATION` to show updated profile
- User confirms or makes more changes

## State Management

- All onboarding state is stored in cache with key: `onboarding_{userId}`
- State includes: `step`, `profile` object, `language`
- Profile object contains all collected fields
- When using primary userId mapping, state is stored under `onboarding_{primaryUserId}`

## Error Handling

- Invalid input: System stays on current step, LLM asks again
- Email validation: Must match regex pattern, otherwise re-asked
- Database errors: Logged, user can retry
- Missing fields: System checks and asks for missing required fields

## Multi-Language Support

All questions are available in:
- English (en)
- Spanish (es)
- Portuguese (pt)
- French (fr)

Language is set at the beginning and persists throughout onboarding.

