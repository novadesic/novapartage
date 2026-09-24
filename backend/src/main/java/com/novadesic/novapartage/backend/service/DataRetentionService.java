package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.FormSubmission;
import com.novadesic.novapartage.backend.model.ShareAccessTabdata;
import com.novadesic.novapartage.backend.model.ShareAccessTabdataRow;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service de nettoyage des données conformément à la politique de conservation RGPD
 */
@ApplicationScoped
public class DataRetentionService {
    
    private static final Logger LOG = Logger.getLogger(DataRetentionService.class);
    
    @Inject
    ShareService shareService;
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ShareTabdataService shareTabdataService;
    
    @Inject
    EmailService emailService;
    
    @ConfigProperty(name = "data.retention.shares.deleted.days", defaultValue = "30")
    int sharesDeletedDays;
    
    @ConfigProperty(name = "data.retention.shares.new.days", defaultValue = "7")
    int sharesNewDays;
    
    @ConfigProperty(name = "data.retention.shares.finished.months", defaultValue = "18")
    int sharesFinishedMonths;
    
    @ConfigProperty(name = "data.retention.shares.inactive.months", defaultValue = "7")
    int sharesInactiveMonths;
    
    @ConfigProperty(name = "data.retention.shares.inactive.warning.months", defaultValue = "6")
    int sharesInactiveWarningMonths;
    
    @ConfigProperty(name = "data.retention.tokens.expired.days", defaultValue = "90")
    int tokensExpiredDays;
    
    @ConfigProperty(name = "data.retention.tokens.validated.years", defaultValue = "1")
    int tokensValidatedYears;
    
    @ConfigProperty(name = "data.retention.form.submissions.orphan.years", defaultValue = "1")
    int formSubmissionsOrphanYears;
    
