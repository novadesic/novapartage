-- Invitations démo à usage unique (superadmins) + droits testeur limités dans le temps

CREATE TABLE IF NOT EXISTS ddsshare_demo_invites (
    id BIGSERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_by_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    invite_expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    reserved_email VARCHAR(255),
    reserved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_invites_expires ON ddsshare_demo_invites(invite_expires_at);

COMMENT ON TABLE ddsshare_demo_invites IS 'Jeton hashé SHA-256 ; le lien brut n''est montré qu''à la création.';

CREATE TABLE IF NOT EXISTS ddsshare_demo_entitlements (
    email VARCHAR(255) PRIMARY KEY,
    valid_until TIMESTAMP NOT NULL,
    invite_id BIGINT REFERENCES ddsshare_demo_invites(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_entitlements_valid_until ON ddsshare_demo_entitlements(valid_until);

COMMENT ON TABLE ddsshare_demo_entitlements IS 'Période testeur sans abonnement Kooneo ; après valid_until, compte standard.';
