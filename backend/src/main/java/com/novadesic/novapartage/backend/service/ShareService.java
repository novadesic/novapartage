package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.dto.ShareRequest;
import com.novadesic.novapartage.backend.model.dto.ShareResponse;
import com.novadesic.novapartage.backend.model.dto.AccessTokenResponse;
import com.novadesic.novapartage.backend.model.dto.FormAccessData;
import com.novadesic.novapartage.backend.model.dto.SecureFormAccessData;
import com.novadesic.novapartage.backend.model.Recipient;
import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.service.FormSubmissionService;
import com.novadesic.novapartage.backend.service.StatusControlService;
import com.novadesic.novapartage.backend.service.EmailService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import io.quarkus.hibernate.orm.panache.Panache;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.UUID;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Comparator;
import java.util.Set;

@ApplicationScoped
public class ShareService {
    
    private static final Logger LOG = Logger.getLogger(ShareService.class);
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ExcelService excelService;
    
    @Inject
    FormSubmissionService formSubmissionService;
    
    @Inject
    StatusControlService statusControlService;
    
    @Inject
    EmailService emailService;
    
    @Inject
    ShareTabdataService shareTabdataService;
    
    /**
     * Crée un nouveau partage à partir d'une requête (statut NEW par défaut)
     */
    @Transactional
    public ShareResponse createShare(ShareRequest request, String ownerUsername, String ownerEmail) throws IOException {
        LOG.infof("🚀🚀🚀 SHARE SERVICE - createShare appelé 🚀🚀🚀");
        LOG.infof("📊 Paramètres: user=%s, email=%s", ownerUsername, ownerEmail);
        
        // Valider la requête
        if (!request.isValid()) {
            LOG.warnf("❌ Validation échouée: %s", request.getValidationError());
            throw new IllegalArgumentException(request.getValidationError());
        }
        
        LOG.infof("✅ Validation réussie pour %s avec fichier %s", ownerUsername, request.fileName);
        
        // Déplacer le fichier temporaire vers le stockage permanent
        FileStorageService.FileInfo fileInfo = fileStorageService.moveTemporaryFile(
            request.fileId, 
            request.fileName, 
            ownerUsername
        );
        
        // Créer l'entité Share
        Share share = new Share();
        
        // Informations du fichier
        share.fileName = fileInfo.fileName;
        share.originalFileName = fileInfo.originalFileName;
        share.filePath = fileInfo.relativePath;
        share.fileExtension = fileInfo.extension;
        share.fileSize = fileInfo.size;
        
        // Chiffrement : tous les nouveaux fichiers sont chiffrés
        share.isEncrypted = true;
        share.encryptionKeyId = ownerEmail;
        
        // Propriétaire
        share.ownerUsername = ownerUsername;
        share.ownerEmail = ownerEmail;
        
        // Configuration des données
        share.selectedSheet = request.selectedSheet;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.headerRow = request.headerRow;
        share.dataStartRow = request.dataStartRow;
        share.columnRange = request.columnRange;
        share.includeFormulas = request.includeFormulas;
        share.preserveFormatting = request.preserveFormatting;
        share.detectedFields = request.detectedFields;
        
        // Destinataires
        share.recipients = request.recipients;
        
        // Définir la référence bidirectionnelle pour chaque destinataire
        if (share.recipients != null) {
            for (Recipient recipient : share.recipients) {
                recipient.share = share;
            }
        }
        
        // Log des cellules éditables et sélections pour debug
        if (request.recipients != null) {
            LOG.infof("💾 Création - Sauvegarde des cellules éditables et sélections pour %d destinataires", request.recipients.size());
            for (int i = 0; i < request.recipients.size(); i++) {
                Recipient recipient = request.recipients.get(i);
                LOG.infof("💾 Création - Destinataire %d (%s):", i, recipient.email);
                LOG.infof("💾 Création -   selectedSheetIndex = %d", recipient.selectedSheetIndex);
                
                // Log des sélections
                if (recipient.selections != null) {
                    LOG.infof("💾 Création -   selections.keys: %s", recipient.selections.keySet());
                    for (Map.Entry<String, List<Recipient.CellSelection>> entry : recipient.selections.entrySet()) {
                        String sheetKey = entry.getKey();
                        List<Recipient.CellSelection> cells = entry.getValue();
                        LOG.infof("💾 Création -   Sheet %s: %d sélections", sheetKey, cells.size());
                        for (Recipient.CellSelection cell : cells) {
                            LOG.infof("💾 Création -     - [%d,%d]", cell.row, cell.col);
                        }
                    }
                } else {
                    LOG.warnf("⚠️ Création - Destinataire %d: selections est null", i);
                }
                
                // Log des cellules éditables
                if (recipient.editableCells != null) {
                    LOG.infof("💾 Création -   editableCells.keys: %s", recipient.editableCells.keySet());
                    for (Map.Entry<String, List<Recipient.CellSelection>> entry : recipient.editableCells.entrySet()) {
                        String sheetKey = entry.getKey();
                        List<Recipient.CellSelection> cells = entry.getValue();
                        LOG.infof("💾 Création -   Sheet %s: %d cellules éditables", sheetKey, cells.size());
                        for (Recipient.CellSelection cell : cells) {
                            String expectedColumnKey = "column-" + cell.col;
                            LOG.infof("💾 Création -     - [%d,%d] (clé: %s)", cell.row, cell.col, expectedColumnKey);
                        }
                    }
                } else {
                    LOG.warnf("⚠️ Création - Destinataire %d: editableCells est null", i);
                }
            }
        }
        
        // Permissions
        share.selectedPermission = request.selectedPermission;
        share.allowComments = request.allowComments;
        share.allowDownload = request.allowDownload;
        
        // Données Excel
        share.headers = request.headers;
        share.totalRows = request.totalRows;
        share.totalColumns = request.totalColumns;
        
        // Calculer le fileFingerprint pour la sécurité (avec déchiffrement si nécessaire)
        try (InputStream fileStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId)) {
            share.fileFingerprint = calculateFileFingerprint(fileStream);
            share.tabdataSchemaVersion = "1.0";
            LOG.infof("🔒 FileFingerprint calculé: %s", share.fileFingerprint);
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors du calcul du fileFingerprint: %s", e.getMessage());
            throw new IOException("Impossible de calculer l'empreinte du fichier", e);
        }
        
        // Sauvegarder en base
        share.persist();
        
        LOG.infof("Partage créé avec succès, ID: %s", share.id);
        
        // Calculer et stocker le tabdata pour tous les destinataires
        try {
            for (Recipient recipient : share.recipients) {
                shareTabdataService.computeAndStoreTabdata(share.id.toString(), recipient.email);
                LOG.infof("📊 Tabdata calculé pour %s", recipient.email);
            }
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors du calcul du tabdata: %s", e.getMessage());
            // Ne pas faire échouer la création du partage
        }
        
