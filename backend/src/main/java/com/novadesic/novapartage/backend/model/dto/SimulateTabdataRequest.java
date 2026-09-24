package com.novadesic.novapartage.backend.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * DTO pour la requête de simulation de tabdata
 * Utilisé pour générer les données de preview sans les sauvegarder en base
 */
public class SimulateTabdataRequest {
    
    @JsonProperty("tempFileId")
    public String tempFileId;
    
    @JsonProperty("shareId")
    public String shareId;
    
    @JsonProperty("recipientEmail")
    public String recipientEmail;
    
    @JsonProperty("selectedSheetIndex")
    public int selectedSheetIndex;
    
    @JsonProperty("selections")
    public Map<String, List<CellSelection>> selections;
    
    @JsonProperty("editableCells")
    public Map<String, List<CellSelection>> editableCells;
    
    @JsonProperty("columnLabels")
    public Map<String, Map<String, String>> columnLabels;
    
    /**
     * Représente une sélection de cellule
     */
    public static class CellSelection {
        @JsonProperty("row")
        public int row;
        
        @JsonProperty("col")
        public int col;
        
        public CellSelection() {}
        
        public CellSelection(int row, int col) {
            this.row = row;
            this.col = col;
        }
    }
    
    /**
     * Valide la requête
     */
    public boolean isValid() {
        boolean hasFileId = (tempFileId != null && !tempFileId.trim().isEmpty()) ||
                           (shareId != null && !shareId.trim().isEmpty());
        return hasFileId &&
               recipientEmail != null && !recipientEmail.trim().isEmpty() &&
               selectedSheetIndex >= 0;
    }
    
    /**
     * Retourne le message d'erreur de validation
     */
    public String getValidationError() {
        if ((tempFileId == null || tempFileId.trim().isEmpty()) &&
            (shareId == null || shareId.trim().isEmpty())) {
            return "tempFileId ou shareId est requis";
        }
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            return "recipientEmail est requis";
        }
        if (selectedSheetIndex < 0) {
            return "selectedSheetIndex doit être >= 0";
        }
        return null;
    }
}
