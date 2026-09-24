package com.novadesic.novapartage.backend.service;

import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@ApplicationScoped
public class EmailService {
    
    private static final Logger LOG = Logger.getLogger(EmailService.class);
    private static final String BASE_SUBJECT = "NovaPartage";
    
    @Inject
    EmailServiceHelper emailServiceHelper;
    
    @Inject
    TemplateEmailServiceHelper templateEmailServiceHelper;
    
    /**
     * Envoie un email de notification de création d'accès
     * 
     * SECURITE: Attention, le paramètre 'fileName' ne doit JAMAIS contenir le nom réel du fichier Excel
     * car cela pourrait révéler des informations sensibles sur l'infrastructure ou le contenu.
     * Preference pour utiliser le nom du formulaire (pageTitle) configuré pour le destinataire.
     * 
     * @param recipientEmail Email du destinataire
     * @param accessUrl URL d'accès au formulaire
     * @param formName Nom du formulaire (pageTitle) à afficher (PAS le nom du fichier Excel)
     * @param ownerEmail Email du propriétaire qui partage
     * @param validityDays Nombre de jours de validité
     * @param expiresAt Date d'expiration de l'accès
     */
    public void sendAccessCreatedNotification(String recipientEmail, String accessUrl, 
                                            String formName, String ownerEmail, 
                                            int validityDays, LocalDateTime expiresAt) {
        try {
            LOG.infof("📧 Envoi de notification de création d'accès à: %s", recipientEmail);
            
            // Construire le sujet avec le titre du partage
            String shareTitle = formName != null ? formName : "Partage de données";
            String subject = "NovaPartage - Partage de données : " + shareTitle;
            
            // Formater la date d'expiration
            String expiresAtFormatted = expiresAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("recipientEmail", recipientEmail);
            variables.put("accessUrl", accessUrl);
            variables.put("formName", shareTitle);
            variables.put("ownerEmail", ownerEmail);
            variables.put("validityDays", String.valueOf(validityDays));
            variables.put("validityDaysPlural", validityDays > 1 ? "s" : "");
            variables.put("expiresAtFormatted", expiresAtFormatted);
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("access-created", recipientEmail, subject, variables);
            
            LOG.infof("✅ Email de notification envoyé avec succès à: %s", recipientEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de notification à: %s", recipientEmail);
            // Ne pas faire échouer la création d'accès si l'email échoue
        }
    }
    
    /**
     * Envoie un email de notification d'accès validé
     * 
     * SECURITE: Attention, le paramètre 'formName' ne doit JAMAIS contenir le nom réel du fichier Excel
     * car cela pourrait révéler des informations sensibles.
     * 
     * @param recipientEmail Email du destinataire qui a validé
     * @param formName Nom du formulaire (pageTitle) à afficher (PAS le nom du fichier Excel)
     * @param ownerEmail Email du propriétaire qui a partagé
     * @param accessUrl URL d'accès au partage
     * @param validityDays Nombre de jours de validité restants
     */
    public void sendAccessValidatedNotification(String recipientEmail, String formName, String ownerEmail, String accessUrl, int validityDays) {
        try {
            LOG.infof("📧 Envoi de notification d'accès validé à: %s", recipientEmail);
            
            String subject = BASE_SUBJECT + " - Partage validé";
            String validatedDate = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("formName", formName != null ? formName : "Partage de données");
            variables.put("fileName", "");
            variables.put("recipientEmail", recipientEmail);
            variables.put("validatedBy", recipientEmail);
            variables.put("validatedDate", validatedDate);
            variables.put("shareDetailUrl", "");
            variables.put("accessUrl", accessUrl != null ? accessUrl : "");
            variables.put("validityDays", String.valueOf(validityDays));
            variables.put("validityDaysPlural", validityDays > 1 ? "s" : "");
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("access-validated", recipientEmail, subject, variables);
            
            LOG.infof("✅ Email de validation envoyé avec succès à: %s", recipientEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de validation à: %s", recipientEmail);
        }
    }
    
    /**
     * Envoie un email de confirmation au destinataire après validation
     * 
     * @param recipientEmail Email du destinataire
     * @param formName Nom du partage (pageTitle) à afficher
     * @param validatedBy Email de la personne qui a validé
     * @param validatedAt Date de validation
     * @param accessUrl URL d'accès au partage
     * @param validityDays Nombre de jours de validité restants
     */
    public void sendValidationConfirmationToRecipient(String recipientEmail, String formName, String validatedBy, LocalDateTime validatedAt, String accessUrl, int validityDays) {
        try {
            LOG.infof("📧 Envoi de confirmation de validation au destinataire: %s", recipientEmail);
            
            String subject = "NovaPartage - Validation confirmée";
            String validatedDate = validatedAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("formName", formName != null ? formName : "Partage de données");
            variables.put("fileName", "");
            variables.put("recipientEmail", recipientEmail);
            variables.put("validatedBy", validatedBy);
            variables.put("validatedDate", validatedDate);
            variables.put("shareDetailUrl", "");
            variables.put("accessUrl", accessUrl != null ? accessUrl : "");
            variables.put("validityDays", String.valueOf(validityDays));
            variables.put("validityDaysPlural", validityDays > 1 ? "s" : "");
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("access-validated", recipientEmail, subject, variables);
            
            LOG.infof("✅ Email de confirmation de validation envoyé au destinataire: %s", recipientEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de confirmation au destinataire: %s", recipientEmail);
        }
    }
    
    /**
     * Envoie un email de notification au propriétaire après validation
     * 
     * @param ownerEmail Email du propriétaire
     * @param formName Nom du partage (pageTitle) à afficher
     * @param fileName Nom du fichier Excel (visible uniquement pour le propriétaire)
     * @param recipientEmail Email du destinataire
     * @param validatedBy Email de la personne qui a validé
     * @param validatedAt Date de validation
     * @param shareDetailUrl Lien vers le détail du partage
     */
    public void sendValidationNotificationToOwner(String ownerEmail, String formName, String fileName, String recipientEmail, String validatedBy, LocalDateTime validatedAt, String shareDetailUrl) {
        try {
            LOG.infof("📧 Envoi de notification de validation au propriétaire: %s", ownerEmail);
            
            String subject = "NovaPartage - Partage validé";
            String validatedDate = validatedAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("formName", formName != null ? formName : "Partage de données");
            variables.put("fileName", fileName != null ? fileName : "Fichier partagé");
            variables.put("recipientEmail", recipientEmail);
            variables.put("validatedBy", validatedBy);
            variables.put("validatedDate", validatedDate);
            variables.put("shareDetailUrl", shareDetailUrl);
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("validation-notification", ownerEmail, subject, variables);
            
            LOG.infof("✅ Email de notification de validation envoyé au propriétaire: %s", ownerEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de notification au propriétaire: %s", ownerEmail);
        }
    }
    
    /**
     * Charge un template HTML depuis les ressources et remplace les variables
     * 
     * @param templateFile Nom du fichier theorique (dans templates/)
     * @param variables Variables à remplacer dans le template
     * @return Contenu HTML avec les variables remplacées
     */
    private String loadAndFillTemplate(String templateFile, Map<String, String> variables) {
        try (InputStream is = getClass().getClassLoader()
                .getResourceAsStream("templates/" + templateFile)) {
            
            if (is == null) {
                LOG.errorf("❌ Template non trouvé: %s", templateFile);
                throw new RuntimeException("Template non trouvé: " + templateFile);
            }
            
            String template = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            
            // Remplacer les variables {{variable}} par les valeurs
            for (Map.Entry<String, String> entry : variables.entrySet()) {
                template = template.replace("{{" + entry.getKey() + "}}", entry.getValue());
            }
            
            return template;
            
        } catch (IOException e) {
            LOG.errorf(e, "❌ Erreur lors du chargement du template: %s", templateFile);
            throw new RuntimeException("Erreur lors du chargement du template: " + templateFile, e);
        }
    }
    
    /**
     * Génère un email à partir du template de base avec un contenu spécifique
     * 
     * @param contentTemplateFile Nom du fichier de contenu (dans templates/)
     * @param title Titre de l'email
     * @param headerGradient Dégradé du header (ex: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)")
     * @param headerSubtitle Sous-titre du header
     * @param contentVariables Variables pour le contenu
     * @return Contenu HTML complet
     */
    private String generateEmailFromTemplate(String contentTemplateFile, String title, String headerGradient, String headerSubtitle, Map<String, String> contentVariables) {
        try {
            // Charger le contenu
            String bodyContent = loadAndFillTemplate(contentTemplateFile, contentVariables);
            
            // Charger le template de base
            String baseTemplate = loadAndFillTemplate("email-base.html", Map.of(
                "title", title,
                "headerGradient", headerGradient,
                "headerSubtitle", headerSubtitle,
                "bodyContent", bodyContent
            ));
            
            return baseTemplate;
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la génération de l'email à partir du template: %s", contentTemplateFile);
            throw new RuntimeException("Erreur lors de la génération de l'email", e);
        }
    }
    
    /**
     * Récupère l'adresse email de l'expéditeur depuis la configuration
     */
    private String getEmailFrom() {
        String from = System.getenv("SMTP_FROM");
        if (from == null || from.trim().isEmpty()) {
            return "no-reply@novapartage.fr";
        }
        return from;
    }
    
    /**
     * Envoie un email de notification d'expiration prochaine d'un accès
     * 
     * SECURITE: Attention, le paramètre 'formName' ne doit JAMAIS contenir le nom réel du fichier Excel
     * car cela pourrait révéler des informations sensibles.
     * 
     * @param recipientEmail Email du destinataire
     * @param accessUrl URL d'accès au formulaire
     * @param formName Nom du formulaire (pageTitle) à afficher (PAS le nom du fichier Excel)
     * @param ownerEmail Email du propriétaire qui partage
     * @param expiresAt Date d'expiration de l'accès
     * @param hoursRemaining Nombre d'heures restantes avant expiration
     */
    public void sendAccessExpiringSoonNotification(String recipientEmail, String accessUrl, 
                                                   String formName, String ownerEmail, 
                                                   LocalDateTime expiresAt, long hoursRemaining) {
        try {
            LOG.infof("📧 Envoi de notification d'expiration prochaine à: %s (expire dans %d heures)", 
                     recipientEmail, hoursRemaining);
            
            String subject = BASE_SUBJECT + " - Expiration prochaine";
            
            // Formater la date d'expiration
            String expiresAtFormatted = expiresAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm"));
            
            // Calculer les jours et heures restants
            long daysRemaining = hoursRemaining / 24;
            long hoursRemainingMod = hoursRemaining % 24;
            
            // Construire le message de temps restant
            String timeRemainingMessage;
            if (daysRemaining > 0) {
                String daysText = daysRemaining > 1 ? "s" : "";
                if (hoursRemainingMod > 0) {
                    String hoursText = hoursRemainingMod > 1 ? "s" : "";
                    timeRemainingMessage = String.format(
                        "<p style=\"margin: 5px 0; color: #ff9800; font-weight: bold; font-size: 16px;\">" +
                        "⚠️ Il reste %d jour%s et %d heure%s avant l'expiration</p>",
                        daysRemaining, daysText, hoursRemainingMod, hoursText);
                } else {
                    timeRemainingMessage = String.format(
                        "<p style=\"margin: 5px 0; color: #ff9800; font-weight: bold; font-size: 16px;\">" +
                        "⚠️ Il reste %d jour%s avant l'expiration</p>",
                        daysRemaining, daysText);
                }
            } else {
                String hoursText = hoursRemaining > 1 ? "s" : "";
                timeRemainingMessage = String.format(
                    "<p style=\"margin: 5px 0; color: #ff9800; font-weight: bold; font-size: 16px;\">" +
                    "⚠️ Il reste %d heure%s avant l'expiration</p>",
                    hoursRemaining, hoursText);
            }
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("recipientEmail", recipientEmail);
            variables.put("accessUrl", accessUrl);
            variables.put("formName", formName != null ? formName : "Partage de données");
            variables.put("ownerEmail", ownerEmail);
            variables.put("expiresAtFormatted", expiresAtFormatted);
            variables.put("timeRemainingMessage", timeRemainingMessage);
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("access-expiring", recipientEmail, subject, variables);
            
            LOG.infof("✅ Email de notification d'expiration envoyé avec succès à: %s", recipientEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email de notification d'expiration à: %s", recipientEmail);
            // Ne pas faire échouer le processus si l'email échoue
        }
    }
    
    /**
     * Envoie un email d'avertissement de suppression pour un partage inactif
     * 
     * @param ownerEmail Email du propriétaire du partage
     * @param shareName Nom du partage (formName ou fileName)
     * @param createdAt Date de création du partage
     * @param updatedAt Date de dernière modification
     * @param monthsInactive Nombre de mois d'inactivité
     * @param daysRemaining Nombre de jours avant suppression
     * @param deletionDate Date prévue de suppression
     * @param manageSharesUrl URL pour gérer les partages
     */
    public void sendShareDeletionWarning(String ownerEmail, String shareName, 
                                       LocalDateTime createdAt, LocalDateTime updatedAt,
                                       int monthsInactive, int daysRemaining, 
                                       LocalDateTime deletionDate, String manageSharesUrl) {
        try {
            LOG.infof("📧 Envoi d'avertissement de suppression à: %s pour le partage: %s", ownerEmail, shareName);
            
            String subject = BASE_SUBJECT + " - Avertissement de suppression";
            
            // Formater les dates
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm");
            String createdAtFormatted = createdAt.format(formatter);
            String updatedAtFormatted = updatedAt.format(formatter);
            String deletionDateFormatted = deletionDate.format(formatter);
            
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("shareName", shareName != null ? shareName : "Partage de données");
            variables.put("monthsInactive", String.valueOf(monthsInactive));
            variables.put("daysRemaining", String.valueOf(daysRemaining));
            variables.put("daysRemainingPlural", daysRemaining > 1 ? "s" : "");
            variables.put("createdAtFormatted", createdAtFormatted);
            variables.put("updatedAtFormatted", updatedAtFormatted);
            variables.put("deletionDateFormatted", deletionDateFormatted);
            variables.put("manageSharesUrl", manageSharesUrl);
            
            // Envoyer l'email templaté via le service email
            templateEmailServiceHelper.sendTemplatedEmail("share-deletion-warning", ownerEmail, subject, variables);
            
            LOG.infof("✅ Email d'avertissement de suppression envoyé avec succès à: %s", ownerEmail);
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email d'avertissement de suppression à: %s", ownerEmail);
            // Ne pas faire échouer le processus si l'email échoue
        }
    }
}
