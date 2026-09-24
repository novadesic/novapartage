package com.novadesic.novapartage.backend.service;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import java.util.Map;

/**
 * Client REST pour les templates d'emails (email-service)
 * Utilise le nouveau système de templates centralisé
 */
@RegisterRestClient(configKey = "email-service")
@RegisterClientHeaders
public interface TemplateEmailServiceClient {
    
    @POST
    @Path("/v3.1/templates/novapartage/send")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    Response sendTemplatedEmail(TemplateEmailRequest request);
    
    /**
     * Classe interne pour la requête d'email templaté
     */
    class TemplateEmailRequest {
        public String template;
        public String to;
        public String subject;
        public Map<String, String> variables;
        public TemplateOptions options;
        
        public static class TemplateOptions {
            public Boolean embedImages;
            public String imageFormat;
            public String textVersion;
        }
    }
    
    /**
     * Classe interne pour la réponse d'email templaté
     */
    class TemplateEmailResponse {
        public String status;
        public String messageId;
        public String template;
        public String templateGroup;
        public ProcessingInfo processing;
        public Metadata _metadata;
        
        public static class ProcessingInfo {
            public Integer imagesEmbedded;
            public String textVersion;
            public Integer htmlSize;
            public Integer textSize;
        }
        
        public static class Metadata {
            public String relay;
            public String relayType;
            public Boolean fallback;
        }
    }
    
    /**
     * Classe interne pour les erreurs
     */
    class TemplateEmailError {
        public String error;
        public String errorCode;
        public Integer statusCode;
    }
}

