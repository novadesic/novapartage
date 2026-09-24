package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "shares")
public class Share extends PanacheEntityBase {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "file_name")
    public String fileName;
    
    @Column(name = "original_file_name")
    public String originalFileName;
    
    @Column(name = "file_path")
    public String filePath;
    
    @Column(name = "file_extension")
    public String fileExtension;
    
    @Column(name = "file_size")
    public long fileSize;
    
    @Column(name = "owner_username")
    public String ownerUsername;
    
    @Column(name = "owner_email")
    public String ownerEmail;
    
    @Column(name = "selected_sheet")
    public String selectedSheet;
    
    @Column(name = "selected_sheet_index")
    public int selectedSheetIndex;
    
    @Column(name = "header_row")
    public int headerRow;
    
    @Column(name = "data_start_row")
    public int dataStartRow;
    
    @Column(name = "column_range")
    public String columnRange;
    
    @Column(name = "include_formulas")
    public boolean includeFormulas;
    
    @Column(name = "preserve_formatting")
    public boolean preserveFormatting;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detected_fields", columnDefinition = "jsonb")
    public List<String> detectedFields;
    
    @OneToMany(mappedBy = "share", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<Recipient> recipients;
    
    @Column(name = "selected_permission")
    public String selectedPermission;
    
    @Column(name = "allow_comments")
    public boolean allowComments;
    
    @Column(name = "allow_download")
    public boolean allowDownload;
    
    @Column(name = "created_at")
    public LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    public ShareStatus status;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "headers", columnDefinition = "jsonb")
    public List<String> headers;
    
    @Column(name = "total_rows")
    public int totalRows;
    
    @Column(name = "total_columns")
    public int totalColumns;
    
    @Column(name = "file_fingerprint")
    public String fileFingerprint;
    
    @Column(name = "tabdata_schema_version")
    public String tabdataSchemaVersion;
    
    @Column(name = "deletion_notification_sent")
    public Boolean deletionNotificationSent = false;
    
    @Column(name = "is_encrypted")
    public Boolean isEncrypted = false;
    
    @Column(name = "encryption_key_id")
    public String encryptionKeyId;  // null pour fichiers non chiffrés, email utilisateur pour fichiers chiffrés
    
    public Share() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.status = ShareStatus.NEW;
        this.deletionNotificationSent = false;
        this.isEncrypted = false;
    }
    
    public void updateTimestamp() {
        this.updatedAt = LocalDateTime.now();
    }
    
    public void finalizeShare() {
        if (this.status == ShareStatus.NEW) {
            this.status = ShareStatus.ACTIVE;
            this.updateTimestamp();
        }
    }
    
    public boolean isFinalized() {
        return this.status == ShareStatus.ACTIVE;
    }
    
    public boolean isNew() {
        return this.status == ShareStatus.NEW;
    }
    
    // Méthodes de recherche Panache
    public static List<Share> findByOwner(String username) {
        return list("ownerUsername", username);
    }
    
    public static List<Share> findByRecipient(String email) {
        return find("SELECT DISTINCT s FROM Share s JOIN s.recipients r WHERE r.email = ?1", email).list();
    }
    
    public static List<Share> findActiveShares() {
        return list("status", ShareStatus.ACTIVE);
    }
    
    public static List<Share> findNewShares() {
        return list("status", ShareStatus.NEW);
    }
    
    public static List<Share> findNewSharesByOwner(String ownerUsername) {
        return list("status = ?1 and ownerUsername = ?2", ShareStatus.NEW, ownerUsername);
    }
    
    public static Share findByIdAndOwner(UUID id, String ownerUsername) {
        return find("id = ?1 and ownerUsername = ?2", id, ownerUsername).firstResult();
    }
    
    public enum ShareStatus {
        NEW, ACTIVE, INACTIVE, DELETED, FINISHED
    }
} 
