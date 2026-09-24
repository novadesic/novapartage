-- Migration V2 : Ajout du chiffrement pour row_data dans share_access_tabdata_row
-- Date: 2025-01-10
-- Description: 
--   - S'assure que row_data est en BYTEA (conversion depuis JSONB si nécessaire)
--   - Ajoute les colonnes is_encrypted et encryption_key_id si elles n'existent pas
--   - Met à jour les valeurs NULL de is_encrypted à FALSE pour rétrocompatibilité

-- 1. Ajouter les colonnes is_encrypted et encryption_key_id si elles n'existent pas
DO $$
BEGIN
    -- Ajouter is_encrypted si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'share_access_tabdata_row' 
        AND column_name = 'is_encrypted'
    ) THEN
        ALTER TABLE share_access_tabdata_row 
        ADD COLUMN is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
        
        RAISE NOTICE 'Colonne is_encrypted ajoutée à share_access_tabdata_row';
    END IF;
    
    -- Ajouter encryption_key_id si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'share_access_tabdata_row' 
        AND column_name = 'encryption_key_id'
    ) THEN
        ALTER TABLE share_access_tabdata_row 
        ADD COLUMN encryption_key_id VARCHAR(255);
        
        RAISE NOTICE 'Colonne encryption_key_id ajoutée à share_access_tabdata_row';
    END IF;
END $$;

-- 2. Mettre à jour les valeurs NULL de is_encrypted à FALSE (rétrocompatibilité)
UPDATE share_access_tabdata_row 
SET is_encrypted = FALSE 
WHERE is_encrypted IS NULL;

-- 3. Convertir la colonne row_data de JSONB à BYTEA si nécessaire
-- Cette conversion est nécessaire pour stocker les données chiffrées
DO $$
DECLARE
    current_type TEXT;
    row_count INTEGER;
BEGIN
    -- Vérifier le type actuel de la colonne
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'share_access_tabdata_row'
    AND column_name = 'row_data';
    
    -- Compter les lignes existantes
    SELECT COUNT(*) INTO row_count
    FROM share_access_tabdata_row;
    
    IF current_type = 'jsonb' THEN
        RAISE NOTICE 'Conversion de row_data de JSONB à BYTEA...';
        
        -- Convertir JSONB -> BYTEA avec la clause USING
        -- convert_to(row_data::text, 'UTF8') convertit le JSON en texte puis en bytes UTF-8
        ALTER TABLE share_access_tabdata_row 
            ALTER COLUMN row_data TYPE BYTEA 
            USING convert_to(row_data::text, 'UTF8');
        
        RAISE NOTICE 'Conversion terminée. % lignes converties.', row_count;
    ELSIF current_type = 'bytea' THEN
        RAISE NOTICE 'La colonne row_data est déjà en BYTEA - OK';
    ELSE
        RAISE WARNING 'Type inattendu pour row_data: %. Conversion non effectuée.', current_type;
    END IF;
END $$;

-- 4. Créer un index sur is_encrypted pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_tabdata_row_is_encrypted 
    ON share_access_tabdata_row(is_encrypted);

-- 5. Créer un index sur encryption_key_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tabdata_row_encryption_key_id 
    ON share_access_tabdata_row(encryption_key_id);

-- Note: Les données existantes non chiffrées continueront à fonctionner grâce au flag is_encrypted = FALSE
-- Les nouvelles données seront automatiquement chiffrées par l'application

