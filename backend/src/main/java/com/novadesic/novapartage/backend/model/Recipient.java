package com.novadesic.novapartage.backend.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "recipients")
public class Recipient {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "share_id", nullable = false)
    @JsonIgnore
    public Share share;
    
    @Column(name = "email")
    public String email;
    
    @Column(name = "display_name")
    public String displayName;
    
    @Column(name = "selected_sheet_index")
    public int selectedSheetIndex = 0;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "selections", columnDefinition = "jsonb")
    public Map<String, List<CellSelection>> selections;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "editable_cells", columnDefinition = "jsonb")
    public Map<String, List<CellSelection>> editableCells;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_labels", columnDefinition = "jsonb")
    public Map<String, Map<String, String>> columnLabels;
    
    @Column(name = "page_title")
    public String pageTitle;
    
    @Column(name = "page_description", columnDefinition = "TEXT")
    public String pageDescription;
    
    @Column(name = "permission")
    public String permission;
    
    @Column(name = "allow_comments")
    public boolean allowComments;
    
    @Column(name = "allow_download")
    public boolean allowDownload;
    
    @Column(name = "has_accessed")
    public boolean hasAccessed;
    
    @Column(name = "last_accessed")
    public LocalDateTime lastAccessed;
    
    public Recipient() {
    }
    
    public Recipient(String email) {
        this.email = email;
        this.displayName = email;
        this.hasAccessed = false;
    }
    
    public void markAsAccessed() {
        this.hasAccessed = true;
        this.lastAccessed = LocalDateTime.now();
    }
    
    @Embeddable
    public static class CellSelection {
        public int row;
        public int col;
        
        public CellSelection() {
        }
        
        public CellSelection(int row, int col) {
            this.row = row;
            this.col = col;
        }
    }
} 
