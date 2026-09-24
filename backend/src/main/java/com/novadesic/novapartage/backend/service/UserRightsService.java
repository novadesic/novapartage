package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.FormSubmission;
import com.novadesic.novapartage.backend.model.ShareAccessTabdata;
import com.novadesic.novapartage.backend.model.ShareAccessTabdataRow;
import com.novadesic.novapartage.backend.model.Recipient;
import com.novadesic.novapartage.backend.model.dto.ShareResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service pour gérer les droits RGPD des utilisateurs
 * - Droit d'accès (Article 15)
 * - Droit de rectification (Article 16)
 * - Droit à l'effacement (Article 17)
 * - Droit à la portabilité (Article 20)
 */
@ApplicationScoped
public class UserRightsService {
    
    private static final Logger LOG = Logger.getLogger(UserRightsService.class);
    
    @Inject
    ShareService shareService;
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ShareTabdataService shareTabdataService;
    
    @Inject
    EmailService emailService;
    
    /**
     * Exporte toutes les données d'un utilisateur (Article 15 RGPD - Droit d'accès)
     * 
     * @param userEmail Email de l'utilisateur
     * @return Map contenant toutes les données de l'utilisateur
     */
    public Map<String, Object> exportUserData(String userEmail) {
        LOG.infof("📥 Export des données RGPD pour l'utilisateur: %s", userEmail);
        
        Map<String, Object> exportData = new HashMap<>();
        exportData.put("exportDate", LocalDateTime.now().toString());
        exportData.put("userEmail", userEmail);
        
        // 1. Informations utilisateur de base
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("email", userEmail);
        userInfo.put("exportDate", LocalDateTime.now().toString());
        exportData.put("user", userInfo);
        
        // 2. Partages créés par l'utilisateur
        List<Share> ownedShares = Share.findByOwner(userEmail);
        List<Map<String, Object>> sharesData = ownedShares.stream()
            .map(this::shareToMap)
            .collect(Collectors.toList());
        exportData.put("ownedShares", sharesData);
        exportData.put("ownedSharesCount", sharesData.size());
        
        // 3. Tokens d'accès créés par l'utilisateur
        List<AccessToken> createdTokens = AccessToken.find("createdBy = ?1", userEmail).list();
        List<Map<String, Object>> tokensData = createdTokens.stream()
            .map(this::tokenToMap)
            .collect(Collectors.toList());
        exportData.put("createdTokens", tokensData);
        exportData.put("createdTokensCount", tokensData.size());
        
        // 4. Partages où l'utilisateur est destinataire
        List<Share> sharedWithUser = Share.findByRecipient(userEmail);
        List<Map<String, Object>> sharedSharesData = sharedWithUser.stream()
            .map(share -> {
                Map<String, Object> shareMap = shareToMap(share);
                // Ajouter les informations spécifiques au destinataire
                Optional<Recipient> recipient = share.recipients.stream()
                    .filter(r -> r.email.equals(userEmail))
                    .findFirst();
                if (recipient.isPresent()) {
                    Map<String, Object> recipientInfo = new HashMap<>();
                    recipientInfo.put("email", recipient.get().email);
                    recipientInfo.put("displayName", recipient.get().displayName);
                    recipientInfo.put("lastAccessed", recipient.get().lastAccessed != null ? recipient.get().lastAccessed.toString() : null);
                    recipientInfo.put("hasAccessed", recipient.get().hasAccessed);
                    shareMap.put("recipientInfo", recipientInfo);
                }
                return shareMap;
            })
            .collect(Collectors.toList());
        exportData.put("sharedWithMe", sharedSharesData);
        exportData.put("sharedWithMeCount", sharedSharesData.size());
        
        // 5. Tokens d'accès reçus par l'utilisateur
        List<AccessToken> receivedTokens = AccessToken.find("recipientEmail = ?1", userEmail).list();
        List<Map<String, Object>> receivedTokensData = receivedTokens.stream()
            .map(this::tokenToMap)
            .collect(Collectors.toList());
        exportData.put("receivedTokens", receivedTokensData);
        exportData.put("receivedTokensCount", receivedTokensData.size());
        
        // 6. Soumissions de formulaires de l'utilisateur
        List<FormSubmission> formSubmissions = FormSubmission.find("recipientEmail = ?1", userEmail).list();
        List<Map<String, Object>> submissionsData = formSubmissions.stream()
            .map(this::formSubmissionToMap)
            .collect(Collectors.toList());
        exportData.put("formSubmissions", submissionsData);
        exportData.put("formSubmissionsCount", submissionsData.size());
        
        LOG.infof("✅ Export des données terminé pour %s: %d partages créés, %d partages reçus, %d tokens, %d soumissions",
                 userEmail, sharesData.size(), sharedSharesData.size(), 
                 tokensData.size() + receivedTokensData.size(), submissionsData.size());
        
        return exportData;
    }
    
