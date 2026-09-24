package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.AccessTokenNotification;
import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.Recipient;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service de notification d'expiration des accès
 * Envoie des notifications aux destinataires lorsque leurs accès approchent de l'expiration
 */
@ApplicationScoped
public class AccessExpirationNotificationService {
    
    private static final Logger LOG = Logger.getLogger(AccessExpirationNotificationService.class);
    
    @Inject
    EmailService emailService;
    
    /**
     * Parse les durées de notification depuis les variables d'environnement
     * Format attendu: "72h,24h" ou "3d,1d" ou "72,24" (en heures par défaut)
     * @return Liste des heures avant expiration pour lesquelles envoyer des notifications
     */
    private List<Integer> parseNotificationDeltas() {
        String deltasEnv = System.getenv("ACCESS_EXPIRATION_NOTIFICATION_DELTAS");
        if (deltasEnv == null || deltasEnv.trim().isEmpty()) {
            // Valeurs par défaut: 3 jours (72h) et 24h
            return List.of(72, 24);
        }
        
        List<Integer> deltas = new ArrayList<>();
        String[] parts = deltasEnv.split(",");
        
        for (String part : parts) {
            part = part.trim();
            try {
                int hours;
                if (part.endsWith("h")) {
                    hours = Integer.parseInt(part.substring(0, part.length() - 1));
                } else if (part.endsWith("d")) {
                    int days = Integer.parseInt(part.substring(0, part.length() - 1));
                    hours = days * 24;
                } else {
                    // Par défaut, considérer comme heures
                    hours = Integer.parseInt(part);
                }
                if (hours > 0) {
                    deltas.add(hours);
                }
            } catch (NumberFormatException e) {
                LOG.warnf("⚠️ Format invalide pour la durée de notification: %s (ignoré)", part);
            }
        }
        
        // Trier par ordre décroissant pour traiter les notifications les plus lointaines en premier
        deltas.sort((a, b) -> b.compareTo(a));
        
        return deltas.isEmpty() ? List.of(72, 24) : deltas;
    }
    
    /**
     * Vérifie si les notifications sont activées
     */
    private boolean isNotificationEnabled() {
        String enabled = System.getenv("ACCESS_EXPIRATION_NOTIFICATION_ENABLED");
        return enabled == null || "true".equalsIgnoreCase(enabled.trim());
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
        return "http://localhost:4200";
    }
    
    /**
     * Tâche planifiée pour vérifier et envoyer les notifications d'expiration
     * Exécutée selon la configuration ACCESS_EXPIRATION_NOTIFICATION_SCHEDULE
     * Par défaut: toutes les 6 heures
     * Format cron Quarkus: 6 parties (secondes minute heure jour mois jour-semaine)
     */
    @Scheduled(cron = "${access.expiration.notification.schedule:0 0 */6 * * ?}")
    @Transactional
    public void checkAndSendExpirationNotifications() {
        if (!isNotificationEnabled()) {
            LOG.debug("🔕 Notifications d'expiration désactivées");
            return;
        }
        
        LOG.infof("🔔 Début de la vérification des notifications d'expiration");
        
        List<Integer> notificationDeltas = parseNotificationDeltas();
        LOG.infof("📅 Deltas de notification configurés: %s heures", notificationDeltas);
        
        int totalNotificationsSent = 0;
        
        for (Integer deltaHours : notificationDeltas) {
            try {
                int sent = processNotificationsForDelta(deltaHours);
                totalNotificationsSent += sent;
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors du traitement des notifications pour delta %d heures", deltaHours);
            }
        }
        
        LOG.infof("✅ Vérification terminée: %d notification(s) envoyée(s)", totalNotificationsSent);
    }
    
