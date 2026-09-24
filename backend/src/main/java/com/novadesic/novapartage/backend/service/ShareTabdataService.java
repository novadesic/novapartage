package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.ShareAccessTabdata;
import com.novadesic.novapartage.backend.model.ShareAccessTabdataRow;
import com.novadesic.novapartage.backend.model.Recipient;
import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.model.ExcelData.FormulaCellPosition;
import com.novadesic.novapartage.backend.service.ExcelDataConverter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

@ApplicationScoped
public class ShareTabdataService {
    
    private static final String LOG_PREFIX = "🔒 TABDATA SERVICE";
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ExcelService excelService;
    
    @Inject
    ObjectMapper objectMapper;
    
    @Inject
    FileEncryptionService fileEncryptionService;
    
    @ConfigProperty(name = "share.tabdata.compression.enabled", defaultValue = "false")
    boolean compressionEnabled;
    
    @ConfigProperty(name = "share.tabdata.max-size", defaultValue = "10485760") // 10MB
    long maxTabdataSize;
    
    /**
     * Calcule et stocke le tabdata pour un destinataire
     */
    @Transactional
    public void computeAndStoreTabdata(String shareId, String recipientEmail) throws IOException {
        UUID shareUuid = UUID.fromString(shareId);
        Share share = Share.findById(shareUuid);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        computeAndStoreTabdata(share, recipientEmail);
    }
    
