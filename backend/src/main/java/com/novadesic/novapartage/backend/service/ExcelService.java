package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.model.ExcelData.FormulaCellPosition;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.jboss.logging.Logger;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

@ApplicationScoped
public class ExcelService {
    
    private static final Logger LOG = Logger.getLogger(ExcelService.class);

    public ExcelData processExcelFile(InputStream inputStream, String fileName) throws IOException {
        return processExcelFile(inputStream, fileName, 0); // Par défaut, première feuille
    }
    
    public ExcelData processExcelFile(InputStream inputStream, String fileName, int sheetIndex) throws IOException {
        try (Workbook workbook = createWorkbook(inputStream, fileName)) {
            if (sheetIndex >= workbook.getNumberOfSheets()) {
                throw new IllegalArgumentException("Index de feuille invalide: " + sheetIndex + ". Le fichier contient " + workbook.getNumberOfSheets() + " feuille(s).");
            }
            
            Sheet sheet = workbook.getSheetAt(sheetIndex);
            
            // Créer un FormulaEvaluator pour évaluer les formules et retourner les résultats calculés
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            evaluator.setIgnoreMissingWorkbooks(true);
            
            // Déterminer le nombre de colonnes en parcourant toutes les lignes
            int maxColumns = determineMaxColumns(sheet);
            List<String> headers = generateStandardHeaders(maxColumns);
            List<FormulaCellPosition> formulaCells = new ArrayList<>();
            List<Map<String, Object>> rows = extractAllRows(sheet, maxColumns, evaluator, formulaCells);
            
            ExcelData excelData = new ExcelData(fileName, headers, rows);
            excelData.setFormulaCells(formulaCells);
            return excelData;
        }
    }
    
