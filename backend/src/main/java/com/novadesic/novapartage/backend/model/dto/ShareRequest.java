package com.novadesic.novapartage.backend.model.dto;

import com.novadesic.novapartage.backend.model.Recipient;

import java.util.List;

public class ShareRequest {
    
    // Informations sur le fichier (nom original, l'upload s'est déjà fait)
    public String fileName;
    public String fileId; // ID temporaire du fichier uploadé
    
    // Configuration des données partagées
    public String selectedSheet;
    public int selectedSheetIndex; // Index de la feuille sélectionnée (0-based)
    public int headerRow;
    public int dataStartRow;
    public String columnRange;
    public boolean includeFormulas;
    public boolean preserveFormatting;
    public List<String> detectedFields;
    
    // Destinataires avec leurs configurations
    public List<Recipient> recipients;
    
    // Permissions globales
    public String selectedPermission; // 'read', 'edit-own', 'full'
    public boolean allowComments;
    public boolean allowDownload;
    
    // Données Excel pour validation
    public List<String> headers;
    public int totalRows;
    public int totalColumns;
    
    public ShareRequest() {
    }
    
    // Méthodes de validation
    public boolean isValid() {
        return fileName != null && !fileName.trim().isEmpty() &&
               fileId != null && !fileId.trim().isEmpty() &&
               recipients != null && !recipients.isEmpty() &&
               selectedPermission != null &&
               headers != null && !headers.isEmpty();
    }
    
    public String getValidationError() {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "Le nom du fichier est requis";
        }
        if (fileId == null || fileId.trim().isEmpty()) {
            return "L'ID du fichier est requis";
        }
        if (recipients == null || recipients.isEmpty()) {
            return "Au moins un destinataire est requis";
        }
        if (selectedPermission == null) {
            return "Les permissions sont requises";
        }
        if (headers == null || headers.isEmpty()) {
            return "Les en-têtes du fichier sont requises";
        }
        
        // Valider les emails des destinataires
        for (Recipient recipient : recipients) {
            if (recipient.email == null || recipient.email.trim().isEmpty()) {
                return "Tous les destinataires doivent avoir un email";
            }
            if (!isValidEmail(recipient.email)) {
                return "Email invalide: " + recipient.email;
            }
        }
        
        return null; // Aucune erreur
    }
    
    private boolean isValidEmail(String email) {
        return email != null && email.contains("@") && email.contains(".");
    }
} 