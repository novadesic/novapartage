package com.novadesic.novapartage.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Helper pour envoyer des emails via le service email
 */
@ApplicationScoped
public class EmailServiceHelper {
    
    private static final Logger LOG = Logger.getLogger(EmailServiceHelper.class);
    
    @Inject
    @RestClient
    EmailServiceClient emailServiceClient;
    
    /**
     * Envoie un email via le service email
     * 
     * @param to Email du destinataire
     * @param subject Sujet de l'email
     * @param htmlContent Contenu HTML
     * @param from Email expéditeur (optionnel, utilise SMTP_FROM par défaut)
     */
    public void sendEmail(String to, String subject, String htmlContent, String from) {
        try {
            String fromEmail = from != null ? from : getEmailFrom();
            
            EmailServiceClient.EmailRequest request = new EmailServiceClient.EmailRequest();
            request.Messages = new ArrayList<>();
            
            EmailServiceClient.EmailRequest.Message message = new EmailServiceClient.EmailRequest.Message();
            message.From = new EmailServiceClient.EmailRequest.From();
            message.From.Email = fromEmail;
            message.From.Name = "NovaPartage";
            
            message.To = new ArrayList<>();
            EmailServiceClient.EmailRequest.To toObj = new EmailServiceClient.EmailRequest.To();
            toObj.Email = to;
            toObj.Name = to.split("@")[0];
            message.To.add(toObj);
            
            message.Subject = subject;
            message.HTMLPart = htmlContent;
            message.TextPart = htmlContent.replaceAll("<[^>]*>", ""); // Extraire le texte
            
            request.Messages.add(message);
            
            try {
                var response = emailServiceClient.sendEmail(request);
                
                if (response.getStatus() >= 200 && response.getStatus() < 300) {
                    LOG.infof("✅ Email envoyé avec succès à: %s", to);
                } else {
                    try {
                        var error = response.readEntity(EmailServiceClient.EmailError.class);
                        LOG.errorf("❌ Erreur lors de l'envoi de l'email à %s: %s", to, error.ErrorMessage);
                        throw new RuntimeException("Erreur lors de l'envoi de l'email: " + error.ErrorMessage);
                    } catch (Exception e) {
                        LOG.errorf("❌ Erreur lors de l'envoi de l'email à %s (status: %d)", to, response.getStatus());
                        throw new RuntimeException("Erreur lors de l'envoi de l'email (status: " + response.getStatus() + ")");
                    }
                }
            } catch (jakarta.ws.rs.ProcessingException e) {
                LOG.errorf(e, "❌ Erreur de connexion au service email pour %s", to);
                throw new RuntimeException("Impossible de se connecter au service email", e);
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email à: %s", to);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        }
    }
    
    /**
     * Récupère l'adresse email de l'expéditeur depuis la configuration.
     * Extrait uniquement l'email si SMTP_FROM est au format "Name <email>".
     */
    private String getEmailFrom() {
        String from = System.getenv("SMTP_FROM");
        if (from == null || from.trim().isEmpty()) {
            return "no-reply@novapartage.fr";
        }
        // Extraire uniquement l'email si format "Name <email>"
        Pattern p = Pattern.compile("^.+?\\s+<([^>]+)>$");
        Matcher m = p.matcher(from.trim());
        return m.matches() ? m.group(1).trim() : from.trim();
    }
}

