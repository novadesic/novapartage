package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_encryption_keys")
public class UserEncryptionKey extends PanacheEntityBase {
    
    @Id
    @Column(name = "user_email")
    public String userEmail;
    
    @Column(name = "encrypted_key", columnDefinition = "BYTEA", nullable = false)
    public byte[] encryptedKey;
    
    @Column(name = "created_at")
    public LocalDateTime createdAt;
    
    @Column(name = "rotated_at")
    public LocalDateTime rotatedAt;
    
    @Column(name = "is_active")
    public boolean isActive = true;
    
    public UserEncryptionKey() {
        this.createdAt = LocalDateTime.now();
        this.isActive = true;
    }
    
    public static UserEncryptionKey findByUserEmail(String userEmail) {
        return find("userEmail = ?1 and isActive = ?2", userEmail, true).firstResult();
    }
}

