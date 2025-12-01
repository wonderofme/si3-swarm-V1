-- Create matches table to track user matches
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "matchedUserId" UUID NOT NULL,
    "roomId" UUID, -- Telegram chat ID / room ID for sending messages
    "matchDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending', -- pending, connected, not_interested, expired
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("userId", "matchedUserId", "matchDate")
);

-- Create follow_ups table to track scheduled follow-up messages
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "matchId" UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL, -- '3_day_checkin' or '7_day_next_match'
    "scheduledDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "sentDate" TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, responded, skipped
    "response" TEXT, -- User's response (Yes/No/Not interested)
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_matches_userId ON matches("userId");
CREATE INDEX IF NOT EXISTS idx_matches_matchedUserId ON matches("matchedUserId");
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_userId ON follow_ups("userId");
CREATE INDEX IF NOT EXISTS idx_follow_ups_matchId ON follow_ups("matchId");
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduledDate ON follow_ups("scheduledDate");
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

