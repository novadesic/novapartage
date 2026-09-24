package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "share_access_tabdata", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"share_id", "recipient_email"}))
public class ShareAccessTabdata extends PanacheEntityBase {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "share_id")
    public UUID shareId;
    
    @Column(name = "temp_file_id")
    public String tempFileId;
    
    @Column(name = "recipient_email")
    public String recipientEmail;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "headers", columnDefinition = "JSONB")
    public String headers; // JSON sérialisé de la List<String> des en-têtes
    
    @Column(name = "file_fingerprint")
    public String fileFingerprint;
    
    @Column(name = "schema_version")
    public String schemaVersion;
    
    @Column(name = "computed_at")
    public LocalDateTime computedAt;
    
    @Column(name = "updated_at")
    public LocalDateTime updatedAt;
    
    @Column(name = "expires_at")
    public LocalDateTime expiresAt;
    
    @Column(name = "is_compressed")
    public boolean isCompressed;
    
    @Column(name = "original_size")
    public long originalSize;
    
    @Column(name = "total_rows")
    public int totalRows;
    
    @Column(name = "selections_hash")
    public String selectionsHash; // Hash des sélections et editableCells pour détecter les changements
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "formula_cells", columnDefinition = "JSONB")
    public String formulaCells; // JSON sérialisé de la List des positions des cellules formules [{row, col}, ...]
    
    public ShareAccessTabdata() {
        this.computedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.schemaVersion = "1.0";
        this.isCompressed = false;
        this.originalSize = 0;
        this.totalRows = 0;
    }
    
    public void updateTimestamp() {
        this.updatedAt = LocalDateTime.now();
    }
    
    public boolean isStale() {
        if (this.tempFileId != null && this.expiresAt != null) {
            return LocalDateTime.now().isAfter(this.expiresAt);
        }
        return updatedAt.isBefore(LocalDateTime.now().minusHours(24));
    }
    
    public boolean isConsistentWithFile(String currentFileFingerprint) {
        return this.fileFingerprint != null && 
               this.fileFingerprint.equals(currentFileFingerprint);
    }
    
    public boolean isTemporary() {
        return this.tempFileId != null && this.shareId == null;
    }
}
