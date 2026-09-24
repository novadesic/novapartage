package com.novadesic.novapartage.backend.service;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import org.jboss.logging.Logger;

import java.util.Map;

/**
 * Mock du TemplateEmailServiceHelper pour les tests
 * Évite les tentatives de connexion au service email réel
 * 
 * Utilise @Alternative avec @Priority pour remplacer le bean réel en test
 */
@ApplicationScoped
@Alternative
@Priority(1)
public class MockTemplateEmailServiceHelper extends TemplateEmailServiceHelper {
    
    private static final Logger LOG = Logger.getLogger(MockTemplateEmailServiceHelper.class);
    
    @Override
    public void sendTemplatedEmail(String template, String to, String subject, Map<String, String> variables) {
        // Mock : ne fait rien, juste log pour les tests
        // Ne pas appeler super.sendTemplatedEmail() pour éviter la connexion réelle au service email
        LOG.infof("📧 [MOCK] Envoi d'email templaté ignoré pour les tests - Template: %s, To: %s, Subject: %s", 
                 template, to, subject);
    }
}