    /**
     * Traite les notifications pour un delta spécifique (en heures)
     * Note: Cette méthode est appelée depuis checkAndSendExpirationNotifications() qui est @Transactional
     */
    private int processNotificationsForDelta(int deltaHours) {
        LOG.infof("🔍 Recherche des tokens expirant dans %d heures", deltaHours);
        
        // Trouver les tokens qui expirent dans le délai spécifié
        // Utiliser une tolérance de 60 minutes pour capturer les tokens dans la fenêtre
        List<AccessToken> expiringTokens = AccessToken.findTokensExpiringInHours(deltaHours, 60);
        
        LOG.infof("📊 %d token(s) trouvé(s) expirant dans %d heures", expiringTokens.size(), deltaHours);
        
        int notificationsSent = 0;
        
        for (AccessToken token : expiringTokens) {
            try {
                // Vérifier si une notification a déjà été envoyée pour ce token et ce delta
                if (AccessTokenNotification.hasNotificationBeenSent(token.id, deltaHours)) {
                    LOG.debugf("⏭️ Notification déjà envoyée pour token %s avec delta %d heures", token.id, deltaHours);
                    continue;
                }
                
                // Récupérer le partage associé
                Share share = Share.findById(token.shareId);
                if (share == null) {
                    LOG.warnf("⚠️ Partage non trouvé pour token %s (shareId: %s)", token.id, token.shareId);
                    continue;
                }
                
                // Trouver le destinataire pour obtenir le pageTitle
                Recipient recipient = share.recipients.stream()
                    .filter(r -> r.email.equals(token.recipientEmail))
                    .findFirst()
                    .orElse(null);
                
                if (recipient == null) {
                    LOG.warnf("⚠️ Destinataire non trouvé pour token %s (email: %s)", token.id, token.recipientEmail);
                    continue;
                }
                
                // Construire l'URL d'accès
                String baseUrl = getBaseUrl();
                String accessUrl = baseUrl + "/access/" + token.token;
                
                // Récupérer le nom du formulaire (pageTitle)
                String formName = recipient.pageTitle != null && !recipient.pageTitle.trim().isEmpty()
                    ? recipient.pageTitle
                    : "Partage de données";
                
                // Calculer les heures restantes jusqu'à l'expiration
                long hoursRemaining = ChronoUnit.HOURS.between(LocalDateTime.now(), token.expiresAt);
                
                // Envoyer la notification
                emailService.sendAccessExpiringSoonNotification(
                    token.recipientEmail,
                    accessUrl,
                    formName,
                    share.ownerEmail,
                    token.expiresAt,
                    hoursRemaining
                );
                
                // Marquer la notification comme envoyée
                AccessTokenNotification.markNotificationSent(token.id, deltaHours, token.recipientEmail);
                
                notificationsSent++;
                LOG.infof("✅ Notification envoyée à %s pour token %s (expire dans %d heures)", 
                         token.recipientEmail, token.id, deltaHours);
                
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors de l'envoi de la notification pour token %s", token.id);
                // Continuer avec les autres tokens même en cas d'erreur
            }
        }
        
        return notificationsSent;
    }
    
    /**
     * Méthode de test pour déclencher manuellement les notifications
     * Peut être appelée via un endpoint REST si nécessaire
     */
    @Transactional
    public int triggerNotificationsManually() {
        LOG.infof("🔔 Déclenchement manuel des notifications d'expiration");
        if (!isNotificationEnabled()) {
            LOG.debug("🔕 Notifications d'expiration désactivées");
            return 0;
        }
        
        List<Integer> notificationDeltas = parseNotificationDeltas();
        LOG.infof("📅 Deltas de notification configurés: %s heures", notificationDeltas);
        
        int totalNotificationsSent = 0;
        
        for (Integer deltaHours : notificationDeltas) {
            try {
                int sent = processNotificationsForDelta(deltaHours);
                totalNotificationsSent += sent;
            } catch (Exception e) {
                LOG.errorf(e, "❌ Erreur lors du traitement des notifications pour delta %d heures", deltaHours);
            }
        }
        
        LOG.infof("✅ Vérification terminée: %d notification(s) envoyée(s)", totalNotificationsSent);
        return totalNotificationsSent;
    }
}

