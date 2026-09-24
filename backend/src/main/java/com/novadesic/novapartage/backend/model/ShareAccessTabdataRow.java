package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Entity
@Table(name = "share_access_tabdata_row",
       indexes = {
           @Index(name = "idx_tabdata_id", columnList = "tabdata_id"),
           @Index(name = "idx_tabdata_row_index", columnList = "tabdata_id, row_index"),
           @Index(name = "idx_searchable_text", columnList = "searchable_text")
       })
public class ShareAccessTabdataRow extends PanacheEntityBase {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @Column(name = "tabdata_id", nullable = false)
    public UUID tabdataId;
    
    @Column(name = "row_index", nullable = false)
    public int rowIndex;
    
    // Changé de String/JSONB à BYTEA pour stocker les données chiffrées ou non chiffrées
    @Lob
    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "row_data", nullable = false, columnDefinition = "BYTEA")
    public byte[] rowData; // Données chiffrées (si isEncrypted=true) ou JSON non chiffré (rétrocompatibilité)
    
    @Column(name = "searchable_text", columnDefinition = "TEXT")
    public String searchableText; // Texte concaténé de toutes les valeurs pour la recherche
    
    @Column(name = "is_encrypted", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    public Boolean isEncrypted = false;
    
    @Column(name = "encryption_key_id")
    public String encryptionKeyId; // null pour données non chiffrées, email utilisateur pour données chiffrées
    
    public ShareAccessTabdataRow() {
        this.isEncrypted = false;
    }
    
    /**
     * Constructeur pour données non chiffrées (rétrocompatibilité)
     */
    public ShareAccessTabdataRow(UUID tabdataId, int rowIndex, String rowDataJson, String searchableText) {
        this.tabdataId = tabdataId;
        this.rowIndex = rowIndex;
        this.rowData = rowDataJson.getBytes(StandardCharsets.UTF_8);
        this.searchableText = searchableText;
        this.isEncrypted = false;
        this.encryptionKeyId = null;
    }
    
    /**
     * Constructeur pour données chiffrées
     */
    public ShareAccessTabdataRow(UUID tabdataId, int rowIndex, byte[] rowDataEncrypted, 
                                 String searchableText, String encryptionKeyId) {
        this.tabdataId = tabdataId;
        this.rowIndex = rowIndex;
        this.rowData = rowDataEncrypted;
        this.searchableText = searchableText;
        this.isEncrypted = true;
        this.encryptionKeyId = encryptionKeyId;
    }
}

