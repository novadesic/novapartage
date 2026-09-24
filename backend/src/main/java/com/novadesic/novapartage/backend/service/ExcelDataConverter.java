package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.ExcelData;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service de conversion des données Excel vers le format de tableau simplifié
 * Permet de transformer les données Excel en format générique utilisable par le frontend
 */
public class ExcelDataConverter {
    
    private static final Logger LOG = Logger.getLogger(ExcelDataConverter.class);
    
    /**
     * Convertit un objet ExcelData en liste de Maps pour le format tableData
     * 
     * @param excelData Les données Excel à convertir
     * @return Liste de Maps représentant les lignes du tableau
     */
    public static List<Map<String, Object>> convertToTableData(ExcelData excelData) {
        List<Map<String, Object>> tableData = new ArrayList<>();
        
        LOG.infof("🔄 Conversion ExcelData vers TableData");
        
        if (excelData == null) {
            LOG.warnf("❌ ExcelData est null");
            return tableData;
        }
        
        List<String> headers = excelData.getHeaders();
        List<Map<String, Object>> rows = excelData.getRows();
        
        if (headers == null || headers.isEmpty()) {
            LOG.warnf("❌ Headers manquants ou vides");
            return tableData;
        }
        
        if (rows == null || rows.isEmpty()) {
            LOG.warnf("❌ Rows manquants ou vides");
            return tableData;
        }
        
        LOG.infof("📊 Headers: %s", headers);
        LOG.infof("📊 Nombre de lignes: %d", rows.size());
        
        // Convertir chaque ligne
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> rowData = rows.get(i);
            Map<String, Object> convertedRow = new HashMap<>();
            
            // Normaliser la ligne : s'assurer que toutes les colonnes sont présentes avec les clés column-X
            for (int j = 0; j < headers.size(); j++) {
                String header = headers.get(j);
                String columnKey = "column-" + j;
                Object value = null;
                if (rowData != null) {
                    value = rowData.get(header);
                }
                // Garantir qu'on n'a jamais de valeurs null
                convertedRow.put(columnKey, value != null ? value : "");
            }
            
            // Ajouter l'index de ligne pour référence
            convertedRow.put("_rowIndex", i);
            
            tableData.add(convertedRow);
            
            LOG.debugf("📋 Ligne %d convertie: %d champs", i, convertedRow.size());
            if (i == 0) {
                LOG.infof("🔍 DEBUG: Première ligne convertie: %s", convertedRow);
            }
        }
        