    /**
     * Supprime complètement toutes les données d'un utilisateur (Article 17 RGPD - Droit à l'effacement)
     * 
     * @param userEmail Email de l'utilisateur
     * @return Nombre d'entités supprimées
     */
    @Transactional
    public Map<String, Object> deleteUserAccount(String userEmail) {
        LOG.infof("🗑️ Suppression complète du compte utilisateur: %s", userEmail);
        
        Map<String, Object> deletionReport = new HashMap<>();
        deletionReport.put("userEmail", userEmail);
        deletionReport.put("deletionDate", LocalDateTime.now().toString());
        
        int sharesDeleted = 0;
        int tokensDeleted = 0;
        int formSubmissionsDeleted = 0;
        int tabdataDeleted = 0;
        int filesDeleted = 0;
        
        // 1. Supprimer tous les partages créés par l'utilisateur (avec fichiers)
        List<Share> ownedShares = Share.findByOwner(userEmail);
        for (Share share : ownedShares) {
            try {
                deleteShareCompletely(share);
                sharesDeleted++;
                filesDeleted++;
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression du partage %s", share.id);
            }
        }
        
        // 2. Supprimer tous les tokens créés par l'utilisateur
        List<AccessToken> createdTokens = AccessToken.find("createdBy = ?1", userEmail).list();
        for (AccessToken token : createdTokens) {
            try {
                token.delete();
                tokensDeleted++;
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression du token %s", token.id);
            }
        }
        
        // 3. Supprimer tous les tokens reçus par l'utilisateur
        List<AccessToken> receivedTokens = AccessToken.find("recipientEmail = ?1", userEmail).list();
        for (AccessToken token : receivedTokens) {
            try {
                token.delete();
                tokensDeleted++;
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression du token reçu %s", token.id);
            }
        }
        
        // 4. Supprimer toutes les soumissions de formulaires de l'utilisateur
        List<FormSubmission> formSubmissions = FormSubmission.find("recipientEmail = ?1", userEmail).list();
        for (FormSubmission submission : formSubmissions) {
            try {
                submission.delete();
                formSubmissionsDeleted++;
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression de la soumission %s", submission.id);
            }
        }
        
        // 5. Supprimer les tabdata associés aux partages supprimés
        // (Les tabdata sont supprimés en cascade avec les partages, mais on peut aussi les supprimer explicitement)
        List<ShareAccessTabdata> tabdataList = ShareAccessTabdata.find("recipientEmail = ?1", userEmail).list();
        for (ShareAccessTabdata tabdata : tabdataList) {
            try {
                // Supprimer les lignes associées
                ShareAccessTabdataRow.delete("tabdataId = ?1", tabdata.id);
                tabdata.delete();
                tabdataDeleted++;
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression du tabdata %s", tabdata.id);
            }
        }
        
        // 6. Retirer l'utilisateur des destinataires des autres partages
        List<Share> sharesWithUserAsRecipient = Share.findByRecipient(userEmail);
        for (Share share : sharesWithUserAsRecipient) {
            try {
                share.recipients.removeIf(r -> r.email.equals(userEmail));
                share.updateTimestamp();
                share.persist();
            } catch (Exception e) {
                LOG.errorf(e, "Erreur lors de la suppression de l'utilisateur des destinataires du partage %s", share.id);
            }
        }
        
        deletionReport.put("sharesDeleted", sharesDeleted);
        deletionReport.put("tokensDeleted", tokensDeleted);
        deletionReport.put("formSubmissionsDeleted", formSubmissionsDeleted);
        deletionReport.put("tabdataDeleted", tabdataDeleted);
        deletionReport.put("filesDeleted", filesDeleted);
        deletionReport.put("totalDeleted", sharesDeleted + tokensDeleted + formSubmissionsDeleted + tabdataDeleted);
        
        LOG.infof("✅ Suppression du compte terminée pour %s: %d partages, %d tokens, %d soumissions, %d tabdata",
                 userEmail, sharesDeleted, tokensDeleted, formSubmissionsDeleted, tabdataDeleted);
        
        return deletionReport;
    }
    
