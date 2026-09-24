package com.novadesic.novapartage.backend.model;

import java.util.List;
import java.util.Map;

public class ExcelData {
    private String fileName;
    private List<String> headers;
    private List<Map<String, Object>> rows;
    private int totalRows;
    private int totalColumns;
    /** Cellules contenant des formules (row = index dans rows, col = "column-0", etc.) */
    private List<FormulaCellPosition> formulaCells;

    public ExcelData() {
    }

    public ExcelData(String fileName, List<String> headers, List<Map<String, Object>> rows) {
        this.fileName = fileName;
        this.headers = headers;
        this.rows = rows;
        this.totalRows = rows != null ? rows.size() : 0;
        this.totalColumns = headers != null ? headers.size() : 0;
    }

    public static class FormulaCellPosition {
        public int row;
        public String col;

        public FormulaCellPosition() {
        }

        public FormulaCellPosition(int row, String col) {
            this.row = row;
            this.col = col;
        }
    }

    // Getters et Setters
    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public List<String> getHeaders() {
        return headers;
    }

    public void setHeaders(List<String> headers) {
        this.headers = headers;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public void setRows(List<Map<String, Object>> rows) {
        this.rows = rows;
        this.totalRows = rows != null ? rows.size() : 0;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public int getTotalColumns() {
        return totalColumns;
    }

    public void setTotalColumns(int totalColumns) {
        this.totalColumns = totalColumns;
    }

    public List<FormulaCellPosition> getFormulaCells() {
        return formulaCells;
    }

    public void setFormulaCells(List<FormulaCellPosition> formulaCells) {
        this.formulaCells = formulaCells;
    }
} 