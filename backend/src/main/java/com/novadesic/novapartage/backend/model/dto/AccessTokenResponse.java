package com.novadesic.novapartage.backend.model.dto;

import com.novadesic.novapartage.backend.model.AccessToken;
import java.time.LocalDateTime;

public class AccessTokenResponse {
    
    public String id;
    public String shareId;
    public String recipientEmail;
    public String accessUrl;
    public int validityDays;
    public LocalDateTime createdAt;
    public LocalDateTime expiresAt;
    public String status;
    public LocalDateTime lastUsedAt;
    public int usageCount;
    public String createdBy;
    
    // Informations enrichies du partage
    public String ownerUsername;
    public String ownerEmail;
    public String fileName;
    public String originalFileName;
    
    // Informations personnalisées du destinataire
    public String pageTitle;
    public String pageDescription;
    
    public AccessTokenResponse() {}
    
    public AccessTokenResponse(AccessToken token, String baseUrl) {
        this.id = token.id.toString();
        this.shareId = token.shareId.toString();
        this.recipientEmail = token.recipientEmail;
        this.accessUrl = baseUrl + "/access/" + token.token;
        this.validityDays = token.validityDays;
        this.createdAt = token.createdAt;
        this.expiresAt = token.expiresAt;
        this.status = token.status.name();
        this.lastUsedAt = token.lastUsedAt;
        this.usageCount = token.usageCount;
        this.createdBy = token.createdBy;
    }
    
    public AccessTokenResponse(AccessToken token) {
        this.id = token.id.toString();
        this.shareId = token.shareId.toString();
        this.recipientEmail = token.recipientEmail;
        this.validityDays = token.validityDays;
        this.createdAt = token.createdAt;
        this.expiresAt = token.expiresAt;
        this.status = token.status.name();
        this.lastUsedAt = token.lastUsedAt;
        this.usageCount = token.usageCount;
        this.createdBy = token.createdBy;
    }
} 