    /**
     * Calcule et stocke le tabdata pour un destinataire (version avec share en paramètre)
     * Utilise le share fourni au lieu de le recharger depuis la base pour éviter les problèmes de synchronisation
     */
    @Transactional
    public void computeAndStoreTabdata(Share share, String recipientEmail) throws IOException {
        Log.infof("%s - Calcul du tabdata pour shareId=%s, recipientEmail=%s", 
                 LOG_PREFIX, share.id, recipientEmail);
        
        // 1. Récupérer le destinataire depuis le share fourni
        Recipient recipient = share.recipients.stream()
            .filter(r -> r.email.equals(recipientEmail))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Destinataire non trouvé: " + recipientEmail));
        
        // 🔍 DEBUG : Log des informations du destinataire
        Log.infof("%s - DEBUG: Destinataire trouvé: %s", LOG_PREFIX, recipient.email);
        Log.infof("%s - DEBUG: selectedSheetIndex = %d", LOG_PREFIX, recipient.selectedSheetIndex);
        Log.infof("%s - DEBUG: selections = %s", LOG_PREFIX, recipient.selections);
        Log.infof("%s - DEBUG: editableCells = %s", LOG_PREFIX, recipient.editableCells);
        
        // 2. Lire le fichier (SEUL MOMENT D'ACCÈS FICHIER)
        Log.infof("%s - 🔒 ACCÈS FICHIER AUTORISÉ - Calcul tabdata pour %s", LOG_PREFIX, recipientEmail);
        
        try (InputStream fileStream1 = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId);
             InputStream fileStream2 = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId)) {
            
            // 3. Calculer le fileFingerprint
            String fileFingerprint = calculateFileFingerprint(fileStream1);
            
            // 4. Recalculer les données Excel
            int sheetIndex = recipient.selectedSheetIndex;
            Object excelData = excelService.processExcelFile(fileStream2, share.originalFileName, sheetIndex);
            
            // 5. Filtrer les données selon les sélections du destinataire
            Object filteredData = filterDataBySelections(excelData, recipient, share);
            
            // 6. Extraire les headers, les lignes et les cellules formules
            List<String> headers = null;
            List<Map<String, Object>> rows = null;
            List<FormulaCellPosition> formulaCells = null;
            int totalRows = 0;
            
            if (filteredData instanceof ExcelData) {
                ExcelData filteredExcelData = (ExcelData) filteredData;
                headers = filteredExcelData.getHeaders();
                rows = filteredExcelData.getRows();
                formulaCells = filteredExcelData.getFormulaCells();
                totalRows = rows != null ? rows.size() : 0;
            } else if (filteredData instanceof java.util.Map) {
                java.util.Map<?, ?> map = (java.util.Map<?, ?>) filteredData;
                if (map.containsKey("headers") && map.get("headers") instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<String> headersList = (java.util.List<String>) map.get("headers");
                    headers = headersList;
                }
                if (map.containsKey("rows") && map.get("rows") instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<Map<String, Object>> rowsList = (java.util.List<Map<String, Object>>) map.get("rows");
                    rows = rowsList;
                    totalRows = rows != null ? rows.size() : 0;
                }
            }
            
            if (headers == null) {
                headers = new ArrayList<>();
            }
            if (rows == null) {
                rows = new ArrayList<>();
            }
            
            // 7. Créer ou mettre à jour l'entité ShareAccessTabdata
            // Supprimer complètement l'ancien tabdata (lignes + entité) pour garantir une mise à jour propre
            ShareAccessTabdata existingTabdata = ShareAccessTabdata.find(
                "shareId = ?1 and recipientEmail = ?2", share.id, recipientEmail).firstResult();
            
            if (existingTabdata != null) {
                // Supprimer d'abord les lignes, puis l'entité principale
                ShareAccessTabdataRow.delete("tabdataId = ?1", existingTabdata.id);
                ShareAccessTabdata.delete("id = ?1", existingTabdata.id);
                Log.infof("%s - Ancien tabdata supprimé pour %s avant recalcul", LOG_PREFIX, recipientEmail);
            }
            
            // Créer une nouvelle entité (toujours, même si elle existait avant)
            ShareAccessTabdata tabdata = new ShareAccessTabdata();
            tabdata.shareId = share.id;
            tabdata.recipientEmail = recipientEmail;
            
            // 8. Stocker les headers et les cellules formules
            tabdata.headers = objectMapper.writeValueAsString(headers);
            tabdata.fileFingerprint = fileFingerprint;
            tabdata.formulaCells = (formulaCells != null && !formulaCells.isEmpty()) 
                ? objectMapper.writeValueAsString(formulaCells) : null;
            // Calculer et stocker le hash des sélections et editableCells du recipient
            String selectionsHash = calculateSelectionsHash(recipient);
            tabdata.selectionsHash = selectionsHash;
            tabdata.schemaVersion = "1.0";
            tabdata.totalRows = totalRows;
            tabdata.updateTimestamp();
            
            // 9. Stocker en base pour obtenir l'ID
            tabdata.persist();
            
            // 10. Stocker chaque ligne dans share_access_tabdata_row (avec chiffrement)
            for (int i = 0; i < rows.size(); i++) {
                Map<String, Object> row = rows.get(i);
                String rowDataJson = objectMapper.writeValueAsString(row);
                String searchableText = generateSearchableText(row);
                
                // Chiffrer les données avec la clé du propriétaire
                byte[] rowDataBytes = rowDataJson.getBytes(StandardCharsets.UTF_8);
                byte[] encryptedRowData = fileEncryptionService.encryptData(rowDataBytes, share.ownerEmail);
                
                ShareAccessTabdataRow rowEntity = new ShareAccessTabdataRow(
                    tabdata.id, i, encryptedRowData, searchableText, share.ownerEmail
                );
                rowEntity.persist();
            }
            
            Log.infof("%s - Tabdata stocké avec succès (headers: %d, totalRows: %d)", 
                     LOG_PREFIX, headers.size(), totalRows);
        }
    }
    
    /**
     * Récupère le tabdata depuis la base (SANS ACCÈS FICHIER)
     * 
     * ⚠️ RÈGLE CRITIQUE DE SÉCURITÉ ⚠️
     * =================================
     * Cette méthode NE DOIT JAMAIS accéder au fichier Excel pour les raisons suivantes :
     * 
     * 1. ACCÈS PUBLIC : Les accès publics (via token) ne doivent pas nécessiter l'accès au fichier
     *    - Les données sont déjà stockées en base de données
     *    - L'accès au fichier est réservé uniquement au propriétaire lors de l'édition
     * 
     * 2. SÉCURITÉ : Éviter les accès fichiers non autorisés
     *    - Les utilisateurs publics ne doivent pas pouvoir déclencher des accès fichiers
     *    - Seul le propriétaire peut accéder au fichier lors de l'édition/modification
     * 
     * 3. PERFORMANCE : Les données en base sont suffisantes
     *    - Le tabdata contient déjà toutes les données nécessaires (headers, rows)
     *    - Pas besoin de recalculer ou vérifier depuis le fichier
     * 
     * 4. RECALCUL : Le recalcul du tabdata est géré séparément
     *    - Le propriétaire peut recalculer via rebuildTabdataForAllRecipients()
     *    - Le recalcul se fait uniquement lors de l'édition par le propriétaire
     *    - La vérification de cohérence (isTabdataConsistent) est une méthode séparée
     * 
     * ❌ INTERDIT : Ne jamais appeler fileStorageService.getFile() dans cette méthode
     * ✅ AUTORISÉ : Utiliser uniquement les données stockées en base (ShareAccessTabdata)
     * 
     * @param page Numéro de page (commence à 1), null pour toutes les données
     * @param limit Nombre de lignes par page, null pour toutes les données
     */
    public Object getTabdataFromDatabase(String shareId, String recipientEmail, Integer page, Integer limit) throws IOException {
        Log.debugf("%s - Récupération tabdata depuis base pour shareId=%s, recipientEmail=%s, page=%s, limit=%s", 
                  LOG_PREFIX, shareId, recipientEmail, page, limit);
        
        // 1. Récupérer depuis la base de données
        UUID shareUuid = UUID.fromString(shareId);
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "shareId = ?1 and recipientEmail = ?2", shareUuid, recipientEmail).firstResult();
        
        if (tabdata == null) {
            throw new IllegalArgumentException("Tabdata non trouvé pour ce destinataire");
        }
        
        // 🔒 SÉCURITÉ : Vérification de cohérence avec le fichier SUPPRIMÉE
        // Cette vérification nécessitait un accès au fichier via fileStorageService.getFile(),
        // ce qui est INTERDIT pour les accès publics. Les données en base sont utilisées directement.
        // Le recalcul du tabdata est géré par le propriétaire lors de l'édition via rebuildTabdataForAllRecipients().
        
        // 2. Vérifier si le tabdata temporaire est expiré
        if (tabdata.isTemporary() && tabdata.isStale()) {
            Log.warnf("%s - Tabdata temporaire expiré pour %s", LOG_PREFIX, recipientEmail);
            throw new IllegalArgumentException("Tabdata temporaire expiré");
        }
        
        // 4. Récupérer les headers
        List<String> headers = new ArrayList<>();
        if (tabdata.headers != null && !tabdata.headers.isEmpty()) {
            headers = objectMapper.readValue(tabdata.headers, 
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        }
        
        // 5. Récupérer les lignes avec pagination
        List<Map<String, Object>> rows = getRowsFromDatabase(tabdata.id, page, limit);
        
        // 5b. Récupérer et adapter les cellules formules pour la pagination
        List<FormulaCellPosition> formulaCells = getFormulaCellsFromTabdata(tabdata, page, limit);
        
        // 6. Construire la réponse
        if (page != null && limit != null && page > 0 && limit > 0) {
            // Mode pagination : retourner un objet avec rows et total
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("rows", rows);
            response.put("total", tabdata.totalRows);
            response.put("headers", headers);
            response.put("tableDataFormulaCells", formulaCells != null ? toCellPositionMaps(formulaCells) : new ArrayList<>());
            return response;
        } else {
            // Mode complet : retourner un ExcelData
            ExcelData excelData = new ExcelData();
            excelData.setFileName("");
            excelData.setHeaders(headers);
            excelData.setRows(rows);
            excelData.setTotalRows(tabdata.totalRows);
            excelData.setTotalColumns(headers.size());
            excelData.setFormulaCells(formulaCells);
            return excelData;
        }
    }
    
    /**
     * Récupère le tabdata depuis la base pour un fichier temporaire
     * @param currentFileFingerprint Fingerprint actuel du fichier (pour vérifier la cohérence)
     */
    public Object getTabdataFromDatabaseForTempFile(String tempFileId, String recipientEmail, 
                                                    String currentFileFingerprint,
                                                    Integer page, Integer limit) throws IOException {
        Log.debugf("%s - Récupération tabdata depuis base pour tempFileId=%s, recipientEmail=%s, page=%s, limit=%s", 
                  LOG_PREFIX, tempFileId, recipientEmail, page, limit);
        
        // 1. Récupérer depuis MongoDB
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "tempFileId = ?1 and recipientEmail = ?2", tempFileId, recipientEmail).firstResult();
        
        if (tabdata == null) {
            return null; // Pas de cache disponible
        }
        
        // 2. Vérifier si le tabdata temporaire est expiré
        if (tabdata.isStale()) {
            Log.warnf("%s - Tabdata temporaire expiré pour %s", LOG_PREFIX, recipientEmail);
            // Supprimer le cache expiré
            tabdata.delete();
            return null;
        }
        
        // 3. Vérifier la cohérence avec le fichier actuel si fingerprint fourni
        if (currentFileFingerprint != null && !tabdata.isConsistentWithFile(currentFileFingerprint)) {
            Log.warnf("%s - Tabdata temporaire incohérent (fichier modifié) pour %s", LOG_PREFIX, recipientEmail);
            // Supprimer le cache incohérent
            tabdata.delete();
            return null;
        }
        
        // 4. Récupérer les headers
        List<String> headers = new ArrayList<>();
        if (tabdata.headers != null && !tabdata.headers.isEmpty()) {
            headers = objectMapper.readValue(tabdata.headers, 
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        }
        
        // 5. Récupérer les lignes avec pagination
        List<Map<String, Object>> rows = getRowsFromDatabase(tabdata.id, page, limit);
        
        // 5b. Récupérer et adapter les cellules formules pour la pagination
        List<FormulaCellPosition> formulaCells = getFormulaCellsFromTabdata(tabdata, page, limit);
        
        // 6. Construire la réponse
        if (page != null && limit != null && page > 0 && limit > 0) {
            // Mode pagination : retourner un objet avec rows et total
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("rows", rows);
            response.put("total", tabdata.totalRows);
            response.put("headers", headers);
            response.put("tableDataFormulaCells", formulaCells != null ? toCellPositionMaps(formulaCells) : new ArrayList<>());
            return response;
        } else {
            // Mode complet : retourner un ExcelData
            ExcelData excelData = new ExcelData();
            excelData.setFileName("");
            excelData.setHeaders(headers);
            excelData.setRows(rows);
            excelData.setTotalRows(tabdata.totalRows);
            excelData.setTotalColumns(headers.size());
            excelData.setFormulaCells(formulaCells);
            return excelData;
        }
    }
    
    /**
     * Désérialise et adapte les cellules formules pour la pagination (row indices relatifs à la page)
     */
    private List<FormulaCellPosition> getFormulaCellsFromTabdata(ShareAccessTabdata tabdata, Integer page, Integer limit) throws IOException {
        if (tabdata.formulaCells == null || tabdata.formulaCells.isEmpty()) {
            return new ArrayList<>();
        }
        var typeRef = objectMapper.getTypeFactory().constructCollectionType(List.class, FormulaCellPosition.class);
        List<FormulaCellPosition> all = objectMapper.readValue(tabdata.formulaCells, typeRef);
        if (page == null || limit == null || page <= 0 || limit <= 0) {
            return all;
        }
        int pageOffset = (page - 1) * limit;
        int pageEnd = pageOffset + limit;
        List<FormulaCellPosition> result = new ArrayList<>();
        for (FormulaCellPosition fc : all) {
            if (fc.row >= pageOffset && fc.row < pageEnd) {
                result.add(new FormulaCellPosition(fc.row - pageOffset, fc.col));
            }
        }
        return result;
    }
    
    private List<Map<String, Object>> toCellPositionMaps(List<FormulaCellPosition> cells) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (FormulaCellPosition c : cells) {
            Map<String, Object> m = new HashMap<>();
            m.put("row", c.row);
            m.put("col", c.col);
            result.add(m);
        }
        return result;
    }
    
    /**
     * Récupère les lignes depuis la base de données avec pagination
     * @param tabdataId ID du ShareAccessTabdata
     * @param page Numéro de page (commence à 1), null pour toutes les données
     * @param limit Nombre de lignes par page, null pour toutes les données
     * @return Liste des lignes désérialisées
     */
    private List<Map<String, Object>> getRowsFromDatabase(UUID tabdataId, Integer page, Integer limit) throws IOException {
        List<ShareAccessTabdataRow> rowEntities;
        
        if (page != null && limit != null && page > 0 && limit > 0) {
            // Pagination : récupérer seulement les lignes de la page demandée
            // Panache utilise un index de page basé sur 0, donc page - 1
            rowEntities = ShareAccessTabdataRow.find(
                "tabdataId = ?1 ORDER BY rowIndex ASC", tabdataId)
                .page(page - 1, limit)
                .list();
        } else {
            // Pas de pagination : récupérer toutes les lignes
            rowEntities = ShareAccessTabdataRow.find(
                "tabdataId = ?1 ORDER BY rowIndex ASC", tabdataId)
                .list();
        }
        
        // Désérialiser chaque ligne (avec déchiffrement si nécessaire)
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ShareAccessTabdataRow rowEntity : rowEntities) {
            byte[] rowDataBytes;
            
            // Déchiffrer si nécessaire
            if (Boolean.TRUE.equals(rowEntity.isEncrypted) && rowEntity.encryptionKeyId != null) {
                rowDataBytes = fileEncryptionService.decryptData(rowEntity.rowData, rowEntity.encryptionKeyId);
            } else {
                // Rétrocompatibilité : données non chiffrées
                rowDataBytes = rowEntity.rowData;
            }
            
            String rowDataJson = new String(rowDataBytes, StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> row = objectMapper.readValue(rowDataJson, Map.class);
            rows.add(row);
        }
        
        return rows;
    }
    
    /**
     * Recherche des lignes par texte dans les tabdata
     * @param shareId ID du partage
     * @param recipientEmail Email du destinataire
     * @param searchText Texte à rechercher
     * @param page Numéro de page (commence à 1)
     * @param limit Nombre de lignes par page
     * @return Objet avec rows (lignes correspondantes) et total (nombre total de correspondances)
     */
    public Object searchTabdataRows(String shareId, String recipientEmail, String searchText, 
                                    Integer page, Integer limit) throws IOException {
        Log.debugf("%s - Recherche dans tabdata pour shareId=%s, recipientEmail=%s, searchText=%s, page=%s, limit=%s", 
                  LOG_PREFIX, shareId, recipientEmail, searchText, page, limit);
        
        // 1. Récupérer le tabdata
        UUID shareUuid = UUID.fromString(shareId);
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "shareId = ?1 and recipientEmail = ?2", shareUuid, recipientEmail).firstResult();
        
        if (tabdata == null) {
            throw new IllegalArgumentException("Tabdata non trouvé pour ce destinataire");
        }
        
        // 2. Rechercher les lignes contenant le texte (recherche insensible à la casse)
        String searchLower = searchText.toLowerCase();
        List<ShareAccessTabdataRow> matchingRows;
        
        if (page != null && limit != null && page > 0 && limit > 0) {
            // Utiliser LIKE pour la recherche (PostgreSQL)
            matchingRows = ShareAccessTabdataRow.find(
                "tabdataId = ?1 AND LOWER(searchableText) LIKE ?2 ORDER BY rowIndex ASC", 
                tabdata.id, "%" + searchLower + "%")
                .page(page - 1, limit)
                .list();
        } else {
            matchingRows = ShareAccessTabdataRow.find(
                "tabdataId = ?1 AND LOWER(searchableText) LIKE ?2 ORDER BY rowIndex ASC", 
                tabdata.id, "%" + searchLower + "%")
                .list();
        }
        
        // Compter le total de correspondances
        long totalMatches = ShareAccessTabdataRow.count(
            "tabdataId = ?1 AND LOWER(searchableText) LIKE ?2", 
            tabdata.id, "%" + searchLower + "%");
        
        // 3. Désérialiser les lignes (avec déchiffrement si nécessaire)
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ShareAccessTabdataRow rowEntity : matchingRows) {
            byte[] rowDataBytes;
            
            // Déchiffrer si nécessaire
            if (Boolean.TRUE.equals(rowEntity.isEncrypted) && rowEntity.encryptionKeyId != null) {
                rowDataBytes = fileEncryptionService.decryptData(rowEntity.rowData, rowEntity.encryptionKeyId);
            } else {
                // Rétrocompatibilité : données non chiffrées
                rowDataBytes = rowEntity.rowData;
            }
            
            String rowDataJson = new String(rowDataBytes, StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> row = objectMapper.readValue(rowDataJson, Map.class);
            rows.add(row);
        }
        
        // 4. Récupérer les headers
        List<String> headers = new ArrayList<>();
        if (tabdata.headers != null && !tabdata.headers.isEmpty()) {
            headers = objectMapper.readValue(tabdata.headers, 
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        }
        
        // 5. Construire la réponse
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("rows", rows);
        response.put("total", (int) totalMatches);
        response.put("headers", headers);
        
        Log.infof("%s - Recherche terminée: %d correspondances trouvées", LOG_PREFIX, totalMatches);
        
        return response;
    }
    
    /**
     * Applique la pagination aux données désérialisées
     * @deprecated Cette méthode n'est plus utilisée car la pagination est gérée directement en base
     */
    @Deprecated
    private Object applyPagination(Object data, int page, int limit, int totalRows) {
        if (data instanceof ExcelData) {
            ExcelData excelData = (ExcelData) data;
            List<Map<String, Object>> rows = excelData.getRows();
            if (rows == null) {
                return data;
            }
            
            int startIndex = (page - 1) * limit;
            int endIndex = Math.min(startIndex + limit, rows.size());
            
            if (startIndex >= rows.size()) {
                // Page hors limites
                ExcelData emptyData = new ExcelData();
                emptyData.setFileName(excelData.getFileName());
                emptyData.setHeaders(excelData.getHeaders());
                emptyData.setRows(new ArrayList<>());
                emptyData.setTotalRows(totalRows);
                emptyData.setTotalColumns(excelData.getTotalColumns());
                return emptyData;
            }
            
            List<Map<String, Object>> paginatedRows = rows.subList(startIndex, endIndex);
            ExcelData paginatedData = new ExcelData();
            paginatedData.setFileName(excelData.getFileName());
            paginatedData.setHeaders(excelData.getHeaders());
            paginatedData.setRows(paginatedRows);
            paginatedData.setTotalRows(totalRows);
            paginatedData.setTotalColumns(excelData.getTotalColumns());
            
            // Retourner un objet avec rows et total pour la pagination
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("rows", paginatedRows);
            response.put("total", totalRows);
            return response;
        } else if (data instanceof java.util.Map) {
            java.util.Map<?, ?> map = (java.util.Map<?, ?>) data;
            if (map.containsKey("rows") && map.get("rows") instanceof java.util.List) {
                java.util.List<?> rows = (java.util.List<?>) map.get("rows");
                int startIndex = (page - 1) * limit;
                int endIndex = Math.min(startIndex + limit, rows.size());
                
                if (startIndex >= rows.size()) {
                    java.util.Map<String, Object> emptyResponse = new java.util.HashMap<>();
                    emptyResponse.put("rows", new ArrayList<>());
                    emptyResponse.put("total", totalRows);
                    return emptyResponse;
                }
                
                java.util.List<?> paginatedRows = rows.subList(startIndex, endIndex);
                java.util.Map<String, Object> response = new java.util.HashMap<>();
                response.put("rows", paginatedRows);
                response.put("total", totalRows);
                return response;
            }
        }
        
        return data;
    }
    
    /**
     * Calcule et stocke le tabdata pour un fichier temporaire (avec TTL)
     * @param tempFileId ID du fichier temporaire
     * @param recipientEmail Email du destinataire
     * @param username Nom d'utilisateur propriétaire du fichier
     * @param filteredData Données filtrées à stocker
     * @param fileFingerprint Hash du fichier source
     * @param ttlHours Durée de vie en heures (défaut: 24h)
     */
    @Transactional
    public void computeAndStoreTabdataForTempFile(String tempFileId, String recipientEmail, String username,
                                                  Object filteredData, String fileFingerprint, String selectionsHash, int ttlHours) throws IOException {
        Log.infof("%s - Calcul et stockage tabdata pour fichier temporaire tempFileId=%s, recipientEmail=%s", 
                 LOG_PREFIX, tempFileId, recipientEmail);
        
        // 1. Extraire les headers et les lignes
        List<String> headers = null;
        List<Map<String, Object>> rows = null;
        int totalRows = 0;
        
        List<FormulaCellPosition> formulaCells = null;
        if (filteredData instanceof ExcelData) {
            ExcelData filteredExcelData = (ExcelData) filteredData;
            headers = filteredExcelData.getHeaders();
            rows = filteredExcelData.getRows();
            formulaCells = filteredExcelData.getFormulaCells();
            totalRows = rows != null ? rows.size() : 0;
        } else if (filteredData instanceof java.util.Map) {
            java.util.Map<?, ?> map = (java.util.Map<?, ?>) filteredData;
            if (map.containsKey("headers") && map.get("headers") instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<String> headersList = (java.util.List<String>) map.get("headers");
                headers = headersList;
            }
            if (map.containsKey("rows") && map.get("rows") instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> rowsList = (java.util.List<Map<String, Object>>) map.get("rows");
                rows = rowsList;
                totalRows = rows != null ? rows.size() : 0;
            }
        }
        
        if (headers == null) {
            headers = new ArrayList<>();
        }
        if (rows == null) {
            rows = new ArrayList<>();
        }
        
        // 2. Créer ou mettre à jour l'entité ShareAccessTabdata
        // Supprimer complètement l'ancien tabdata (lignes + entité) pour garantir une mise à jour propre
        ShareAccessTabdata existingTabdata = ShareAccessTabdata.find(
            "tempFileId = ?1 and recipientEmail = ?2", tempFileId, recipientEmail).firstResult();
        
        if (existingTabdata != null) {
            // Supprimer d'abord les lignes, puis l'entité principale
            ShareAccessTabdataRow.delete("tabdataId = ?1", existingTabdata.id);
            ShareAccessTabdata.delete("id = ?1", existingTabdata.id);
            Log.infof("%s - Ancien tabdata temporaire supprimé pour %s avant recalcul", LOG_PREFIX, recipientEmail);
        }
        
        // Créer une nouvelle entité (toujours, même si elle existait avant)
        ShareAccessTabdata tabdata = new ShareAccessTabdata();
        tabdata.tempFileId = tempFileId;
        tabdata.recipientEmail = recipientEmail;
        
        // 3. Stocker les headers et les cellules formules
        tabdata.headers = objectMapper.writeValueAsString(headers);
        tabdata.fileFingerprint = fileFingerprint;
        tabdata.formulaCells = (formulaCells != null && !formulaCells.isEmpty()) 
            ? objectMapper.writeValueAsString(formulaCells) : null;
        tabdata.selectionsHash = selectionsHash; // Stocker le hash des sélections pour détecter les changements
        tabdata.schemaVersion = "1.0";
        tabdata.totalRows = totalRows;
        tabdata.expiresAt = LocalDateTime.now().plusHours(ttlHours); // TTL par défaut 24h
        tabdata.updateTimestamp();
        
        // 4. Stocker en base pour obtenir l'ID
        tabdata.persist();
        
        // 5. Stocker chaque ligne dans share_access_tabdata_row (avec chiffrement applicative pour données temporaires)
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            String rowDataJson = objectMapper.writeValueAsString(row);
            String searchableText = generateSearchableText(row);
            
            // Chiffrer les données temporaires avec la clé applicative
            byte[] rowDataBytes = rowDataJson.getBytes(StandardCharsets.UTF_8);
            byte[] encryptedRowData = fileEncryptionService.encryptDataWithApplicationKey(rowDataBytes);
            
            // Pour les données temporaires, on utilise "APPLICATION" comme encryptionKeyId
            ShareAccessTabdataRow rowEntity = new ShareAccessTabdataRow(
                tabdata.id, i, encryptedRowData, searchableText, "APPLICATION"
            );
            rowEntity.persist();
        }
        
        Log.infof("%s - Tabdata temporaire stocké avec succès (headers: %d, totalRows: %d, expire dans %d heures)", 
                 LOG_PREFIX, headers.size(), totalRows, ttlHours);
    }
    
    /**
     * Recalcule le tabdata pour tous les destinataires d'un partage
     */
    @Transactional
    public void rebuildTabdataForAllRecipients(String shareId, String ownerUsername) throws IOException {
        UUID shareUuid = UUID.fromString(shareId);
        Share share = Share.findById(shareUuid);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        rebuildTabdataForAllRecipients(share, ownerUsername);
    }
    
    /**
     * Recalcule le tabdata pour tous les destinataires d'un partage (version avec share en paramètre)
     * Utilise le share fourni au lieu de le recharger depuis la base pour éviter les problèmes de synchronisation
     */
    @Transactional
    public void rebuildTabdataForAllRecipients(Share share, String ownerUsername) throws IOException {
        Log.infof("%s - Recalcul tabdata pour tous les destinataires de shareId=%s", 
                 LOG_PREFIX, share.id);
        
        // 1. Vérifier que l'utilisateur est propriétaire
        if (!share.ownerUsername.equals(ownerUsername)) {
            throw new SecurityException("Accès non autorisé - propriétaire requis");
        }
        
        // 2. S'assurer que la relation share est initialisée pour tous les recipients
        // Cela évite l'erreur "not-null property references a null or transient value"
        if (share.recipients != null) {
            for (Recipient recipient : share.recipients) {
                recipient.share = share;
            }
        }
        
        // 3. Pour chaque destinataire, recalculer et stocker en utilisant le share fourni
        for (Recipient recipient : share.recipients) {
            try {
                computeAndStoreTabdata(share, recipient.email);
                Log.infof("%s - Tabdata recalculé pour %s", LOG_PREFIX, recipient.email);
            } catch (Exception e) {
                Log.errorf("%s - Erreur lors du recalcul pour %s: %s", 
                          LOG_PREFIX, recipient.email, e.getMessage());
                // Continuer avec les autres destinataires
            }
        }
    }
    
    /**
     * Vérifie la cohérence du tabdata avec le fichier
     */
    public boolean isTabdataConsistent(String shareId, String recipientEmail) {
        try {
            UUID shareUuid = UUID.fromString(shareId);
            ShareAccessTabdata tabdata = ShareAccessTabdata.find(
                "shareId = ?1 and recipientEmail = ?2", shareUuid, recipientEmail).firstResult();
            
            if (tabdata == null) {
                return false;
            }
            
            Share share = Share.findById(shareUuid);
            if (share == null) {
                return false;
            }
            
            String currentFileFingerprint = calculateFileFingerprint(fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId));
            return tabdata.isConsistentWithFile(currentFileFingerprint);
        } catch (Exception e) {
            Log.errorf("%s - Erreur lors de la vérification de cohérence: %s", LOG_PREFIX, e.getMessage());
            return false;
        }
    }
    
    /**
     * Supprime le tabdata pour un destinataire
     */
    public void deleteTabdataForRecipient(String shareId, String recipientEmail) {
        UUID shareUuid = UUID.fromString(shareId);
        ShareAccessTabdata.delete("shareId = ?1 and recipientEmail = ?2", shareUuid, recipientEmail);
        Log.infof("%s - Tabdata supprimé pour shareId=%s, recipientEmail=%s", 
                 LOG_PREFIX, shareId, recipientEmail);
    }
    
    /**
     * Supprime tout le tabdata pour un partage
     */
    public void deleteTabdataForShare(String shareId) {
        UUID shareUuid = UUID.fromString(shareId);
        ShareAccessTabdata.delete("shareId = ?1", shareUuid);
        Log.infof("%s - Tout le tabdata supprimé pour shareId=%s", LOG_PREFIX, shareId);
    }
    
    /**
     * Récupère le hash des sélections pour un fichier temporaire
     */
    public String getSelectionsHashForTempFile(String tempFileId, String recipientEmail) {
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "tempFileId = ?1 and recipientEmail = ?2", tempFileId, recipientEmail).firstResult();
        return tabdata != null ? tabdata.selectionsHash : null;
    }
    
    /**
     * Récupère le hash des sélections pour un partage existant
     */
    public String getSelectionsHashForShare(String shareId, String recipientEmail) {
        UUID shareUuid = UUID.fromString(shareId);
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "shareId = ?1 and recipientEmail = ?2", shareUuid, recipientEmail).firstResult();
        return tabdata != null ? tabdata.selectionsHash : null;
    }
    
    /**
     * Calcule un hash des sélections et editableCells d'un recipient
     */
    private String calculateSelectionsHash(Recipient recipient) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            
            // Inclure selectedSheetIndex
            digest.update(String.valueOf(recipient.selectedSheetIndex).getBytes());
            
            // Inclure les sélections
            if (recipient.selections != null) {
                String selectionsJson = objectMapper.writeValueAsString(recipient.selections);
                digest.update(selectionsJson.getBytes());
            }
            
            // Inclure les editableCells
            if (recipient.editableCells != null) {
                String editableCellsJson = objectMapper.writeValueAsString(recipient.editableCells);
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
     * Supprime le tabdata pour un fichier temporaire
     */
    @Transactional
    public void deleteTabdataForTempFile(String tempFileId, String recipientEmail) {
        ShareAccessTabdata tabdata = ShareAccessTabdata.find(
            "tempFileId = ?1 and recipientEmail = ?2", tempFileId, recipientEmail).firstResult();
        if (tabdata != null) {
            // Supprimer d'abord les lignes
            ShareAccessTabdataRow.delete("tabdataId = ?1", tabdata.id);
            // Puis l'entité principale
            tabdata.delete();
            Log.infof("%s - Tabdata temporaire supprimé pour tempFileId=%s, recipientEmail=%s", 
                     LOG_PREFIX, tempFileId, recipientEmail);
        }
    }
    
    // Méthodes utilitaires privées
    
    private String calculateFileFingerprint(InputStream fileStream) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = fileStream.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            
            byte[] hash = digest.digest();
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IOException("Algorithme SHA-256 non disponible", e);
        }
    }
    
    private String compressData(String data) throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             GZIPOutputStream gzos = new GZIPOutputStream(baos)) {
            
            gzos.write(data.getBytes(StandardCharsets.UTF_8));
            gzos.finish();
            
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        }
    }
    
    private String decompressData(String compressedData) throws IOException {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(Base64.getDecoder().decode(compressedData));
             GZIPInputStream gzis = new GZIPInputStream(bais);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = gzis.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            
            return baos.toString(StandardCharsets.UTF_8);
        }
    }
    
    private Object filterDataBySelections(Object excelData, Recipient recipient, Share share) {
        if (!(excelData instanceof ExcelData)) {
            return excelData;
        }
        
        ExcelData excelDataObj = (ExcelData) excelData;
        
        // 🔧 HARMONISATION : Utiliser exactement la même logique que TabdataSimulationService
        
        // Si pas de sélections globalement, retourner un tableau vide
        if (recipient.selections == null || recipient.selections.isEmpty()) {
            Log.infof("%s - Aucune sélection globale, retour d'un tableau vide", LOG_PREFIX);
            return createEmptyExcelData();
        }
        
        String sheetKey = String.valueOf(recipient.selectedSheetIndex);
        Object selectionsObj = recipient.selections.get(sheetKey);
        
        if (selectionsObj == null) {
            Log.infof("%s - Aucune sélection pour la feuille %s, retour d'un tableau vide", LOG_PREFIX, sheetKey);
            return createEmptyExcelData();
        }
        
        // Convertir les LinkedHashMap (désérialisés depuis JSONB) en CellSelection
        List<Recipient.CellSelection> selections = convertToCellSelectionList(selectionsObj);
        
        if (selections == null || selections.isEmpty()) {
            Log.infof("%s - Aucune sélection pour la feuille %s, retour d'un tableau vide", LOG_PREFIX, sheetKey);
            return createEmptyExcelData();
        }
        
        Log.infof("%s - %d cellules sélectionnées pour la feuille %s", LOG_PREFIX, selections.size(), sheetKey);
        
        // Convertir les CellSelection en CellPosition
        List<ExcelDataConverter.CellPosition> selectedCells = new ArrayList<>();
        for (Recipient.CellSelection cell : selections) {
            selectedCells.add(new ExcelDataConverter.CellPosition(cell.row, cell.col));
            Log.infof("%s - Cellule sélectionnée: row=%d, col=%d", LOG_PREFIX, cell.row, cell.col);
        }
        
        Log.infof("%s - Données Excel avant filtrage: %d lignes", LOG_PREFIX, excelDataObj.getRows().size());
        
        // 🔧 FILTRAGE SIMPLIFIÉ : Filtrer les cellules individuelles selon les sélections
        List<Map<String, Object>> filteredTableData = filterCellsBySelection(excelDataObj.getRows(), selectedCells);
        
        Log.infof("%s - Données après filtrage: %d lignes", LOG_PREFIX, filteredTableData.size());
        
        // 🔧 HARMONISATION : Normaliser le tableData selon les sélections uniquement
        filteredTableData = normalizeTableDataBySelections(filteredTableData, selectedCells);
        
        // 🔧 FILTRER ET NORMALISER LES CELLULES FORMULES
        List<FormulaCellPosition> filteredFormulaCells = filterAndNormalizeFormulaCells(
            excelDataObj.getFormulaCells(), selectedCells);
        
        // 🔧 EN-TÊTES PERSONNALISÉS : Remplacer les en-têtes par les columnLabels personnalisés selon les sélections
        List<String> customHeaders = applyCustomHeadersBySelections(excelDataObj.getHeaders(), recipient.columnLabels, recipient.selectedSheetIndex, selectedCells);
        
        ExcelData filteredExcelData = new ExcelData();
        filteredExcelData.setFileName(""); // 🔒 SÉCURITÉ: Pas de fileName dans les données stockées
        filteredExcelData.setHeaders(customHeaders);
        filteredExcelData.setRows(filteredTableData);
        filteredExcelData.setTotalRows(filteredTableData.size());
        filteredExcelData.setTotalColumns(customHeaders != null ? customHeaders.size() : 0);
        filteredExcelData.setFormulaCells(filteredFormulaCells);
        
        Log.infof("%s - Données filtrées: %d lignes, %d colonnes, %d cellules formules",
                 LOG_PREFIX, filteredExcelData.getTotalRows(), filteredExcelData.getTotalColumns(), filteredFormulaCells.size());
        
        return filteredExcelData;
    }
    
    /**
     * Normalise le tableData selon les sélections uniquement
     */
    private List<Map<String, Object>> normalizeTableDataBySelections(List<Map<String, Object>> tableData, List<ExcelDataConverter.CellPosition> selectedCells) {
        if (tableData == null || selectedCells == null || selectedCells.isEmpty()) {
            return tableData;
        }
        
        // Trouver les colonnes uniques sélectionnées et les trier
        java.util.Set<Integer> selectedColumnsSet = new java.util.HashSet<>();
        for (ExcelDataConverter.CellPosition cell : selectedCells) {
            selectedColumnsSet.add(cell.col);
        }
        
        // 🔧 CORRECTION : Convertir en liste et trier pour garantir l'ordre (comme dans TabdataSimulationService)
        List<Integer> selectedColumns = new ArrayList<>(selectedColumnsSet);
        selectedColumns.sort(Integer::compareTo);
        
        Log.infof("%s - Colonnes sélectionnées (triées): %s", LOG_PREFIX, selectedColumns);
        
        List<Map<String, Object>> normalizedData = new ArrayList<>();
        
        for (Map<String, Object> row : tableData) {
            Map<String, Object> normalizedRow = new HashMap<>();
            
            // Ne garder que les colonnes sélectionnées (dans l'ordre trié)
            int newColumnIndex = 0;
            for (int originalColIndex : selectedColumns) {
                String originalColumnKey = "column-" + originalColIndex;
                String newColumnKey = "column-" + newColumnIndex;
                Object value = row.getOrDefault(originalColumnKey, "");
                normalizedRow.put(newColumnKey, value);
                newColumnIndex++;
            }
            
            normalizedData.add(normalizedRow);
        }
        
        Log.infof("%s - Données normalisées: %d colonnes sélectionnées, ordre: %s", 
                 LOG_PREFIX, selectedColumns.size(), selectedColumns);
        return normalizedData;
    }
    
    /**
     * Filtre et normalise les cellules formules selon les sélections (même logique que pour les données)
     */
    private List<FormulaCellPosition> filterAndNormalizeFormulaCells(List<FormulaCellPosition> formulaCells, 
                                                                     List<ExcelDataConverter.CellPosition> selectedCells) {
        if (formulaCells == null || formulaCells.isEmpty() || selectedCells == null || selectedCells.isEmpty()) {
            return new ArrayList<>();
        }
        java.util.Set<String> selectedCellKeys = new java.util.HashSet<>();
        for (ExcelDataConverter.CellPosition cell : selectedCells) {
            selectedCellKeys.add(cell.row + "," + cell.col);
        }
        java.util.Set<Integer> selectedColumnsSet = new java.util.HashSet<>();
        for (ExcelDataConverter.CellPosition cell : selectedCells) {
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
     * Crée un ExcelData vide (pour la cohérence avec TabdataSimulationService)
     */
    private ExcelData createEmptyExcelData() {
        ExcelData emptyData = new ExcelData();
        emptyData.setFileName(""); // Pas de fileName pour la sécurité
        emptyData.setHeaders(new ArrayList<>());
        emptyData.setRows(new ArrayList<>());
        emptyData.setTotalRows(0);
        emptyData.setTotalColumns(0);
        return emptyData;
    }
    
    /**
     * Filtre les cellules individuelles selon les sélections (même logique que TabdataSimulationService)
     */
    private List<Map<String, Object>> filterCellsBySelection(List<Map<String, Object>> rows, List<ExcelDataConverter.CellPosition> selectedCells) {
        if (rows == null || selectedCells == null || selectedCells.isEmpty()) {
            return rows;
        }
        
        java.util.Set<String> selectedCellKeys = new java.util.HashSet<>();
        for (ExcelDataConverter.CellPosition cell : selectedCells) {
            selectedCellKeys.add(cell.row + "," + cell.col);
        }
        
        Log.infof("%s - Cellules sélectionnées: %s", LOG_PREFIX, selectedCellKeys);
        
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            Map<String, Object> originalRow = rows.get(rowIndex);
            Map<String, Object> filteredRow = new HashMap<>();
            boolean hasSelectedCells = false;
            
            // Pour toutes les lignes (y compris la ligne 0), ne conserver que les cellules sélectionnées
            for (Map.Entry<String, Object> entry : originalRow.entrySet()) {
                String columnKey = entry.getKey();
                if (columnKey.startsWith("column-")) {
                    int colIndex = Integer.parseInt(columnKey.substring(7)); // "column-0" -> 0
                    String cellKey = rowIndex + "," + colIndex;
                    
                    if (selectedCellKeys.contains(cellKey)) {
                        filteredRow.put(columnKey, entry.getValue());
                        hasSelectedCells = true;
                        Log.infof("%s - Ligne %d, colonne %d: cellule conservée", LOG_PREFIX, rowIndex, colIndex);
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
     * Applique les en-têtes personnalisés selon les sélections uniquement
     * RÈGLE ABSOLUE : simulate-tabdata et tableData enregistré en base doivent utiliser les mêmes méthodes
     * RÈGLE ABSOLUE : Ce que l'utilisateur voit à l'étape 4 de share-new doit être obligatoirement les mêmes données enregistrées en base
     */
    private List<String> applyCustomHeadersBySelections(List<String> defaultHeaders, Map<String, Map<String, String>> columnLabels, int selectedSheetIndex, List<ExcelDataConverter.CellPosition> selectedCells) {
        if (defaultHeaders == null || selectedCells == null || selectedCells.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Trouver les colonnes uniques sélectionnées et les trier
        java.util.Set<Integer> selectedColumnsSet = new java.util.HashSet<>();
        for (ExcelDataConverter.CellPosition cell : selectedCells) {
            selectedColumnsSet.add(cell.col);
        }
        
        // 🔧 CORRECTION : Convertir en liste et trier pour garantir l'ordre (comme dans normalizeTableDataBySelections)
        List<Integer> selectedColumns = new ArrayList<>(selectedColumnsSet);
        selectedColumns.sort(Integer::compareTo);
        
        String sheetKey = String.valueOf(selectedSheetIndex);
        Map<String, String> sheetColumnLabels = columnLabels != null ? columnLabels.get(sheetKey) : null;
        
        // 🔍 DEBUG : Log des données d'entrée
        Log.infof("%s - DEBUG: defaultHeaders: %s", LOG_PREFIX, defaultHeaders);
        Log.infof("%s - DEBUG: columnLabels: %s", LOG_PREFIX, columnLabels);
        Log.infof("%s - DEBUG: selectedSheetIndex: %d", LOG_PREFIX, selectedSheetIndex);
        Log.infof("%s - DEBUG: sheetKey: %s", LOG_PREFIX, sheetKey);
        Log.infof("%s - DEBUG: sheetColumnLabels: %s", LOG_PREFIX, sheetColumnLabels);
        Log.infof("%s - DEBUG: Colonnes sélectionnées (triées): %s", LOG_PREFIX, selectedColumns);
        
        List<String> customHeaders = new ArrayList<>();
        
        // Ne générer des en-têtes que pour les colonnes sélectionnées (dans l'ordre trié)
        int newColumnIndex = 0;
        for (int originalColIndex : selectedColumns) {
            String originalColumnKey = "column-" + originalColIndex;
            String customLabel = null;
            
            // Chercher le label personnalisé pour cette colonne
            if (sheetColumnLabels != null) {
                customLabel = sheetColumnLabels.get(originalColumnKey);
            }
            
            // 🔧 CORRECTION : Utiliser le label personnalisé s'il existe, sinon chaîne vide (pas de fallback)
            // Le frontend doit afficher un en-tête vide si le label est manquant ou vide
            String finalHeader = (customLabel != null && !customLabel.trim().isEmpty()) ? customLabel : "";
            customHeaders.add(finalHeader);
            
            Log.infof("%s - En-tête colonne %d (original %d): '%s' -> '%s' (label: %s)", 
                     LOG_PREFIX, newColumnIndex, originalColIndex, originalColumnKey, finalHeader,
                     customLabel != null ? customLabel : "null/vide");
            newColumnIndex++;
        }
        
        Log.infof("%s - En-têtes personnalisés appliqués selon sélections (ordre: %s): %s", 
                 LOG_PREFIX, selectedColumns, customHeaders);
        return customHeaders;
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
                    Log.warnf("%s - Type inattendu dans la liste de sélections: %s", LOG_PREFIX, item.getClass().getName());
                }
            }
            
            return result;
        }
        
        Log.warnf("%s - Type inattendu pour les sélections: %s", LOG_PREFIX, obj.getClass().getName());
        return null;
    }
    
    /**
     * Génère un texte recherchable à partir d'une ligne de données
     * Concatène toutes les valeurs de la ligne en une chaîne pour permettre la recherche texte
     */
    private String generateSearchableText(Map<String, Object> row) {
        // 🔒 SÉCURITÉ : Ne plus générer searchable_text pour éviter les données en clair
        // Les nouvelles données ne seront plus en clair
        return null;
    }
}
