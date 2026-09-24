package com.novadesic.novapartage.backend.model.dto;

import com.novadesic.novapartage.backend.model.Recipient;
import com.novadesic.novapartage.backend.model.Share;

import java.time.LocalDateTime;
import java.util.List;

public class ShareResponse {
    
    public String id;
    public String fileName;
    public String originalFileName;
    public String fileExtension;
    public long fileSize;
    
    // Propriétaire
    public String ownerUsername;
    public String ownerEmail;
    
    // Configuration des données
    public String selectedSheet;
    public int headerRow;
    public int dataStartRow;
    public String columnRange;
    public boolean includeFormulas;
    public boolean preserveFormatting;
    public List<String> detectedFields;
    
    // Destinataires
    public List<Recipient> recipients;
    
    // Permissions
    public String selectedPermission;
    public boolean allowComments;
    public boolean allowDownload;
    
    // Métadonnées
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public String status;
    
    // Données Excel
    public List<String> headers;
    public int totalRows;
    public int totalColumns;
    
    // Données Excel complètes (pour les partages en statut NEW)
    public Object excelData;
    
    // Statistiques des tokens d'accès
    public int activeTokensCount;
    public int expiredTokensCount;
    
    public ShareResponse() {
    }
    
    public ShareResponse(Share share) {
        this.id = share.id.toString();
        this.fileName = share.fileName;
        this.originalFileName = share.originalFileName;
        this.fileExtension = share.fileExtension;
        this.fileSize = share.fileSize;
        
        this.ownerUsername = share.ownerUsername;
        this.ownerEmail = share.ownerEmail;
        
        this.selectedSheet = share.selectedSheet;
        this.headerRow = share.headerRow;
        this.dataStartRow = share.dataStartRow;
        this.columnRange = share.columnRange;
        this.includeFormulas = share.includeFormulas;
        this.preserveFormatting = share.preserveFormatting;
        this.detectedFields = share.detectedFields;
        
        this.recipients = share.recipients;
        
        this.selectedPermission = share.selectedPermission;
        this.allowComments = share.allowComments;
        this.allowDownload = share.allowDownload;
        
        this.createdAt = share.createdAt;
        this.updatedAt = share.updatedAt;
        this.status = share.status.toString();
        
        this.headers = share.headers;
        this.totalRows = share.totalRows;
        this.totalColumns = share.totalColumns;
    }
    
    // Version light pour les listes
    public static ShareResponse forList(Share share) {
        ShareResponse response = new ShareResponse();
        response.id = share.id.toString();
        response.fileName = share.fileName;
        response.originalFileName = share.originalFileName;
        response.ownerUsername = share.ownerUsername;
        response.createdAt = share.createdAt;
        response.updatedAt = share.updatedAt;
        response.status = share.status.toString();
        response.recipients = share.recipients;
        return response;
    }
} 