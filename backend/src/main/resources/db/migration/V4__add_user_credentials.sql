-- Migration V4 : Table des identifiants utilisateur (mots de passe)
-- Les mots de passe sont stockés hashés avec bcrypt (jamais en clair)
-- Date: 2025

CREATE TABLE IF NOT EXISTS ddsshare_user_credentials (
    email VARCHAR(255) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherche par email (déjà couvert par PK)
CREATE INDEX IF NOT EXISTS idx_user_credentials_email ON ddsshare_user_credentials(email);

-- Commentaire pour documentation
COMMENT ON TABLE ddsshare_user_credentials IS 'Identifiants utilisateur - mots de passe hashés avec bcrypt';
COMMENT ON COLUMN ddsshare_user_credentials.password_hash IS 'Hash bcrypt du mot de passe - jamais stocker en clair';
