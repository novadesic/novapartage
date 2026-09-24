-- Migration V8 : notifications d'expiration des access tokens
-- Date: 2026

CREATE TABLE IF NOT EXISTS access_token_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token_id UUID NOT NULL,
    notification_delta_hours INTEGER NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    CONSTRAINT uk_token_notification_delta UNIQUE (access_token_id, notification_delta_hours)
);

CREATE INDEX IF NOT EXISTS idx_atn_access_token_id ON access_token_notifications(access_token_id);
CREATE INDEX IF NOT EXISTS idx_atn_sent_at ON access_token_notifications(sent_at);

COMMENT ON TABLE access_token_notifications IS 'Suivi des notifications d''expiration envoyées pour les access tokens';
