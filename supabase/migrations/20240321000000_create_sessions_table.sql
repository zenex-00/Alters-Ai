-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on expires for cleanup
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires);

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS trigger AS $$
BEGIN
    DELETE FROM sessions WHERE expires < CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to clean up expired sessions
CREATE OR REPLACE TRIGGER cleanup_sessions_trigger
    AFTER INSERT ON sessions
    EXECUTE FUNCTION cleanup_expired_sessions(); 