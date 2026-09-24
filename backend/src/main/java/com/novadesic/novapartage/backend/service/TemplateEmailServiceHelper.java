package com.novadesic.novapartage.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ProcessingException;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;

/**
 * Helper pour envoyer des emails templatés via email-service
 */
@ApplicationScoped
public class TemplateEmailServiceHelper {
    
    private static final Logger LOG = Logger.getLogger(TemplateEmailServiceHelper.class);
    
    @Inject
    @RestClient
    TemplateEmailServiceClient templateEmailServiceClient;
    
    /**
     * Envoie un email templaté
     * 
     * @param template Nom du template (ex: "access-created")
     * @param to Email du destinataire
     * @param subject Sujet de l'email (optionnel, généré automatiquement si null)
     * @param variables Variables pour le template
     */
    public void sendTemplatedEmail(String template, String to, String subject, Map<String, String> variables) {
        try {
            TemplateEmailServiceClient.TemplateEmailRequest request = 
                new TemplateEmailServiceClient.TemplateEmailRequest();
            request.template = template;
            request.to = to;
            request.subject = subject;
            request.variables = variables != null ? variables : new HashMap<>();
            request.options = new TemplateEmailServiceClient.TemplateEmailRequest.TemplateOptions();
            request.options.embedImages = true;
            request.options.imageFormat = "cid";
            request.options.textVersion = "auto";
            
            var response = templateEmailServiceClient.sendTemplatedEmail(request);
            
            if (response.getStatus() >= 200 && response.getStatus() < 300) {
                LOG.infof("✅ Email templaté envoyé avec succès à: %s (template: %s)", to, template);
            } else {
                try {
                    var error = response.readEntity(TemplateEmailServiceClient.TemplateEmailError.class);
                    LOG.errorf("❌ Erreur lors de l'envoi de l'email templaté à %s: %s", to, error.error);
                    throw new RuntimeException("Erreur lors de l'envoi de l'email templaté: " + error.error);
                } catch (Exception e) {
                    LOG.errorf("❌ Erreur lors de l'envoi de l'email templaté à %s (status: %d)", to, response.getStatus());
                    throw new RuntimeException("Erreur lors de l'envoi de l'email templaté (status: " + response.getStatus() + ")");
                }
            }
        } catch (jakarta.ws.rs.ProcessingException e) {
            LOG.errorf(e, "❌ Erreur de connexion au service email pour %s", to);
            throw new RuntimeException("Impossible de se connecter au service email", e);
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'envoi de l'email templaté à: %s", to);
            throw new RuntimeException("Erreur lors de l'envoi de l'email templaté", e);
        }
    }
}

