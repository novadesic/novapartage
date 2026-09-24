-- Baseline Flyway : Schéma complet de la base de données en production
-- Date: 2025
-- Description: Représente l'état actuel de la base après toutes les migrations précédentes
-- Ce fichier ne modifie rien, il sert uniquement de baseline pour Flyway

-- Table: shares
CREATE TABLE IF NOT EXISTS shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255),
    original_file_name VARCHAR(255),
    file_path TEXT,
    file_extension VARCHAR(10),
    file_size BIGINT,
    owner_username VARCHAR(255),
    owner_email VARCHAR(255),
    selected_sheet VARCHAR(255),
    selected_sheet_index INTEGER,
    header_row INTEGER,
    data_start_row INTEGER,
    column_range VARCHAR(50),
    include_formulas BOOLEAN DEFAULT FALSE,
    preserve_formatting BOOLEAN DEFAULT FALSE,
    detected_fields JSONB,
    selected_permission VARCHAR(50),
    allow_comments BOOLEAN DEFAULT FALSE,
    allow_download BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20),
    headers JSONB,
    total_rows INTEGER,
    total_columns INTEGER,
    file_fingerprint VARCHAR(255),
    tabdata_schema_version VARCHAR(50),
    deletion_notification_sent BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_key_id VARCHAR(255)
);

-- Index pour shares
CREATE INDEX IF NOT EXISTS idx_shares_owner_username ON shares(owner_username);
CREATE INDEX IF NOT EXISTS idx_shares_status ON shares(status);
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at);
CREATE INDEX IF NOT EXISTS idx_shares_updated_at ON shares(updated_at);
CREATE INDEX IF NOT EXISTS idx_shares_is_encrypted ON shares(is_encrypted);
CREATE INDEX IF NOT EXISTS idx_shares_encryption_key_id ON shares(encryption_key_id);
CREATE INDEX IF NOT EXISTS idx_shares_deletion_notification 
    ON shares(status, updated_at, deletion_notification_sent) 
    WHERE status = 'INACTIVE';

-- Table: recipients
CREATE TABLE IF NOT EXISTS recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255),
    selected_sheet_index INTEGER DEFAULT 0,
    selections JSONB,
    editable_cells JSONB,
    column_labels JSONB,
    page_title VARCHAR(255),
    page_description TEXT,
    permission VARCHAR(50),
    allow_comments BOOLEAN DEFAULT FALSE,
    allow_download BOOLEAN DEFAULT FALSE,
    has_accessed BOOLEAN DEFAULT FALSE,
    last_accessed TIMESTAMP,
    CONSTRAINT fk_recipients_share FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
);

-- Index pour recipients
CREATE INDEX IF NOT EXISTS idx_recipients_share_id ON recipients(share_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);

-- Table: share_access_tabdata
CREATE TABLE IF NOT EXISTS share_access_tabdata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID,
    temp_file_id VARCHAR(255),
    recipient_email VARCHAR(255),
    headers JSONB,
    file_fingerprint VARCHAR(255),
    schema_version VARCHAR(50),
    computed_at TIMESTAMP,
    updated_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_compressed BOOLEAN DEFAULT FALSE,
    original_size BIGINT DEFAULT 0,
    total_rows INTEGER DEFAULT 0,
    selections_hash VARCHAR(255),
    CONSTRAINT uk_tabdata_share_recipient UNIQUE (share_id, recipient_email)
);

-- Index pour share_access_tabdata
CREATE INDEX IF NOT EXISTS idx_tabdata_share_id ON share_access_tabdata(share_id);
CREATE INDEX IF NOT EXISTS idx_tabdata_recipient_email ON share_access_tabdata(recipient_email);
CREATE INDEX IF NOT EXISTS idx_tabdata_temp_file_id ON share_access_tabdata(temp_file_id);

-- Table: share_access_tabdata_row
CREATE TABLE IF NOT EXISTS share_access_tabdata_row (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabdata_id UUID NOT NULL,
    row_index INTEGER NOT NULL,
    row_data BYTEA NOT NULL,
    searchable_text TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_key_id VARCHAR(255),
    CONSTRAINT fk_tabdata_row_tabdata FOREIGN KEY (tabdata_id) REFERENCES share_access_tabdata(id) ON DELETE CASCADE
);

-- Index pour share_access_tabdata_row
CREATE INDEX IF NOT EXISTS idx_tabdata_id ON share_access_tabdata_row(tabdata_id);
CREATE INDEX IF NOT EXISTS idx_tabdata_row_index ON share_access_tabdata_row(tabdata_id, row_index);
CREATE INDEX IF NOT EXISTS idx_searchable_text ON share_access_tabdata_row USING gin(to_tsvector('french', searchable_text));

-- Table: access_tokens
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID,
    recipient_email VARCHAR(255),
    token VARCHAR(255) UNIQUE,
    validity_days INTEGER,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(20),
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    created_by VARCHAR(255),
    validated_at TIMESTAMP,
    validated_by VARCHAR(255)
);

-- Index pour access_tokens
CREATE INDEX IF NOT EXISTS idx_tokens_share_id ON access_tokens(share_id);
CREATE INDEX IF NOT EXISTS idx_tokens_recipient_email ON access_tokens(recipient_email);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON access_tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON access_tokens(expires_at);

-- Table: form_submissions
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID,
    recipient_email VARCHAR(255),
    submitted_values JSONB,
    submitted_at TIMESTAMP,
    last_modified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index pour form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_share_id ON form_submissions(share_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_recipient_email ON form_submissions(recipient_email);
CREATE INDEX IF NOT EXISTS idx_form_submissions_is_active ON form_submissions(is_active);

-- Table: user_encryption_keys
CREATE TABLE IF NOT EXISTS user_encryption_keys (
    user_email VARCHAR(255) PRIMARY KEY,
    encrypted_key BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    rotated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index pour user_encryption_keys
CREATE INDEX IF NOT EXISTS idx_user_keys_email ON user_encryption_keys(user_email);
CREATE INDEX IF NOT EXISTS idx_user_keys_active ON user_encryption_keys(is_active);

-- Note: Ce fichier utilise CREATE TABLE IF NOT EXISTS pour ne pas modifier les tables existantes
-- Flyway marquera cette migration comme appliquée sans modifier la base de données