    /**
     * Met à jour le profil utilisateur (Article 16 RGPD - Droit de rectification)
     * 
     * @param userEmail Email de l'utilisateur
     * @param newEmail Nouvel email (optionnel)
     * @param displayName Nouveau nom d'affichage (optionnel)
     * @return Map avec les informations mises à jour
     */
    @Transactional
    public Map<String, Object> updateUserProfile(String userEmail, String newEmail, String displayName) {
        LOG.infof("✏️ Mise à jour du profil utilisateur: %s", userEmail);
        
        Map<String, Object> updateReport = new HashMap<>();
        updateReport.put("userEmail", userEmail);
        updateReport.put("updateDate", LocalDateTime.now().toString());
        
        List<String> updatedFields = new ArrayList<>();
        
        // Note: Dans cette application, l'email est l'identifiant principal
        // Changer l'email nécessiterait de mettre à jour toutes les références
        // Pour l'instant, on ne permet que la mise à jour du displayName dans les destinataires
        
        if (displayName != null && !displayName.trim().isEmpty()) {
            // Mettre à jour le displayName dans tous les destinataires où l'utilisateur apparaît
            List<Share> sharesWithUser = Share.findByRecipient(userEmail);
            for (Share share : sharesWithUser) {
                share.recipients.stream()
                    .filter(r -> r.email.equals(userEmail))
                    .forEach(r -> {
                        r.displayName = displayName;
                    });
                share.updateTimestamp();
                share.persist();
            }
            updatedFields.add("displayName");
            updateReport.put("displayName", displayName);
        }
        
        if (newEmail != null && !newEmail.trim().isEmpty() && !newEmail.equals(userEmail)) {
            // Changer l'email est complexe car c'est l'identifiant
            // Pour l'instant, on logue mais on ne fait pas la mise à jour automatique
            LOG.warnf("⚠️ Changement d'email demandé de %s vers %s - Non implémenté (nécessite migration complète)", 
                     userEmail, newEmail);
            updateReport.put("emailChangeRequested", true);
            updateReport.put("newEmail", newEmail);
            updateReport.put("note", "Le changement d'email nécessite une procédure manuelle. Contactez privacy@novadesic.com");
        }
        
        updateReport.put("updatedFields", updatedFields);
        
        LOG.infof("✅ Mise à jour du profil terminée pour %s: %s", userEmail, String.join(", ", updatedFields));
        
        return updateReport;
    }
    
