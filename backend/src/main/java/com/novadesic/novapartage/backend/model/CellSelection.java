package com.novadesic.novapartage.backend.model;

public class CellSelection {
    
    public int row;
    public int col;
    
    public CellSelection() {
    }
    
    public CellSelection(int row, int col) {
        this.row = row;
        this.col = col;
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        CellSelection that = (CellSelection) obj;
        return row == that.row && col == that.col;
    }
    
    @Override
    public int hashCode() {
        return 31 * row + col;
    }
    
    @Override
    public String toString() {
        return String.format("CellSelection{row=%d, col=%d}", row, col);
    }
    
    // Méthodes utilitaires
    public String toCellAddress() {
        // Convertir en adresse Excel (ex: A1, B2, etc.)
        char colLetter = (char) ('A' + col);
        return colLetter + String.valueOf(row + 1);
    }
    
    public static CellSelection fromCellAddress(String address) {
        // Convertir depuis une adresse Excel (ex: "A1" -> row=0, col=0)
        if (address == null || address.length() < 2) {
            throw new IllegalArgumentException("Invalid cell address: " + address);
        }
        
        char colChar = address.charAt(0);
        int col = colChar - 'A';
        int row = Integer.parseInt(address.substring(1)) - 1;
        
        return new CellSelection(row, col);
    }
} 