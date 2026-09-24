package com.novadesic.novapartage.backend.model.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class FormAccessData {
    
    // Informations du partage
    public String shareId;
    public String fileName;
    public String originalFileName;
    public String ownerUsername;
    public String ownerEmail;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    public LocalDateTime createdAt;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    public LocalDateTime expiresAt;
    public String recipientEmail;
    
    // Configuration du formulaire
    public String pageTitle;
    public String pageDescription;
    
    // Données du tableau
    public List<Map<String, Object>> tableData; // Données fusionnées (originales + soumises)
    public List<Map<String, Object>> originalTableData; // Données originales d'Excel (pour détecter les modifications)
    public Map<String, String> columnLabels;
    
    // Configuration des cellules
    public List<CellPosition> tableDataEditableCells;
    public List<CellPosition> tableDataFormulaCells; // Cellules contenant des formules (valeur calculée)
    
    // Métadonnées
    public int totalRows;
    public int totalColumns;
    
    // Statut du token
    public String tokenStatus;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    public LocalDateTime validatedAt;
    
    public FormAccessData() {
    }
    
    public static class CellPosition {
        public int row;
        public String col; // Changé de int à String pour contenir le nom de la colonne
        
        public CellPosition() {
        }
        
        public CellPosition(int row, String col) {
            this.row = row;
            this.col = col;
        }
    }
} 