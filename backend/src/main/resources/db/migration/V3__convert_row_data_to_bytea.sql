-- Migration V3 : Conversion de row_data de JSONB à BYTEA
-- Date: 2025-01-10
-- Description: 
--   - Convertit la colonne row_data de JSONB à BYTEA si elle est encore en JSONB
--   - Cette migration est nécessaire car PostgreSQL ne peut pas convertir automatiquement JSONB -> BYTEA
--   - Les données JSONB sont converties en bytes UTF-8

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
        RAISE NOTICE 'Nombre de lignes à convertir: %', row_count;
        
        -- Convertir JSONB -> BYTEA avec la clause USING
        -- convert_to(row_data::text, 'UTF8') convertit le JSON en texte puis en bytes UTF-8
        ALTER TABLE share_access_tabdata_row 
            ALTER COLUMN row_data TYPE BYTEA 
            USING convert_to(row_data::text, 'UTF8');
        
        RAISE NOTICE 'Conversion terminée avec succès. % lignes converties.', row_count;
    ELSIF current_type = 'bytea' THEN
        RAISE NOTICE 'La colonne row_data est déjà en BYTEA - Aucune conversion nécessaire';
    ELSE
        RAISE WARNING 'Type inattendu pour row_data: %. Conversion non effectuée.', current_type;
    END IF;
END $$;

