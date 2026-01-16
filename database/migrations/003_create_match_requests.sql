-- Create table for match requests (request/approve flow)
CREATE TABLE IF NOT EXISTS match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL,           -- User who requested
  requested_id TEXT NOT NULL,           -- User being requested
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,             -- When approved/rejected
  response TEXT,                         -- 'approved' or 'rejected'
  match_score NUMERIC,                   -- Compatibility score
  match_reason TEXT,                     -- Why they matched
  expires_at TIMESTAMPTZ,                -- Expire after 7 days
  CONSTRAINT unique_request UNIQUE(requester_id, requested_id)
);

CREATE INDEX IF NOT EXISTS idx_match_requests_requester ON match_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_match_requests_requested ON match_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_match_requests_status ON match_requests(status);
CREATE INDEX IF NOT EXISTS idx_match_requests_created_at ON match_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_match_requests_expires_at ON match_requests(expires_at) WHERE status = 'pending';


