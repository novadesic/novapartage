package com.novadesic.novapartage.backend.service;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import java.util.List;

/**
 * Client REST pour le service email (email-service)
 * Remplace l'utilisation directe de Quarkus Mailer
 */
@RegisterRestClient(configKey = "email-service")
@RegisterClientHeaders
public interface EmailServiceClient {
    
    @POST
    @Path("/v3.1/send")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    Response sendEmail(EmailRequest request);
    
    /**
     * Classe interne pour la requête email (format Mailjet v3.1)
     */
    class EmailRequest {
        public List<Message> Messages;
        
        public static class Message {
            public From From;
            public List<To> To;
            public String Subject;
            public String HTMLPart;
            public String TextPart;
        }
        
        public static class From {
            public String Email;
            public String Name;
        }
        
        public static class To {
            public String Email;
            public String Name;
        }
    }
    
    /**
     * Classe interne pour la réponse email
     */
    class EmailResponse {
        public List<MessageResponse> Messages;
        public Metadata _metadata;
        
        public static class MessageResponse {
            public String Status;
            public List<ToResponse> To;
        }
        
        public static class ToResponse {
            public String Email;
            public String MessageID;
        }
        
        public static class Metadata {
            public String relay;
            public String relayType;
        }
    }
    
    /**
     * Classe interne pour les erreurs
     */
    class EmailError {
        public String ErrorMessage;
        public String ErrorIdentifier;
        public Integer StatusCode;
    }
}