    /**
     * Récupère la liste des feuilles disponibles dans un fichier Excel
     */
    public List<Map<String, Object>> getExcelSheets(InputStream inputStream, String fileName) throws IOException {
        try (Workbook workbook = createWorkbook(inputStream, fileName)) {
            List<Map<String, Object>> sheets = new ArrayList<>();
            
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                Map<String, Object> sheetInfo = new HashMap<>();
                sheetInfo.put("index", i);
                sheetInfo.put("name", sheet.getSheetName());
                sheetInfo.put("lastRowNum", sheet.getLastRowNum());
                sheetInfo.put("lastColNum", determineMaxColumns(sheet));
                sheets.add(sheetInfo);
            }
            
            return sheets;
        }
    }

    private Workbook createWorkbook(InputStream inputStream, String fileName) throws IOException {
        if (fileName.toLowerCase().endsWith(".xlsx")) {
            return new XSSFWorkbook(inputStream);
        } else if (fileName.toLowerCase().endsWith(".xls")) {
            return new HSSFWorkbook(inputStream);
        } else {
            throw new IllegalArgumentException("Format de fichier non supporté. Utilisez .xlsx ou .xls");
        }
    }

    /**
     * Détermine le nombre maximum de colonnes dans la feuille
     */
    private int determineMaxColumns(Sheet sheet) {
        int maxColumns = 0;
        
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row != null) {
                int lastCellNum = row.getLastCellNum();
                if (lastCellNum > maxColumns) {
                    maxColumns = lastCellNum;
                }
            }
        }
        
        return maxColumns;
    }
    
    /**
     * Génère des en-têtes standardisés (column-0, column-1, etc.)
     */
    private List<String> generateStandardHeaders(int columnCount) {
        List<String> headers = new ArrayList<>();
        for (int i = 0; i < columnCount; i++) {
            headers.add("column-" + i);
            }
        return headers;
    }

    /**
     * Extrait toutes les lignes de la feuille avec des noms de colonnes standardisés
     * @param evaluator Évaluateur de formules pour retourner les résultats calculés au lieu des formules brutes
     * @param formulaCellsOut Liste à remplir avec les positions des cellules contenant des formules (row = index dans rows, col = "column-X")
     */
    private List<Map<String, Object>> extractAllRows(Sheet sheet, int maxColumns, FormulaEvaluator evaluator, 
                                                     List<FormulaCellPosition> formulaCellsOut) {
        List<Map<String, Object>> rows = new ArrayList<>();
        
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row != null && !isEmptyRow(row, evaluator)) {
                int outputRowIndex = rows.size();
                Map<String, Object> rowData = new HashMap<>();
                
                for (int j = 0; j < maxColumns; j++) {
                    Cell cell = row.getCell(j);
                    if (cell != null && cell.getCellType() == CellType.FORMULA) {
                        formulaCellsOut.add(new FormulaCellPosition(outputRowIndex, "column-" + j));
                    }
                    Object cellValue = getCellValue(cell, evaluator);
                    rowData.put("column-" + j, cellValue);
                }
                
                rows.add(rowData);
            }
        }
        
        return rows;
    }
    
    /**
     * Extrait les lignes de la feuille avec pagination
     * @param formulaCellsOut Liste à remplir avec les positions des cellules formules (indices relatifs à la page)
     */
    private List<Map<String, Object>> extractRowsPaginated(Sheet sheet, int maxColumns, int page, int limit, 
                                                          FormulaEvaluator evaluator, List<FormulaCellPosition> formulaCellsOut) {
        List<Map<String, Object>> rows = new ArrayList<>();
        
        // Calculer les indices de début et de fin
        int startRow = page * limit;
        int endRow = Math.min(startRow + limit, sheet.getLastRowNum() + 1);
        
        // Extraire seulement les lignes de la page demandée
        for (int i = startRow; i < endRow; i++) {
            Row row = sheet.getRow(i);
            if (row != null && !isEmptyRow(row, evaluator)) {
                int outputRowIndex = rows.size();
                Map<String, Object> rowData = new HashMap<>();
                
                for (int j = 0; j < maxColumns; j++) {
                    Cell cell = row.getCell(j);
                    if (cell != null && cell.getCellType() == CellType.FORMULA) {
                        formulaCellsOut.add(new FormulaCellPosition(outputRowIndex, "column-" + j));
                    }
                    Object cellValue = getCellValue(cell, evaluator);
                    rowData.put("column-" + j, cellValue);
                }
                
                rows.add(rowData);
            }
        }
        
        return rows;
    }
    
    /**
     * Traite un fichier Excel avec pagination
     * @param inputStream Le flux du fichier Excel
     * @param fileName Le nom du fichier
     * @param sheetIndex L'index de la feuille
     * @param page Numéro de page (0-indexed, défaut: 0)
     * @param limit Nombre de lignes par page (défaut: 100, max: 1000)
     * @return ExcelData avec les lignes de la page demandée
     * @throws IOException En cas d'erreur de lecture
     */
    public ExcelData processExcelFilePaginated(InputStream inputStream, String fileName, int sheetIndex, 
                                               Integer page, Integer limit) throws IOException {
        // Valeurs par défaut
        int pageNum = (page != null && page >= 0) ? page : 0;
        int pageSize = (limit != null && limit > 0) ? Math.min(limit, 1000) : 100; // Max 1000 lignes par page
        
        try (Workbook workbook = createWorkbook(inputStream, fileName)) {
            if (sheetIndex >= workbook.getNumberOfSheets()) {
                throw new IllegalArgumentException("Index de feuille invalide: " + sheetIndex + ". Le fichier contient " + workbook.getNumberOfSheets() + " feuille(s).");
            }
            
            Sheet sheet = workbook.getSheetAt(sheetIndex);
            
            // Créer un FormulaEvaluator pour évaluer les formules et retourner les résultats calculés
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            evaluator.setIgnoreMissingWorkbooks(true);
            
            // Déterminer le nombre de colonnes (sur un échantillon pour optimiser)
            int maxColumns = determineMaxColumns(sheet);
            List<String> headers = generateStandardHeaders(maxColumns);
            
            // Compter le nombre total de lignes non vides
            int totalRows = countNonEmptyRows(sheet, evaluator);
            
            // Extraire seulement les lignes de la page demandée
            List<FormulaCellPosition> formulaCells = new ArrayList<>();
            List<Map<String, Object>> rows = extractRowsPaginated(sheet, maxColumns, pageNum, pageSize, evaluator, formulaCells);
            
            ExcelData excelData = new ExcelData(fileName, headers, rows);
            excelData.setTotalRows(totalRows);
            excelData.setFormulaCells(formulaCells);
            
            return excelData;
        }
    }
    
    /**
     * Compte le nombre de lignes non vides dans une feuille
     * @param evaluator Évaluateur de formules (peut être null pour les contextes sans workbook)
     */
    private int countNonEmptyRows(Sheet sheet, FormulaEvaluator evaluator) {
        int count = 0;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row != null && !isEmptyRow(row, evaluator)) {
                count++;
            }
        }
        return count;
    }

    private boolean isEmptyRow(Row row, FormulaEvaluator evaluator) {
        if (row == null) return true;
        
        for (int i = 0; i < row.getLastCellNum(); i++) {
            Cell cell = row.getCell(i);
            if (cell != null && getCellValueAsString(cell, evaluator) != null && !getCellValueAsString(cell, evaluator).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Extrait la valeur d'une cellule. Pour les cellules de formule, utilise FormulaEvaluator
     * pour retourner le résultat calculé au lieu de la formule brute.
     */
    private Object getCellValue(Cell cell, FormulaEvaluator evaluator) {
        if (cell == null) {
            return ""; // Retourner une chaîne vide au lieu de null
        }

        // Utiliser DataFormatter pour obtenir la valeur formatée telle qu'elle apparaît dans Excel
        DataFormatter formatter = new DataFormatter();

        switch (cell.getCellType()) {
            case STRING:
                String stringValue = cell.getStringCellValue();
                return stringValue != null ? stringValue : ""; // Garantir qu'on ne retourne jamais null
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    // Pour les dates, utiliser le formatter pour obtenir la valeur formatée visible
                    return formatter.formatCellValue(cell);
                } else {
                    double numericValue = cell.getNumericCellValue();
                    // Vérifier si c'est un entier
                    if (numericValue == (long) numericValue) {
                        return (long) numericValue;
                    } else {
                        return numericValue;
                    }
                }
            case BOOLEAN:
                return cell.getBooleanCellValue();
            case FORMULA:
                // Pour les formules, utiliser le formatter avec l'évaluateur pour retourner le résultat calculé
                try {
                    return evaluator != null ? formatter.formatCellValue(cell, evaluator) : formatter.formatCellValue(cell);
                } catch (Exception e) {
                    LOG.debugf("Erreur lors de l'évaluation de la formule en cellule: %s", e.getMessage());
                    return formatter.formatCellValue(cell);
                }
            case BLANK:
                return ""; // Cellule vide explicite
            default:
                return ""; // Pour tous les autres cas, retourner une chaîne vide
        }
    }

    private String getCellValueAsString(Cell cell, FormulaEvaluator evaluator) {
        Object value = getCellValue(cell, evaluator);
        return value != null ? value.toString() : ""; // Retourner une chaîne vide au lieu de null
    }

    /**
     * Surcharge pour les contextes où l'évaluateur n'est pas disponible (ex: mise à jour de cellules).
     * Utilise null pour l'évaluateur ; les formules utiliseront la valeur mise en cache si disponible.
     */
    private String getCellValueAsString(Cell cell) {
        return getCellValueAsString(cell, null);
    }
    
    /**
     * Met à jour un fichier Excel avec les données modifiées des accès validés
     */
    public byte[] updateExcelFileWithValidatedData(InputStream originalFileStream, String fileName, 
                                                   List<Map<String, Object>> validatedData) throws IOException {
        return updateExcelFileWithValidatedData(originalFileStream, fileName, validatedData, 0);
    }
    
    /**
     * Met à jour un fichier Excel avec les données modifiées des accès validés pour une feuille spécifique
     */
    public byte[] updateExcelFileWithValidatedData(InputStream originalFileStream, String fileName, 
                                                   List<Map<String, Object>> validatedData, int sheetIndex) throws IOException {
        try (Workbook workbook = createWorkbook(originalFileStream, fileName)) {
            if (sheetIndex >= workbook.getNumberOfSheets()) {
                throw new IllegalArgumentException("Index de feuille invalide: " + sheetIndex + ". Le fichier contient " + workbook.getNumberOfSheets() + " feuille(s).");
            }
            
            Sheet sheet = workbook.getSheetAt(sheetIndex);
            
            // Appliquer les modifications pour chaque ligne de données validées
            for (Map<String, Object> rowData : validatedData) {
                Integer rowIndex = (Integer) rowData.get("_rowIndex");
                if (rowIndex != null) {
                    // Ajouter 1 pour compenser la ligne d'en-tête
                    // _rowIndex = 0 correspond à la première ligne de données (ligne 1 du fichier Excel)
                    int excelRowIndex = rowIndex + 1;
                    
                    Row row = sheet.getRow(excelRowIndex);
                    if (row != null) {
                        // Appliquer les modifications pour chaque cellule
                        for (Map.Entry<String, Object> entry : rowData.entrySet()) {
                            String columnKey = entry.getKey();
                            if (!columnKey.equals("_rowIndex") && entry.getValue() != null) {
                                // Extraire l'index de colonne depuis column-X
                                if (columnKey.startsWith("column-")) {
                                    try {
                                        int colIndex = Integer.parseInt(columnKey.substring(7));
                                        Cell cell = row.getCell(colIndex);
                                        if (cell == null) {
                                            cell = row.createCell(colIndex);
                                        }
                                        
                                        // Définir la valeur selon le type en préservant le format si possible
                                        Object value = entry.getValue();
                                        String oldValueStr = getCellValueAsString(cell);
                                        if (value instanceof String) {
                                            setCellValueWithFormat(cell, (String) value, oldValueStr);
                                        } else if (value instanceof Number) {
                                            cell.setCellValue(((Number) value).doubleValue());
                                        } else if (value instanceof Boolean) {
                                            cell.setCellValue((Boolean) value);
                                        } else {
                                            setCellValueWithFormat(cell, value.toString(), oldValueStr);
                                        }
                                    } catch (NumberFormatException e) {
                                        // Ignorer les colonnes qui ne suivent pas le format column-X
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Écrire le workbook dans un byte array
            try (java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream()) {
                workbook.write(outputStream);
                return outputStream.toByteArray();
            }
        }
    }
    
    /**
     * Met à jour un fichier Excel avec les données modifiées des accès validés pour plusieurs feuilles
     * Chaque destinataire peut avoir sa propre feuille sélectionnée
     */
    public byte[] updateExcelFileWithValidatedDataMultiSheet(InputStream originalFileStream, String fileName, 
                                                           Map<String, Map<Integer, List<Map<String, Object>>>> modificationsByRecipientAndSheet) throws IOException {
        try (Workbook workbook = createWorkbook(originalFileStream, fileName)) {
            int totalSheets = workbook.getNumberOfSheets();
            
            // 🔧 CORRECTION : Regrouper les modifications par feuille d'abord, puis par cellule
            // Cela permet de détecter si plusieurs destinataires modifient la même cellule
            Map<Integer, Map<String, LinkedHashSet<String>>> modificationsBySheetAndCell = new HashMap<>();
            
            // Collecter toutes les modifications de tous les destinataires, regroupées par feuille et cellule
            for (Map.Entry<String, Map<Integer, List<Map<String, Object>>>> recipientEntry : modificationsByRecipientAndSheet.entrySet()) {
                String recipientEmail = recipientEntry.getKey();
                Map<Integer, List<Map<String, Object>>> modificationsBySheet = recipientEntry.getValue();
                
                for (Map.Entry<Integer, List<Map<String, Object>>> sheetEntry : modificationsBySheet.entrySet()) {
                    int sheetIndex = sheetEntry.getKey();
                    List<Map<String, Object>> validatedData = sheetEntry.getValue();
                    
                    if (sheetIndex >= totalSheets) {
                        LOG.warnf("Index de feuille invalide pour le destinataire %s: %d. Le fichier contient %d feuille(s).", 
                                 recipientEmail, sheetIndex, totalSheets);
                        continue;
                    }
                    
                    // Initialiser la structure pour cette feuille si nécessaire
                    modificationsBySheetAndCell.computeIfAbsent(sheetIndex, k -> new HashMap<>());
                    
                    // Collecter toutes les modifications pour cette feuille
                    for (Map<String, Object> rowData : validatedData) {
                        Integer rowIndex = (Integer) rowData.get("_rowIndex");
                        if (rowIndex != null) {
                            for (Map.Entry<String, Object> entry : rowData.entrySet()) {
                                String columnKey = entry.getKey();
                                if (!columnKey.equals("_rowIndex") && entry.getValue() != null) {
                                    if (columnKey.startsWith("column-")) {
                                        try {
                                            int colIndex = Integer.parseInt(columnKey.substring(7));
                                            String cellKey = rowIndex + ":" + colIndex;
                                            String value = entry.getValue().toString();
                                            
                                            // Utiliser LinkedHashSet pour garder l'ordre et éviter les doublons
                                            modificationsBySheetAndCell.get(sheetIndex)
                                                .computeIfAbsent(cellKey, k -> new LinkedHashSet<>())
                                                .add(value);
                                        } catch (NumberFormatException e) {
                                            // Ignorer
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    LOG.infof("📝 Destinataire %s: %d modifications collectées pour la feuille %d", 
                             recipientEmail, validatedData.size(), sheetIndex);
                }
            }
            
            // Appliquer les modifications regroupées par feuille
            for (Map.Entry<Integer, Map<String, LinkedHashSet<String>>> sheetEntry : modificationsBySheetAndCell.entrySet()) {
                int sheetIndex = sheetEntry.getKey();
                Map<String, LinkedHashSet<String>> modificationsByCell = sheetEntry.getValue();
                
                Sheet sheet = workbook.getSheetAt(sheetIndex);
                LOG.infof("📝 Mise à jour de la feuille %d avec %d cellules uniques", 
                         sheetIndex, modificationsByCell.size());
                
                // Appliquer les modifications regroupées
                for (Map.Entry<String, LinkedHashSet<String>> cellEntry : modificationsByCell.entrySet()) {
                    String[] parts = cellEntry.getKey().split(":");
                    int rowIndex = Integer.parseInt(parts[0]);
                    int colIndex = Integer.parseInt(parts[1]);
                    LinkedHashSet<String> valuesSet = cellEntry.getValue();
                    List<String> values = new ArrayList<>(valuesSet);
                    
                    // 🔧 CORRECTION : rowIndex vient de _rowIndex qui est un index Excel (0-indexed)
                    // Dans Apache POI, les lignes sont 0-indexed, donc on utilise rowIndex directement
                    // Mais vérifions d'abord si cela fonctionne, sinon on pourra ajuster
                    int excelRowIndex = rowIndex;
                    
                    LOG.infof("📝 Application modification: [%d,%d] (original _rowIndex) -> Excel ligne %d (0-indexed), colonne %d", 
                             rowIndex, colIndex, excelRowIndex, colIndex);
                    
                    // Vérifier les limites de la feuille
                    int lastRowNum = sheet.getLastRowNum();
                    LOG.infof("📝 Feuille Excel: dernière ligne = %d (0-indexed)", lastRowNum);
                    
                    Row row = sheet.getRow(excelRowIndex);
                    if (row == null) {
                        row = sheet.createRow(excelRowIndex);
                        LOG.infof("📝 Ligne Excel %d créée (n'existait pas, dernière ligne était %d)", excelRowIndex, lastRowNum);
                    } else {
                        LOG.infof("📝 Ligne Excel %d existe déjà", excelRowIndex);
                    }
                    
                    Cell cell = row.getCell(colIndex);
                    String oldValueStr = null;
                    if (cell == null) {
                        cell = row.createCell(colIndex);
                        LOG.infof("📝 Cellule [%d,%d] créée (n'existait pas)", excelRowIndex, colIndex);
                    } else {
                        oldValueStr = getCellValueAsString(cell);
                        LOG.infof("📝 Cellule [%d,%d] existe déjà, ancienne valeur: '%s'", excelRowIndex, colIndex, oldValueStr);
                    }
                    
                    // 🔧 CORRECTION : Si plusieurs destinataires modifient la même cellule, utiliser le séparateur ' | '
                    // Sinon, écraser directement la valeur originale
                    String finalValue;
                    if (values.size() > 1) {
                        // Plusieurs valeurs uniques : concaténer avec ' | ' (avec espaces)
                        finalValue = String.join(" | ", values);
                        LOG.infof("📝 Cellule [%d,%d]: %d valeurs uniques -> '%s' (concaténation avec |)", 
                                 rowIndex, colIndex, values.size(), finalValue);
                    } else {
                        // Une seule valeur : écraser directement la valeur originale
                        finalValue = values.get(0);
                        LOG.infof("📝 Cellule [%d,%d]: 1 valeur -> '%s' (écrasement, ancienne: '%s')", 
                                 rowIndex, colIndex, finalValue, oldValueStr);
                    }
                    
                    // Définir la valeur dans la cellule en préservant le format si possible
                    setCellValueWithFormat(cell, finalValue, oldValueStr);
                    LOG.infof("📝 ✅ Valeur '%s' définie dans la cellule Excel [%d,%d] (ancienne: '%s')", 
                             finalValue, excelRowIndex, colIndex, oldValueStr);
                }
            }
            
            // Convertir le workbook en tableau de bytes
            // 🔧 CORRECTION : Vérifier que les modifications sont bien présentes avant l'écriture
            LOG.infof("📝 Vérification des modifications avant écriture du workbook");
            for (Map.Entry<Integer, Map<String, LinkedHashSet<String>>> sheetEntry : modificationsBySheetAndCell.entrySet()) {
                int sheetIndex = sheetEntry.getKey();
                Sheet sheet = workbook.getSheetAt(sheetIndex);
                Map<String, LinkedHashSet<String>> modificationsByCell = sheetEntry.getValue();
                
                for (Map.Entry<String, LinkedHashSet<String>> cellEntry : modificationsByCell.entrySet()) {
                    String[] parts = cellEntry.getKey().split(":");
                    int rowIndex = Integer.parseInt(parts[0]);
                    int colIndex = Integer.parseInt(parts[1]);
                    LinkedHashSet<String> valuesSet = cellEntry.getValue();
                    List<String> values = new ArrayList<>(valuesSet);
                    String expectedValue = values.size() > 1 ? String.join(" | ", values) : values.get(0);
                    
                    Row row = sheet.getRow(rowIndex);
                    if (row != null) {
                        Cell cell = row.getCell(colIndex);
                        if (cell != null) {
                            String actualValue = getCellValueAsString(cell);
                            LOG.infof("📝 Vérification cellule [%d,%d]: attendu='%s', actuel='%s'", 
                                     rowIndex, colIndex, expectedValue, actualValue);
                            if (!expectedValue.equals(actualValue)) {
                                LOG.warnf("⚠️ Cellule [%d,%d]: valeur attendue '%s' mais actuelle '%s' - réapplication", 
                                         rowIndex, colIndex, expectedValue, actualValue);
                                setCellValueWithFormat(cell, expectedValue, actualValue);
                            }
                        } else {
                            LOG.warnf("⚠️ Cellule [%d,%d] n'existe pas après modification", rowIndex, colIndex);
                        }
                    } else {
                        LOG.warnf("⚠️ Ligne %d n'existe pas après modification", rowIndex);
                    }
                }
            }
            
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            byte[] result = outputStream.toByteArray();
            outputStream.close();
            LOG.infof("📝 Workbook écrit avec succès, taille: %d bytes", result.length);
            return result;
        }
    }
    
    /**
     * Définit la valeur d'une cellule en essayant de préserver le format original
     * Si la valeur est une date, essaie de la convertir en date Excel
     * Sinon, passe en texte
     */
    private void setCellValueWithFormat(Cell cell, String value, String oldValueStr) {
        if (value == null || value.trim().isEmpty()) {
            cell.setBlank();
            return;
        }
        
        // Si la cellule avait un format de date, essayer de convertir la nouvelle valeur en date
        if (oldValueStr != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            try {
                // Essayer de parser la valeur comme une date
                // Formats communs de dates
                java.text.SimpleDateFormat[] dateFormats = {
                    new java.text.SimpleDateFormat("dd/MM/yyyy"),
                    new java.text.SimpleDateFormat("MM/dd/yyyy"),
                    new java.text.SimpleDateFormat("yyyy-MM-dd"),
                    new java.text.SimpleDateFormat("dd-MM-yyyy"),
                    new java.text.SimpleDateFormat("yyyy/MM/dd"),
                    new java.text.SimpleDateFormat("dd.MM.yyyy"),
                    new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss"),
                    new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"),
                    new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
                };
                
                java.util.Date parsedDate = null;
                for (java.text.SimpleDateFormat format : dateFormats) {
                    try {
                        format.setLenient(false);
                        parsedDate = format.parse(value.trim());
                        break;
                    } catch (java.text.ParseException e) {
                        // Continuer avec le prochain format
                    }
                }
                
                if (parsedDate != null) {
                    // Conserver le format de date et définir la nouvelle date
                    cell.setCellValue(parsedDate);
                    return;
                }
            } catch (Exception e) {
                LOG.debugf("Impossible de convertir '%s' en date, passage en texte", value);
            }
        }
        
        // Si ce n'est pas une date ou si la conversion a échoué, essayer d'autres types
        try {
            // Essayer de convertir en nombre
            double numValue = Double.parseDouble(value.trim());
            // Vérifier si c'est un entier
            if (numValue == (long) numValue) {
                cell.setCellValue((long) numValue);
            } else {
                cell.setCellValue(numValue);
            }
        } catch (NumberFormatException e) {
            // Si ce n'est pas un nombre, essayer boolean
            if ("true".equalsIgnoreCase(value.trim()) || "false".equalsIgnoreCase(value.trim())) {
                cell.setCellValue(Boolean.parseBoolean(value.trim()));
            } else {
                // Sinon, passer en texte
                cell.setCellValue(value);
            }
        }
    }
} 