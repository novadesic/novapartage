-- Migration V5 : Table des superadmins (lecture seule côté application)
-- Remplie directement en base par les ops. Pas d'accès front, pas d'API d'écriture.
-- Les superadmins se connectent en local (sans Kooneo) et sont toujours considérés actifs.
-- Date: 2026

CREATE TABLE IF NOT EXISTS ddsshare_superadmins (
    email VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_superadmins_email ON ddsshare_superadmins(email);

COMMENT ON TABLE ddsshare_superadmins IS 'Superadmins : connexion locale, toujours actifs. Rempli manuellement en base. Lecture seule par auth-service.';
