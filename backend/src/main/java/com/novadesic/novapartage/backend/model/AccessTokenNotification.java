package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Table de suivi des notifications d'expiration envoyées pour les AccessToken
 * Permet d'éviter les doublons et de suivre quelles notifications ont été envoyées
 */
@Entity
@Table(name = "access_token_notifications", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"access_token_id", "notification_delta_hours"}))
public class AccessTokenNotification extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "access_token_id", nullable = false)
    public UUID accessTokenId;
    
    @Column(name = "notification_delta_hours", nullable = false)
    public int notificationDeltaHours; // Nombre d'heures avant expiration (ex: 72 pour 3 jours, 24 pour 1 jour)
    
    @Column(name = "sent_at", nullable = false)
    public LocalDateTime sentAt;
    
    @Column(name = "recipient_email", nullable = false)
    public String recipientEmail;
    
    public AccessTokenNotification() {}
    
    public AccessTokenNotification(UUID accessTokenId, int notificationDeltaHours, String recipientEmail) {
        this.accessTokenId = accessTokenId;
        this.notificationDeltaHours = notificationDeltaHours;
        this.recipientEmail = recipientEmail;
        this.sentAt = LocalDateTime.now();
    }
    
    /**
     * Vérifie si une notification a déjà été envoyée pour un token et un delta donné
     */
    public static boolean hasNotificationBeenSent(UUID accessTokenId, int notificationDeltaHours) {
        return count("accessTokenId = ?1 and notificationDeltaHours = ?2", 
                    accessTokenId, notificationDeltaHours) > 0;
    }
    
    /**
     * Enregistre qu'une notification a été envoyée
     */
    public static void markNotificationSent(UUID accessTokenId, int notificationDeltaHours, String recipientEmail) {
        AccessTokenNotification notification = new AccessTokenNotification(
            accessTokenId, notificationDeltaHours, recipientEmail);
        notification.persist();
    }
    
    /**
     * Supprime les anciennes notifications (nettoyage)
     */
    public static void deleteOldNotifications(LocalDateTime beforeDate) {
        delete("sentAt < ?1", beforeDate);
    }
}

