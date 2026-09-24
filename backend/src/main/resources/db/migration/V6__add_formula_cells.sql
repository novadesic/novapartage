-- Ajout de la colonne formula_cells pour stocker les positions des cellules contenant des formules
ALTER TABLE share_access_tabdata ADD COLUMN IF NOT EXISTS formula_cells JSONB;
