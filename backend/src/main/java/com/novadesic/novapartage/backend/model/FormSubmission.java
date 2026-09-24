package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "form_submissions")
public class FormSubmission extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "share_id")
    public UUID shareId;
    
    @Column(name = "recipient_email")
    public String recipientEmail;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submitted_values", columnDefinition = "jsonb")
    public Map<String, String> submittedValues;
    
    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;
    
    @Column(name = "last_modified_at")
    public LocalDateTime lastModifiedAt;
    
    @Column(name = "is_active")
    public boolean isActive = true;
    
    public FormSubmission() {}
    
    public FormSubmission(UUID shareId, String recipientEmail, Map<String, String> submittedValues) {
        this.shareId = shareId;
        this.recipientEmail = recipientEmail;
        this.submittedValues = submittedValues;
        this.submittedAt = LocalDateTime.now();
        this.lastModifiedAt = LocalDateTime.now();
    }
    
    public static FormSubmission findByShareAndRecipient(UUID shareId, String recipientEmail) {
        return find("shareId = ?1 and recipientEmail = ?2 and isActive = ?3", 
                   shareId, recipientEmail, true).firstResult();
    }
    
    public void updateValues(Map<String, String> newValues) {
        this.submittedValues.putAll(newValues);
        this.lastModifiedAt = LocalDateTime.now();
    }
} 
