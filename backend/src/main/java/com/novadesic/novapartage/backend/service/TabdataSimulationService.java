package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.model.ExcelData.FormulaCellPosition;
import com.novadesic.novapartage.backend.model.Recipient;
import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.dto.SimulateTabdataRequest;
import com.novadesic.novapartage.backend.service.ExcelDataConverter.CellPosition;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service pour simuler les tabdata sans les sauvegarder en base
 * Utilisé pour le form-preview des partages en cours de création
 */
@ApplicationScoped
public class TabdataSimulationService {
    
    private static final String LOG_PREFIX = "🎭 SIMULATION TABDATA";
    private static final Logger Log = Logger.getLogger(TabdataSimulationService.class);
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ExcelService excelService;
    
    @Inject
    ShareService shareService;
    
    @Inject
    ShareTabdataService shareTabdataService;
    
    @Inject
    ObjectMapper objectMapper;
    
    /**
     * Simule les tabdata pour un destinataire sans les sauvegarder
     * Gère à la fois les fichiers temporaires et les partages existants
     * @param page Numéro de page (commence à 1), null pour toutes les données
     * @param limit Nombre de lignes par page, null pour toutes les données
     */
    public Object simulateTabdataForRecipient(String tempFileId, String username, 
                                            SimulateTabdataRequest request,
                                            Integer page, Integer limit) throws IOException {
        Log.infof("%s - Simulation tabdata pour tempFileId=%s, recipientEmail=%s, page=%s, limit=%s", 
                 LOG_PREFIX, tempFileId, request.recipientEmail, page, limit);
        
        // 1. Valider la requête
        if (!request.isValid()) {
            throw new IllegalArgumentException("Requête invalide: " + request.getValidationError());
        }
        
        // 2. Pour les fichiers temporaires, vérifier d'abord le cache
        String fileFingerprint = null;
        String selectionsHash = null; // Calculer une seule fois et réutiliser
        if (request.shareId == null || request.shareId.trim().isEmpty()) {
            // Calculer le fingerprint pour vérifier la cohérence du cache
            try (InputStream fingerprintStream = fileStorageService.getTemporaryFile(tempFileId, username)) {
                if (fingerprintStream != null) {
                    fileFingerprint = calculateFileFingerprint(fingerprintStream);
                }
            } catch (Exception e) {
                Log.warnf("%s - Erreur lors du calcul du fingerprint: %s", LOG_PREFIX, e.getMessage());
            }
            
            // Calculer le hash des sélections et editableCells pour détecter les changements
            selectionsHash = calculateSelectionsHash(request);
            
            // Vérifier le cache avec le fingerprint ET le hash des sélections
            try {
                Object cachedData = shareTabdataService.getTabdataFromDatabaseForTempFile(
                    tempFileId, request.recipientEmail, fileFingerprint, page, limit);
                if (cachedData != null) {
                    // Vérifier si les sélections/editableCells ont changé en comparant avec le hash stocké
                    String cachedSelectionsHash = shareTabdataService.getSelectionsHashForTempFile(
                        tempFileId, request.recipientEmail);
                    
                    if (selectionsHash != null && selectionsHash.equals(cachedSelectionsHash)) {
                        Log.infof("%s - ✅ Tabdata récupéré depuis le cache (sélections identiques)", LOG_PREFIX);
                        // 🔧 CORRECTION : Valider et compléter la réponse du cache pour garantir tous les champs
                        Object validatedCachedData = validateAndCompleteCachedResponse(cachedData, request, page, limit);
                        return validatedCachedData;
                    } else {
                        Log.infof("%s - 🔄 Sélections/editableCells modifiées, reconstruction nécessaire (hash: %s vs %s)", 
                                 LOG_PREFIX, selectionsHash, cachedSelectionsHash);
                        // Supprimer le cache obsolète
                        shareTabdataService.deleteTabdataForTempFile(tempFileId, request.recipientEmail);
                    }
                }
            } catch (Exception e) {
                Log.warnf("%s - Erreur lors de la récupération du cache: %s", LOG_PREFIX, e.getMessage());
                // Continuer avec le calcul normal
            }
        }
        
        // 3. Pour les partages existants, vérifier le cache avec le hash des sélections
        if (request.shareId != null && !request.shareId.trim().isEmpty()) {
            // Calculer le hash des sélections pour les partages existants aussi
            if (selectionsHash == null) {
                selectionsHash = calculateSelectionsHash(request);
            }
            
            try {
                // Vérifier d'abord si les sélections ont changé
                String cachedSelectionsHash = shareTabdataService.getSelectionsHashForShare(
                    request.shareId, request.recipientEmail);
                
                // Utiliser le cache SEULEMENT si le hash existe ET est identique
                if (cachedSelectionsHash != null && selectionsHash != null && selectionsHash.equals(cachedSelectionsHash)) {
                    // Les sélections sont identiques, utiliser le cache
                    Object cachedData = shareTabdataService.getTabdataFromDatabase(
                        request.shareId, request.recipientEmail, page, limit);
                    Log.infof("%s - ✅ Tabdata récupéré depuis la base pour partage existant (sélections identiques, hash: %s)", 
                             LOG_PREFIX, selectionsHash);
                    // 🔧 CORRECTION : Valider et compléter la réponse du cache pour garantir tous les champs
                    Object validatedCachedData = validateAndCompleteCachedResponse(cachedData, request, page, limit);
                    return validatedCachedData;
                } else {
                    // Hash null (colonne pas encore créée) ou hash différent = sélections modifiées
                    Log.infof("%s - 🔄 Sélections/editableCells modifiées ou hash manquant pour partage existant, reconstruction nécessaire (hash actuel: %s, hash cache: %s)", 
                             LOG_PREFIX, selectionsHash, cachedSelectionsHash);
                    // Ne pas utiliser le cache, forcer la reconstruction en continuant avec le calcul normal
                }
            } catch (IllegalArgumentException | SecurityException e) {
                Log.warnf("%s - Tabdata non disponible en cache, calcul nécessaire: %s", LOG_PREFIX, e.getMessage());
                // Continuer avec le calcul normal pour la simulation
            }
        }
        
        // 3. Récupérer les données Excel (fichier temporaire ou partage existant)
        // Note: On doit charger toutes les données pour pouvoir filtrer selon les sélections
        // La pagination sera appliquée après le filtrage
        ExcelData excelData;
        
        if (request.shareId != null && !request.shareId.trim().isEmpty()) {
            // Mode partage existant
            Log.infof("%s - 🔒 ACCÈS PARTAGE EXISTANT AUTORISÉ - Simulation pour %s", LOG_PREFIX, request.recipientEmail);
            excelData = getExcelDataFromShare(request.shareId, request.recipientEmail, request.selectedSheetIndex);
        } else {
            // Mode fichier temporaire
            Log.infof("%s - 🔒 ACCÈS FICHIER TEMPORAIRE AUTORISÉ - Simulation pour %s", LOG_PREFIX, request.recipientEmail);
            
            // Si le fingerprint n'a pas été calculé, le calculer maintenant
            if (fileFingerprint == null) {
                try (InputStream fingerprintStream = fileStorageService.getTemporaryFile(tempFileId, username)) {
                    if (fingerprintStream == null) {
                        throw new IllegalArgumentException("Fichier temporaire non trouvé: " + tempFileId);
                    }
                    fileFingerprint = calculateFileFingerprint(fingerprintStream);
                }
            }
            
            // Charger les données Excel
            try (InputStream fileStream = fileStorageService.getTemporaryFile(tempFileId, username)) {
                if (fileStream == null) {
                    throw new IllegalArgumentException("Fichier temporaire non trouvé: " + tempFileId);
                }
                String fileName = fileStorageService.getTemporaryFileName(tempFileId, username);
                // Charger toutes les données (nécessaire pour le filtrage selon les sélections)
                excelData = excelService.processExcelFile(fileStream, fileName, request.selectedSheetIndex);
            }
        }
        
        Log.infof("%s - Données Excel traitées: %d lignes, %d colonnes", 
                 LOG_PREFIX, excelData.getTotalRows(), excelData.getTotalColumns());
        
        // 5. Créer un objet Recipient temporaire pour le filtrage
        Recipient tempRecipient = createTempRecipient(request);
        
        // 6. Appliquer le même filtrage que ShareTabdataService
        // La pagination sera appliquée dans filterDataBySelections après le filtrage
        Object filteredData = filterDataBySelections(excelData, tempRecipient, null, request.columnLabels, page, limit);
        
        // 7. Pour les fichiers temporaires, stocker dans le cache avec le hash des sélections
        if (request.shareId == null || request.shareId.trim().isEmpty()) {
            try {
                // Utiliser le hash déjà calculé (ou le calculer si pas encore fait)
                if (selectionsHash == null) {
                    selectionsHash = calculateSelectionsHash(request);
                }
                
                // Récupérer les données complètes (sans pagination) pour le cache
                Object fullFilteredData = filterDataBySelections(excelData, tempRecipient, null, request.columnLabels, null, null);
                shareTabdataService.computeAndStoreTabdataForTempFile(
                    tempFileId, request.recipientEmail, username, fullFilteredData, fileFingerprint, selectionsHash, 24);
                Log.infof("%s - ✅ Tabdata stocké dans le cache pour fichiers temporaires (hash sélections: %s)", 
                         LOG_PREFIX, selectionsHash);
            } catch (Exception e) {
                Log.warnf("%s - Erreur lors du stockage en cache: %s", LOG_PREFIX, e.getMessage());
                // Continuer même si le cache échoue
            }
        }
        
        Log.infof("%s - Simulation terminée avec succès", LOG_PREFIX);
        
        return filteredData;
    }
    