        LOG.infof("✅ Conversion terminée: %d lignes générées", tableData.size());
        return tableData;
    }
    
    /**
     * Convertit un objet ExcelData en liste de Maps en filtrant selon les cellules sélectionnées
     * 
     * @param excelData Les données Excel à convertir
     * @param selectedCells Liste des cellules sélectionnées (optionnel)
     * @return Liste de Maps représentant les lignes filtrées du tableau
     */
    public static List<Map<String, Object>> convertToTableDataWithSelection(ExcelData excelData, List<CellPosition> selectedCells) {
        List<Map<String, Object>> tableData = new ArrayList<>();
        
        LOG.infof("🔄 Conversion ExcelData vers TableData avec sélection");
        
        if (excelData == null) {
            LOG.warnf("❌ ExcelData est null");
            return tableData;
        }
        
        List<String> headers = excelData.getHeaders();
        List<Map<String, Object>> rows = excelData.getRows();
        
        if (headers == null || headers.isEmpty()) {
            LOG.warnf("❌ Headers manquants ou vides");
            return tableData;
        }
        
        if (rows == null || rows.isEmpty()) {
            LOG.warnf("❌ Rows manquants ou vides");
            return tableData;
        }
        
        // Si pas de sélection, retourner toutes les données
        if (selectedCells == null || selectedCells.isEmpty()) {
            LOG.infof("📊 Aucune sélection spécifiée, retour de toutes les données");
            LOG.infof("🔍 DEBUG: Appel de convertToTableData avec excelData: %s", excelData);
            List<Map<String, Object>> result = convertToTableData(excelData);
            LOG.infof("🔍 DEBUG: Résultat de convertToTableData: %d lignes", result.size());
            if (!result.isEmpty()) {
                LOG.infof("🔍 DEBUG: Première ligne: %s", result.get(0));
            }
            return result;
        }
        
        LOG.infof("📊 Headers: %s", headers);
        LOG.infof("📊 Nombre de lignes: %d", rows.size());
        LOG.infof("📊 Cellules sélectionnées: %d", selectedCells.size());
        
        // Créer un map des cellules sélectionnées par ligne
        Map<Integer, List<Integer>> selectedCellsByRow = new HashMap<>();
        for (CellPosition cell : selectedCells) {
            selectedCellsByRow.computeIfAbsent(cell.row, k -> new ArrayList<>()).add(cell.col);
        }
        
        // Identifier toutes les colonnes qui ont au moins une cellule sélectionnée
        Set<Integer> allSelectedColumns = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            allSelectedColumns.add(cell.col);
        }
        
        // IMPORTANT: Trier les colonnes pour garantir un ordre cohérent
        List<Integer> orderedSelectedColumns = new ArrayList<>(allSelectedColumns);
        orderedSelectedColumns.sort(Integer::compareTo);
        
        LOG.infof("📊 Colonnes avec au moins une cellule sélectionnée (non triées): %s", allSelectedColumns);
        LOG.infof("📊 Colonnes avec au moins une cellule sélectionnée (triées): %s", orderedSelectedColumns);
        
        // Convertir TOUTES les lignes, mais filtrer les valeurs selon la sélection
        // IMPORTANT: Inclure toutes les lignes car les en-têtes ont déjà été traités
        
        // DEBUG: Afficher l'ordre des colonnes sélectionnées
        LOG.infof("📊 Ordre des colonnes sélectionnées: %s", orderedSelectedColumns);
        LOG.infof("📊 Headers disponibles: %s", headers);
        
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            // Inclure toutes les lignes car les en-têtes ont déjà été traités
            Map<String, Object> rowData = rows.get(rowIndex);
            Map<String, Object> convertedRow = new HashMap<>();
            
            // Vérifier quelles cellules sont sélectionnées pour cette ligne
            List<Integer> selectedColsForThisRow = selectedCellsByRow.get(rowIndex);
            boolean hasSelectedCellsInThisRow = selectedColsForThisRow != null && !selectedColsForThisRow.isEmpty();
            
            // DEBUG: Log spécial pour la ligne 0
            if (rowIndex == 0) {
                LOG.infof("🔍 DEBUG Ligne 0: selectedColsForThisRow=%s, hasSelectedCellsInThisRow=%s", selectedColsForThisRow, hasSelectedCellsInThisRow);
                LOG.infof("🔍 DEBUG Ligne 0: rowData=%s", rowData);
                LOG.infof("🔍 DEBUG Ligne 0: orderedSelectedColumns=%s", orderedSelectedColumns);
            }
            
            // Pour chaque ligne, ajouter toutes les colonnes qui ont au moins une cellule sélectionnée
            for (Integer colIndex : orderedSelectedColumns) {
                if (colIndex >= 0 && colIndex < headers.size()) {
                    String header = headers.get(colIndex);
                    String columnKey = "column-" + colIndex; // IMPORTANT: Utiliser la clé column-X
                    Object value = null;
                    
                    // Vérifier si cette cellule spécifique est sélectionnée
                    boolean isThisCellSelected = selectedColsForThisRow != null && selectedColsForThisRow.contains(colIndex);
                    
                    if (rowData != null) {
                        value = rowData.get(header);
                    }
                    
                    // DEBUG: Log spécial pour la ligne 0
                    if (rowIndex == 0) {
                        LOG.infof("🔍 DEBUG Ligne 0, colonne %d: header='%s', columnKey='%s', value='%s', isThisCellSelected=%s", colIndex, header, columnKey, value, isThisCellSelected);
                    }
                    
                    // Afficher la valeur réelle pour toutes les cellules
                    // Les cellules sélectionnées seront marquées comme éditables côté frontend
                    convertedRow.put(columnKey, value != null ? value : "");
                    if (isThisCellSelected) {
                        LOG.debugf("📋 Ligne %d, colonne %d -> header '%s' -> columnKey '%s' -> valeur '%s' (SÉLECTIONNÉE)", rowIndex, colIndex, header, columnKey, value);
                    } else {
                        LOG.debugf("📋 Ligne %d, colonne %d -> header '%s' -> columnKey '%s' -> valeur '%s' (NON sélectionnée mais affichée)", rowIndex, colIndex, header, columnKey, value);
                    }
                } else {
                    LOG.warnf("⚠️ Index de colonne invalide: %d (headers.size: %d)", colIndex, colIndex, headers.size());
                }
            }
            
            // Ajouter l'index de ligne pour référence
            convertedRow.put("_rowIndex", rowIndex);
            
            tableData.add(convertedRow);
            
            // DEBUG: Afficher l'ordre des colonnes dans cette ligne
            List<String> columnOrder = convertedRow.keySet().stream()
                .filter(key -> key.startsWith("column-"))
                .sorted((a, b) -> {
                    int aIndex = Integer.parseInt(a.replace("column-", ""));
                    int bIndex = Integer.parseInt(b.replace("column-", ""));
                    return Integer.compare(aIndex, bIndex);
                })
                .collect(Collectors.toList());
            
            LOG.infof("📋 Ligne %d traitée: %d colonnes avec sélection, %d cellules sélectionnées dans cette ligne, ordre: %s", 
                     rowIndex, allSelectedColumns.size(), selectedColsForThisRow != null ? selectedColsForThisRow.size() : 0, columnOrder);
        }
        
        LOG.infof("✅ Conversion avec sélection terminée: %d lignes générées", tableData.size());
        return tableData;
    }
    
    /**
     * Classe utilitaire pour représenter une position de cellule
     */
    public static class CellPosition {
        public int row;
        public int col;
        
        public CellPosition() {}
        
        public CellPosition(int row, int col) {
            this.row = row;
            this.col = col;
        }
    }
    
    /**
     * Génère des labels de colonnes par défaut à partir des headers
     * 
     * @param headers Liste des headers
     * @return Map des labels de colonnes (header -> header)
     */
    public static Map<String, String> generateDefaultColumnLabels(List<String> headers) {
        Map<String, String> columnLabels = new HashMap<>();
        
        if (headers != null) {
            for (String header : headers) {
                columnLabels.put(header, header);
            }
        }
        
        LOG.infof("🏷️ Labels de colonnes par défaut générés: %s", columnLabels);
        return columnLabels;
    }
    
    /**
     * Génère des labels de colonnes plus lisibles à partir des headers
     * Les clés utilisent les headers originaux, les valeurs sont les labels lisibles
     * 
     * @param headers Liste des headers
     * @return Map des labels de colonnes avec des noms plus lisibles
     */
    public static Map<String, String> generateReadableColumnLabels(List<String> headers) {
        Map<String, String> columnLabels = new HashMap<>();
        
        if (headers != null) {
            for (String header : headers) {
                String readableLabel = makeHeaderReadable(header);
                columnLabels.put(header, readableLabel);
            }
        }
        
        LOG.infof("🏷️ Labels de colonnes lisibles générés: %s", columnLabels);
        return columnLabels;
    }
    
    /**
     * Génère des labels de colonnes avec les clés transformées (compatibles avec tableData)
     * 
     * @param headers Liste des headers
     * @return Map des labels de colonnes avec les clés transformées
     */
    public static Map<String, String> generateTransformedColumnLabels(List<String> headers) {
        Map<String, String> columnLabels = new HashMap<>();
        
        if (headers != null) {
            for (String header : headers) {
                String transformedKey = makeHeaderReadable(header);
                columnLabels.put(transformedKey, transformedKey);
            }
        }
        
        LOG.infof("🏷️ Labels de colonnes transformés générés: %s", columnLabels);
        return columnLabels;
    }
    
    /**
     * Rend un header plus lisible en nettoyant le format
     * 
     * @param header Le header original
     * @return Le header nettoyé et plus lisible
     */
    private static String makeHeaderReadable(String header) {
        if (header == null || header.trim().isEmpty()) {
            return "Colonne";
        }
        
        // Supprimer les caractères spéciaux et underscores
        String cleaned = header.replaceAll("[_\\-]", " ");
        
        // Capitaliser la première lettre de chaque mot
        String[] words = cleaned.split("\\s+");
        StringBuilder result = new StringBuilder();
        
        for (int i = 0; i < words.length; i++) {
            if (i > 0) result.append(" ");
            if (words[i].length() > 0) {
                result.append(Character.toUpperCase(words[i].charAt(0)))
                      .append(words[i].substring(1).toLowerCase());
            }
        }
        
        return result.toString().trim();
    }
} 