    /**
     * Nettoie les partages NEW non finalisés après 7 jours
     * Exécuté tous les jours à 2h du matin
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupNewShares() {
        LOG.infof("🧹 Début du nettoyage des partages NEW non finalisés (conservation: %d jours)", sharesNewDays);
        
        LocalDateTime cutoff = LocalDateTime.now().minusDays(sharesNewDays);
        List<Share> newShares = Share.findNewShares();
        
        int deletedCount = 0;
        for (Share share : newShares) {
            if (share.createdAt.isBefore(cutoff)) {
                try {
                    LOG.infof("🗑️ Suppression du partage NEW non finalisé: %s (créé le %s)", 
                             share.id, share.createdAt);
                    deleteShareCompletely(share.id.toString());
                    deletedCount++;
                } catch (Exception e) {
                    LOG.errorf(e, "❌ Erreur lors de la suppression du partage NEW: %s", share.id);
                }
            }
        }
        
        LOG.infof("✅ Nettoyage terminé: %d partage(s) NEW supprimé(s)", deletedCount);
    }
    
    /**
     * Nettoie les partages FINISHED après 18 mois
     * Exécuté tous les jours à 3h du matin
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupFinishedShares() {
        LOG.infof("🧹 Début du nettoyage des partages FINISHED (conservation: %d mois)", sharesFinishedMonths);
        
        LocalDateTime cutoff = LocalDateTime.now().minusMonths(sharesFinishedMonths);
        List<Share> finishedShares = Share.list("status = ?1 AND updatedAt < ?2", 
                                                 Share.ShareStatus.FINISHED, cutoff);
        
        int deletedCount = 0;
        for (Share share : finishedShares) {
            try {
                LOG.infof("🗑️ Suppression du partage FINISHED: %s (dernière modif: %s)", 
                         share.id, share.updatedAt);
                deleteShareCompletely(share.id.toString());
                deletedCount++;
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de la suppression du partage FINISHED: %s", share.id);
            }
        }
        
        LOG.infof("✅ Nettoyage terminé: %d partage(s) FINISHED supprimé(s)", deletedCount);
    }
    
    /**
     * Nettoie les partages INACTIVE après 7 mois (avec notification à 6 mois)
     * Exécuté tous les jours à 4h du matin
     */
    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional
    public void cleanupInactiveShares() {
        LOG.infof("🧹 Début du nettoyage des partages INACTIVE (conservation: %d mois)", sharesInactiveMonths);
        
        LocalDateTime warningDate = LocalDateTime.now().minusMonths(sharesInactiveWarningMonths);
        LocalDateTime deletionDate = LocalDateTime.now().minusMonths(sharesInactiveMonths);
        
        // Notification à 6 mois (pour les partages qui n'ont pas encore reçu de notification)
        // Gérer les valeurs null comme false (partages créés avant l'ajout du champ)
        List<Share> inactiveSharesForWarning = Share.find(
            "SELECT DISTINCT s FROM Share s LEFT JOIN FETCH s.recipients WHERE s.status = ?1 AND s.updatedAt < ?2 AND (s.deletionNotificationSent = ?3 OR s.deletionNotificationSent IS NULL)", 
            Share.ShareStatus.INACTIVE, warningDate, false).list();
        
        int notificationCount = 0;
        for (Share share : inactiveSharesForWarning) {
            try {
                // Recharger le partage avec les recipients si nécessaire
                if (share.recipients == null) {
                    share = Share.find("SELECT DISTINCT s FROM Share s LEFT JOIN FETCH s.recipients WHERE s.id = ?1", share.id).firstResult();
                }
                
                // Calculer les jours restants avant suppression
                LocalDateTime shareDeletionDate = share.updatedAt.plusMonths(sharesInactiveMonths);
                int daysRemaining = Math.max(0, (int) java.time.temporal.ChronoUnit.DAYS.between(
                    LocalDateTime.now(), 
                    shareDeletionDate
                ));
                
                // Obtenir le nom du partage (première pageTitle disponible ou fileName)
                String shareName = share.recipients != null && !share.recipients.isEmpty()
                    ? share.recipients.stream()
                        .filter(r -> r.pageTitle != null && !r.pageTitle.trim().isEmpty())
                        .map(r -> r.pageTitle)
                        .findFirst()
                        .orElse(share.originalFileName != null ? share.originalFileName : share.fileName)
                    : (share.originalFileName != null ? share.originalFileName : share.fileName);
                
                // Construire l'URL de gestion
                String baseUrl = getBaseUrl();
                String manageSharesUrl = baseUrl + "/home";
                
                // Envoyer la notification
                emailService.sendShareDeletionWarning(
                    share.ownerEmail,
                    shareName,
                    share.createdAt,
                    share.updatedAt,
                    sharesInactiveWarningMonths,
                    daysRemaining,
                    shareDeletionDate,
                    manageSharesUrl
                );
                
                // Marquer comme notifié
                share.deletionNotificationSent = true;
                share.persist();
                notificationCount++;
                
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de l'envoi de la notification pour le partage: %s", share.id);
            }
        }
        
        LOG.infof("📧 Notifications envoyées: %d partage(s) INACTIVE", notificationCount);
        
        // Suppression à 7 mois
        List<Share> toDelete = Share.list("status = ?1 AND updatedAt < ?2", 
                                          Share.ShareStatus.INACTIVE, deletionDate);
        
        int deletedCount = 0;
        for (Share share : toDelete) {
            try {
                LOG.infof("🗑️ Suppression du partage INACTIVE: %s (dernière modif: %s)", 
                         share.id, share.updatedAt);
                deleteShareCompletely(share.id.toString());
                deletedCount++;
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de la suppression du partage INACTIVE: %s", share.id);
            }
        }
        
        LOG.infof("✅ Nettoyage terminé: %d partage(s) INACTIVE supprimé(s)", deletedCount);
    }
    
    /**
     * Nettoie les tokens expirés après 90 jours
     * Exécuté tous les jours à 5h du matin
     */
    @Scheduled(cron = "0 0 5 * * ?")
    @Transactional
    public void cleanupExpiredTokens() {
        LOG.infof("🧹 Début du nettoyage des tokens expirés (conservation: %d jours)", tokensExpiredDays);
        
        int deletedCount = AccessToken.deleteExpiredTokens();
        
        LOG.infof("✅ Nettoyage terminé: %d token(s) expiré(s) supprimé(s)", deletedCount);
    }
    
