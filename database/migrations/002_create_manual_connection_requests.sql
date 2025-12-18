-- Create table for tracking manual connection requests (no-match notifications)
CREATE TABLE IF NOT EXISTS manual_connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT,
  telegram_handle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'processed', 'connected'
);

CREATE INDEX IF NOT EXISTS idx_manual_connection_requests_user_id ON manual_connection_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_connection_requests_created_at ON manual_connection_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_manual_connection_requests_status ON manual_connection_requests(status);