    /**
     * Supprime complètement un partage (fichier + données)
     */
    private void deleteShareCompletely(Share share) {
        try {
            // 1. Supprimer les tokens d'accès
            List<AccessToken> tokens = AccessToken.findByShareId(share.id);
            for (AccessToken token : tokens) {
                token.delete();
            }
            
            // 2. Supprimer les soumissions de formulaires
            List<FormSubmission> submissions = FormSubmission.find("shareId = ?1", share.id).list();
            for (FormSubmission submission : submissions) {
                submission.delete();
            }
            
            // 3. Supprimer les tabdata et leurs lignes
            List<ShareAccessTabdata> tabdataList = ShareAccessTabdata.find("shareId = ?1", share.id).list();
            for (ShareAccessTabdata tabdata : tabdataList) {
                ShareAccessTabdataRow.delete("tabdataId = ?1", tabdata.id);
                tabdata.delete();
            }
            
            // 4. Supprimer le fichier physique
            if (share.filePath != null) {
                try {
                    fileStorageService.deleteFile(share.filePath);
                } catch (Exception e) {
                    LOG.warnf(e, "Impossible de supprimer le fichier %s", share.filePath);
                }
            }
            
            // 5. Supprimer le partage (les destinataires sont supprimés en cascade)
            share.delete();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la suppression complète du partage %s", share.id);
            throw e;
        }
    }
    
    /**
     * Convertit un Share en Map pour l'export
     */
    private Map<String, Object> shareToMap(Share share) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", share.id.toString());
        map.put("fileName", share.fileName);
        map.put("originalFileName", share.originalFileName);
        map.put("status", share.status != null ? share.status.toString() : null);
        map.put("createdAt", share.createdAt != null ? share.createdAt.toString() : null);
        map.put("updatedAt", share.updatedAt != null ? share.updatedAt.toString() : null);
        map.put("ownerEmail", share.ownerEmail);
        map.put("ownerUsername", share.ownerUsername);
        map.put("fileSize", share.fileSize);
        map.put("fileExtension", share.fileExtension);
        map.put("totalRows", share.totalRows);
        map.put("totalColumns", share.totalColumns);
        map.put("recipientsCount", share.recipients != null ? share.recipients.size() : 0);
        
        // Informations sur les destinataires (sans données sensibles)
        if (share.recipients != null) {
            List<Map<String, Object>> recipientsInfo = share.recipients.stream()
                .map(r -> {
                    Map<String, Object> recipientMap = new HashMap<>();
                    recipientMap.put("email", r.email);
                    recipientMap.put("displayName", r.displayName);
                    recipientMap.put("lastAccessed", r.lastAccessed != null ? r.lastAccessed.toString() : null);
                    recipientMap.put("hasAccessed", r.hasAccessed);
                    return recipientMap;
                })
                .collect(Collectors.toList());
            map.put("recipients", recipientsInfo);
        }
        
        return map;
    }
    
    /**
     * Convertit un AccessToken en Map pour l'export
     */
    private Map<String, Object> tokenToMap(AccessToken token) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", token.id.toString());
        map.put("shareId", token.shareId.toString());
        map.put("recipientEmail", token.recipientEmail);
        map.put("status", token.status != null ? token.status.toString() : null);
        map.put("createdAt", token.createdAt != null ? token.createdAt.toString() : null);
        map.put("expiresAt", token.expiresAt != null ? token.expiresAt.toString() : null);
        map.put("validityDays", token.validityDays);
        map.put("lastUsedAt", token.lastUsedAt != null ? token.lastUsedAt.toString() : null);
        map.put("usageCount", token.usageCount);
        map.put("createdBy", token.createdBy);
        map.put("validatedAt", token.validatedAt != null ? token.validatedAt.toString() : null);
        // Ne pas inclure le token lui-même pour des raisons de sécurité
        return map;
    }
    
    /**
     * Convertit un FormSubmission en Map pour l'export
     */
    private Map<String, Object> formSubmissionToMap(FormSubmission submission) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", submission.id.toString());
        map.put("shareId", submission.shareId.toString());
        map.put("recipientEmail", submission.recipientEmail);
        map.put("submittedAt", submission.submittedAt != null ? submission.submittedAt.toString() : null);
        map.put("lastModifiedAt", submission.lastModifiedAt != null ? submission.lastModifiedAt.toString() : null);
        map.put("formData", submission.submittedValues);
        return map;
    }
}