    /**
     * Calcule un hash des sélections et editableCells pour détecter les changements
     */
    private String calculateSelectionsHash(SimulateTabdataRequest request) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            
            // Inclure selectedSheetIndex
            digest.update(String.valueOf(request.selectedSheetIndex).getBytes());
            
            // Inclure les sélections
            if (request.selections != null) {
                String selectionsJson = objectMapper.writeValueAsString(request.selections);
                digest.update(selectionsJson.getBytes());
            }
            
            // Inclure les editableCells
            if (request.editableCells != null) {
                String editableCellsJson = objectMapper.writeValueAsString(request.editableCells);
                digest.update(editableCellsJson.getBytes());
            }
            
            byte[] hash = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            Log.warnf("%s - Erreur lors du calcul du hash des sélections: %s", LOG_PREFIX, e.getMessage());
            return null;
        }
    }
    
    /**
     * Calcule le fingerprint d'un fichier
     */
    private String calculateFileFingerprint(InputStream fileStream) throws IOException {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fileStream.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            byte[] hash = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException("Algorithme SHA-256 non disponible", e);
        }
    }
    
    /**
     * Crée un objet Recipient temporaire à partir de la requête
     */
    private Recipient createTempRecipient(SimulateTabdataRequest request) {
        Recipient tempRecipient = new Recipient();
        tempRecipient.email = request.recipientEmail;
        tempRecipient.selectedSheetIndex = request.selectedSheetIndex;
        
        // Convertir les sélections
        if (request.selections != null) {
            tempRecipient.selections = new HashMap<>();
            for (Map.Entry<String, List<SimulateTabdataRequest.CellSelection>> entry : request.selections.entrySet()) {
                String sheetKey = entry.getKey();
                List<SimulateTabdataRequest.CellSelection> cellSelections = entry.getValue();
                
                List<Recipient.CellSelection> recipientSelections = new ArrayList<>();
                for (SimulateTabdataRequest.CellSelection cell : cellSelections) {
                    recipientSelections.add(new Recipient.CellSelection(cell.row, cell.col));
                }
                
                tempRecipient.selections.put(sheetKey, recipientSelections);
            }
        }
        
        // Convertir les cellules éditables
        if (request.editableCells != null) {
            tempRecipient.editableCells = new HashMap<>();
            Log.infof("%s - 🔍 DEBUG: editableCells dans la requête: %s", LOG_PREFIX, request.editableCells);
            for (Map.Entry<String, List<SimulateTabdataRequest.CellSelection>> entry : request.editableCells.entrySet()) {
                String sheetKey = entry.getKey();
                List<SimulateTabdataRequest.CellSelection> cellSelections = entry.getValue();
                
                List<Recipient.CellSelection> recipientSelections = new ArrayList<>();
                for (SimulateTabdataRequest.CellSelection cell : cellSelections) {
                    recipientSelections.add(new Recipient.CellSelection(cell.row, cell.col));
                }
                
                tempRecipient.editableCells.put(sheetKey, recipientSelections);
                Log.infof("%s - 🔍 DEBUG: editableCells ajoutés pour sheetKey=%s: %d cellules", 
                         LOG_PREFIX, sheetKey, recipientSelections.size());
            }
            Log.infof("%s - 🔍 DEBUG: editableCells final dans tempRecipient: %s", 
                     LOG_PREFIX, tempRecipient.editableCells);
        } else {
            Log.warnf("%s - ⚠️ editableCells est null dans la requête", LOG_PREFIX);
        }
        
        return tempRecipient;
    }
    
    /**
     * Filtre les données selon les sélections du destinataire
     * Réutilise la même logique que ShareTabdataService
     * @param page Numéro de page (commence à 1), null pour toutes les données
     * @param limit Nombre de lignes par page, null pour toutes les données
     */
    private Object filterDataBySelections(ExcelData excelData, Recipient recipient, Share share, 
                                         Map<String, Map<String, String>> columnLabels,
                                         Integer page, Integer limit) {
        Log.infof("%s - Filtrage des données selon les sélections", LOG_PREFIX);
        
        if (excelData == null) {
            Log.warnf("%s - ExcelData est null", LOG_PREFIX);
            return new ExcelData("", new ArrayList<>(), new ArrayList<>());
        }
        
        // Si pas de sélections, retourner un tableau vide (pas toutes les données)
        if (recipient.selections == null || recipient.selections.isEmpty()) {
            Log.infof("%s - Aucune sélection, retour d'un tableau vide", LOG_PREFIX);
            return createEmptyExcelData();
        }
        
        String sheetKey = String.valueOf(recipient.selectedSheetIndex);
        List<Recipient.CellSelection> selections = recipient.selections.get(sheetKey);
        
        if (selections == null || selections.isEmpty()) {
            Log.infof("%s - Aucune sélection pour la feuille %s, retour d'un tableau vide", LOG_PREFIX, sheetKey);
            return createEmptyExcelData();
        }
        
        Log.infof("%s - %d cellules sélectionnées pour la feuille %s", LOG_PREFIX, selections.size(), sheetKey);
        
        // Convertir les sélections en CellPosition
        List<CellPosition> selectedCells = new ArrayList<>();
        for (Recipient.CellSelection cell : selections) {
            selectedCells.add(new CellPosition(cell.row, cell.col));
            Log.infof("%s - Cellule sélectionnée: row=%d, col=%d", LOG_PREFIX, cell.row, cell.col);
        }
        
        Log.infof("%s - Données Excel avant filtrage: %d lignes", LOG_PREFIX, excelData.getRows().size());
        
        // 🔍 DEBUG : Afficher la structure des données Excel
        if (excelData.getRows() != null && !excelData.getRows().isEmpty()) {
            Log.infof("%s - DEBUG: Structure des données Excel:", LOG_PREFIX);
            for (int i = 0; i < Math.min(5, excelData.getRows().size()); i++) {
                Map<String, Object> row = excelData.getRows().get(i);
                Log.infof("%s - DEBUG: Ligne %d: %s", LOG_PREFIX, i, row.keySet());
                // Afficher le contenu de chaque ligne
                for (Map.Entry<String, Object> entry : row.entrySet()) {
                    Log.infof("%s - DEBUG: Ligne %d, %s = %s", LOG_PREFIX, i, entry.getKey(), entry.getValue());
                }
            }
        }
        
        // 🔧 FILTRAGE SIMPLIFIÉ : Filtrer les cellules individuelles selon les sélections
        List<Map<String, Object>> filteredTableData = filterCellsBySelection(excelData.getRows(), selectedCells);
        
        Log.infof("%s - Données après filtrage: %d lignes", LOG_PREFIX, filteredTableData.size());
        
        // 🔧 HARMONISATION : Normaliser le tableData selon les sélections uniquement
        filteredTableData = normalizeTableDataBySelections(filteredTableData, selectedCells);
        
        // 🔧 FILTRER ET NORMALISER LES CELLULES FORMULES
        List<FormulaCellPosition> filteredFormulaCells = filterAndNormalizeFormulaCells(
            excelData.getFormulaCells(), selectedCells);
        
        // 🔧 CORRECTION STRICTE : Extraire les headers depuis columnLabels de la requête, dans l'ordre des colonnes filtrées
        // PAS de fallback vers excelData.getHeaders() - on utilise UNIQUEMENT columnLabels de la requête
        List<String> customHeaders = extractHeadersFromColumnLabels(columnLabels, recipient.selectedSheetIndex, selectedCells);
        
        // 🔧 CORRECTION : Convertir columnLabels pour utiliser les nouveaux index (column-0, column-1, etc.)
        // Le frontend peut envoyer soit les index originaux soit les index filtrés
        // On détecte automatiquement le format et on convertit si nécessaire
        Map<String, Map<String, String>> convertedColumnLabels = convertColumnLabelsToNewIndexes(columnLabels, recipient.selectedSheetIndex, selectedCells);
        
        Log.infof("%s - ColumnLabels convertis pour la réponse: %s", LOG_PREFIX, convertedColumnLabels);
        
        // Sauvegarder le total avant pagination
        int totalRows = filteredTableData.size();
        
        // Calculer l'offset de la page pour adapter les index des editableCells
        int pageOffset = 0;
        
        // Appliquer la pagination si demandée
        if (page != null && limit != null && page > 0 && limit > 0) {
            int startIndex = (page - 1) * limit;
            pageOffset = startIndex; // Sauvegarder l'offset pour adapter les index
            int endIndex = Math.min(startIndex + limit, filteredTableData.size());
            
            if (startIndex < filteredTableData.size()) {
                filteredTableData = filteredTableData.subList(startIndex, endIndex);
                Log.infof("%s - Pagination appliquée: page=%d, limit=%d, startIndex=%d, endIndex=%d, lignes retournées=%d, pageOffset=%d", 
                         LOG_PREFIX, page, limit, startIndex, endIndex, filteredTableData.size(), pageOffset);
            } else {
                filteredTableData = new ArrayList<>();
                Log.infof("%s - Page demandée hors limites, retour d'un tableau vide", LOG_PREFIX);
            }
        }
        
        // 🔧 Adapter les cellules formules pour la pagination (indices relatifs à la page)
        List<Map<String, Object>> tableDataFormulaCells = adaptFormulaCellsForPagination(
            filteredFormulaCells, page, limit, totalRows);
        
        // 🔧 CORRECTION : Convertir les editableCells en tableDataEditableCells avec les index filtrés
        // Les editableCells de la requête sont déjà dans le format filtré (col: 0, 1, 2, ...)
        // Passer pageOffset pour adapter les index de lignes à la pagination
        List<Map<String, Object>> tableDataEditableCells = convertEditableCellsToTableDataFormat(
            recipient, filteredTableData, selectedCells, true, pageOffset);
        
        // Si pagination demandée, retourner un objet avec rows, total, headers, columnLabels et tableDataEditableCells
        if (page != null && limit != null && page > 0 && limit > 0) {
            Map<String, Object> paginatedResponse = new HashMap<>();
            paginatedResponse.put("rows", filteredTableData != null ? filteredTableData : new ArrayList<>());
            paginatedResponse.put("total", totalRows);
            // 🔧 CORRECTION : Toujours inclure les headers, même s'ils sont vides (pas de fallback)
            paginatedResponse.put("headers", customHeaders != null ? customHeaders : new ArrayList<>());
            // 🔧 CORRECTION : Garantir que columnLabels est toujours présent avec la structure correcte
            paginatedResponse.put("columnLabels", ensureColumnLabelsStructure(convertedColumnLabels, recipient.selectedSheetIndex));
            // 🔧 CORRECTION : Ajouter les cellules éditables
            paginatedResponse.put("tableDataEditableCells", tableDataEditableCells);
            // 🔧 Ajouter les cellules formules
            paginatedResponse.put("tableDataFormulaCells", tableDataFormulaCells);
            
            // 🔧 CONTRÔLE : Valider que tous les champs nécessaires sont présents
            validatePaginatedResponse(paginatedResponse);
            
            Log.infof("%s - Réponse paginée complète: rows=%d, total=%d, headers=%s, columnLabels=%s, editableCells=%d", 
                     LOG_PREFIX, filteredTableData != null ? filteredTableData.size() : 0, totalRows,
                     paginatedResponse.get("headers"), paginatedResponse.get("columnLabels"), tableDataEditableCells.size());
            return paginatedResponse;
        }
        
        // Sinon, retourner ExcelData avec columnLabels dans un Map wrapper
        // (car ExcelData n'a pas de champ columnLabels)
        Map<String, Object> response = new HashMap<>();
        ExcelData filteredExcelData = new ExcelData();
        filteredExcelData.setFileName(""); // 🔒 SÉCURITÉ: Pas de fileName dans la simulation
        filteredExcelData.setHeaders(customHeaders);
        filteredExcelData.setRows(filteredTableData);
        filteredExcelData.setTotalRows(totalRows);
        filteredExcelData.setTotalColumns(customHeaders != null ? customHeaders.size() : 0);
        
        response.put("headers", customHeaders != null ? customHeaders : new ArrayList<>());
        response.put("rows", filteredTableData != null ? filteredTableData : new ArrayList<>());
        response.put("totalRows", totalRows);
        response.put("totalColumns", customHeaders != null ? customHeaders.size() : 0);
        response.put("columnLabels", ensureColumnLabelsStructure(convertedColumnLabels, recipient.selectedSheetIndex));
        // 🔧 CORRECTION : Ajouter les cellules éditables
        response.put("tableDataEditableCells", tableDataEditableCells);
        // 🔧 Ajouter les cellules formules (format [{row, col}, ...])
        response.put("tableDataFormulaCells", adaptFormulaCellsForPagination(filteredFormulaCells, page, limit, totalRows));
        
        // 🔧 CONTRÔLE : Valider que tous les champs nécessaires sont présents
        validateResponse(response);
        
        Log.infof("%s - Données filtrées: %d lignes, %d colonnes", 
                 LOG_PREFIX, filteredExcelData.getTotalRows(), filteredExcelData.getTotalColumns());
        
        return response;
    }
    
    /**
     * Filtre et normalise les cellules formules selon les sélections
     */
    private List<FormulaCellPosition> filterAndNormalizeFormulaCells(List<FormulaCellPosition> formulaCells, 
                                                                     List<CellPosition> selectedCells) {
        if (formulaCells == null || formulaCells.isEmpty() || selectedCells == null || selectedCells.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> selectedCellKeys = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedCellKeys.add(cell.row + "," + cell.col);
        }
        Set<Integer> selectedColumnsSet = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedColumnsSet.add(cell.col);
        }
        List<Integer> selectedColumns = new ArrayList<>(selectedColumnsSet);
        selectedColumns.sort(Integer::compareTo);
        
        List<FormulaCellPosition> result = new ArrayList<>();
        for (FormulaCellPosition fc : formulaCells) {
            int colIndex = Integer.parseInt(fc.col.replace("column-", ""));
            if (selectedCellKeys.contains(fc.row + "," + colIndex)) {
                int newColIndex = selectedColumns.indexOf(colIndex);
                if (newColIndex >= 0) {
                    result.add(new FormulaCellPosition(fc.row, "column-" + newColIndex));
                }
            }
        }
        return result;
    }
    
    /**
     * Adapte les cellules formules pour la pagination (filtre par page et ajuste les indices row)
     */
    private List<Map<String, Object>> adaptFormulaCellsForPagination(List<FormulaCellPosition> formulaCells,
                                                                     Integer page, Integer limit, int totalRows) {
        if (formulaCells == null || formulaCells.isEmpty()) {
            return new ArrayList<>();
        }
        if (page == null || limit == null || page <= 0 || limit <= 0) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (FormulaCellPosition c : formulaCells) {
                Map<String, Object> m = new HashMap<>();
                m.put("row", c.row);
                m.put("col", c.col);
                result.add(m);
            }
            return result;
        }
        int pageOffset = (page - 1) * limit;
        int pageEnd = pageOffset + limit;
        List<Map<String, Object>> result = new ArrayList<>();
        for (FormulaCellPosition fc : formulaCells) {
            if (fc.row >= pageOffset && fc.row < pageEnd) {
                Map<String, Object> m = new HashMap<>();
                m.put("row", fc.row - pageOffset);
                m.put("col", fc.col);
                result.add(m);
            }
        }
        return result;
    }
    
    /**
     * Crée un ExcelData vide (sans fileName pour la sécurité)
     */
    private ExcelData createEmptyExcelData() {
        ExcelData emptyData = new ExcelData();
        emptyData.setFileName(""); // 🔒 SÉCURITÉ: Pas de fileName dans la simulation
        emptyData.setHeaders(new ArrayList<>());
        emptyData.setRows(new ArrayList<>());
        emptyData.setTotalRows(0);
        emptyData.setTotalColumns(0);
        return emptyData;
    }
    
    /**
     * Normalise le tableData selon les sélections uniquement
     */
    private List<Map<String, Object>> normalizeTableDataBySelections(List<Map<String, Object>> tableData, List<CellPosition> selectedCells) {
        if (tableData == null || selectedCells == null || selectedCells.isEmpty()) {
            return tableData;
        }
        
        // Trouver les colonnes uniques sélectionnées et les trier
        Set<Integer> selectedColumnsSet = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedColumnsSet.add(cell.col);
        }
        List<Integer> selectedColumns = new ArrayList<>(selectedColumnsSet);
        selectedColumns.sort(Integer::compareTo);
        
        Log.infof("%s - Colonnes sélectionnées (triées): %s", LOG_PREFIX, selectedColumns);
        
        List<Map<String, Object>> normalizedData = new ArrayList<>();
        
        // 🔍 DEBUG : Afficher les colonnes disponibles dans la première ligne
        if (!tableData.isEmpty()) {
            Map<String, Object> firstRow = tableData.get(0);
            Set<String> availableColumns = firstRow.keySet().stream()
                .filter(key -> key.startsWith("column-"))
                .collect(java.util.stream.Collectors.toSet());
            Log.infof("%s - Colonnes disponibles dans tableData: %s", LOG_PREFIX, availableColumns);
        }
        
        for (Map<String, Object> row : tableData) {
            // Utiliser LinkedHashMap pour préserver l'ordre
            Map<String, Object> normalizedRow = new LinkedHashMap<>();
            
            // Ne garder que les colonnes sélectionnées (dans l'ordre trié)
            int newColumnIndex = 0;
            for (int originalColIndex : selectedColumns) {
                String originalColumnKey = "column-" + originalColIndex;
                String newColumnKey = "column-" + newColumnIndex;
                Object value = row.getOrDefault(originalColumnKey, "");
                normalizedRow.put(newColumnKey, value);
                Log.infof("%s - Normalisation: %s -> %s (valeur: %s)", 
                         LOG_PREFIX, originalColumnKey, newColumnKey, value);
                newColumnIndex++;
            }
            
            normalizedData.add(normalizedRow);
        }
        
        Log.infof("%s - Données normalisées: %d colonnes sélectionnées, ordre: %s", 
                 LOG_PREFIX, selectedColumns.size(), selectedColumns);
        return normalizedData;
    }
    
    /**
     * Récupère les données Excel d'un partage existant
     * 🔧 CORRECTION : Lire le fichier Excel original, pas les données filtrées en base
     */
    private ExcelData getExcelDataFromShare(String shareId, String recipientEmail, int selectedSheetIndex) throws IOException {
        Log.infof("%s - Récupération du fichier Excel original du partage %s pour %s", LOG_PREFIX, shareId, recipientEmail);
        
        // Récupérer le partage
        Share share = shareService.getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        
        Log.infof("%s - Fichier Excel original: %s", LOG_PREFIX, share.filePath);
        
        // 🔧 CORRECTION : Lire le fichier Excel original, pas les données filtrées (avec déchiffrement si nécessaire)
        try (InputStream fileStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId)) {
            if (fileStream == null) {
                throw new IllegalArgumentException("Fichier Excel non trouvé: " + share.filePath);
            }
            
            // Traiter le fichier Excel original
            ExcelData excelDataObj = excelService.processExcelFile(fileStream, share.originalFileName, selectedSheetIndex);
            
            Log.infof("%s - Fichier Excel original traité: %d lignes, %d colonnes", 
                     LOG_PREFIX, excelDataObj.getTotalRows(), excelDataObj.getTotalColumns());
            
            return excelDataObj;
        }
    }
    
    /**
     * Convertit un Map en ExcelData
     */
    private ExcelData convertMapToExcelData(java.util.Map<String, Object> dataMap) {
        ExcelData excelData = new ExcelData();
        
        // Convertir fileName (sécurité : ne pas exposer le nom de fichier)
        excelData.setFileName("");
        
        // Convertir headers
        if (dataMap.containsKey("headers")) {
            Object headersObj = dataMap.get("headers");
            if (headersObj instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<String> headers = (java.util.List<String>) headersObj;
                excelData.setHeaders(headers);
            }
        }
        
        // Convertir rows
        if (dataMap.containsKey("rows")) {
            Object rowsObj = dataMap.get("rows");
            if (rowsObj instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> rows = (java.util.List<java.util.Map<String, Object>>) rowsObj;
                excelData.setRows(rows);
            }
        }
        
        // Convertir totalRows
        if (dataMap.containsKey("totalRows")) {
            Object totalRowsObj = dataMap.get("totalRows");
            if (totalRowsObj instanceof Number) {
                excelData.setTotalRows(((Number) totalRowsObj).intValue());
            }
        }
        
        // Convertir totalColumns
        if (dataMap.containsKey("totalColumns")) {
            Object totalColumnsObj = dataMap.get("totalColumns");
            if (totalColumnsObj instanceof Number) {
                excelData.setTotalColumns(((Number) totalColumnsObj).intValue());
            }
        }
        
        return excelData;
    }
    
    
    /**
     * Filtre les cellules individuelles selon les sélections
     * Retourne seulement les cellules spécifiquement sélectionnées
     */
    private List<Map<String, Object>> filterCellsBySelection(List<Map<String, Object>> rows, List<CellPosition> selectedCells) {
        if (rows == null || selectedCells == null || selectedCells.isEmpty()) {
            return rows;
        }
        
        // Créer un Set des cellules sélectionnées pour un accès rapide
        Set<String> selectedCellKeys = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedCellKeys.add(cell.row + "," + cell.col);
        }
        
        Log.infof("%s - Cellules sélectionnées: %s", LOG_PREFIX, selectedCellKeys);
        
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Map<String, Object> originalRow = rows.get(rowIndex);
            // Utiliser LinkedHashMap pour préserver l'ordre des colonnes
            Map<String, Object> filteredRow = new LinkedHashMap<>();
            boolean hasSelectedCells = false;
            
            Log.infof("%s - DEBUG: Traitement ligne %d, clés disponibles: %s", LOG_PREFIX, rowIndex, originalRow.keySet());
            
            // Pour toutes les lignes (y compris la ligne 0), ne conserver que les cellules sélectionnées
            // IMPORTANT: Utiliser LinkedHashMap pour préserver l'ordre des colonnes
            for (Map.Entry<String, Object> entry : originalRow.entrySet()) {
                String columnKey = entry.getKey();
                if (columnKey.startsWith("column-")) {
                    int colIndex = Integer.parseInt(columnKey.substring(7)); // "column-0" -> 0
                    String cellKey = rowIndex + "," + colIndex;
                    
                    Log.infof("%s - DEBUG: Vérification cellule %s (ligne %d, col %d) - sélectionnée: %s", 
                             LOG_PREFIX, cellKey, rowIndex, colIndex, selectedCellKeys.contains(cellKey));
                    
                    if (selectedCellKeys.contains(cellKey)) {
                        filteredRow.put(columnKey, entry.getValue());
                        hasSelectedCells = true;
                        Log.infof("%s - Ligne %d, colonne %d: cellule conservée (valeur: %s)", LOG_PREFIX, rowIndex, colIndex, entry.getValue());
                    }
                } else {
                    // Conserver les clés spéciales comme _rowIndex
                    filteredRow.put(columnKey, entry.getValue());
                }
            }
            
            // Ne conserver que les lignes qui ont des cellules sélectionnées
            if (hasSelectedCells && !filteredRow.isEmpty()) {
                filteredRows.add(filteredRow);
                Log.infof("%s - Ligne %d: %d cellules conservées", LOG_PREFIX, rowIndex, filteredRow.size());
            } else {
                Log.infof("%s - Ligne %d: aucune cellule sélectionnée, ligne supprimée", LOG_PREFIX, rowIndex);
            }
        }
        
        return filteredRows;
    }
    
    /**
     * Extrait les headers depuis columnLabels de la requête, dans l'ordre des colonnes filtrées
     * 🔧 CORRECTION STRICTE : Pas de fallback - utilise UNIQUEMENT columnLabels de la requête
     */
    private List<String> extractHeadersFromColumnLabels(Map<String, Map<String, String>> columnLabels, int selectedSheetIndex, List<CellPosition> selectedCells) {
        List<String> headers = new ArrayList<>();
        
        if (columnLabels == null || columnLabels.isEmpty() || selectedCells == null || selectedCells.isEmpty()) {
            Log.warnf("%s - columnLabels null/vide ou selectedCells vide, headers vides retournés (pas de fallback)", LOG_PREFIX);
            return headers;
        }
        
        // Trouver les colonnes uniques sélectionnées et les trier
        Set<Integer> selectedColumnsSet = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedColumnsSet.add(cell.col);
        }
        List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
        sortedSelectedColumns.sort(Integer::compareTo);
        
        String sheetKey = String.valueOf(selectedSheetIndex);
        Map<String, String> sheetColumnLabels = columnLabels.get(sheetKey);
        
        if (sheetColumnLabels == null || sheetColumnLabels.isEmpty()) {
            // Si columnLabels est vide pour cette feuille, créer des headers vides selon le nombre de colonnes
            for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                headers.add("");
            }
            Log.warnf("%s - columnLabels vide pour sheetKey=%s, headers vides créés: %s", LOG_PREFIX, sheetKey, headers);
            return headers;
        }
        
        // Extraire les headers dans l'ordre des colonnes filtrées (column-0, column-1, column-2, etc.)
        for (int i = 0; i < sortedSelectedColumns.size(); i++) {
            String columnKey = "column-" + i;
            String header = sheetColumnLabels.getOrDefault(columnKey, "");
            headers.add(header);
        }
        
        Log.infof("%s - Headers extraits strictement depuis columnLabels de la requête: %s", LOG_PREFIX, headers);
        return headers;
    }
    
    /**
     * Convertit columnLabels pour utiliser les nouveaux index (column-0, column-1, etc.)
     * au lieu des index originaux du fichier Excel (column-2, column-3, etc.)
     * 
     * @param columnLabels Les columnLabels avec les index originaux
     * @param selectedSheetIndex L'index de la feuille sélectionnée
     * @param selectedCells Les cellules sélectionnées
     * @return Les columnLabels convertis avec les nouveaux index
     */
    private Map<String, Map<String, String>> convertColumnLabelsToNewIndexes(
            Map<String, Map<String, String>> columnLabels, 
            int selectedSheetIndex, 
            List<CellPosition> selectedCells) {
        
        if (columnLabels == null || selectedCells == null || selectedCells.isEmpty()) {
            return new HashMap<>();
        }
        
        // Trouver les colonnes uniques sélectionnées et les trier
        Set<Integer> selectedColumns = new HashSet<>();
        for (CellPosition cell : selectedCells) {
            selectedColumns.add(cell.col);
        }
        List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumns);
        sortedSelectedColumns.sort(Integer::compareTo);
        
        String sheetKey = String.valueOf(selectedSheetIndex);
        Map<String, String> sheetColumnLabels = columnLabels.get(sheetKey);
        
        if (sheetColumnLabels == null || sheetColumnLabels.isEmpty()) {
            return new HashMap<>();
        }
        
        // 🔧 DÉTECTION : Vérifier si les columnLabels utilisent déjà les index filtrés (0, 1, 2...) ou les index originaux
        // Si toutes les clés sont de la forme column-X où X est entre 0 et (nombre de colonnes - 1),
        // et qu'il y a exactement le même nombre de labels que de colonnes sélectionnées,
        // alors ils sont déjà au bon format
        Set<String> labelKeys = sheetColumnLabels.keySet();
        boolean allKeysAreColumnFormat = labelKeys.stream()
            .allMatch(key -> key.startsWith("column-"));
        
        if (allKeysAreColumnFormat && labelKeys.size() == sortedSelectedColumns.size()) {
            // Vérifier si tous les index sont dans la plage [0, nombre de colonnes[
            boolean allIndexesInRange = labelKeys.stream()
                .allMatch(key -> {
                    try {
                        int index = Integer.parseInt(key.replace("column-", ""));
                        return index >= 0 && index < sortedSelectedColumns.size();
                    } catch (NumberFormatException e) {
                        return false;
                    }
                });
            
            if (allIndexesInRange) {
                // Les columnLabels sont déjà au bon format, mais il faut les réordonner selon les colonnes sélectionnées
                // pour garantir la cohérence avec l'ordre des données filtrées
                Log.infof("%s - ColumnLabels déjà au bon format (index filtrés), réordonnement selon colonnes sélectionnées. Labels: %s", 
                         LOG_PREFIX, labelKeys);
                
                // Créer un LinkedHashMap pour préserver l'ordre
                Map<String, String> orderedLabels = new LinkedHashMap<>();
                for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                    String columnKey = "column-" + i;
                    if (sheetColumnLabels.containsKey(columnKey)) {
                        orderedLabels.put(columnKey, sheetColumnLabels.get(columnKey));
                    }
                }
                
                Map<String, Map<String, String>> result = new HashMap<>();
                result.put(sheetKey, orderedLabels);
                return result;
            }
        }
        
        Log.infof("%s - Conversion nécessaire. Labels reçus: %s, Colonnes sélectionnées: %s", 
                 LOG_PREFIX, labelKeys, sortedSelectedColumns);
        
        // Sinon, convertir depuis les index originaux vers les index filtrés
        // Utiliser LinkedHashMap pour préserver l'ordre
        Map<String, String> convertedLabels = new LinkedHashMap<>();
        int newColumnIndex = 0;
        for (int originalColIndex : sortedSelectedColumns) {
            String originalColumnKey = "column-" + originalColIndex;
            String newColumnKey = "column-" + newColumnIndex;
            
            // Si un label personnalisé existe pour cette colonne originale, l'utiliser
            if (sheetColumnLabels.containsKey(originalColumnKey)) {
                convertedLabels.put(newColumnKey, sheetColumnLabels.get(originalColumnKey));
                Log.infof("%s - Conversion columnLabels: %s -> %s (label: %s)", 
                         LOG_PREFIX, originalColumnKey, newColumnKey, sheetColumnLabels.get(originalColumnKey));
            }
            
            newColumnIndex++;
        }
        
        Map<String, Map<String, String>> result = new HashMap<>();
        result.put(sheetKey, convertedLabels);
        
        Log.infof("%s - ColumnLabels convertis: %d labels pour la feuille %s", 
                 LOG_PREFIX, convertedLabels.size(), sheetKey);
        
        return result;
    }
    
    /**
     * Garantit que columnLabels a toujours la structure correcte, même s'il est vide
     * Structure attendue: { "0": { "column-0": "label1", "column-1": "label2", ... } }
     */
    private Map<String, Map<String, String>> ensureColumnLabelsStructure(
            Map<String, Map<String, String>> columnLabels, 
            int selectedSheetIndex) {
        
        String sheetKey = String.valueOf(selectedSheetIndex);
        
        if (columnLabels == null || columnLabels.isEmpty()) {
            // Créer une structure vide mais valide
            Map<String, Map<String, String>> emptyStructure = new HashMap<>();
            emptyStructure.put(sheetKey, new LinkedHashMap<>());
            Log.warnf("%s - ColumnLabels null ou vide, structure vide créée pour sheetKey: %s", LOG_PREFIX, sheetKey);
            return emptyStructure;
        }
        
        // Vérifier que la structure contient la clé de la feuille
        if (!columnLabels.containsKey(sheetKey)) {
            // Ajouter la clé manquante avec une Map vide
            Map<String, Map<String, String>> correctedStructure = new HashMap<>(columnLabels);
            correctedStructure.put(sheetKey, new LinkedHashMap<>());
            Log.warnf("%s - Clé sheetKey manquante dans columnLabels, ajoutée: %s", LOG_PREFIX, sheetKey);
            return correctedStructure;
        }
        
        // Vérifier que la Map interne n'est pas null
        Map<String, String> sheetLabels = columnLabels.get(sheetKey);
        if (sheetLabels == null) {
            Map<String, Map<String, String>> correctedStructure = new HashMap<>(columnLabels);
            correctedStructure.put(sheetKey, new LinkedHashMap<>());
            Log.warnf("%s - Map interne null pour sheetKey, remplacée par Map vide: %s", LOG_PREFIX, sheetKey);
            return correctedStructure;
        }
        
        // Tout est correct
        return columnLabels;
    }
    
    /**
     * Valide que tous les champs nécessaires sont présents dans la réponse paginée
     */
    private void validatePaginatedResponse(Map<String, Object> response) {
        if (response == null) {
            throw new IllegalStateException("Réponse paginée ne peut pas être null");
        }
        
        // Vérifier les champs obligatoires
        if (!response.containsKey("rows")) {
            response.put("rows", new ArrayList<>());
            Log.warnf("%s - Champ 'rows' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("total")) {
            response.put("total", 0);
            Log.warnf("%s - Champ 'total' manquant, ajouté comme 0", LOG_PREFIX);
        }
        
        if (!response.containsKey("headers")) {
            response.put("headers", new ArrayList<>());
            Log.warnf("%s - Champ 'headers' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("columnLabels")) {
            response.put("columnLabels", new HashMap<>());
            Log.warnf("%s - Champ 'columnLabels' manquant, ajouté comme Map vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("tableDataFormulaCells")) {
            response.put("tableDataFormulaCells", new ArrayList<>());
            Log.warnf("%s - Champ 'tableDataFormulaCells' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        // Vérifier que columnLabels a la bonne structure
        Object columnLabelsObj = response.get("columnLabels");
        if (columnLabelsObj == null) {
            response.put("columnLabels", new HashMap<>());
            Log.warnf("%s - columnLabels est null, remplacé par Map vide", LOG_PREFIX);
        }
        
        Log.infof("%s - Validation réponse paginée: rows=%s, total=%s, headers=%s, columnLabels=%s, tableDataEditableCells=%s, tableDataFormulaCells=%s", 
                 LOG_PREFIX, 
                 response.get("rows") != null ? "présent" : "absent",
                 response.get("total") != null ? "présent" : "absent",
                 response.get("headers") != null ? "présent" : "absent",
                 response.get("columnLabels") != null ? "présent" : "absent",
                 response.get("tableDataEditableCells") != null ? "présent" : "absent",
                 response.get("tableDataFormulaCells") != null ? "présent" : "absent");
    }
    
    /**
     * Valide que tous les champs nécessaires sont présents dans la réponse non paginée
     */
    private void validateResponse(Map<String, Object> response) {
        if (response == null) {
            throw new IllegalStateException("Réponse ne peut pas être null");
        }
        
        // Vérifier les champs obligatoires
        if (!response.containsKey("headers")) {
            response.put("headers", new ArrayList<>());
            Log.warnf("%s - Champ 'headers' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("rows")) {
            response.put("rows", new ArrayList<>());
            Log.warnf("%s - Champ 'rows' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("totalRows")) {
            response.put("totalRows", 0);
            Log.warnf("%s - Champ 'totalRows' manquant, ajouté comme 0", LOG_PREFIX);
        }
        
        if (!response.containsKey("totalColumns")) {
            response.put("totalColumns", 0);
            Log.warnf("%s - Champ 'totalColumns' manquant, ajouté comme 0", LOG_PREFIX);
        }
        
        if (!response.containsKey("columnLabels")) {
            response.put("columnLabels", new HashMap<>());
            Log.warnf("%s - Champ 'columnLabels' manquant, ajouté comme Map vide", LOG_PREFIX);
        }
        
        if (!response.containsKey("tableDataEditableCells")) {
            response.put("tableDataEditableCells", new ArrayList<>());
            Log.warnf("%s - Champ 'tableDataEditableCells' manquant, ajouté comme liste vide", LOG_PREFIX);
        }
        
        Log.infof("%s - Validation réponse: tous les champs présents", LOG_PREFIX);
    }
    
    /**
     * Valide et complète la réponse du cache pour garantir que tous les champs nécessaires sont présents
     * 🔧 CORRECTION : Génère les headers et columnLabels depuis la requête au lieu d'ajouter des valeurs vides
     */
    @SuppressWarnings("unchecked")
    private Object validateAndCompleteCachedResponse(Object cachedData, SimulateTabdataRequest request, 
                                                      Integer page, Integer limit) {
        if (cachedData == null) {
            return cachedData;
        }
        
        // Si c'est une Map (réponse paginée ou wrapper)
        if (cachedData instanceof Map) {
            Map<String, Object> responseMap = (Map<String, Object>) cachedData;
            
            // 🔧 CORRECTION STRICTE : Extraire les headers depuis columnLabels de la requête, sans fallback
            // Extraire les sélections pour générer les headers
            List<CellPosition> selectedCells = new ArrayList<>();
            if (request.selections != null) {
                String sheetKey = String.valueOf(request.selectedSheetIndex);
                List<SimulateTabdataRequest.CellSelection> cellSelections = request.selections.get(sheetKey);
                if (cellSelections != null) {
                    for (SimulateTabdataRequest.CellSelection cell : cellSelections) {
                        selectedCells.add(new CellPosition(cell.row, cell.col));
                    }
                }
            }
            
            // Extraire les headers depuis columnLabels de la requête (STRICT - pas de fallback)
            List<String> generatedHeaders = extractHeadersFromColumnLabels(request.columnLabels, request.selectedSheetIndex, selectedCells);
            
            // Convertir les columnLabels pour utiliser les index filtrés
            Map<String, Map<String, String>> generatedColumnLabels = new HashMap<>();
            if (request.columnLabels != null && !request.columnLabels.isEmpty() && selectedCells != null && !selectedCells.isEmpty()) {
                generatedColumnLabels = convertColumnLabelsToNewIndexes(request.columnLabels, request.selectedSheetIndex, selectedCells);
            } else {
                generatedColumnLabels = ensureColumnLabelsStructure(null, request.selectedSheetIndex);
            }
            
            // 🔧 CORRECTION : Générer tableDataEditableCells depuis la requête (comme pour headers et columnLabels)
            List<Map<String, Object>> generatedTableDataEditableCells = new ArrayList<>();
            if (request.editableCells != null && !request.editableCells.isEmpty() && selectedCells != null && !selectedCells.isEmpty()) {
                // Créer un recipient temporaire avec les editableCells de la requête
                Recipient tempRecipient = new Recipient();
                tempRecipient.selectedSheetIndex = request.selectedSheetIndex;
                tempRecipient.editableCells = new HashMap<>();
                for (Map.Entry<String, List<SimulateTabdataRequest.CellSelection>> entry : request.editableCells.entrySet()) {
                    String sheetKey = entry.getKey();
                    List<SimulateTabdataRequest.CellSelection> cellSelections = entry.getValue();
                    List<Recipient.CellSelection> recipientSelections = new ArrayList<>();
                    for (SimulateTabdataRequest.CellSelection cell : cellSelections) {
                        recipientSelections.add(new Recipient.CellSelection(cell.row, cell.col));
                    }
                    tempRecipient.editableCells.put(sheetKey, recipientSelections);
                }
                
                // Extraire les rows depuis la réponse du cache pour obtenir filteredTableData
                List<Map<String, Object>> filteredTableData = new ArrayList<>();
                if (responseMap.containsKey("rows") && responseMap.get("rows") instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> rows = (List<Map<String, Object>>) responseMap.get("rows");
                    filteredTableData = rows;
                }
                
                // Calculer l'offset de la page pour adapter les index des editableCells
                int pageOffset = 0;
                if (page != null && limit != null && page > 0 && limit > 0) {
                    pageOffset = (page - 1) * limit;
                }
                
                // Convertir les editableCells en tableDataEditableCells (déjà filtrés)
                // Passer pageOffset pour adapter les index de lignes à la pagination
                generatedTableDataEditableCells = convertEditableCellsToTableDataFormat(
                    tempRecipient, filteredTableData, selectedCells, true, pageOffset);
            }
            
            Log.infof("%s - Headers extraits depuis la requête (cache): %s", LOG_PREFIX, generatedHeaders);
            Log.infof("%s - ColumnLabels convertis depuis la requête (cache): %s", LOG_PREFIX, generatedColumnLabels);
            Log.infof("%s - TableDataEditableCells générés depuis la requête (cache): %d cellules", 
                     LOG_PREFIX, generatedTableDataEditableCells.size());
            
            // Vérifier si c'est une réponse paginée
            if (page != null && limit != null && page > 0 && limit > 0) {
                // Réponse paginée : doit avoir rows, total, headers, columnLabels, tableDataEditableCells
                // 🔧 CORRECTION : Utiliser les headers générés depuis la requête
                responseMap.put("headers", generatedHeaders);
                
                // 🔧 CORRECTION : Utiliser les columnLabels générés depuis la requête
                responseMap.put("columnLabels", ensureColumnLabelsStructure(generatedColumnLabels, request.selectedSheetIndex));
                
                // 🔧 CORRECTION : Utiliser les tableDataEditableCells générés depuis la requête
                responseMap.put("tableDataEditableCells", generatedTableDataEditableCells);
                
                // Valider la réponse complète
                validatePaginatedResponse(responseMap);
                
                Log.infof("%s - Réponse du cache validée et complétée: rows=%s, total=%s, headers=%s, columnLabels=%s", 
                         LOG_PREFIX,
                         responseMap.containsKey("rows") ? "présent" : "absent",
                         responseMap.containsKey("total") ? "présent" : "absent",
                         generatedHeaders,
                         generatedColumnLabels);
            } else {
                // Réponse non paginée : doit avoir headers, rows, totalRows, totalColumns, columnLabels, tableDataEditableCells
                // 🔧 CORRECTION : Utiliser les headers générés depuis la requête
                responseMap.put("headers", generatedHeaders);
                
                // 🔧 CORRECTION : Utiliser les columnLabels générés depuis la requête
                responseMap.put("columnLabels", ensureColumnLabelsStructure(generatedColumnLabels, request.selectedSheetIndex));
                
                // 🔧 CORRECTION : Utiliser les tableDataEditableCells générés depuis la requête
                responseMap.put("tableDataEditableCells", generatedTableDataEditableCells);
                
                // Valider la réponse complète
                validateResponse(responseMap);
            }
            
            return responseMap;
        }
        
        // Si ce n'est pas une Map, retourner tel quel (cas improbable)
        Log.warnf("%s - Réponse du cache n'est pas une Map, retour sans modification", LOG_PREFIX);
        return cachedData;
    }
    
    /**
     * Convertit les editableCells du recipient en format tableDataEditableCells avec les index filtrés
     * Format de sortie: [{ "row": 0, "col": "column-0" }, { "row": 1, "col": "column-2" }, ...]
     * 
     * @param alreadyFiltered Si true, les editableCells sont déjà dans le format filtré (col: 0, 1, 2, ...)
     *                        et doivent être utilisés directement sans mapping
     * @param pageOffset Offset de la page pour adapter les index de lignes à la pagination
     *                   (0 si pas de pagination, sinon (page - 1) * limit)
     */
    private List<Map<String, Object>> convertEditableCellsToTableDataFormat(
            Recipient recipient, 
            List<Map<String, Object>> filteredTableData,
            List<CellPosition> selectedCells,
            boolean alreadyFiltered,
            int pageOffset) {
        
        List<Map<String, Object>> tableDataEditableCells = new ArrayList<>();
        
        Log.infof("%s - 🔍 DEBUG convertEditableCellsToTableDataFormat: recipient.editableCells=%s, pageOffset=%d", 
                 LOG_PREFIX, recipient.editableCells, pageOffset);
        
        if (recipient.editableCells == null || recipient.editableCells.isEmpty()) {
            Log.warnf("%s - ⚠️ Aucune cellule éditable dans le recipient (null ou vide)", LOG_PREFIX);
            return tableDataEditableCells;
        }
        
        String sheetKey = String.valueOf(recipient.selectedSheetIndex);
        Log.infof("%s - 🔍 DEBUG: Recherche editableCells pour sheetKey=%s", LOG_PREFIX, sheetKey);
        Object editableCellsObj = recipient.editableCells.get(sheetKey);
        Log.infof("%s - 🔍 DEBUG: editableCellsObj trouvé: %s (type: %s)", 
                 LOG_PREFIX, editableCellsObj, editableCellsObj != null ? editableCellsObj.getClass().getName() : "null");
        
        if (editableCellsObj == null) {
            Log.warnf("%s - ⚠️ Aucune cellule éditable pour la feuille %s (clés disponibles: %s)", 
                     LOG_PREFIX, sheetKey, recipient.editableCells.keySet());
            return tableDataEditableCells;
        }
        
        // Convertir les LinkedHashMap (désérialisés depuis JSONB) en CellSelection
        List<Recipient.CellSelection> editableCellsForSheet = convertToCellSelectionList(editableCellsObj);
        if (editableCellsForSheet == null || editableCellsForSheet.isEmpty()) {
            Log.infof("%s - Liste de cellules éditables vide après conversion", LOG_PREFIX);
            return tableDataEditableCells;
        }
        
        Log.infof("%s - Conversion de %d cellules éditables pour la feuille %s (alreadyFiltered=%s, pageOffset=%d)", 
                 LOG_PREFIX, editableCellsForSheet.size(), sheetKey, alreadyFiltered, pageOffset);
        
        // Obtenir les clés de colonnes dans l'ordre pour mapper les indices vers les noms
        List<String> orderedColumnKeys = new ArrayList<>();
        if (filteredTableData != null && !filteredTableData.isEmpty()) {
            Map<String, Object> firstRow = filteredTableData.get(0);
            orderedColumnKeys = firstRow.keySet().stream()
                .filter(key -> key.startsWith("column-"))
                .sorted((a, b) -> {
                    int aIndex = Integer.parseInt(a.replace("column-", ""));
                    int bIndex = Integer.parseInt(b.replace("column-", ""));
                    return Integer.compare(aIndex, bIndex);
                })
                .collect(java.util.stream.Collectors.toList());
        }
        
        Log.infof("%s - Colonnes ordonnées dans tableData filtré: %s", LOG_PREFIX, orderedColumnKeys);
        
        if (alreadyFiltered) {
            // 🔧 CORRECTION : Les editableCells sont déjà dans le format filtré (col: 0, 1, 2, ...)
            // Mais les index de lignes sont absolus (basés sur le total filtré)
            // Il faut adapter les index de lignes en soustrayant pageOffset pour qu'ils soient relatifs à la page
            for (Recipient.CellSelection cell : editableCellsForSheet) {
                int colIndex = cell.col;
                int absoluteRowIndex = cell.row; // Index absolu (basé sur le total filtré)
                int relativeRowIndex = absoluteRowIndex - pageOffset; // Index relatif à la page
                
                // Vérifier que l'index de ligne est dans la plage de la page actuelle
                if (relativeRowIndex >= 0 && relativeRowIndex < filteredTableData.size()) {
                    // Vérifier que l'index de colonne est valide
                    if (colIndex >= 0 && colIndex < orderedColumnKeys.size()) {
                        String columnName = orderedColumnKeys.get(colIndex);
                        
                        Map<String, Object> cellPosition = new HashMap<>();
                        cellPosition.put("row", relativeRowIndex); // Utiliser l'index relatif à la page
                        cellPosition.put("col", columnName);
                        tableDataEditableCells.add(cellPosition);
                        
                        Log.infof("%s - Cellule éditable (adaptée à la pagination): [%d,%d] (absolu) -> [%d,%s] (relatif page)", 
                                 LOG_PREFIX, absoluteRowIndex, cell.col, relativeRowIndex, columnName);
                    } else {
                        Log.warnf("%s - Index de colonne %d hors limites (max: %d)", 
                                 LOG_PREFIX, colIndex, orderedColumnKeys.size() - 1);
                    }
                } else {
                    Log.infof("%s - Cellule éditable [%d,%d] (absolu) hors de la page actuelle (offset=%d, taille page=%d), ignorée", 
                             LOG_PREFIX, absoluteRowIndex, cell.col, pageOffset, filteredTableData.size());
                }
            }
        } else {
            // Ancien comportement : convertir depuis les index originaux
            // Trouver les colonnes uniques sélectionnées et les trier pour créer le mapping
            Set<Integer> selectedColumnsSet = new HashSet<>();
            for (CellPosition cell : selectedCells) {
                selectedColumnsSet.add(cell.col);
            }
            List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
            sortedSelectedColumns.sort(Integer::compareTo);
            
            // Créer le mapping : index original -> index filtré (column-0, column-1, etc.)
            Map<Integer, Integer> columnMapping = new HashMap<>();
            for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                columnMapping.put(sortedSelectedColumns.get(i), i);
            }
            
            Log.infof("%s - Mapping des colonnes: %s", LOG_PREFIX, columnMapping);
            
            // Convertir chaque cellule éditable
            for (Recipient.CellSelection cell : editableCellsForSheet) {
                // Trouver le nouvel index de colonne après filtrage
                Integer newColIndex = columnMapping.get(cell.col);
                
                if (newColIndex != null) {
                    // Utiliser le nom de colonne du tableData filtré
                    String columnName = "column-" + newColIndex;
                    
                    // Vérifier si le nom de colonne existe dans le tableData filtré
                    if (newColIndex >= 0 && newColIndex < orderedColumnKeys.size()) {
                        columnName = orderedColumnKeys.get(newColIndex);
                    }
                    
                    Map<String, Object> cellPosition = new HashMap<>();
                    cellPosition.put("row", cell.row);
                    cellPosition.put("col", columnName);
                    tableDataEditableCells.add(cellPosition);
                    
                    Log.infof("%s - Cellule éditable convertie: [%d,%d] (original) -> [%d,%s] (filtré)", 
                             LOG_PREFIX, cell.row, cell.col, cell.row, columnName);
                } else {
                    Log.warnf("%s - Colonne originale %d non trouvée dans le mapping (non sélectionnée)", 
                             LOG_PREFIX, cell.col);
                }
            }
        }
        
        Log.infof("%s - %d cellules éditables converties au format tableData", 
                 LOG_PREFIX, tableDataEditableCells.size());
        
        return tableDataEditableCells;
    }
    
    /**
     * Convertit un objet (peut être LinkedHashMap depuis JSONB) en liste de CellSelection
     */
    @SuppressWarnings("unchecked")
    private List<Recipient.CellSelection> convertToCellSelectionList(Object obj) {
        if (obj == null) {
            return null;
        }
        
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            List<Recipient.CellSelection> result = new ArrayList<>();
            
            for (Object item : list) {
                if (item instanceof Recipient.CellSelection) {
                    result.add((Recipient.CellSelection) item);
                } else if (item instanceof java.util.Map) {
                    // Désérialisation depuis JSONB (LinkedHashMap)
                    java.util.Map<String, Object> map = (java.util.Map<String, Object>) item;
                    Recipient.CellSelection cell = new Recipient.CellSelection();
                    cell.row = ((Number) map.getOrDefault("row", 0)).intValue();
                    cell.col = ((Number) map.getOrDefault("col", 0)).intValue();
                    result.add(cell);
                } else {
                    Log.warnf("%s - Type inattendu dans la liste de cellules éditables: %s", 
                             LOG_PREFIX, item.getClass().getName());
                }
            }
            
            return result;
        }
        
        Log.warnf("%s - Type inattendu pour les cellules éditables: %s", 
                 LOG_PREFIX, obj.getClass().getName());
        return null;
    }
}