        return new ShareResponse(share);
    }
    
    /**
     * Sauvegarde un partage en cours de création (statut NEW)
     * Permet de sauvegarder les données à n'importe quelle étape
     */
    @Transactional
    public ShareResponse saveShare(ShareRequest request, String ownerUsername, String ownerEmail) throws IOException {
        LOG.infof("💾 Sauvegarde d'un partage en cours de création");
        LOG.infof("📊 Paramètres: user=%s, email=%s", ownerUsername, ownerEmail);
        
        // Valider la requête (validation moins stricte pour la sauvegarde)
        if (request.fileName == null || request.fileName.trim().isEmpty() ||
            request.fileId == null || request.fileId.trim().isEmpty()) {
            throw new IllegalArgumentException("Nom de fichier et ID de fichier requis pour la sauvegarde");
        }
        
        // Déplacer le fichier temporaire vers le stockage permanent
        FileStorageService.FileInfo fileInfo = fileStorageService.moveTemporaryFile(
            request.fileId, 
            request.fileName, 
            ownerUsername
        );
        
        // Créer l'entité Share avec statut NEW
        Share share = new Share();
        
        // Informations du fichier
        share.fileName = fileInfo.fileName;
        share.originalFileName = fileInfo.originalFileName;
        share.filePath = fileInfo.relativePath;
        share.fileExtension = fileInfo.extension;
        share.fileSize = fileInfo.size;
        
        // Chiffrement : tous les nouveaux fichiers sont chiffrés
        share.isEncrypted = true;
        share.encryptionKeyId = ownerEmail;
        
        // Propriétaire
        share.ownerUsername = ownerUsername;
        share.ownerEmail = ownerEmail;
        
        // Configuration des données (peut être partielle)
        share.selectedSheet = request.selectedSheet;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.headerRow = request.headerRow;
        share.dataStartRow = request.dataStartRow;
        share.columnRange = request.columnRange;
        share.includeFormulas = request.includeFormulas;
        share.preserveFormatting = request.preserveFormatting;
        share.detectedFields = request.detectedFields;
        
        // Destinataires (peut être vide)
        share.recipients = request.recipients != null ? request.recipients : new ArrayList<>();
        
        // Définir la référence bidirectionnelle pour chaque destinataire
        if (share.recipients != null) {
            for (Recipient recipient : share.recipients) {
                recipient.share = share;
            }
        }
        
        // Log des cellules éditables et sélections pour debug
        if (request.recipients != null) {
            LOG.infof("💾 Sauvegarde - Sauvegarde des cellules éditables et sélections pour %d destinataires", request.recipients.size());
            for (int i = 0; i < request.recipients.size(); i++) {
                Recipient recipient = request.recipients.get(i);
                LOG.infof("💾 Sauvegarde - Destinataire %d (%s):", i, recipient.email);
                LOG.infof("💾 Sauvegarde -   selectedSheetIndex = %d", recipient.selectedSheetIndex);
                
                // Log des sélections
                if (recipient.selections != null) {
                    LOG.infof("💾 Sauvegarde -   selections.keys: %s", recipient.selections.keySet());
                    for (Map.Entry<String, List<Recipient.CellSelection>> entry : recipient.selections.entrySet()) {
                        String sheetKey = entry.getKey();
                        List<Recipient.CellSelection> cells = entry.getValue();
                        LOG.infof("💾 Sauvegarde -   Sheet %s: %d sélections", sheetKey, cells.size());
                        for (Recipient.CellSelection cell : cells) {
                            LOG.infof("💾 Sauvegarde -     - [%d,%d]", cell.row, cell.col);
                        }
                    }
                } else {
                    LOG.warnf("⚠️ Sauvegarde - Destinataire %d: selections est null", i);
                }
                
                // Log des cellules éditables
                if (recipient.editableCells != null) {
                    LOG.infof("💾 Sauvegarde -   editableCells.keys: %s", recipient.editableCells.keySet());
                    for (Map.Entry<String, List<Recipient.CellSelection>> entry : recipient.editableCells.entrySet()) {
                        String sheetKey = entry.getKey();
                        List<Recipient.CellSelection> cells = entry.getValue();
                        LOG.infof("💾 Sauvegarde -   Sheet %s: %d cellules éditables", sheetKey, cells.size());
                        for (Recipient.CellSelection cell : cells) {
                            String expectedColumnKey = "column-" + cell.col;
                            LOG.infof("💾 Sauvegarde -     - [%d,%d] (clé: %s)", cell.row, cell.col, expectedColumnKey);
                        }
                    }
                } else {
                    LOG.warnf("⚠️ Sauvegarde - Destinataire %d: editableCells est null", i);
                }
            }
        }
        
        // Permissions
        share.selectedPermission = request.selectedPermission;
        share.allowComments = request.allowComments;
        share.allowDownload = request.allowDownload;
        
        // Données Excel
        share.headers = request.headers;
        share.totalRows = request.totalRows;
        share.totalColumns = request.totalColumns;
        
        // Statut NEW (en cours de création)
        share.status = Share.ShareStatus.NEW;
        
        // Sauvegarder en base
        share.persist();
        
        LOG.infof("Partage sauvegardé avec succès, ID: %s (statut: NEW)", share.id);
        
        return new ShareResponse(share);
    }
    
    /**
     * Finalise un partage en le passant de NEW à ACTIVE
     */
    @Transactional
    public ShareResponse finalizeShare(String shareId, String ownerUsername) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findByIdAndOwner(uuid, ownerUsername);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé ou accès non autorisé: " + shareId);
        }
        
        if (share.status != Share.ShareStatus.NEW) {
            throw new IllegalStateException("Seuls les partages en statut NEW peuvent être finalisés");
        }
        
        // Finaliser le partage
        share.finalizeShare();
        share.persist();
        
        // Contrôler le statut du share après la finalisation
        statusControlService.controlShareStatus(share);
        
        // 🔍 DEBUG : Vérifier les sélections avant de recalculer le tabdata
        LOG.infof("🔍 Finalisation - Vérification des sélections pour %d destinataires", share.recipients.size());
        for (int i = 0; i < share.recipients.size(); i++) {
            Recipient recipient = share.recipients.get(i);
            LOG.infof("🔍 Finalisation - Destinataire %d (%s):", i, recipient.email);
            LOG.infof("🔍 Finalisation -   selectedSheetIndex = %d", recipient.selectedSheetIndex);
            LOG.infof("🔍 Finalisation -   selections = %s", recipient.selections);
            LOG.infof("🔍 Finalisation -   editableCells = %s", recipient.editableCells);
        }
        
        // Recalculer le tabdata pour tous les destinataires après finalisation
        try {
            shareTabdataService.rebuildTabdataForAllRecipients(shareId, ownerUsername);
            LOG.infof("📊 Tabdata recalculé pour tous les destinataires après finalisation");
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors du recalcul du tabdata après finalisation: %s", e.getMessage());
            // Ne pas faire échouer la finalisation
        }
        
        // Envoyer les emails d'accès à tous les destinataires après finalisation
        String baseUrl = getBaseUrl();
        for (Recipient recipient : share.recipients) {
            try {
                // Vérifier si un token existe déjà pour ce destinataire (non expiré)
                List<AccessToken> existingTokens = AccessToken.findByShareIdAndRecipient(share.id, recipient.email);
                AccessToken token = existingTokens.stream()
                    .filter(t -> !t.isExpired())
                    .findFirst()
                    .orElse(null);
                
                if (token == null) {
                    // Créer un nouveau token si aucun n'existe
                    String tokenStr = generateUniqueToken();
                    token = new AccessToken(share.id, recipient.email, tokenStr, 7, ownerUsername);
                    token.persist();
                }
                
                String accessUrl = baseUrl + "/access/" + token.token;
                String formName = recipient.pageTitle != null && !recipient.pageTitle.trim().isEmpty() 
                    ? recipient.pageTitle 
                    : "Partage de données";
                
                // Envoyer l'email de notification
                emailService.sendAccessCreatedNotification(
                    recipient.email,
                    accessUrl,
                    formName,
                    share.ownerEmail,
                    (int) java.time.temporal.ChronoUnit.DAYS.between(
                        java.time.LocalDateTime.now(), 
                        token.expiresAt
                    ),
                    token.expiresAt
                );
                LOG.infof("📧 Email de notification envoyé à: %s après finalisation", recipient.email);
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email à: %s après finalisation", recipient.email);
                // Ne pas faire échouer la finalisation si l'email échoue
            }
        }
        
        // Recharger le share depuis la base pour s'assurer que le statut est bien ACTIVE
        share = Share.findById(share.id);
        LOG.infof("Partage finalisé avec succès, ID: %s (statut: %s)", share.id, share.status);
        
        return new ShareResponse(share);
    }
    
    /**
     * Met à jour un partage en cours de création (statut NEW)
     */
    @Transactional
    public ShareResponse updateNewShare(String shareId, ShareRequest request, String ownerUsername) throws IOException {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findByIdAndOwner(uuid, ownerUsername);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé ou accès non autorisé: " + shareId);
        }
        
        // Permettre la mise à jour des partages NEW et ACTIVE pour le propriétaire
        if (share.status != Share.ShareStatus.NEW && share.status != Share.ShareStatus.ACTIVE) {
            throw new IllegalStateException("Seuls les partages en statut NEW ou ACTIVE peuvent être mis à jour");
        }
        
        // GÉRER LA MISE À JOUR DU FICHIER
        if (request.fileId != null && !request.fileId.equals(share.filePath)) {
            LOG.warnf("⚠️ TENTATIVE DE CHANGEMENT DE FICHIER BLOQUÉE pour le partage %s", shareId);
            LOG.warnf("📁 Ancien fichier: %s", share.filePath);
            LOG.warnf("📁 Nouveau fichier temporaire: %s", request.fileId);
            LOG.warnf("📝 Nouveau nom: %s", request.fileName);
            LOG.warnf("🚫 Le changement de fichier n'est pas autorisé pour les partages existants");
            
            // Ne pas modifier le fichier, garder l'ancien
            // Seules les métadonnées et configurations seront mises à jour
        } else if (request.fileId == null) {
            LOG.infof("ℹ️ Aucun fileId fourni - Conservation du fichier existant pour le partage %s", shareId);
            LOG.infof("📁 Fichier conservé: %s", share.filePath);
        }
        
        // Mettre à jour les champs modifiables
        share.selectedSheet = request.selectedSheet;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.headerRow = request.headerRow;
        share.dataStartRow = request.dataStartRow;
        share.columnRange = request.columnRange;
        share.includeFormulas = request.includeFormulas;
        share.preserveFormatting = request.preserveFormatting;
        share.detectedFields = request.detectedFields;
        share.recipients = request.recipients;
        
        // Définir la référence bidirectionnelle pour chaque destinataire
        if (share.recipients != null) {
            for (Recipient recipient : share.recipients) {
                recipient.share = share;
            }
        }
        
        share.selectedPermission = request.selectedPermission;
        share.allowComments = request.allowComments;
        share.allowDownload = request.allowDownload;
        share.headers = request.headers;
        share.totalRows = request.totalRows;
        share.totalColumns = request.totalColumns;
        
        // Log des cellules éditables pour debug
        if (request.recipients != null) {
            LOG.infof("💾 Sauvegarde des cellules éditables pour %d destinataires", request.recipients.size());
            for (int i = 0; i < request.recipients.size(); i++) {
                Recipient recipient = request.recipients.get(i);
                LOG.infof("💾 Destinataire %d (%s):", i, recipient.email);
                if (recipient.editableCells != null) {
                    LOG.infof("💾   editableCells.keys: %s", recipient.editableCells.keySet());
                    for (Map.Entry<String, List<Recipient.CellSelection>> entry : recipient.editableCells.entrySet()) {
                        String sheetKey = entry.getKey();
                        List<Recipient.CellSelection> cells = entry.getValue();
                        LOG.infof("💾   Sheet %s: %d cellules éditables", sheetKey, cells.size());
                        for (Recipient.CellSelection cell : cells) {
                            String expectedColumnKey = "column-" + cell.col;
                            LOG.infof("💾     - [%d,%d] (clé: %s)", cell.row, cell.col, expectedColumnKey);
                        }
                    }
                } else {
                    LOG.warnf("⚠️ Destinataire %d: editableCells est null", i);
                }
            }
        }
        
        share.updateTimestamp();
        share.persist();
        
        // 🔧 CORRECTION : Recalculer le tabdata pour tous les destinataires après mise à jour
        try {
            shareTabdataService.rebuildTabdataForAllRecipients(share.id.toString(), ownerUsername);
            LOG.infof("📊 Tabdata recalculé pour tous les destinataires après sauvegarde");
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors du recalcul du tabdata après sauvegarde: %s", e.getMessage());
            // Ne pas faire échouer la sauvegarde
        }
        
        LOG.infof("💾 Partage mis à jour (fichier conservé): %s", share.id);
        
        return new ShareResponse(share);
    }
    
    /**
     * Récupère un partage par ID
     * @param shareId ID du partage
     * @param username Nom d'utilisateur
     * @param metadataOnly Si true, ne charge pas les données Excel (optimisation)
     */
    public ShareResponse getShare(String shareId, String username, boolean metadataOnly) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findById(uuid);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Vérifier les droits d'accès
        if (!hasAccessToShare(share, username)) {
            throw new SecurityException("Accès non autorisé au partage: " + shareId);
        }
        
        ShareResponse response = new ShareResponse(share);
        
        // OPTIMISATION: Charger les données Excel seulement si metadataOnly est false
        // Si le partage est en statut NEW ou si l'utilisateur est le propriétaire, inclure les données Excel
        if (!metadataOnly && (share.status == Share.ShareStatus.NEW || username.equals(share.ownerUsername))) {
            try {
                LOG.infof("📊 Chargement des données Excel pour le partage %s (statut: %s, propriétaire: %s, metadataOnly: %s)", 
                         share.status, username, shareId, metadataOnly);
                Object excelData = getShareDataForOwner(shareId, username);
                response.excelData = excelData;
                LOG.infof("✅ Données Excel chargées avec succès");
            } catch (Exception e) {
                LOG.warnf("⚠️ Impossible de charger les données Excel pour le partage %s: %s", shareId, e.getMessage());
                // Ne pas échouer complètement, juste ne pas inclure les données Excel
            }
        } else if (metadataOnly) {
            LOG.infof("⚡ OPTIMISATION: Évitement du chargement des données Excel pour le partage %s (metadataOnly=true)", shareId);
        }
        
        return response;
    }
    
    /**
     * Récupère un partage par ID (méthode de compatibilité)
     * @param shareId ID du partage
     * @param username Nom d'utilisateur
     */
    public ShareResponse getShare(String shareId, String username) {
        return getShare(shareId, username, false); // Par défaut, charger les données Excel
    }
    
    /**
     * Récupère les partages créés par l'utilisateur avec statistiques des tokens
     */
    public List<ShareResponse> getUserShares(String username) {
        // Contrôler le statut de tous les shares de l'utilisateur
        statusControlService.controlAllSharesForUser(username);
        
        List<Share> shares = Share.findByOwner(username);
        return shares.stream()
                    .map(share -> {
                        ShareResponse response = ShareResponse.forList(share);
                        
                        // Ajouter les statistiques des tokens d'accès (optimisé)
                        long activeTokens = AccessToken.count("shareId = ?1 and status = ?2 and expiresAt > ?3", 
                            share.id, AccessToken.TokenStatus.ACTIVE, LocalDateTime.now());
                            
                        long expiredTokens = AccessToken.count("shareId = ?1 and (status = ?2 or status = ?3)", 
                            share.id, AccessToken.TokenStatus.EXPIRED, AccessToken.TokenStatus.REVOKED);
                        
                        response.activeTokensCount = (int) activeTokens;
                        response.expiredTokensCount = (int) expiredTokens;
                        
                        return response;
                    })
                    .collect(Collectors.toList());
    }
    
    /**
     * Récupère les partages où l'utilisateur est destinataire
     */
    public List<ShareResponse> getSharedWithUser(String userEmail) {
        // Contrôler le statut de tous les shares où l'utilisateur est destinataire
        statusControlService.controlAllSharesForRecipient(userEmail);
        
        List<Share> shares = Share.findByRecipient(userEmail);
        return shares.stream()
                    .map(ShareResponse::forList)
                    .collect(Collectors.toList());
    }
    
    /**
     * Met à jour un partage
     */
    @Transactional
    public ShareResponse updateShare(String shareId, ShareRequest request, String ownerUsername) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findByIdAndOwner(uuid, ownerUsername);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé ou accès non autorisé: " + shareId);
        }
        
        // Vérifier que le partage est actif pour permettre la redéfinition
        if (share.status != Share.ShareStatus.ACTIVE) {
            LOG.warnf("❌ Tentative de redéfinition d'un partage non actif: %s (statut: %s)", shareId, share.status);
            throw new IllegalArgumentException("La redéfinition du partage n'est pas disponible car le partage est " + share.status);
        }
        
        // Mettre à jour les champs modifiables
        share.selectedSheet = request.selectedSheet;
        share.selectedSheetIndex = request.selectedSheetIndex;
        share.headerRow = request.headerRow;
        share.dataStartRow = request.dataStartRow;
        share.columnRange = request.columnRange;
        share.includeFormulas = request.includeFormulas;
        share.preserveFormatting = request.preserveFormatting;
        share.detectedFields = request.detectedFields;
        
        // Mettre à jour les recipients de manière intelligente (préserver les IDs existants)
        // IMPORTANT: Ne pas remplacer la collection directement pour éviter l'erreur orphanRemoval
        // Modifier la collection en place au lieu de la remplacer
        if (request.recipients != null) {
            // Créer une map des recipients existants par email pour un accès rapide
            Map<String, Recipient> existingRecipientsByEmail = new HashMap<>();
            Set<String> existingEmails = new HashSet<>();
            if (share.recipients != null) {
                for (Recipient existing : share.recipients) {
                    existingRecipientsByEmail.put(existing.email, existing);
                    existingEmails.add(existing.email);
                }
            }
            
            // Identifier les emails de la nouvelle liste
            Set<String> newEmails = request.recipients.stream()
                .map(r -> r.email)
                .collect(Collectors.toSet());
            
            // Supprimer les recipients qui ne sont plus dans la nouvelle liste
            Set<String> removedEmails = new HashSet<>(existingEmails);
            removedEmails.removeAll(newEmails);
            if (share.recipients != null) {
                share.recipients.removeIf(r -> removedEmails.contains(r.email));
            }
            
            // Mettre à jour ou créer les recipients
            for (Recipient requestRecipient : request.recipients) {
                Recipient existingRecipient = existingRecipientsByEmail.get(requestRecipient.email);
                
                if (existingRecipient != null) {
                    // Mettre à jour le recipient existant (préserver l'ID et les métadonnées d'accès)
                    existingRecipient.displayName = requestRecipient.displayName;
                    existingRecipient.selectedSheetIndex = requestRecipient.selectedSheetIndex;
                    existingRecipient.selections = requestRecipient.selections;
                    existingRecipient.editableCells = requestRecipient.editableCells;
                    existingRecipient.columnLabels = requestRecipient.columnLabels;
                    existingRecipient.pageTitle = requestRecipient.pageTitle;
                    existingRecipient.pageDescription = requestRecipient.pageDescription;
                    existingRecipient.permission = requestRecipient.permission;
                    existingRecipient.allowComments = requestRecipient.allowComments;
                    existingRecipient.allowDownload = requestRecipient.allowDownload;
                    existingRecipient.share = share; // S'assurer que la relation est définie
                } else {
                    // Nouveau recipient - l'ajouter à la collection existante
                    Recipient newRecipient = new Recipient(requestRecipient.email);
                    newRecipient.displayName = requestRecipient.displayName;
                    newRecipient.selectedSheetIndex = requestRecipient.selectedSheetIndex;
                    newRecipient.selections = requestRecipient.selections;
                    newRecipient.editableCells = requestRecipient.editableCells;
                    newRecipient.columnLabels = requestRecipient.columnLabels;
                    newRecipient.pageTitle = requestRecipient.pageTitle;
                    newRecipient.pageDescription = requestRecipient.pageDescription;
                    newRecipient.permission = requestRecipient.permission;
                    newRecipient.allowComments = requestRecipient.allowComments;
                    newRecipient.allowDownload = requestRecipient.allowDownload;
                    newRecipient.share = share;
                    
                    // Initialiser la liste si elle est null
                    if (share.recipients == null) {
                        share.recipients = new ArrayList<>();
                    }
                    share.recipients.add(newRecipient);
                }
            }
        } else {
            // Si aucun recipient dans la requête, vider la liste en supprimant tous les éléments
            if (share.recipients != null) {
                share.recipients.clear();
            }
        }
        
        share.selectedPermission = request.selectedPermission;
        share.allowComments = request.allowComments;
        share.allowDownload = request.allowDownload;
        
        share.updateTimestamp();
        share.persist();
        
        // Forcer le flush pour s'assurer que les recipients sont bien persistés en base
        // avant de recalculer le tabdata
        Panache.getEntityManager().flush();
        
        // 🔧 CORRECTION : Recalculer le tabdata pour tous les destinataires après mise à jour
        // Passer le share directement pour utiliser les données déjà modifiées en mémoire
        try {
            shareTabdataService.rebuildTabdataForAllRecipients(share, ownerUsername);
            LOG.infof("📊 Tabdata recalculé pour tous les destinataires après mise à jour");
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors du recalcul du tabdata après mise à jour: %s", e.getMessage());
            // Ne pas faire échouer la mise à jour
        }
        
        // Recharger le share depuis la base pour s'assurer qu'on retourne les données réellement persistées
        // Cela garantit que les recipients et leurs editableCells sont correctement synchronisés
        share = Share.findById(share.id);
        if (share == null) {
            throw new IllegalStateException("Partage non trouvé après mise à jour: " + shareId);
        }
        
        LOG.infof("Partage mis à jour: %s", share.id);
        
        return new ShareResponse(share);
    }
    
    /**
     * Supprime un partage (soft delete)
     */
    @Transactional
    public boolean deleteShare(String shareId, String ownerUsername) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findByIdAndOwner(uuid, ownerUsername);
        if (share == null) {
            return false;
        }
        
        // Soft delete
        share.status = Share.ShareStatus.DELETED;
        share.updateTimestamp();
        share.persist();
        
        // Supprimer le fichier physique
        fileStorageService.deleteFile(share.filePath);
        
        LOG.infof("Partage supprimé: %s", share.id);
        
        return true;
    }
    
    /**
     * Marque qu'un destinataire a accédé au partage
     */
    @Transactional
    public void markAsAccessed(String shareId, String userEmail) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            return;
        }
        
        Share share = Share.findById(uuid);
        if (share == null || share.recipients == null) {
            return;
        }
        
        // Marquer le destinataire comme ayant accédé
        share.recipients.stream()
            .filter(recipient -> userEmail.equals(recipient.email))
            .findFirst()
            .ifPresent(recipient -> {
                recipient.markAsAccessed();
                share.updateTimestamp();
                share.persist();
            });
    }
    
    /**
     * Récupère les données Excel d'un partage pour un destinataire
     * NOUVELLE VERSION SÉCURISÉE : Utilise les données pré-calculées
     */
    public Object getShareData(String shareId, String userEmail) throws IOException {
        return getShareData(shareId, userEmail, null, null);
    }
    
    public Object getShareData(String shareId, String userEmail, Integer page, Integer limit) throws IOException {
        LOG.infof("📊 Récupération des données pour shareId=%s, userEmail=%s, page=%s, limit=%s", shareId, userEmail, page, limit);
        
        try {
            // Utiliser le nouveau système de tabdata (SANS ACCÈS FICHIER)
            return shareTabdataService.getTabdataFromDatabase(shareId, userEmail, page, limit);
        } catch (SecurityException e) {
            if (e.getMessage().contains("obsolète")) {
                LOG.warnf("⚠️ Tabdata obsolète pour %s - Code 409", userEmail);
                throw new SecurityException("Tabdata obsolète - recalcul nécessaire", e);
            }
            throw e;
        } catch (Exception e) {
            LOG.errorf("❌ Erreur lors de la récupération du tabdata: %s", e.getMessage());
            throw new IOException("Impossible de récupérer les données", e);
        }
    }
    
    /**
     * Crée un ExcelData vide pour la sécurité
     */
    private ExcelData createEmptyExcelData() {
        ExcelData emptyData = new ExcelData();
        emptyData.setHeaders(new ArrayList<>());
        emptyData.setRows(new ArrayList<>());
        return emptyData;
    }
    
    /**
     * Filtre les données Excel selon les sélections du destinataire
     */
    private Object filterDataBySelections(Object excelData, List<Recipient.CellSelection> selections) {
        if (!(excelData instanceof ExcelData)) {
            return excelData;
        }
        
        ExcelData excelDataObj = (ExcelData) excelData;
        List<Map<String, Object>> allRows = excelDataObj.getRows();
        
        if (allRows == null || allRows.isEmpty()) {
            return createEmptyExcelData();
        }
        
        // Créer un ensemble des cellules sélectionnées pour un accès rapide
        Set<String> selectedCells = new HashSet<>();
        for (Recipient.CellSelection selection : selections) {
            selectedCells.add(selection.row + "," + selection.col);
        }
        
        // Filtrer les lignes qui contiennent au moins une cellule sélectionnée
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        for (int rowIndex = 0; rowIndex < allRows.size(); rowIndex++) {
            Map<String, Object> row = allRows.get(rowIndex);
            boolean hasSelectedCell = false;
            
            // Vérifier si cette ligne contient une cellule sélectionnée
            for (String columnKey : row.keySet()) {
                if (columnKey.startsWith("column-")) {
                    try {
                        int colIndex = Integer.parseInt(columnKey.substring(7));
                        String cellKey = rowIndex + "," + colIndex;
                        if (selectedCells.contains(cellKey)) {
                            hasSelectedCell = true;
                            break;
                        }
                    } catch (NumberFormatException e) {
                        // Ignorer les colonnes qui ne suivent pas le format "column-X"
                    }
                }
            }
            
            if (hasSelectedCell) {
                // Filtrer les colonnes de cette ligne pour ne garder que les cellules sélectionnées
                Map<String, Object> filteredRow = new HashMap<>();
                for (String columnKey : row.keySet()) {
                    if (columnKey.startsWith("column-")) {
                        try {
                            int colIndex = Integer.parseInt(columnKey.substring(7));
                            String cellKey = rowIndex + "," + colIndex;
                            if (selectedCells.contains(cellKey)) {
                                filteredRow.put(columnKey, row.get(columnKey));
                            }
                        } catch (NumberFormatException e) {
                            // Garder les colonnes non-numériques (comme les en-têtes)
                            filteredRow.put(columnKey, row.get(columnKey));
                        }
                    } else {
                        // Garder les colonnes non-numériques (comme les en-têtes)
                        filteredRow.put(columnKey, row.get(columnKey));
                    }
                }
                filteredRows.add(filteredRow);
            }
        }
        
        // Créer un nouvel ExcelData avec les données filtrées
        ExcelData filteredExcelData = new ExcelData();
        filteredExcelData.setHeaders(excelDataObj.getHeaders());
        filteredExcelData.setRows(filteredRows);
        
        LOG.infof("🔒 SÉCURITÉ: Données filtrées - %d lignes sélectionnées sur %d lignes totales", 
                 filteredRows.size(), allRows.size());
        
        return filteredExcelData;
    }
    
    /**
     * Récupère les données Excel d'un partage pour le propriétaire (pour les partages NEW)
     */
    public Object getShareDataForOwner(String shareId, String ownerUsername) throws IOException {
        Share share = getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        
        // Vérifier que l'utilisateur est le propriétaire
        if (!ownerUsername.equals(share.ownerUsername)) {
            throw new SecurityException("Accès non autorisé au partage: " + shareId);
        }
        
        // Récupérer le fichier et extraire les données (avec déchiffrement si nécessaire)
        try (var inputStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId)) {
            // Utiliser l'index de feuille sélectionnée
            int sheetIndex = share.selectedSheetIndex;
            Object excelData = excelService.processExcelFile(inputStream, share.originalFileName, sheetIndex);
            
            // Normaliser les données si c'est un ExcelData
            if (excelData instanceof ExcelData) {
                ExcelData excelDataObj = (ExcelData) excelData;
                List<Map<String, Object>> tableData = ExcelDataConverter.convertToTableData(excelDataObj);
                
                // Normaliser le tableData
                tableData = normalizeTableData(tableData, share.headers);
                
                // Créer un nouvel ExcelData avec les données normalisées
                ExcelData normalizedExcelData = new ExcelData();
                normalizedExcelData.setFileName(excelDataObj.getFileName());
                normalizedExcelData.setHeaders(excelDataObj.getHeaders());
                normalizedExcelData.setRows(tableData);
                normalizedExcelData.setTotalRows(tableData.size());
                normalizedExcelData.setTotalColumns(share.headers != null ? share.headers.size() : 0);
                
                return normalizedExcelData;
            }
            
            return excelData;
        }
    }
    
    // Méthodes utilitaires privées
    
    private boolean hasAccessToShare(Share share, String username) {
        // L'utilisateur a accès s'il est le propriétaire
        if (username.equals(share.ownerUsername)) {
            return true;
        }
        
        // Ou s'il est dans la liste des destinataires
        if (share.recipients != null) {
            return share.recipients.stream()
                .anyMatch(recipient -> username.equals(recipient.email));
        }
        
        return false;
    }
    
    private Share getShareForRecipient(String shareId, String userEmail) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        Share share = Share.findById(uuid);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé: " + shareId);
        }
        
        // Vérifier que l'utilisateur est destinataire
        boolean isRecipient = share.recipients != null && 
            share.recipients.stream().anyMatch(r -> userEmail.equals(r.email));
            
        if (!isRecipient && !userEmail.equals(share.ownerEmail)) {
            throw new SecurityException("Accès non autorisé au partage: " + shareId);
        }
        
        return share;
    }
    
    /**
     * Nettoie les partages et fichiers anciens/supprimés
     */
    @Transactional
    public void cleanupDeletedShares(int daysOld) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(daysOld);
        
        List<Share> deletedShares = Share.list("status = ?1 and updatedAt < ?2", 
                                              Share.ShareStatus.DELETED, cutoffDate);
        
        for (Share share : deletedShares) {
            // Supprimer le fichier physique
            fileStorageService.deleteFile(share.filePath);
            
            // Supprimer définitivement de la base
            share.delete();
            
            LOG.infof("Partage supprimé définitivement: %s", share.id);
        }
        
        // Nettoyer les fichiers temporaires
        fileStorageService.cleanupTemporaryFiles(24); // 24 heures
    }
    
    /**
     * Génère un lien d'accès pour un destinataire
     */
    @Transactional
    public String generateRecipientLink(String shareId, String recipientEmail, int validityDays, String ownerUsername) {
        // Vérifier que l'utilisateur est propriétaire du partage
        Share share = getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        if (!share.ownerUsername.equals(ownerUsername)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        // Vérifier que le destinataire existe dans la liste
        boolean recipientExists = share.recipients.stream()
            .anyMatch(r -> r.email.equals(recipientEmail));
        
        if (!recipientExists) {
            throw new IllegalArgumentException("Destinataire non trouvé dans ce partage");
        }
        
        // Générer un token unique
        String token = generateUniqueToken();
        
        // Créer et sauvegarder le token en base
        UUID shareUuid = UUID.fromString(shareId);
        AccessToken accessToken = new AccessToken(shareUuid, recipientEmail, token, validityDays, ownerUsername);
        accessToken.persist();
        
        // Contrôler le statut du share après l'ajout du nouveau token
        statusControlService.controlShareStatus(share);
        
        // Construire l'URL d'accès
        String baseUrl = getBaseUrl();
        String accessUrl = baseUrl + "/access/" + token;
        
        LOG.infof("Lien d'accès généré pour le partage %s, destinataire %s: %s", 
                 shareId, recipientEmail, accessUrl);
        
        // Récupérer le nom du formulaire (pageTitle) du destinataire pour l'email
        // SECURITE: Ne JAMAIS divulguer le nom du fichier Excel (share.fileName) aux destinataires
        String formName = share.recipients.stream()
            .filter(r -> r.email.equals(recipientEmail))
            .map(r -> r.pageTitle)
            .filter(title -> title != null && !title.trim().isEmpty())
            .findFirst()
            .orElse("Partage de données");
        
        // Envoyer un email de notification au destinataire
        try {
            emailService.sendAccessCreatedNotification(
                recipientEmail, 
                accessUrl, 
                formName, 
                share.ownerEmail, 
                validityDays,
                accessToken.expiresAt
            );
            LOG.infof("📧 Email de notification envoyé à: %s avec nom de formulaire: %s", recipientEmail, formName);
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de notification à: %s", recipientEmail);
            // Ne pas faire échouer la création d'accès si l'email échoue
        }
        
        return accessUrl;
    }
    
    /**
     * Récupère tous les tokens d'accès pour un partage
     */
    public java.util.List<AccessTokenResponse> getAccessTokensForShare(String shareId, String ownerUsername) {
        // Vérifier que l'utilisateur est propriétaire du partage
        Share share = getShareByIdWithRecipients(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        if (!share.ownerUsername.equals(ownerUsername)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        // Contrôler le statut de tous les tokens d'accès pour ce share
        statusControlService.controlAllAccessTokensForShare(shareId);
        
        String baseUrl = getBaseUrl();
        
        // Créer une map des destinataires par email pour faciliter la recherche
        java.util.Map<String, Recipient> recipientsByEmail = new java.util.HashMap<>();
        if (share.recipients != null) {
            // Forcer le chargement des destinataires en accédant à la liste
            share.recipients.size(); // Déclenche le chargement lazy
            for (Recipient recipient : share.recipients) {
                recipientsByEmail.put(recipient.email, recipient);
            }
        }
        
        UUID shareUuid = UUID.fromString(shareId);
        return AccessToken.findByShareId(shareUuid)
            .stream()
            .map(token -> {
                AccessTokenResponse response = new AccessTokenResponse(token, baseUrl);
                
                // Enrichir avec les informations du partage
                response.ownerUsername = share.ownerUsername;
                response.ownerEmail = share.ownerEmail;
                response.fileName = share.fileName;
                response.originalFileName = share.originalFileName;
                
                // Enrichir avec les informations du destinataire (pageTitle, pageDescription)
                Recipient recipient = recipientsByEmail.get(token.recipientEmail);
                if (recipient != null) {
                    response.pageTitle = recipient.pageTitle;
                    response.pageDescription = recipient.pageDescription;
                }
                
                return response;
            })
            .collect(java.util.stream.Collectors.toList());
    }
    
    /**
     * Renvoie l'email d'accès à un destinataire avec le dernier token actif
     */
    public void resendAccessEmail(String shareId, String recipientEmail, String ownerUsername) {
        // Vérifier que l'utilisateur est propriétaire du partage
        Share share = getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        if (!share.ownerUsername.equals(ownerUsername)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        // Vérifier que le destinataire existe dans la liste
        boolean recipientExists = share.recipients.stream()
            .anyMatch(r -> r.email.equals(recipientEmail));
        
        if (!recipientExists) {
            throw new IllegalArgumentException("Destinataire non trouvé dans ce partage");
        }
        
        // Récupérer le dernier token actif ou validé pour ce destinataire
        UUID shareUuid;
        try {
            shareUuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        java.util.List<AccessToken.TokenStatus> validStatuses = java.util.Arrays.asList(
            AccessToken.TokenStatus.ACTIVE, 
            AccessToken.TokenStatus.VALIDATED
        );
        AccessToken lastToken = AccessToken.find(
            "shareId = ?1 and recipientEmail = ?2 and status in ?3 order by createdAt desc", 
            shareUuid, recipientEmail, validStatuses
        ).firstResult();
        
        if (lastToken == null) {
            throw new IllegalStateException("Aucun token d'accès trouvé pour ce destinataire. Veuillez d'abord générer un lien d'accès.");
        }
        
        // Construire l'URL d'accès
        String baseUrl = getBaseUrl();
        String accessUrl = baseUrl + "/access/" + lastToken.token;
        
        // Calculer les jours de validité restants
        int validityDays = lastToken.validityDays > 0 ? 
            (int) java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDateTime.now(), lastToken.expiresAt) : 7;
        
        LOG.infof("Renvoi de l'email d'accès pour le partage %s, destinataire %s, token: %s", 
                 shareId, recipientEmail, lastToken.token);
        
        // Récupérer le nom du formulaire (pageTitle) du destinataire pour l'email
        // SECURITE: Ne JAMAIS divulguer le nom du fichier Excel (share.fileName) aux destinataires
        String formName = share.recipients.stream()
            .filter(r -> r.email.equals(recipientEmail))
            .map(r -> r.pageTitle)
            .filter(title -> title != null && !title.trim().isEmpty())
            .findFirst()
            .orElse("Partage de données");
        
        // Envoyer l'email de notification au destinataire
        try {
            emailService.sendAccessCreatedNotification(
                recipientEmail, 
                accessUrl, 
                formName, 
                share.ownerEmail, 
                validityDays,
                lastToken.expiresAt
            );
            LOG.infof("📧 Email d'accès renvoyé avec succès à: %s", recipientEmail);
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors du renvoi de l'email d'accès à: %s", recipientEmail);
            // Propager l'erreur pour informer l'utilisateur
            throw new RuntimeException("Erreur lors de l'envoi de l'email: " + e.getMessage(), e);
        }
    }
    
    /**
     * Récupère tous les tokens d'accès de l'utilisateur connecté
     */
    public java.util.List<AccessTokenResponse> getUserAccessTokens(String userEmail) {
        LOG.infof("🔍 Récupération des tokens d'accès pour l'utilisateur: %s", userEmail);
        
        // Contrôler le statut de tous les tokens d'accès de l'utilisateur (optimisé)
        java.util.List<AccessToken> expiredTokens = AccessToken.find(
            "recipientEmail = ?1 and status = ?2 and expiresAt < ?3", 
            userEmail, AccessToken.TokenStatus.ACTIVE, LocalDateTime.now()
        ).list();
        
        LOG.infof("🔍 Tokens expirés trouvés: %d", expiredTokens.size());
        
        for (AccessToken token : expiredTokens) {
            token.expire();
            token.persist();
        }
        
        String baseUrl = getBaseUrl();
        
        java.util.List<AccessTokenResponse> result = AccessToken.findByRecipientEmail(userEmail)
            .stream()
            .map(token -> {
                // Récupérer les informations du partage pour enrichir la réponse
                Share share = getShareById(token.shareId.toString());
                AccessTokenResponse response = new AccessTokenResponse(token, baseUrl);
                
                if (share != null) {
                    // Enrichir avec les informations du partage
                    response.ownerUsername = share.ownerUsername;
                    response.ownerEmail = share.ownerEmail;
                    response.fileName = share.fileName;
                    response.originalFileName = share.originalFileName;
                    
                    // Récupérer la configuration du destinataire pour le titre et la description
                    share.recipients.stream()
                        .filter(r -> r.email.equals(userEmail))
                        .findFirst()
                        .ifPresent(recipient -> {
                            response.pageTitle = recipient.pageTitle;
                            response.pageDescription = recipient.pageDescription;
                        });
                }
                
                return response;
            })
            .collect(java.util.stream.Collectors.toList());
        
        LOG.infof("🔍 Tokens retournés: %d", result.size());
        return result;
    }
    
    /**
     * Récupère tous les contacts utilisés par l'utilisateur connecté dans ses partages
     */
    public List<ContactInfo> getUserContacts(String ownerUsername) {
        LOG.infof("📧 Récupération des contacts pour l'utilisateur: %s", ownerUsername);
        
        // Récupérer tous les partages de l'utilisateur
        List<Share> userShares = Share.find("ownerUsername", ownerUsername).list();
        
        // Extraire tous les contacts uniques des destinataires
        Map<String, ContactInfo> uniqueContacts = new HashMap<>();
        
        userShares.stream()
            .flatMap(share -> share.recipients.stream())
            .forEach(recipient -> {
                String email = recipient.email;
                String displayName = recipient.displayName != null ? recipient.displayName : email;
                
                // Si on a déjà ce contact, garder le nom d'affichage le plus long (plus informatif)
                if (uniqueContacts.containsKey(email)) {
                    ContactInfo existing = uniqueContacts.get(email);
                    if (displayName.length() > existing.displayName.length()) {
                        uniqueContacts.put(email, new ContactInfo(email, displayName));
                    }
                } else {
                    uniqueContacts.put(email, new ContactInfo(email, displayName));
                }
            });
        
        return uniqueContacts.values().stream()
            .sorted(Comparator.comparing(ContactInfo::getDisplayName))
            .collect(Collectors.toList());
    }
    
    /**
     * Classe interne pour représenter un contact avec email et nom d'affichage
     */
    public static class ContactInfo {
        public final String email;
        public final String displayName;
        
        public ContactInfo(String email, String displayName) {
            this.email = email;
            this.displayName = displayName;
        }
        
        public String getDisplayName() {
            return displayName;
        }
        
        public String getFormattedContact() {
            if (displayName.equals(email)) {
                return email;
            } else {
                return displayName + " <" + email + ">";
            }
        }
    }
    
    /**
     * Révoque un token d'accès
     */
    @Transactional
    public boolean revokeAccessToken(String tokenId, String ownerUsername) {
        UUID uuid;
        try {
            uuid = UUID.fromString(tokenId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de token invalide");
        }
        
        AccessToken token = AccessToken.findById(uuid);
        if (token == null) {
            throw new IllegalArgumentException("Token non trouvé");
        }
        
        // Vérifier que l'utilisateur est propriétaire du partage
        Share share = getShareById(token.shareId.toString());
        if (share == null || !share.ownerUsername.equals(ownerUsername)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        token.revoke();
        token.persist();
        
        // Contrôler le statut du share après la révocation
        statusControlService.controlShareStatus(share);
        
        LOG.infof("Token révoqué: %s", tokenId);
        return true;
    }
    
    /**
     * Valide un token d'accès (clôture l'accès et marque comme validé)
     */
    @Transactional
    public boolean validateAccessToken(String token) {
        return validateAccessToken(token, null);
    }
    
    /**
     * Valide un token d'accès (clôture l'accès et marque comme validé)
     * @param token Le token à valider
     * @param validatedBy L'email de la personne qui valide (peut être null pour validation par le destinataire)
     */
    @Transactional
    public boolean validateAccessToken(String token, String validatedBy) {
        AccessToken accessToken = AccessToken.findByToken(token);
        if (accessToken == null) {
            throw new IllegalArgumentException("Token invalide");
        }
        
        // Vérifier que le token est actif
        if (!accessToken.isActive()) {
            throw new SecurityException("Token non actif");
        }
        
        // Valider le token
        if (validatedBy != null && !validatedBy.trim().isEmpty()) {
            accessToken.validate(validatedBy);
            LOG.infof("Token validé: %s par %s (au lieu de %s)", token, validatedBy, accessToken.recipientEmail);
        } else {
            accessToken.validate();
            LOG.infof("Token validé: %s par %s", token, accessToken.recipientEmail);
        }
        accessToken.persist();
        
        // Contrôler le statut du share après la validation
        Share share = getShareById(accessToken.shareId.toString());
        if (share != null) {
            statusControlService.controlShareStatus(share);
            
            // Récupérer le nom du partage (pageTitle) du destinataire
            // SECURITE: Ne JAMAIS divulguer le nom du fichier Excel aux destinataires
            String formName = share.recipients.stream()
                .filter(r -> r.email.equals(accessToken.recipientEmail))
                .map(r -> r.pageTitle)
                .filter(title -> title != null && !title.trim().isEmpty())
                .findFirst()
                .orElse("Partage de données");
            
            // Envoyer un email de confirmation au destinataire
            try {
                String baseUrl = getBaseUrl();
                String accessUrl = baseUrl + "/access/" + token;
                
                // Calculer les jours de validité restants
                int validityDays = accessToken.validityDays > 0 ? 
                    (int) java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDateTime.now(), accessToken.expiresAt) : 0;
                if (validityDays < 0) {
                    validityDays = 0;
                }
                
                emailService.sendValidationConfirmationToRecipient(
                    accessToken.recipientEmail,
                    formName,
                    accessToken.validatedBy != null ? accessToken.validatedBy : accessToken.recipientEmail,
                    accessToken.validatedAt != null ? accessToken.validatedAt : LocalDateTime.now(),
                    accessUrl,
                    validityDays
                );
                LOG.infof("📧 Email de confirmation de validation envoyé au destinataire: %s", accessToken.recipientEmail);
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de confirmation au destinataire: %s", accessToken.recipientEmail);
            }
            
            // Envoyer un email de notification au propriétaire
            try {
                String baseUrl = getBaseUrl();
                String shareDetailUrl = baseUrl + "/share/" + share.id;
                
                emailService.sendValidationNotificationToOwner(
                    share.ownerEmail,
                    formName,
                    share.originalFileName != null ? share.originalFileName : share.fileName, // Nom du fichier d'origine pour le propriétaire
                    accessToken.recipientEmail,
                    accessToken.validatedBy != null ? accessToken.validatedBy : accessToken.recipientEmail,
                    accessToken.validatedAt != null ? accessToken.validatedAt : LocalDateTime.now(),
                    shareDetailUrl // Lien vers le détail du partage
                );
                LOG.infof("📧 Email de notification de validation envoyé au propriétaire: %s", share.ownerEmail);
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de notification au propriétaire: %s", share.ownerEmail);
            }
        }
        
        return true;
    }
    
    /**
     * Nettoie les tokens expirés
     */
    public void cleanupExpiredTokens() {
        java.util.List<AccessToken> expiredTokens = AccessToken.findExpiredTokens();
        
        for (AccessToken token : expiredTokens) {
            token.expire();
            token.persist();
            LOG.infof("Token expiré marqué: %s", token.id);
        }
        
        // Contrôler le statut des shares après le nettoyage des tokens
        java.util.Set<String> affectedShareIds = expiredTokens.stream()
            .map(token -> token.shareId.toString())
            .collect(java.util.stream.Collectors.toSet());
        
        for (String shareId : affectedShareIds) {
            statusControlService.controlShareStatusById(shareId);
        }
        
        LOG.infof("Nettoyage terminé: %d tokens expirés traités, %d shares mis à jour", 
                 expiredTokens.size(), affectedShareIds.size());
    }
    
    /**
     * Accède aux données d'un partage via un token
     */
    @Transactional
    public Object accessShareWithToken(String token) throws IOException {
        // Récupérer le token depuis la base de données
        AccessToken accessToken = AccessToken.findByToken(token);
        if (accessToken == null) {
            throw new IllegalArgumentException("Token invalide");
        }
        
        // Contrôler le statut du token
        statusControlService.controlAccessTokenStatus(accessToken);
        
        // Vérifier que le token est lisible (actif ou validé)
        if (!accessToken.isReadable()) {
            if (accessToken.isExpired()) {
                accessToken.expire();
                accessToken.persist();
            }
            throw new SecurityException("Token expiré ou révoqué");
        }
        
        // Récupérer le partage
        Share share = getShareById(accessToken.shareId.toString());
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Vérifier que le destinataire existe
        boolean recipientExists = share.recipients.stream()
            .anyMatch(r -> r.email.equals(accessToken.recipientEmail));
        
        if (!recipientExists) {
            throw new SecurityException("Destinataire non autorisé");
        }
        
        // Retourner les données du partage
        Object shareData = getShareData(share.id.toString(), accessToken.recipientEmail);
        
        // Marquer comme accédé (en arrière-plan, sans bloquer la réponse)
        try {
            markAsAccessed(share.id.toString(), accessToken.recipientEmail);
        } catch (Exception e) {
            LOG.warnf("Impossible de marquer l'accès pour %s: %s", accessToken.recipientEmail, e.getMessage());
        }
        
        return shareData;
    }
    
    /**
     * Récupère les données du formulaire avec les configurations du destinataire via un token
     * Version sécurisée qui n'expose pas d'informations sensibles sur les fichiers
     * @param token Token d'accès
     * @param page Numéro de page (commence à 1), null pour toutes les données
     * @param limit Nombre de lignes par page, null pour toutes les données
     */
    @Transactional
    public SecureFormAccessData getFormDataWithToken(String token, Integer page, Integer limit) throws IOException {
        LOG.infof("🔍 ShareService.getFormDataWithToken - Début pour token: %s", token);
        
        // Récupérer le token depuis la base de données
        AccessToken accessToken = AccessToken.findByToken(token);
        if (accessToken == null) {
            LOG.warnf("❌ ShareService.getFormDataWithToken - Token non trouvé: %s", token);
            throw new IllegalArgumentException("Token invalide");
        }
        
        LOG.infof("🔍 ShareService.getFormDataWithToken - Token trouvé: id=%s, status=%s, expiresAt=%s, isExpired=%s", 
                 accessToken.id, accessToken.status, accessToken.expiresAt, accessToken.isExpired());
        
        // Contrôler le statut du token (peut modifier le statut si expiré)
        statusControlService.controlAccessTokenStatus(accessToken);
        
        // 🔧 CORRECTION : Recharger le token après controlAccessTokenStatus pour avoir la version à jour
        accessToken = AccessToken.findById(accessToken.id);
        if (accessToken == null) {
            LOG.warnf("❌ ShareService.getFormDataWithToken - Token non trouvé après contrôle de statut");
            throw new IllegalArgumentException("Token non trouvé après contrôle de statut");
        }
        
        LOG.infof("🔍 ShareService.getFormDataWithToken - Token après contrôle: status=%s, isReadable=%s", 
                 accessToken.status, accessToken.isReadable());
        
        // Vérifier que le token est lisible (actif ou validé)
        if (!accessToken.isReadable()) {
            LOG.warnf("❌ ShareService.getFormDataWithToken - Token non lisible: status=%s, expired=%s, expiresAt=%s", 
                     accessToken.status, accessToken.isExpired(), accessToken.expiresAt);
            throw new SecurityException("Token expiré ou révoqué");
        }
        
        LOG.infof("✅ ShareService.getFormDataWithToken - Token valide et lisible");
        
        // 🔧 CORRECTION : Stocker recipientEmail dans une variable final pour l'utiliser dans la lambda
        final String recipientEmail = accessToken.recipientEmail;
        
        // Récupérer le partage
        Share share = getShareById(accessToken.shareId.toString());
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Trouver le destinataire
        Recipient recipient = share.recipients.stream()
            .filter(r -> r.email.equals(recipientEmail))
            .findFirst()
            .orElseThrow(() -> new SecurityException("Destinataire non autorisé"));
        
        // Récupérer les données stockées en base (SANS ACCÈS FICHIER)
        // RÈGLE ABSOLUE : getFormDataWithToken ne doit PAS accéder au fichier Excel
        // 🔧 CORRECTION : Passer les paramètres de pagination à getTabdataFromDatabase
        Object storedData = shareTabdataService.getTabdataFromDatabase(share.id.toString(), accessToken.recipientEmail, page, limit);
        
        // 🔧 CORRECTION : Récupérer aussi les données complètes (sans pagination) pour originalTableData
        // car les cellules éditables utilisent des index absolus dans le tableau filtré complet
        Object storedDataComplete = shareTabdataService.getTabdataFromDatabase(share.id.toString(), accessToken.recipientEmail, null, null);
        
        // Créer la réponse sécurisée avec les données du formulaire (sans informations sensibles)
        SecureFormAccessData response = new SecureFormAccessData();
        response.shareId = share.id.toString();
        response.ownerEmail = share.ownerEmail; // Email de la personne qui a partagé
        // 🔒 SÉCURITÉ: Suppression des informations sensibles sur les fichiers
        // - fileName: peut contenir des informations sensibles
        // - originalFileName: peut révéler des informations métier
        // - ownerUsername: information personnelle (mais ownerEmail est nécessaire pour l'affichage)
        response.createdAt = share.createdAt;
        response.expiresAt = accessToken.expiresAt;
        response.recipientEmail = accessToken.recipientEmail;
        
        // Configuration du formulaire
        response.pageTitle = recipient.pageTitle != null ? recipient.pageTitle : "";
        response.pageDescription = recipient.pageDescription != null ? recipient.pageDescription : "";
        
        // Transformer les données stockées en format simplifié
        LOG.infof("🔍 Données stockées reçues: %s", storedData.getClass().getSimpleName());
        LOG.infof("🔍 Headers: %s", share.headers);
        LOG.infof("🔍 recipient.selectedSheetIndex: %d", recipient.selectedSheetIndex);
        LOG.infof("🔍 recipient.selections: %s", recipient.selections);
        
        // 🔧 CORRECTION : Les données stockées en base sont déjà filtrées selon les sélections
        // RÈGLE ABSOLUE : getFormDataWithToken ne doit PAS accéder à ExcelData, il doit juste récupérer les tableData stockés en base
        List<Map<String, Object>> tableData;
        int totalRows = 0;
        List<String> headersFromData = new ArrayList<>();
        
        List<SecureFormAccessData.CellPosition> tableDataFormulaCells = new ArrayList<>();
        if (storedData instanceof java.util.Map) {
            // Format avec pagination (Map avec rows, total, headers, tableDataFormulaCells)
            java.util.Map<?, ?> dataMap = (java.util.Map<?, ?>) storedData;
            Object rowsObj = dataMap.get("rows");
            Object totalObj = dataMap.get("total");
            Object headersObj = dataMap.get("headers");
            Object formulaCellsObj = dataMap.get("tableDataFormulaCells");
            if (formulaCellsObj instanceof java.util.List) {
                for (Object item : (java.util.List<?>) formulaCellsObj) {
                    if (item instanceof java.util.Map) {
                        java.util.Map<?, ?> m = (java.util.Map<?, ?>) item;
                        Object r = m.get("row");
                        Object c = m.get("col");
                        if (r instanceof Number && c != null) {
                            tableDataFormulaCells.add(new SecureFormAccessData.CellPosition(((Number) r).intValue(), c.toString()));
                        }
                    }
                }
            }
            
            if (rowsObj instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> storedRows = (java.util.List<java.util.Map<String, Object>>) rowsObj;
                tableData = new ArrayList<>(storedRows);
                
                if (totalObj instanceof Number) {
                    totalRows = ((Number) totalObj).intValue();
                }
                
                if (headersObj instanceof java.util.List) {
                    @SuppressWarnings("unchecked")
                    java.util.List<String> storedHeaders = (java.util.List<String>) headersObj;
                    headersFromData = new ArrayList<>(storedHeaders);
                }
                
                LOG.infof("🔍 Share-access: utilisation directe des données stockées en base (%d lignes sur %d total)", 
                         tableData.size(), totalRows);
            } else {
                LOG.warnf("⚠️ Format de données inattendu - rows non trouvés");
                tableData = new ArrayList<>();
            }
        } else if (storedData instanceof ExcelData) {
            // Format sans pagination (ExcelData)
            ExcelData excelData = (ExcelData) storedData;
            tableData = excelData.getRows() != null ? new ArrayList<>(excelData.getRows()) : new ArrayList<>();
            totalRows = excelData.getTotalRows();
            headersFromData = excelData.getHeaders() != null ? new ArrayList<>(excelData.getHeaders()) : new ArrayList<>();
            if (excelData.getFormulaCells() != null) {
                for (var fc : excelData.getFormulaCells()) {
                    tableDataFormulaCells.add(new SecureFormAccessData.CellPosition(fc.row, fc.col));
                }
            }
            LOG.infof("🔍 Share-access: données ExcelData récupérées (%d lignes)", tableData.size());
        } else {
            LOG.warnf("⚠️ Format de données inattendu - Map ou ExcelData attendu, reçu: %s", storedData.getClass().getSimpleName());
            tableData = new ArrayList<>();
        }
        
        // Stocker le totalRows pour la pagination
        response.totalRows = totalRows;
        
        LOG.infof("🔍 TableData transformé: %d lignes", tableData.size());
        
        // Normaliser le tableData pour s'assurer que toutes les colonnes sont présentes
        tableData = normalizeTableData(tableData, share.headers);
        LOG.infof("🔍 TableData normalisé: %d lignes", tableData.size());
        
        // 🔧 CORRECTION : Sauvegarder les données originales AVANT la fusion
        // Utiliser les données complètes (sans pagination) car les cellules éditables utilisent des index absolus
        // OPTIMISATION : Ne stocker que les valeurs des cellules éditables pour alléger la réponse
        List<Map<String, Object>> completeTableData = new ArrayList<>();
        
        // Extraire les données complètes depuis storedDataComplete
        if (storedDataComplete instanceof java.util.Map) {
            java.util.Map<?, ?> dataMap = (java.util.Map<?, ?>) storedDataComplete;
            Object rowsObj = dataMap.get("rows");
            if (rowsObj instanceof java.util.List) {
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> completeRows = (java.util.List<java.util.Map<String, Object>>) rowsObj;
                completeTableData = new ArrayList<>(completeRows);
            }
        } else if (storedDataComplete instanceof ExcelData) {
            ExcelData excelData = (ExcelData) storedDataComplete;
            completeTableData = excelData.getRows() != null ? new ArrayList<>(excelData.getRows()) : new ArrayList<>();
        }
        
        // Normaliser les données complètes pour s'assurer que toutes les colonnes sont présentes
        completeTableData = normalizeTableData(completeTableData, share.headers);
        
        // 🔧 OPTIMISATION : Créer originalTableData avec seulement les cellules éditables
        // Les cellules éditables seront extraites plus tard, mais on prépare la structure ici
        // On va créer une structure clé-valeur avec les index absolus et les noms de colonnes filtrés
        
        // Récupérer les données soumises par ce destinataire
        LOG.infof("🔍 Recherche des données soumises pour shareId=%s, recipientEmail=%s", 
                 share.id.toString(), accessToken.recipientEmail);
        
        Map<String, String> submittedValues = formSubmissionService.getFormSubmission(
            share.id.toString(), 
            accessToken.recipientEmail
        );
        
        LOG.infof("🔍 Données soumises récupérées: %s", submittedValues);
        
        // Fusionner les données soumises avec les données originales
        if (!submittedValues.isEmpty()) {
            LOG.infof("🔄 Fusion des données soumises: %d valeurs trouvées", submittedValues.size());
            
            // Extraire les cellules éditables pour la feuille sélectionnée
            String sheetKey = String.valueOf(recipient.selectedSheetIndex);
            List<Recipient.CellSelection> editableCellsForSheet = new ArrayList<>();
            if (recipient.editableCells != null && recipient.editableCells.containsKey(sheetKey)) {
                // 🔧 CORRECTION : Convertir les LinkedHashMap (désérialisés depuis JSONB) en CellSelection
                Object editableCellsObj = recipient.editableCells.get(sheetKey);
                editableCellsForSheet = convertToCellSelectionList(editableCellsObj);
                if (editableCellsForSheet == null) {
                    editableCellsForSheet = new ArrayList<>();
                }
            }
            
            LOG.infof("🔄 Cellules éditables pour la feuille %s: %d cellules (index originaux)", sheetKey, editableCellsForSheet.size());
            LOG.infof("🔄 Détail des cellules éditables (index originaux):");
            for (Recipient.CellSelection cell : editableCellsForSheet) {
                String expectedColumnKey = "column-" + cell.col;
                LOG.infof("   - [%d,%d] (clé originale: %s)", cell.row, cell.col, expectedColumnKey);
            }
            
            // 🔧 CORRECTION : Convertir les editableCells depuis les index originaux vers les index filtrés
            // car les clés de soumission utilisent les index filtrés (ex: "0-column-2")
            List<Recipient.CellSelection> editableCellsFiltered = convertEditableCellsToFilteredIndices(
                editableCellsForSheet, recipient.selections, sheetKey);
            
            LOG.infof("🔄 Cellules éditables converties (index filtrés): %d cellules", editableCellsFiltered.size());
            LOG.infof("🔄 Détail des cellules éditables (index filtrés):");
            for (Recipient.CellSelection cell : editableCellsFiltered) {
                String expectedColumnKey = "column-" + cell.col;
                LOG.infof("   - [%d,%d] (clé filtrée: %s)", cell.row, cell.col, expectedColumnKey);
            }
            
            // 🔧 CORRECTION : Calculer l'offset de la page pour adapter les index des modifications
            // Les clés de soumission utilisent des index absolus, il faut les adapter à la page actuelle
            int pageOffset = 0;
            if (page != null && limit != null && page > 0 && limit > 0) {
                pageOffset = (page - 1) * limit;
                LOG.infof("🔄 Offset de la page calculé: %d (page=%d, limit=%d)", pageOffset, page, limit);
            }
            
            tableData = mergeSubmittedValues(tableData, submittedValues, editableCellsFiltered, pageOffset);
        } else {
            LOG.infof("ℹ️ Aucune donnée soumise trouvée, utilisation des données originales");
        }
        
        // Normaliser à nouveau après la fusion pour s'assurer que la structure reste cohérente
        tableData = normalizeTableData(tableData, share.headers);
        LOG.infof("🔍 TableData final normalisé: %d lignes", tableData.size());
        
        // 🔧 CORRECTION : La pagination est déjà appliquée dans getTabdataFromDatabase
        // Ne pas réappliquer la pagination ici, utiliser directement les données reçues
        response.tableData = tableData;
        // totalRows a déjà été défini plus haut depuis storedData
        
        // 🔧 CORRECTION : Récupérer les en-têtes personnalisés depuis les données stockées en base
        // RÈGLE ABSOLUE : Les en-têtes doivent venir exclusivement des données stockées en base, pas du fichier
        // RÈGLE ABSOLUE : simulate-tabdata et tableData enregistré en base doivent utiliser les mêmes méthodes
        // RÈGLE ABSOLUE : Ce que l'utilisateur voit à l'étape 4 de share-new doit être obligatoirement les mêmes données enregistrées en base
        // RÈGLE ABSOLUE : Le tableData généré par simulate-tabdata doit être exactement le même que celui enregistré en base
        // RÈGLE ABSOLUE : getFormDataWithToken ne doit PAS accéder à ExcelData, il doit juste récupérer les tableData stockés en base
        Map<String, String> columnLabels = new HashMap<>();
        List<String> headers = new ArrayList<>();
        
        LOG.infof("🔍 Récupération des en-têtes personnalisés depuis les données stockées en base");
        
        // Récupérer les en-têtes depuis les données stockées (qui contiennent déjà les en-têtes personnalisés appliqués)
        // Utiliser headersFromData qui a déjà été extrait plus haut
        if (!headersFromData.isEmpty()) {
            headers = new ArrayList<>(headersFromData);
            
            LOG.infof("🔍 En-têtes stockés dans les données (avec en-têtes personnalisés appliqués): %s", headers);
            
            // Convertir les en-têtes stockés en columnLabels
            if (headers != null && !headers.isEmpty()) {
                for (int i = 0; i < headers.size(); i++) {
                    String columnKey = "column-" + i;
                    String headerValue = headers.get(i);
                    if (headerValue != null && !headerValue.trim().isEmpty()) {
                        columnLabels.put(columnKey, headerValue);
                        LOG.infof("🔍 En-tête récupéré depuis les données stockées: %s -> %s", columnKey, headerValue);
                    }
                }
            }
        } else {
            LOG.warnf("⚠️ Aucun en-tête disponible dans les données stockées");
        }
        
        LOG.infof("🔍 Headers récupérés: %s", headers);
        LOG.infof("🔍 ColumnLabels récupérés: %s", columnLabels);
        // 🔧 CORRECTION : Toujours inclure les headers, même s'ils sont vides
        response.headers = headers != null ? headers : new ArrayList<>();
        response.columnLabels = columnLabels;
        
        // Récupérer les cellules éditables
        String sheetKey = String.valueOf(recipient.selectedSheetIndex);
        List<SecureFormAccessData.CellPosition> tableDataEditableCells = new ArrayList<>();
        
        LOG.infof("🔍 Récupération des cellules éditables pour sheetKey %s", sheetKey);
        LOG.infof("🔍 recipient.editableCells: %s", recipient.editableCells);
        LOG.infof("🔍 recipient.editableCells.keys: %s", recipient.editableCells != null ? recipient.editableCells.keySet() : "null");
        
        if (recipient.editableCells != null && recipient.editableCells.containsKey(sheetKey)) {
            // 🔧 CORRECTION : Convertir les LinkedHashMap (désérialisés depuis JSONB) en CellSelection
            Object editableCellsObj = recipient.editableCells.get(sheetKey);
            List<Recipient.CellSelection> editableCellsForSheet = convertToCellSelectionList(editableCellsObj);
            if (editableCellsForSheet == null) {
                editableCellsForSheet = new ArrayList<>();
            }
            LOG.infof("🔍 Cellules éditables trouvées pour sheetKey %s: %d cellules", sheetKey, editableCellsForSheet.size());
            
            // Obtenir les clés de colonnes dans l'ordre pour mapper les indices vers les noms
            List<String> orderedColumnKeys = new ArrayList<>();
            if (!tableData.isEmpty()) {
                Map<String, Object> firstRow = tableData.get(0);
                orderedColumnKeys = firstRow.keySet().stream()
                    .filter(key -> key.startsWith("column-"))
                    .sorted((a, b) -> {
                        int aIndex = Integer.parseInt(a.replace("column-", ""));
                        int bIndex = Integer.parseInt(b.replace("column-", ""));
                        return Integer.compare(aIndex, bIndex);
                    })
                    .collect(Collectors.toList());
            }
            
            LOG.infof("🔍 Colonnes ordonnées dans tableData filtré: %s", orderedColumnKeys);
            LOG.infof("🔍 Nombre de colonnes dans tableData filtré: %d", orderedColumnKeys.size());
            
            // 🔧 CORRECTION : Les editableCells stockés en base sont dans le format original (index du fichier Excel)
            // Il faut créer un mapping pour convertir les index originaux vers les index filtrés
            Map<Integer, Integer> columnMapping = new HashMap<>();
            if (recipient.selections != null && recipient.selections.containsKey(sheetKey)) {
                List<Recipient.CellSelection> selectedCells = convertToCellSelectionList(recipient.selections.get(sheetKey));
                if (selectedCells != null && !selectedCells.isEmpty()) {
                    // Extraire les colonnes sélectionnées et les trier
                    Set<Integer> selectedColumnsSet = new HashSet<>();
                    for (Recipient.CellSelection cell : selectedCells) {
                        selectedColumnsSet.add(cell.col);
                    }
                    List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
                    sortedSelectedColumns.sort(Integer::compareTo);
                    
                    // Créer le mapping : colonne originale -> index filtré (0, 1, 2, ...)
                    for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                        int originalCol = sortedSelectedColumns.get(i);
                        columnMapping.put(originalCol, i);
                    }
                    LOG.infof("🔍 Colonnes originales sélectionnées: %s", sortedSelectedColumns);
                    LOG.infof("🔍 Mapping colonnes créé (original -> filtré): %s", columnMapping);
                    LOG.infof("🔍 Vérification: nombre de colonnes dans mapping (%d) vs tableData filtré (%d)", 
                             columnMapping.size(), orderedColumnKeys.size());
                }
            }
            
            // Calculer l'offset de la page pour adapter les index de lignes à la pagination
            int pageOffset = 0;
            if (page != null && limit != null && page > 0 && limit > 0) {
                pageOffset = (page - 1) * limit;
                LOG.infof("🔍 Offset de la page pour editableCells: %d (page=%d, limit=%d)", pageOffset, page, limit);
            }
            
            // Convertir les editableCells depuis les index originaux vers les index filtrés
            LOG.infof("🔍 Conversion de %d cellules éditables (index originaux)", editableCellsForSheet.size());
            for (Recipient.CellSelection cell : editableCellsForSheet) {
                LOG.infof("🔍 Traitement cellule éditable originale: [row=%d, col=%d]", cell.row, cell.col);
                
                // Trouver le nouvel index de colonne après filtrage
                Integer newColIndex = columnMapping.get(cell.col);
                
                if (newColIndex != null) {
                    LOG.infof("🔍 Colonne originale %d mappée vers index filtré %d", cell.col, newColIndex);
                    
                    // Utiliser le nom de colonne du tableData filtré
                    String columnName = "column-" + newColIndex;
                    
                    // Vérifier si le nom de colonne existe dans le tableData filtré
                    if (newColIndex >= 0 && newColIndex < orderedColumnKeys.size()) {
                        columnName = orderedColumnKeys.get(newColIndex);
                        LOG.infof("🔍 Nom de colonne final: %s (index filtré %d)", columnName, newColIndex);
                    } else {
                        LOG.warnf("⚠️ Index filtré %d hors limites (max: %d), utilisation de column-%d", 
                                 newColIndex, orderedColumnKeys.size() - 1, newColIndex);
                    }
                    
                    // 🔧 CORRECTION : Adapter l'index de ligne à la pagination
                    // cell.row est l'index absolu dans le tableau filtré complet
                    // Il faut le convertir en index relatif à la page actuelle
                    int absoluteRowIndex = cell.row;
                    int relativeRowIndex = absoluteRowIndex - pageOffset;
                    
                    // Ne garder que les cellules qui sont dans la plage de la page actuelle
                    if (relativeRowIndex >= 0 && relativeRowIndex < tableData.size()) {
                        tableDataEditableCells.add(new SecureFormAccessData.CellPosition(relativeRowIndex, columnName));
                        LOG.infof("🔍 Cellule éditable convertie: [%d,%d] (original) -> [%d,%s] (filtré, relatif page)", 
                                 absoluteRowIndex, cell.col, relativeRowIndex, columnName);
                    } else {
                        LOG.infof("🔍 Cellule éditable [%d,%d] hors de la page actuelle (offset=%d, taille page=%d), ignorée", 
                                 absoluteRowIndex, cell.col, pageOffset, tableData.size());
                    }
                } else {
                    LOG.warnf("⚠️ Colonne originale %d non trouvée dans le mapping (non sélectionnée)", cell.col);
                }
            }
        } else {
            LOG.warnf("⚠️ Aucune cellule éditable trouvée pour sheetKey %s", sheetKey);
            if (recipient.editableCells != null) {
                LOG.warnf("⚠️ Clés disponibles dans recipient.editableCells: %s", recipient.editableCells.keySet());
            }
        }
        
        response.tableDataEditableCells = tableDataEditableCells;
        response.tableDataFormulaCells = tableDataFormulaCells;
        
        // 🔧 OPTIMISATION : Créer originalTableData avec seulement les cellules éditables
        // Utiliser les index absolus et les noms de colonnes filtrés
        List<Map<String, Object>> originalTableData = new ArrayList<>();
        
        // Créer un mapping pour convertir les colonnes originales vers les colonnes filtrées
        Map<Integer, String> originalColToFilteredCol = new HashMap<>();
        if (recipient.selections != null && recipient.selections.containsKey(sheetKey)) {
            List<Recipient.CellSelection> selectedCells = convertToCellSelectionList(recipient.selections.get(sheetKey));
            if (selectedCells != null && !selectedCells.isEmpty()) {
                Set<Integer> selectedColumnsSet = new HashSet<>();
                for (Recipient.CellSelection cell : selectedCells) {
                    selectedColumnsSet.add(cell.col);
                }
                List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
                sortedSelectedColumns.sort(Integer::compareTo);
                
                for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                    int originalCol = sortedSelectedColumns.get(i);
                    String filteredColKey = "column-" + i;
                    originalColToFilteredCol.put(originalCol, filteredColKey);
                }
            }
        }
        
        // Extraire les cellules éditables originales (avec index absolus)
        if (recipient.editableCells != null && recipient.editableCells.containsKey(sheetKey)) {
            Object editableCellsObj = recipient.editableCells.get(sheetKey);
            List<Recipient.CellSelection> editableCellsForSheet = convertToCellSelectionList(editableCellsObj);
            if (editableCellsForSheet != null && !editableCellsForSheet.isEmpty()) {
                // Créer une structure pour stocker les valeurs originales par index absolu
                Map<Integer, Map<String, Object>> originalValuesByRow = new HashMap<>();
                
                for (Recipient.CellSelection cell : editableCellsForSheet) {
                    int absoluteRowIndex = cell.row; // Index absolu dans le tableau filtré complet
                    int originalColIndex = cell.col; // Index de colonne original
                    
                    // Convertir la colonne originale vers la colonne filtrée
                    String filteredColKey = originalColToFilteredCol.get(originalColIndex);
                    if (filteredColKey != null && absoluteRowIndex >= 0 && absoluteRowIndex < completeTableData.size()) {
                        // Récupérer la valeur originale depuis les données complètes
                        Map<String, Object> completeRow = completeTableData.get(absoluteRowIndex);
                        Object originalValue = completeRow.get(filteredColKey);
                        
                        // Créer ou récupérer la ligne dans originalValuesByRow
                        Map<String, Object> originalRow = originalValuesByRow.computeIfAbsent(absoluteRowIndex, k -> new HashMap<>());
                        originalRow.put(filteredColKey, originalValue != null ? originalValue : "");
                    }
                }
                
                // Convertir la structure en liste (index absolus comme clés implicites)
                // On crée une liste où chaque élément correspond à une ligne avec des cellules éditables
                for (int i = 0; i < completeTableData.size(); i++) {
                    Map<String, Object> originalRow = originalValuesByRow.get(i);
                    if (originalRow != null && !originalRow.isEmpty()) {
                        originalTableData.add(originalRow);
                    } else {
                        // Ajouter une ligne vide pour maintenir la correspondance des index
                        originalTableData.add(new HashMap<>());
                    }
                }
                
                LOG.infof("🔍 originalTableData créé avec seulement les cellules éditables: %d lignes (sur %d total)", 
                         originalTableData.size(), completeTableData.size());
            }
        }
        
        response.originalTableData = originalTableData;
        
        // Métadonnées
        // 🔧 CORRECTION : Ne pas écraser response.totalRows qui a déjà été défini à la ligne 1569
        // depuis storedData (qui contient le nombre de lignes filtrées selon les sélections)
        // share.totalRows est le nombre total de lignes dans le fichier Excel original, pas le nombre filtré
        // response.totalRows est déjà correctement défini depuis storedData (ligne 1569)
        // Ne pas l'écraser avec share.totalRows qui serait incorrect pour les données filtrées
        response.totalColumns = share.totalColumns;
        
        // Statut du token
        response.tokenStatus = accessToken.status.name();
        response.validatedAt = accessToken.validatedAt;
        response.validatedBy = accessToken.validatedBy;
        
        LOG.infof("🔍 Token status: %s, validatedAt: %s", response.tokenStatus, response.validatedAt);
        
        // Marquer comme accédé (en arrière-plan, sans bloquer la réponse)
        try {
            markAsAccessed(share.id.toString(), accessToken.recipientEmail);
        } catch (Exception e) {
            LOG.warnf("Impossible de marquer l'accès pour %s: %s", accessToken.recipientEmail, e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Marque un token comme utilisé (appelé une seule fois à l'ouverture de la page)
     * @param token Token d'accès
     * @return true si le token a été marqué comme utilisé, false sinon
     */
    @Transactional
    public boolean markTokenAsUsed(String token) {
        LOG.infof("🔍 ShareService.markTokenAsUsed - Début pour token: %s", token);
        
        // Récupérer le token depuis la base de données
        AccessToken accessToken = AccessToken.findByToken(token);
        if (accessToken == null) {
            LOG.warnf("❌ ShareService.markTokenAsUsed - Token non trouvé: %s", token);
            throw new IllegalArgumentException("Token invalide");
        }
        
        // Contrôler le statut du token (peut modifier le statut si expiré)
        statusControlService.controlAccessTokenStatus(accessToken);
        
        // Recharger le token après contrôle de statut pour avoir la version à jour
        accessToken = AccessToken.findById(accessToken.id);
        if (accessToken == null) {
            LOG.warnf("❌ ShareService.markTokenAsUsed - Token non trouvé après contrôle de statut");
            throw new IllegalArgumentException("Token non trouvé après contrôle de statut");
        }
        
        // Vérifier que le token est lisible (actif ou validé)
        if (!accessToken.isReadable()) {
            LOG.warnf("❌ ShareService.markTokenAsUsed - Token non lisible: status=%s, expired=%s", 
                     accessToken.status, accessToken.isExpired());
            throw new SecurityException("Token expiré ou révoqué");
        }
        
        // Stocker recipientEmail dans une variable finale pour les lambdas
        final String recipientEmail = accessToken.recipientEmail;
        final UUID shareId = accessToken.shareId;
        
        // Récupérer le partage pour vérifier les permissions
        Share share = getShareById(shareId.toString());
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Vérifier que le destinataire existe
        boolean recipientExists = share.recipients.stream()
            .anyMatch(r -> r.email.equals(recipientEmail));
        
        if (!recipientExists) {
            throw new SecurityException("Destinataire non autorisé");
        }
        
        // Marquer le token comme utilisé
        accessToken.markAsUsed();
        accessToken.persist();
        
        LOG.infof("✅ ShareService.markTokenAsUsed - Token marqué comme utilisé: usageCount=%d", accessToken.usageCount);
        
        // Marquer comme accédé (en arrière-plan, sans bloquer la réponse)
        try {
            markAsAccessed(share.id.toString(), recipientEmail);
        } catch (Exception e) {
            LOG.warnf("Impossible de marquer l'accès pour %s: %s", accessToken.recipientEmail, e.getMessage());
        }
        
        return true;
    }
    
    /**
     * Sauvegarde les données du formulaire via un token
     */
    @Transactional
    public boolean saveFormData(String token, Map<String, Object> formData) throws IOException {
        // Récupérer le token depuis la base de données
        AccessToken accessToken = AccessToken.findByToken(token);
        if (accessToken == null) {
            throw new IllegalArgumentException("Token invalide");
        }
        
        // Contrôler le statut du token
        statusControlService.controlAccessTokenStatus(accessToken);
        
        // Vérifier que le token est éditable (seulement ACTIVE, pas VALIDATED)
        if (!accessToken.isEditable()) {
            if (accessToken.isExpired()) {
                accessToken.expire();
                accessToken.persist();
            }
            throw new SecurityException("Token non éditable (validé ou révoqué)");
        }
        
        // Récupérer le partage
        Share share = getShareById(accessToken.shareId.toString());
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Trouver le destinataire
        Recipient recipient = share.recipients.stream()
            .filter(r -> r.email.equals(accessToken.recipientEmail))
            .findFirst()
            .orElseThrow(() -> new SecurityException("Destinataire non autorisé"));
        
        // Vérifier qu'il y a des cellules éditables
        if (recipient.editableCells == null || recipient.editableCells.isEmpty()) {
            LOG.warnf("Tentative de sauvegarde sans cellules éditables pour %s", accessToken.recipientEmail);
            return false;
        }
        
        // Sauvegarder les données soumises via le service dédié
        boolean saved = formSubmissionService.saveFormSubmission(
            share.id.toString(), 
            accessToken.recipientEmail, 
            formData
        );
        
        if (!saved) {
            LOG.errorf("❌ Échec de la sauvegarde des données soumises pour %s", accessToken.recipientEmail);
            return false;
        }
        
        LOG.infof("✅ Données du formulaire sauvegardées avec succès pour le partage %s, destinataire %s", 
                 share.id, accessToken.recipientEmail);
        
        // Marquer comme accédé
        try {
            markAsAccessed(share.id.toString(), accessToken.recipientEmail);
        } catch (Exception e) {
            LOG.warnf("Impossible de marquer l'accès pour %s: %s", accessToken.recipientEmail, e.getMessage());
        }
        
        return true;
    }
    
    /**
     * Récupère le fichier original d'un partage
     */
    public InputStream getShareFile(String shareId, String username) throws IOException {
        Share share = getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Vérifier que l'utilisateur est le propriétaire du partage
        if (!share.ownerUsername.equals(username)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        // Permettre le téléchargement même si le partage est inactif pour le propriétaire
        // (le propriétaire doit pouvoir récupérer le fichier original même après expiration)
        if (share.status != Share.ShareStatus.ACTIVE) {
            LOG.infof("⚠️ Partage %s non actif (status: %s), mais autorisation accordée au propriétaire %s", 
                     shareId, share.status, username);
        }
        
        // Récupérer le fichier via le service de stockage (avec déchiffrement automatique)
        return fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId);
    }
    
    /**
     * Récupère le fichier avec les données mises à jour des accès validés
     */
    public byte[] getShareFileWithValidatedData(String shareId, String username) throws IOException {
        Share share = getShareById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("Partage non trouvé");
        }
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(share);
        
        // Vérifier que l'utilisateur est le propriétaire du partage
        if (!share.ownerUsername.equals(username)) {
            throw new SecurityException("Accès non autorisé");
        }
        
        // Permettre le téléchargement même si le partage est inactif pour le propriétaire
        // (le propriétaire doit pouvoir récupérer les données validées même après expiration)
        if (share.status != Share.ShareStatus.ACTIVE) {
            LOG.infof("⚠️ Partage %s non actif (status: %s), mais autorisation accordée au propriétaire %s", 
                     shareId, share.status, username);
        }
        
        // Récupérer tous les tokens d'accès validés pour ce partage
        UUID shareUuid = UUID.fromString(shareId);
        List<AccessToken> validatedTokens = AccessToken.find("shareId = ?1 and status = ?2", 
                                                           shareUuid, AccessToken.TokenStatus.VALIDATED).list();
        
        LOG.infof("🔍 Recherche de tokens validés pour shareId=%s (UUID=%s): %d tokens trouvés", 
                 shareId, shareUuid, validatedTokens.size());
        
        if (validatedTokens.isEmpty()) {
            LOG.warnf("⚠️ Aucun token validé trouvé pour le partage %s", shareId);
            throw new IllegalArgumentException("Aucun accès validé trouvé pour ce partage");
        }
        
        // Récupérer le fichier original (avec déchiffrement automatique)
        InputStream originalFileStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId);
        
        // Collecter les modifications par destinataire et feuille
        Map<String, Map<Integer, List<Map<String, Object>>>> modificationsByRecipientAndSheet = new HashMap<>();
        
        for (AccessToken token : validatedTokens) {
            try {
                // Récupérer les données soumises pour ce token
                Map<String, String> submittedValues = formSubmissionService.getFormSubmission(
                    shareId, 
                    token.recipientEmail
                );
                
                if (!submittedValues.isEmpty()) {
                    // Trouver le destinataire pour récupérer les cellules éditables
                    Recipient recipient = share.recipients.stream()
                        .filter(r -> r.email.equals(token.recipientEmail))
                        .findFirst()
                        .orElse(null);
                    
                    if (recipient != null) {
                        // Extraire les cellules éditables pour la feuille sélectionnée de ce destinataire
                        String sheetKey = String.valueOf(recipient.selectedSheetIndex);
                        List<Recipient.CellSelection> editableCellsForSheet = new ArrayList<>();
                        if (recipient.editableCells != null && recipient.editableCells.containsKey(sheetKey)) {
                            // 🔧 CORRECTION : Convertir les LinkedHashMap (désérialisés depuis JSONB) en CellSelection
                            Object editableCellsObj = recipient.editableCells.get(sheetKey);
                            editableCellsForSheet = convertToCellSelectionList(editableCellsObj);
                            if (editableCellsForSheet == null) {
                                editableCellsForSheet = new ArrayList<>();
                            }
                        }
                        
                        LOG.infof("🔍 Token %s (destinataire: %s, feuille: %d): %d cellules éditables, %d valeurs soumises", 
                                 token.token, token.recipientEmail, recipient.selectedSheetIndex, editableCellsForSheet.size(), submittedValues.size());
                        
                        // 🔧 DEBUG : Afficher toutes les cellules éditables pour comprendre la plage
                        if (!editableCellsForSheet.isEmpty()) {
                            int minRow = editableCellsForSheet.stream().mapToInt(c -> c.row).min().orElse(0);
                            int maxRow = editableCellsForSheet.stream().mapToInt(c -> c.row).max().orElse(0);
                            Set<Integer> editableRows = editableCellsForSheet.stream().map(c -> c.row).collect(java.util.stream.Collectors.toSet());
                            LOG.infof("🔍 Cellules éditables: plage de lignes [%d-%d], lignes uniques: %s", 
                                     minRow, maxRow, editableRows);
                            // Afficher toutes les cellules éditables pour debug
                            LOG.infof("🔍 Toutes les cellules éditables:");
                            for (Recipient.CellSelection cell : editableCellsForSheet) {
                                LOG.infof("   - [%d,%d]", cell.row, cell.col);
                            }
                        }
                        
                        // Initialiser la structure pour ce destinataire si nécessaire
                        if (!modificationsByRecipientAndSheet.containsKey(token.recipientEmail)) {
                            modificationsByRecipientAndSheet.put(token.recipientEmail, new HashMap<>());
                        }
                        if (!modificationsByRecipientAndSheet.get(token.recipientEmail).containsKey(recipient.selectedSheetIndex)) {
                            modificationsByRecipientAndSheet.get(token.recipientEmail).put(recipient.selectedSheetIndex, new ArrayList<>());
                        }
                        
                        // 🔧 CORRECTION : Créer le mapping inverse (index filtré -> index original) une seule fois
                        // Les clés de soumission utilisent les index filtrés (ex: "0-column-2" où 2 est filtré)
                        // Mais le fichier Excel nécessite les index originaux
                        Map<Integer, Integer> filteredToOriginalColumnMapping = new HashMap<>();
                        if (recipient.selections != null && recipient.selections.containsKey(sheetKey)) {
                            List<Recipient.CellSelection> selectedCells = convertToCellSelectionList(recipient.selections.get(sheetKey));
                            if (selectedCells != null && !selectedCells.isEmpty()) {
                                // Extraire les colonnes sélectionnées et les trier
                                Set<Integer> selectedColumnsSet = new HashSet<>();
                                for (Recipient.CellSelection cell : selectedCells) {
                                    selectedColumnsSet.add(cell.col);
                                }
                                List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
                                sortedSelectedColumns.sort(Integer::compareTo);
                                
                                // Créer le mapping inverse : index filtré (0, 1, 2, ...) -> index original
                                for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                                    int originalCol = sortedSelectedColumns.get(i);
                                    filteredToOriginalColumnMapping.put(i, originalCol);
                                }
                                LOG.infof("🔄 Mapping colonnes filtré->original créé: %s", filteredToOriginalColumnMapping);
                            }
                        }
                        
                        // 🔧 CORRECTION : Créer le mapping des lignes en utilisant les editableCells
                        // Les editableCells contiennent des index originaux Excel (cell.row, cell.col)
                        // Les clés de soumission utilisent des index absolus dans le tableau filtré (ex: "20-column-2")
                        // On doit créer un mapping : index filtré -> index original Excel
                        // Pour cela, on utilise les editableCells : chaque cellule éditable a un index original Excel
                        // et on peut trouver à quel index filtré elle correspond en utilisant les selections
                        Map<Integer, Integer> filteredToOriginalRowMapping = new HashMap<>();
                        
                        // Créer un mapping des lignes en utilisant les selections et editableCells
                        // Les selections indiquent quelles lignes Excel sont dans le tableau filtré
                        if (recipient.selections != null && recipient.selections.containsKey(sheetKey)) {
                            List<Recipient.CellSelection> selectedCells = convertToCellSelectionList(recipient.selections.get(sheetKey));
                            if (selectedCells != null && !selectedCells.isEmpty()) {
                                // Extraire les lignes uniques sélectionnées et les trier
                                Set<Integer> selectedRowsSet = new HashSet<>();
                                for (Recipient.CellSelection cell : selectedCells) {
                                    selectedRowsSet.add(cell.row);
                                }
                                List<Integer> sortedSelectedRows = new ArrayList<>(selectedRowsSet);
                                sortedSelectedRows.sort(Integer::compareTo);
                                
                                // Créer le mapping : index filtré (0, 1, 2, ...) -> index original Excel
                                for (int i = 0; i < sortedSelectedRows.size(); i++) {
                                    int originalRowIndex = sortedSelectedRows.get(i);
                                    filteredToOriginalRowMapping.put(i, originalRowIndex);
                                }
                                LOG.infof("🔄 Mapping lignes filtré->original créé depuis selections: %d mappings (exemple: %s)", 
                                         filteredToOriginalRowMapping.size(), 
                                         filteredToOriginalRowMapping.entrySet().stream()
                                             .limit(5)
                                             .map(e -> e.getKey() + "->" + e.getValue())
                                             .collect(java.util.stream.Collectors.joining(", ")));
                            }
                        }
                        
                        // Si le mapping est toujours vide, essayer avec le tabdata complet comme fallback
                        if (filteredToOriginalRowMapping.isEmpty()) {
                            try {
                                LOG.infof("🔄 Mapping vide depuis selections, tentative avec tabdata complet (shareId=%s, recipientEmail=%s)", 
                                         shareId, token.recipientEmail);
                                Object completeTabdata = shareTabdataService.getTabdataFromDatabase(
                                    shareId, token.recipientEmail, null, null); // null = toutes les données
                                
                                List<Map<String, Object>> completeRows = new ArrayList<>();
                                if (completeTabdata instanceof java.util.Map) {
                                    java.util.Map<?, ?> dataMap = (java.util.Map<?, ?>) completeTabdata;
                                    Object rowsObj = dataMap.get("rows");
                                    if (rowsObj instanceof java.util.List) {
                                        @SuppressWarnings("unchecked")
                                        java.util.List<java.util.Map<String, Object>> rows = 
                                            (java.util.List<java.util.Map<String, Object>>) rowsObj;
                                        completeRows = new ArrayList<>(rows);
                                    }
                                } else if (completeTabdata instanceof ExcelData) {
                                    ExcelData excelData = (ExcelData) completeTabdata;
                                    completeRows = excelData.getRows() != null ? new ArrayList<>(excelData.getRows()) : new ArrayList<>();
                                }
                                
                                // Créer le mapping depuis _rowIndex
                                for (int filteredIndex = 0; filteredIndex < completeRows.size(); filteredIndex++) {
                                    Map<String, Object> row = completeRows.get(filteredIndex);
                                    Object rowIndexObj = row.get("_rowIndex");
                                    if (rowIndexObj instanceof Number) {
                                        int originalRowIndex = ((Number) rowIndexObj).intValue();
                                        filteredToOriginalRowMapping.put(filteredIndex, originalRowIndex);
                                    }
                                }
                                LOG.infof("🔄 Mapping lignes filtré->original créé depuis tabdata: %d mappings", 
                                         filteredToOriginalRowMapping.size());
                            } catch (Exception e) {
                                LOG.warnf("⚠️ Impossible de récupérer le tabdata complet pour le mapping des lignes: %s", e.getMessage());
                            }
                        }
                        
                        // Créer des lignes avec seulement les cellules éditables modifiées
                        for (Map.Entry<String, String> entry : submittedValues.entrySet()) {
                            String submissionKey = entry.getKey(); // Format: "rowIndex-columnKey"
                            String submittedValue = entry.getValue();
                            
                            // Parser la clé de soumission
                            String[] parts = submissionKey.split("-", 2);
                            if (parts.length == 2) {
                                try {
                                    int filteredRowIndex = Integer.parseInt(parts[0]); // Index absolu dans le tableau filtré
                                    String columnKey = parts[1]; // Format: "column-X" où X est l'index filtré
                                    
                                    // Extraire l'index de colonne filtré depuis la clé column-X
                                    final int filteredColIndex;
                                    if (columnKey.startsWith("column-")) {
                                        filteredColIndex = Integer.parseInt(columnKey.substring(7));
                                    } else {
                                        LOG.warnf("⚠️ Clé de colonne invalide: %s", columnKey);
                                        continue;
                                    }
                                    
                                    // 🔧 CORRECTION : Convertir l'index filtré vers l'index original pour la colonne
                                    Integer originalColIndex = filteredToOriginalColumnMapping.get(filteredColIndex);
                                    if (originalColIndex == null) {
                                        LOG.warnf("⚠️ Index de colonne filtré %d non trouvé dans le mapping pour %s", 
                                                 filteredColIndex, token.recipientEmail);
                                        continue;
                                    }
                                    
                                    // 🔧 CORRECTION : Convertir l'index filtré vers l'index original Excel pour la ligne
                                    Integer originalRowIndexTemp = null;
                                    if (!filteredToOriginalRowMapping.isEmpty()) {
                                        originalRowIndexTemp = filteredToOriginalRowMapping.get(filteredRowIndex);
                                    }
                                    
                                    // Fallback : si le mapping est vide ou l'index n'est pas trouvé, utiliser l'index filtré directement
                                    // (cela peut arriver si le tabdata n'a pas de _rowIndex ou si le mapping n'a pas pu être créé)
                                    if (originalRowIndexTemp == null) {
                                        if (filteredToOriginalRowMapping.isEmpty()) {
                                            LOG.warnf("⚠️ Mapping des lignes vide pour %s, utilisation de l'index filtré comme fallback", token.recipientEmail);
                                        } else {
                                            LOG.warnf("⚠️ Index de ligne filtré %d non trouvé dans le mapping pour %s (mapping size: %d), utilisation comme fallback", 
                                                     filteredRowIndex, token.recipientEmail, filteredToOriginalRowMapping.size());
                                        }
                                        // Utiliser l'index filtré comme index original (comportement précédent)
                                        originalRowIndexTemp = filteredRowIndex;
                                    }
                                    
                                    // Déclarer une variable finale pour la lambda
                                    final int originalRowIndex = originalRowIndexTemp;
                                    
                                    // 🔧 DEBUG : Log détaillé pour comprendre pourquoi une cellule n'est pas éditable
                                    LOG.infof("🔍 Vérification éditabilité: [%d,%d] (original), filtré: [%d,%d]", 
                                             originalRowIndex, originalColIndex, filteredRowIndex, filteredColIndex);
                                    LOG.infof("🔍 Nombre de cellules éditables disponibles: %d", editableCellsForSheet.size());
                                    
                                    // Afficher quelques exemples de cellules éditables pour debug
                                    if (editableCellsForSheet.size() > 0) {
                                        LOG.infof("🔍 Exemples de cellules éditables (5 premières):");
                                        for (int i = 0; i < Math.min(5, editableCellsForSheet.size()); i++) {
                                            Recipient.CellSelection cell = editableCellsForSheet.get(i);
                                            LOG.infof("   - [%d,%d]", cell.row, cell.col);
                                        }
                                    }
                                    
                                    // Vérifier si cette cellule est éditable en utilisant les index originaux
                                    boolean isEditable = editableCellsForSheet.stream()
                                        .anyMatch(cell -> cell.row == originalRowIndex && cell.col == originalColIndex);
                                    
                                    if (!isEditable) {
                                        // 🔧 DEBUG : Vérifier si la cellule existe avec des index proches
                                        boolean foundCloseRow = editableCellsForSheet.stream()
                                            .anyMatch(cell -> cell.row == originalRowIndex);
                                        boolean foundCloseCol = editableCellsForSheet.stream()
                                            .anyMatch(cell -> cell.col == originalColIndex);
                                        LOG.warnf("⚠️ Cellule [%d,%d] non trouvée dans editableCells. Row existe: %s, Col existe: %s", 
                                                 originalRowIndex, originalColIndex, foundCloseRow, foundCloseCol);
                                        
                                        // Chercher la cellule exacte dans editableCells pour debug
                                        for (Recipient.CellSelection cell : editableCellsForSheet) {
                                            if (cell.row == originalRowIndex) {
                                                LOG.warnf("   - Trouvé row=%d avec col=%d (attendu: %d)", 
                                                         cell.row, cell.col, originalColIndex);
                                            }
                                            if (cell.col == originalColIndex) {
                                                LOG.warnf("   - Trouvé col=%d avec row=%d (attendu: %d)", 
                                                         cell.col, cell.row, originalRowIndex);
                                            }
                                        }
                                        
                                        // 🔧 CORRECTION : Si la cellule n'est pas dans editableCells mais qu'une valeur a été soumise,
                                        // on l'accepte quand même car elle a été validée par l'utilisateur
                                        // (peut arriver si les cellules éditables ont changé après la soumission)
                                        if (foundCloseCol) {
                                            LOG.warnf("⚠️ Cellule [%d,%d] acceptée malgré l'absence dans editableCells (colonne éditable trouvée)", 
                                                     originalRowIndex, originalColIndex);
                                            isEditable = true; // Accepter la modification
                                        }
                                    }
                                    
                                    if (isEditable) {
                                        // Créer une ligne avec seulement cette modification
                                        // Utiliser la clé de colonne originale pour le fichier Excel
                                        Map<String, Object> modifiedRow = new HashMap<>();
                                        modifiedRow.put("_rowIndex", originalRowIndex);
                                        modifiedRow.put("column-" + originalColIndex, submittedValue);
                                        modificationsByRecipientAndSheet.get(token.recipientEmail).get(recipient.selectedSheetIndex).add(modifiedRow);
                                        
                                        LOG.infof("✅ Ajout modification pour %s (feuille %d): [%d,%d] (original) = '%s' (filtré: [%d,%d])", 
                                                token.recipientEmail, recipient.selectedSheetIndex, 
                                                originalRowIndex, originalColIndex, submittedValue,
                                                filteredRowIndex, filteredColIndex);
                                    } else {
                                        LOG.infof("⚠️ Ignoré (non éditable) pour %s (feuille %d): [%d,%d] (original)", 
                                                token.recipientEmail, recipient.selectedSheetIndex, originalRowIndex, originalColIndex);
                                    }
                                } catch (NumberFormatException e) {
                                    LOG.warnf("⚠️ Clé de soumission invalide: %s", submissionKey);
                                }
                            }
                        }
                    }
                } else {
                    LOG.infof("ℹ️ Aucune donnée soumise pour le token %s", token.token);
                }
            } catch (Exception e) {
                LOG.warnf("Erreur lors de la récupération des données pour le token %s: %s", token.token, e.getMessage());
            }
        }
        
        LOG.infof("📊 Total des modifications collectées par destinataire et feuille: %d destinataires", modificationsByRecipientAndSheet.size());
        
        // Mettre à jour le fichier Excel avec les modifications de toutes les feuilles
        return excelService.updateExcelFileWithValidatedDataMultiSheet(originalFileStream, share.originalFileName, modificationsByRecipientAndSheet);
    }
    
    /**
     * Récupère un partage par ID (méthode publique)
     */
    public Share getShareById(String shareId) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        return Share.findById(uuid);
    }
    
    /**
     * Récupère un partage par ID avec ses destinataires chargés (JOIN FETCH)
     */
    private Share getShareByIdWithRecipients(String shareId) {
        UUID uuid;
        try {
            uuid = UUID.fromString(shareId);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ID de partage invalide: " + shareId);
        }
        
        // Utiliser une requête JPQL avec JOIN FETCH pour charger les destinataires
        return Share.find("SELECT DISTINCT s FROM Share s LEFT JOIN FETCH s.recipients WHERE s.id = ?1", uuid).firstResult();
    }
    
    /**
     * Génère un token unique pour l'accès
     */
    private String generateUniqueToken() {
        // Générer un token aléatoire de 32 caractères
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        java.util.Random random = new java.util.Random();
        StringBuilder token = new StringBuilder();
        
        for (int i = 0; i < 32; i++) {
            token.append(chars.charAt(random.nextInt(chars.length())));
        }
        
        return token.toString();
    }
    
    /**
     * Récupère l'URL de base de l'application
     * Priorité des variables d'environnement :
     * 1. APP_BASE_URL (URL complète de l'application)
     * 2. FRONTEND_URL (URL du frontend)
     * 3. APP_DOMAIN (nom de domaine de l'application)
     * 4. Valeur par défaut pour le développement
     */
    private String getBaseUrl() {
        // 1. APP_BASE_URL - URL complète de l'application
        String appBaseUrl = System.getenv("APP_BASE_URL");
        if (appBaseUrl != null && !appBaseUrl.trim().isEmpty()) {
            return appBaseUrl.trim();
        }
        
        // 2. FRONTEND_URL - URL du frontend
        String frontendUrl = System.getenv("FRONTEND_URL");
        if (frontendUrl != null && !frontendUrl.trim().isEmpty()) {
            return frontendUrl.trim();
        }
        
        // 3. APP_DOMAIN - nom de domaine de l'application
        String appDomain = System.getenv("APP_DOMAIN");
        if (appDomain != null && !appDomain.trim().isEmpty()) {
            String domain = appDomain.trim();
            // Détecter automatiquement le protocole (HTTP/HTTPS)
            String protocol = "https";
            if (domain.contains("localhost") || domain.contains("127.0.0.1")) {
                protocol = "http";
            }
            return protocol + "://" + domain;
        }
        
        // 4. Valeur par défaut pour le développement
        // Détecter automatiquement si on est en mode développement
        String quarkusProfile = System.getenv("QUARKUS_PROFILE");
        if ("dev".equals(quarkusProfile)) {
            return "http://localhost:4200";
        }
        
        // En production, utiliser localhost:80 (nginx)
        return "http://localhost";
    }
    
    /**
     * Transforme les données Excel en format de tableau simplifié
     */
    private List<Map<String, Object>> transformExcelDataToTableData(Object excelData, List<String> headers) {
        List<Map<String, Object>> tableData = new ArrayList<>();
        
        LOG.infof("🔍 Transformation des données Excel - Type: %s", excelData != null ? excelData.getClass().getSimpleName() : "null");
        
        if (excelData == null) {
            LOG.warnf("❌ Données Excel nulles");
            return tableData;
        }
        
        if (headers == null || headers.isEmpty()) {
            LOG.warnf("❌ Headers nuls ou vides");
            return tableData;
        }
        
        LOG.infof("🔍 Headers disponibles: %s", headers);
        
        // Si excelData est déjà une liste de Maps (format attendu)
        if (excelData instanceof List) {
            LOG.infof("📋 Format: Liste de Maps");
            List<?> dataList = (List<?>) excelData;
            LOG.infof("📋 Nombre d'éléments dans la liste: %d", dataList.size());
            
            for (int i = 0; i < dataList.size(); i++) {
                Object item = dataList.get(i);
                if (item instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> originalRow = (Map<String, Object>) item;
                    
                    // 🔧 CORRECTION : Utiliser les clés column-X au lieu des vrais en-têtes
                    Map<String, Object> normalizedRow = new HashMap<>();
                    for (int j = 0; j < headers.size(); j++) {
                        String columnKey = "column-" + j;
                        Object value = originalRow.get(columnKey);
                        // Garantir qu'on n'a jamais de valeurs null
                        normalizedRow.put(columnKey, value != null ? value : "");
                    }
                    
                    normalizedRow.put("_rowIndex", i);
                    tableData.add(normalizedRow);
                } else {
                    LOG.warnf("⚠️ Élément %d n'est pas une Map: %s", i, item.getClass().getSimpleName());
                }
            }
            return tableData;
        }
        
        // Si excelData a une propriété "rows" qui est une liste
        if (excelData instanceof Map) {
            LOG.infof("📋 Format: Map avec propriété rows");
            @SuppressWarnings("unchecked")
            Map<String, Object> dataMap = (Map<String, Object>) excelData;
            
            LOG.infof("📋 Clés disponibles dans la Map: %s", dataMap.keySet());
            
            Object rowsObj = dataMap.get("rows");
            if (rowsObj == null) {
                LOG.warnf("❌ Propriété 'rows' non trouvée");
                return tableData;
            }
            
            if (rowsObj instanceof List) {
                List<?> rows = (List<?>) rowsObj;
                LOG.infof("📋 Nombre de lignes: %d", rows.size());
                
                for (int i = 0; i < rows.size(); i++) {
                    Object rowObj = rows.get(i);
                    Map<String, Object> row = new HashMap<>();
                    
                    if (rowObj instanceof List) {
                        // Si c'est une liste de valeurs
                        List<?> rowValues = (List<?>) rowObj;
                        LOG.infof("📋 Ligne %d: %d valeurs", i, rowValues.size());
                        
                        for (int j = 0; j < Math.min(headers.size(), rowValues.size()); j++) {
                            Object value = rowValues.get(j);
                            String columnKey = "column-" + j;
                            // Garantir qu'on n'a jamais de valeurs null
                            row.put(columnKey, value != null ? value : "");
                        }
                        
                        // Compléter avec des valeurs vides pour les colonnes manquantes
                        for (int j = rowValues.size(); j < headers.size(); j++) {
                            String columnKey = "column-" + j;
                            row.put(columnKey, "");
                        }
                    } else if (rowObj instanceof Map) {
                        // Si c'est déjà une Map
                        @SuppressWarnings("unchecked")
                        Map<String, Object> existingRow = (Map<String, Object>) rowObj;
                        LOG.infof("📋 Ligne %d: Map avec %d clés", i, existingRow.size());
                        
                        // 🔧 CORRECTION : Utiliser les clés column-X au lieu des vrais en-têtes
                        for (int j = 0; j < headers.size(); j++) {
                            String columnKey = "column-" + j;
                            Object value = existingRow.get(columnKey);
                            // Garantir qu'on n'a jamais de valeurs null
                            row.put(columnKey, value != null ? value : "");
                        }
                    } else {
                        LOG.warnf("⚠️ Ligne %d: Type inattendu %s", i, rowObj.getClass().getSimpleName());
                        continue;
                    }
                    
                    // Ajouter l'index de ligne
                    row.put("_rowIndex", i);
                    tableData.add(row);
                }
            } else {
                LOG.warnf("❌ Propriété 'rows' n'est pas une liste: %s", rowsObj.getClass().getSimpleName());
            }
        }
        
        LOG.infof("✅ Transformation terminée: %d lignes générées", tableData.size());
        return tableData;
    }
    
    /**
     * Normalise le tableData pour s'assurer que toutes les colonnes sont présentes dans chaque ligne
     * 
     * @param tableData Les données à normaliser
     * @param headers Les en-têtes de colonnes attendus
     * @return Les données normalisées
     */
    private List<Map<String, Object>> normalizeTableData(List<Map<String, Object>> tableData, List<String> headers) {
        if (tableData == null || tableData.isEmpty()) {
            LOG.warnf("⚠️ TableData vide ou null, pas de normalisation nécessaire");
            return tableData;
        }
        
        List<String> columnHeaders = new ArrayList<>();
        if (headers != null) {
            for (String header : headers) {
                if (header.startsWith("column-")) {
                    columnHeaders.add(header);
                }
            }
        }
        // Si aucun header column-* trouvé, les reconstruire dynamiquement à partir du premier élément du tableData
        if (columnHeaders.isEmpty()) {
            Map<String, Object> firstRow = tableData.get(0);
            for (String key : firstRow.keySet()) {
                if (key.startsWith("column-")) {
                    columnHeaders.add(key);
                }
            }
            LOG.warnf("⚠️ Headers column-* absents, reconstruits dynamiquement: %s", columnHeaders);
        }
        
        LOG.infof("🔄 Normalisation du tableData: %d lignes, %d colonnes column-* attendues", tableData.size(), columnHeaders.size());
        LOG.infof("📋 Ordre des colonnes après normalisation: %s", columnHeaders);
        
        List<Map<String, Object>> normalizedData = new ArrayList<>();
        
        for (int i = 0; i < tableData.size(); i++) {
            Map<String, Object> originalRow = tableData.get(i);
            Map<String, Object> normalizedRow = new HashMap<>();
            
            // S'assurer que toutes les colonnes column-* sont présentes
            for (String header : columnHeaders) {
                Object value = originalRow.get(header);
                normalizedRow.put(header, value != null ? value : "");
            }
            
            // Préserver uniquement _rowIndex
            if (originalRow.containsKey("_rowIndex")) {
                normalizedRow.put("_rowIndex", originalRow.get("_rowIndex"));
            }
            
            normalizedData.add(normalizedRow);
            LOG.debugf("📋 Ligne %d normalisée: %d colonnes column-*", i, normalizedRow.size());
        }
        
        LOG.infof("✅ Normalisation terminée: %d lignes normalisées", normalizedData.size());
        return normalizedData;
    }
    

    
    /**
     * Fusionne les données soumises avec les données originales
     * Les données soumises remplacent les valeurs originales dans les cellules éditables
     */
    /**
     * Convertit les editableCells depuis les index originaux vers les index filtrés
     * pour correspondre aux clés de soumission qui utilisent les index filtrés
     */
    private List<Recipient.CellSelection> convertEditableCellsToFilteredIndices(
            List<Recipient.CellSelection> editableCellsOriginal,
            Map<String, List<Recipient.CellSelection>> selections,
            String sheetKey) {
        
        List<Recipient.CellSelection> editableCellsFiltered = new ArrayList<>();
        
        if (editableCellsOriginal == null || editableCellsOriginal.isEmpty()) {
            return editableCellsFiltered;
        }
        
        // Créer un mapping des colonnes originales vers les index filtrés
        Map<Integer, Integer> columnMapping = new HashMap<>();
        if (selections != null && selections.containsKey(sheetKey)) {
            List<Recipient.CellSelection> selectedCells = convertToCellSelectionList(selections.get(sheetKey));
            if (selectedCells != null && !selectedCells.isEmpty()) {
                // Extraire les colonnes sélectionnées et les trier
                Set<Integer> selectedColumnsSet = new HashSet<>();
                for (Recipient.CellSelection cell : selectedCells) {
                    selectedColumnsSet.add(cell.col);
                }
                List<Integer> sortedSelectedColumns = new ArrayList<>(selectedColumnsSet);
                sortedSelectedColumns.sort(Integer::compareTo);
                
                // Créer le mapping : colonne originale -> index filtré (0, 1, 2, ...)
                for (int i = 0; i < sortedSelectedColumns.size(); i++) {
                    int originalCol = sortedSelectedColumns.get(i);
                    columnMapping.put(originalCol, i);
                }
                LOG.infof("🔄 Mapping colonnes créé pour conversion editableCells: %s", columnMapping);
            }
        }
        
        // Convertir chaque cellule éditable
        for (Recipient.CellSelection cell : editableCellsOriginal) {
            Integer filteredColIndex = columnMapping.get(cell.col);
            if (filteredColIndex != null) {
                // Créer une nouvelle cellule avec l'index filtré
                Recipient.CellSelection filteredCell = new Recipient.CellSelection();
                filteredCell.row = cell.row;
                filteredCell.col = filteredColIndex;
                editableCellsFiltered.add(filteredCell);
                LOG.infof("🔄 Cellule éditable convertie: [%d,%d] (original) -> [%d,%d] (filtré)", 
                         cell.row, cell.col, filteredCell.row, filteredCell.col);
            } else {
                LOG.warnf("⚠️ Colonne originale %d non trouvée dans le mapping (non sélectionnée)", cell.col);
            }
        }
        
        return editableCellsFiltered;
    }
    
    private List<Map<String, Object>> mergeSubmittedValues(
            List<Map<String, Object>> originalData, 
            Map<String, String> submittedValues, 
            List<Recipient.CellSelection> editableCells,
            int pageOffset) {
        
        LOG.infof("🔄 Début de la fusion: %d lignes originales, %d valeurs soumises, %d cellules éditables, pageOffset=%d", 
                 originalData.size(), submittedValues.size(), editableCells.size(), pageOffset);
        LOG.infof("🔄 Valeurs soumises: %s", submittedValues);
        
        // Log détaillé des cellules éditables
        LOG.infof("🔄 Cellules éditables disponibles (index relatifs à la page):");
        for (Recipient.CellSelection cell : editableCells) {
            String expectedColumnKey = "column-" + cell.col;
            LOG.infof("   - Ligne %d (relatif), Colonne %d (clé: %s)", cell.row, cell.col, expectedColumnKey);
        }
        
        List<Map<String, Object>> mergedData = new ArrayList<>(originalData);
        
        // 🔧 CORRECTION : Les clés de soumission utilisent des index absolus (ex: "20-column-2")
        // Il faut adapter ces index pour qu'ils correspondent à la page actuelle
        // Si pageOffset = 20 et limit = 20, alors les index de la page 2 vont de 20 à 39
        // Les clés de soumission avec index absolu 20-39 doivent être converties en index relatifs 0-19
        
        // Traiter chaque valeur soumise individuellement
        for (Map.Entry<String, String> entry : submittedValues.entrySet()) {
            String submissionKey = entry.getKey();
            String submittedValue = entry.getValue();
            
            LOG.infof("🔄 Traitement valeur soumise: '%s' = '%s'", submissionKey, submittedValue);
            
            // Parser la clé de soumission (format: "absoluteRowIndex-columnKey")
            String[] parts = submissionKey.split("-", 2);
            if (parts.length != 2) {
                LOG.warnf("⚠️ Format de clé invalide: '%s'", submissionKey);
                continue;
            }
            
            final int absoluteRowIndex;
            try {
                absoluteRowIndex = Integer.parseInt(parts[0]);
                LOG.infof("🔄 Index de ligne absolu extrait: %d depuis '%s'", absoluteRowIndex, parts[0]);
            } catch (NumberFormatException e) {
                LOG.warnf("⚠️ Impossible de parser l'index de ligne depuis '%s'", parts[0]);
                continue;
            }
            
            // 🔧 CORRECTION : Convertir l'index absolu en index relatif à la page actuelle
            int relativeRowIndex = absoluteRowIndex - pageOffset;
            LOG.infof("🔄 Index de ligne converti: %d (absolu) -> %d (relatif, offset=%d)", 
                     absoluteRowIndex, relativeRowIndex, pageOffset);
            
            // Vérifier que l'index relatif est dans la plage de la page actuelle
            if (relativeRowIndex < 0 || relativeRowIndex >= originalData.size()) {
                LOG.infof("🔄 Modification [%d,%s] (absolu) hors de la page actuelle (offset=%d, taille=%d), ignorée", 
                         absoluteRowIndex, parts[1], pageOffset, originalData.size());
                continue;
            }
            
            String columnKey = parts[1];
            LOG.infof("🔄 Vérification clé: '%s' pour colonne '%s'", submissionKey, columnKey);
            
            // Vérifier si cette cellule est éditable
            // Extraire l'index de colonne depuis la clé column-X
            final int colIndex;
            if (columnKey.startsWith("column-")) {
                try {
                    colIndex = Integer.parseInt(columnKey.substring(7)); // "column-".length() = 7
                    LOG.infof("🔄 Index de colonne extrait: %d depuis '%s'", colIndex, columnKey);
                } catch (NumberFormatException e) {
                    LOG.warnf("⚠️ Impossible de parser l'index de colonne depuis '%s'", columnKey);
                    continue;
                }
            } else {
                LOG.warnf("⚠️ Clé de colonne non reconnue: '%s'", columnKey);
                continue;
            }
            
            // Vérifier si cette cellule est dans la liste des cellules éditables de la page actuelle
            // Les editableCells ont des index relatifs à la page actuelle
            boolean isEditable = false;
            for (Recipient.CellSelection cell : editableCells) {
                if (cell.row == relativeRowIndex && cell.col == colIndex) {
                    isEditable = true;
                    LOG.infof("🔄 ✅ Cellule [%d,%s] (relatif) trouvée dans les cellules éditables de la page actuelle", relativeRowIndex, columnKey);
                    break;
                }
            }
            
            if (!isEditable) {
                LOG.infof("🔄 ❌ Cellule [%d,%s] (relatif) NON trouvée dans les cellules éditables de la page actuelle", relativeRowIndex, columnKey);
                continue;
            }
            
            // Appliquer la modification si la cellule est éditable
            if (relativeRowIndex >= 0 && relativeRowIndex < mergedData.size()) {
                Map<String, Object> rowToUpdate = mergedData.get(relativeRowIndex);
                Object originalValue = rowToUpdate.get(columnKey);
                rowToUpdate.put(columnKey, submittedValue);
                LOG.infof("🔄 ✅ Valeur remplacée: [%d,%s] (relatif, absolu %d) = '%s' -> '%s'", 
                         relativeRowIndex, columnKey, absoluteRowIndex, originalValue, submittedValue);
            } else {
                LOG.warnf("⚠️ Index de ligne invalide: %d (taille: %d)", relativeRowIndex, mergedData.size());
            }
        }
        
        LOG.infof("🔄 Fusion terminée: %d lignes traitées", mergedData.size());
        return mergedData;
    }
    
    /**
     * Obtient l'index de colonne pour une clé donnée (incluant _rowIndex)
     */
    private int getColumnIndex(List<Map<String, Object>> data, String columnKey) {
        if (data.isEmpty()) return 0;
        
        String[] keys = data.get(0).keySet().toArray(new String[0]);
        for (int i = 0; i < keys.length; i++) {
            if (keys[i].equals(columnKey)) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * Obtient l'index de colonne pour une clé donnée (excluant _rowIndex)
     * Cette méthode calcule l'index comme le frontend le fait
     */
    private int getColumnIndexWithoutRowIndex(List<Map<String, Object>> data, String columnKey) {
        if (data.isEmpty()) return 0;
        
        // Filtrer les clés pour exclure _rowIndex (comme le frontend)
        List<String> filteredKeys = data.get(0).keySet().stream()
            .filter(key -> !key.equals("_rowIndex"))
            .collect(Collectors.toList());
        
        for (int i = 0; i < filteredKeys.size(); i++) {
            if (filteredKeys.get(i).equals(columnKey)) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * Recalcule le tabdata pour tous les destinataires d'un partage (méthode publique)
     */
    public void rebuildTabdataForAllRecipients(String shareId, String ownerUsername) throws IOException {
        shareTabdataService.rebuildTabdataForAllRecipients(shareId, ownerUsername);
    }
    
    /**
     * Calcule l'empreinte SHA-256 d'un fichier pour la sécurité
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
            return java.util.Base64.getEncoder().encodeToString(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException("Algorithme SHA-256 non disponible", e);
        }
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
                    LOG.warnf("Type inattendu dans la liste de cellules: %s", item.getClass().getName());
                }
            }
            
            return result;
        }
        
        LOG.warnf("Type inattendu pour les cellules: %s", obj.getClass().getName());
        return null;
    }
} 