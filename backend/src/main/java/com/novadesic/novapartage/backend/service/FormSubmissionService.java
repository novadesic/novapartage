package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.FormSubmission;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class FormSubmissionService {
    
    private static final Logger LOG = Logger.getLogger(FormSubmissionService.class);
    
    /**
     * Sauvegarde ou met à jour les données soumises par un destinataire
     */
    @Transactional
    public boolean saveFormSubmission(String shareId, String recipientEmail, Map<String, Object> formData) {
        try {
            LOG.infof("💾 Sauvegarde des données soumises pour shareId=%s, recipientEmail=%s", shareId, recipientEmail);
            
            // Convertir les données du format frontend vers le format de stockage
            Map<String, String> submittedValues = convertFormDataToSubmittedValues(formData);
            
            // Chercher une soumission existante
            UUID shareUuid = UUID.fromString(shareId);
            FormSubmission existingSubmission = FormSubmission.findByShareAndRecipient(shareUuid, recipientEmail);
            
            if (existingSubmission != null) {
                // Mettre à jour la soumission existante en fusionnant les valeurs
                LOG.infof("📝 Mise à jour de la soumission existante (fusion des valeurs)");
                existingSubmission.updateValues(submittedValues);
                existingSubmission.persist();
            } else {
                // Créer une nouvelle soumission
                LOG.infof("🆕 Création d'une nouvelle soumission");
                FormSubmission newSubmission = new FormSubmission(shareUuid, recipientEmail, submittedValues);
                newSubmission.persist();
            }
            
            LOG.infof("✅ Données soumises sauvegardées avec succès");
            return true;
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la sauvegarde des données soumises");
            return false;
        }
    }
    
    /**
     * Récupère les données soumises par un destinataire
     */
    public Map<String, String> getFormSubmission(String shareId, String recipientEmail) {
        try {
            LOG.infof("📖 Récupération des données soumises pour shareId=%s, recipientEmail=%s", shareId, recipientEmail);
            
            UUID shareUuid = UUID.fromString(shareId);
            FormSubmission submission = FormSubmission.findByShareAndRecipient(shareUuid, recipientEmail);
            
            if (submission != null) {
                LOG.infof("✅ Données soumises trouvées: %d valeurs", submission.submittedValues.size());
                LOG.infof("📖 Détail des données soumises: %s", submission.submittedValues);
                return submission.submittedValues;
            } else {
                LOG.infof("ℹ️ Aucune donnée soumise trouvée");
                return new HashMap<>();
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la récupération des données soumises");
            return new HashMap<>();
        }
    }
    
    /**
     * Convertit les données du format frontend vers le format de stockage
     * Format frontend: {"rowIndex-colIndex": "valeur"}
     * Format stockage: {"rowIndex-colIndex": "valeur"}
     */
    private Map<String, String> convertFormDataToSubmittedValues(Map<String, Object> formData) {
        LOG.infof("🔄 Conversion des données reçues du frontend: %s", formData);
        
        Map<String, String> submittedValues = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : formData.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            // Convertir la valeur en string (permettre les valeurs vides)
            String stringValue = value != null ? value.toString() : "";
            
            // Stocker toutes les valeurs, y compris les valeurs vides
            // Cela permet de sauvegarder explicitement une valeur vide
            submittedValues.put(key, stringValue);
            
            LOG.infof("🔄 Conversion: '%s' = '%s' -> '%s'", key, value, stringValue);
        }
        
        LOG.infof("🔄 Conversion des données terminée: %d valeurs converties (incluant les valeurs vides)", submittedValues.size());
        LOG.infof("🔄 Données converties: %s", submittedValues);
        return submittedValues;
    }
} 