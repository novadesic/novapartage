package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "access_tokens")
public class AccessToken extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "share_id")
    public UUID shareId;
    
    @Column(name = "recipient_email")
    public String recipientEmail;
    
    @Column(name = "token", unique = true)
    public String token;
    
    @Column(name = "validity_days")
    public int validityDays;
    
    @Column(name = "created_at")
    public LocalDateTime createdAt;
    
    @Column(name = "expires_at")
    public LocalDateTime expiresAt;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    public TokenStatus status;
    
    @Column(name = "last_used_at")
    public LocalDateTime lastUsedAt;
    
    @Column(name = "usage_count")
    public int usageCount;
    
    @Column(name = "created_by")
    public String createdBy;
    
    @Column(name = "validated_at")
    public LocalDateTime validatedAt;
    
    @Column(name = "validated_by")
    public String validatedBy;
    
    public enum TokenStatus {
        ACTIVE, EXPIRED, REVOKED, USED, VALIDATED
    }
    
    public AccessToken() {}
    
    public AccessToken(UUID shareId, String recipientEmail, String token, int validityDays, String createdBy) {
        this.shareId = shareId;
        this.recipientEmail = recipientEmail;
        this.token = token;
        this.validityDays = validityDays;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
        this.expiresAt = this.createdAt.plusDays(validityDays);
        this.status = TokenStatus.ACTIVE;
        this.usageCount = 0;
    }
    
    public boolean isActive() {
        return status == TokenStatus.ACTIVE && LocalDateTime.now().isBefore(expiresAt);
    }
    
    public boolean isReadable() {
        if (status == TokenStatus.VALIDATED) {
            return true;
        }
        return status == TokenStatus.ACTIVE && LocalDateTime.now().isBefore(expiresAt);
    }
    
    public boolean isEditable() {
        return status == TokenStatus.ACTIVE && LocalDateTime.now().isBefore(expiresAt);
    }
    
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
    
    public void markAsUsed() {
        this.lastUsedAt = LocalDateTime.now();
        this.usageCount++;
    }
    
    public void revoke() {
        this.status = TokenStatus.REVOKED;
    }
    
    public void expire() {
        this.status = TokenStatus.EXPIRED;
    }
    
    public void validate() {
        this.status = TokenStatus.VALIDATED;
        this.validatedAt = LocalDateTime.now();
        this.validatedBy = this.recipientEmail;
    }
    
    public void validate(String validatedBy) {
        this.status = TokenStatus.VALIDATED;
        this.validatedAt = LocalDateTime.now();
        this.validatedBy = validatedBy;
    }
    
    // Méthodes Panache
    public static AccessToken findByToken(String token) {
        return find("token", token).firstResult();
    }
    
    public static java.util.List<AccessToken> findByShareId(UUID shareId) {
        return list("shareId", shareId);
    }
    
    public static java.util.List<AccessToken> findByShareIdAndRecipient(UUID shareId, String recipientEmail) {
        return list("shareId = ?1 and recipientEmail = ?2", shareId, recipientEmail);
    }
    
    public static java.util.List<AccessToken> findActiveByShareId(UUID shareId) {
        return list("shareId = ?1 and status = ?2", shareId, TokenStatus.ACTIVE);
    }
    
    public static java.util.List<AccessToken> findExpiredTokens() {
        return list("expiresAt < ?1 and status = ?2", LocalDateTime.now(), TokenStatus.ACTIVE);
    }
    
    public static java.util.List<AccessToken> findByRecipientEmail(String recipientEmail) {
        return list("recipientEmail", recipientEmail);
    }
    
    public static java.util.List<AccessToken> findActiveByRecipientEmail(String recipientEmail) {
        return list("recipientEmail = ?1 and status = ?2", recipientEmail, TokenStatus.ACTIVE);
    }
    
    public static long countActiveByShareId(UUID shareId) {
        return count("shareId = ?1 and status = ?2", shareId, TokenStatus.ACTIVE);
    }
    
    /**
     * Supprime les tokens expirés ou révoqués après 90 jours de conservation
     * Cette durée permet la traçabilité et l'audit tout en respectant le RGPD
     * @return Nombre de tokens supprimés
     */
    public static int deleteExpiredTokens() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
        return (int) delete("expiresAt < ?1 AND status IN (?2, ?3)", 
                           cutoff, TokenStatus.EXPIRED, TokenStatus.REVOKED);
    }
    
    /**
     * Supprime les tokens validés après 1 an de conservation
     * @return Nombre de tokens supprimés
     */
    public static int deleteValidatedTokens() {
        LocalDateTime cutoff = LocalDateTime.now().minusYears(1);
        return (int) delete("status = ?1 AND validatedAt < ?2", 
                           TokenStatus.VALIDATED, cutoff);
    }
    
    /**
     * Trouve les tokens actifs qui expirent dans un délai donné (en heures)
     * @param hoursFromNow Nombre d'heures à partir de maintenant
     * @param toleranceMinutes Tolérance en minutes pour la fenêtre de recherche (ex: 60 pour ±1h)
     * @return Liste des tokens expirant dans le délai spécifié
     */
    public static java.util.List<AccessToken> findTokensExpiringInHours(int hoursFromNow, int toleranceMinutes) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime targetTime = now.plusHours(hoursFromNow);
        LocalDateTime minTime = targetTime.minusMinutes(toleranceMinutes);
        LocalDateTime maxTime = targetTime.plusMinutes(toleranceMinutes);
        
        return list("status = ?1 and expiresAt >= ?2 and expiresAt <= ?3", 
                   TokenStatus.ACTIVE, minTime, maxTime);
    }
    
    /**
     * Trouve les tokens actifs qui expirent dans un délai donné (en heures)
     * Version simplifiée avec tolérance par défaut de 60 minutes
     */
    public static java.util.List<AccessToken> findTokensExpiringInHours(int hoursFromNow) {
        return findTokensExpiringInHours(hoursFromNow, 60);
    }
} 