    /**
     * Nettoie les tokens validés après 1 an
     * Exécuté tous les jours à 5h30 du matin
     */
    @Scheduled(cron = "0 30 5 * * ?")
    @Transactional
    public void cleanupValidatedTokens() {
        LOG.infof("🧹 Début du nettoyage des tokens validés (conservation: %d an(s))", tokensValidatedYears);
        
        int deletedCount = AccessToken.deleteValidatedTokens();
        
        LOG.infof("✅ Nettoyage terminé: %d token(s) validé(s) supprimé(s)", deletedCount);
    }
    
    /**
     * Nettoie les soumissions de formulaires orphelines après 1 an
     * Exécuté tous les jours à 6h du matin
     */
    @Scheduled(cron = "0 0 6 * * ?")
    @Transactional
    public void cleanupOrphanFormSubmissions() {
        LOG.infof("🧹 Début du nettoyage des soumissions orphelines (conservation: %d an(s))", 
                 formSubmissionsOrphanYears);
        
        LocalDateTime cutoff = LocalDateTime.now().minusYears(formSubmissionsOrphanYears);
        
        // Récupérer tous les shareIds existants
        List<Share> allShares = Share.listAll();
        java.util.Set<java.util.UUID> existingShareIds = allShares.stream()
            .map(s -> s.id)
            .collect(java.util.stream.Collectors.toSet());
        
        // Trouver les soumissions dont le shareId n'existe plus
        List<FormSubmission> allSubmissions = FormSubmission.listAll();
        int deletedCount = 0;
        
        for (FormSubmission submission : allSubmissions) {
            if (!existingShareIds.contains(submission.shareId) && 
                submission.lastModifiedAt != null &&
                submission.lastModifiedAt.isBefore(cutoff)) {
                try {
                    LOG.infof("🗑️ Suppression soumission orpheline: %s (shareId: %s, modifié: %s)", 
                             submission.id, submission.shareId, submission.lastModifiedAt);
                    submission.delete();
                    deletedCount++;
                } catch (Exception e) {
                    LOG.errorf(e, "❌ Erreur lors de la suppression de la soumission: %s", submission.id);
                }
            }
        }
        
        LOG.infof("✅ Nettoyage terminé: %d soumission(s) orpheline(s) supprimée(s)", deletedCount);
    }
    
    /**
     * Supprime complètement un partage et toutes ses données associées
     * @param shareId ID du partage à supprimer
     */
    private void deleteShareCompletely(String shareId) {
        try {
            Share share = Share.findById(java.util.UUID.fromString(shareId));
            if (share == null) {
                LOG.warnf("⚠️ Partage non trouvé: %s", shareId);
                return;
            }
            
            // 1. Supprimer le fichier physique
            if (share.filePath != null) {
                fileStorageService.deleteFile(share.filePath);
            }
            
            // 2. Supprimer les tokens d'accès associés
            List<AccessToken> tokens = AccessToken.findByShareId(share.id);
            for (AccessToken token : tokens) {
                token.delete();
            }
            
        // 3. Supprimer les soumissions de formulaires
        List<FormSubmission> submissions = FormSubmission.find("shareId = ?1", share.id).list();
        for (FormSubmission submission : submissions) {
            submission.delete();
        }
        
        // 4. Supprimer les tabdata et leurs lignes
        List<ShareAccessTabdata> tabdataList = ShareAccessTabdata.find("shareId = ?1", share.id).list();
        for (ShareAccessTabdata tabdata : tabdataList) {
            // Supprimer les lignes
            ShareAccessTabdataRow.delete("tabdataId = ?1", tabdata.id);
            // Supprimer le tabdata
            tabdata.delete();
        }
            
            // 5. Supprimer le partage (les recipients seront supprimés en cascade)
            share.delete();
            
            LOG.infof("✅ Partage supprimé complètement: %s", shareId);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la suppression complète du partage: %s", shareId);
            throw new RuntimeException("Erreur lors de la suppression du partage", e);
        }
    }
    
    /**
     * Récupère l'URL de base de l'application
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
        String quarkusProfile = System.getenv("QUARKUS_PROFILE");
        if ("dev".equals(quarkusProfile)) {
            return "http://localhost:4200";
        }
        
        // En production, utiliser localhost:80 (nginx)
        return "http://localhost";
    }
}

