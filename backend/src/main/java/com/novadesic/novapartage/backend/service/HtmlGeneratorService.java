package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.dto.SecureFormAccessData;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@ApplicationScoped
public class HtmlGeneratorService {
    
    private static final Logger LOG = Logger.getLogger(HtmlGeneratorService.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMMM yyyy 'à' HH:mm", Locale.FRENCH);
    private static final DateTimeFormatter DATE_ONLY_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.FRENCH);
    
    /**
     * Génère le HTML du formulaire à partir des données du partage
     */
    public String generateFormHtml(SecureFormAccessData formData, String baseUrl) {
        try {
            List<String> columns = getOrderedColumns(formData.tableData);
            
            StringBuilder html = new StringBuilder();
            html.append("<!DOCTYPE html>\n");
            html.append("<html lang=\"fr\">\n");
            html.append("<head>\n");
            html.append("    <meta charset=\"UTF-8\" />\n");
            html.append("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n");
            html.append("    <title>").append(escapeHtml(formData.pageTitle != null ? formData.pageTitle : "Formulaire NovaPartage")).append("</title>\n");
            html.append("    <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css\" />\n");
            html.append(generateStyles());
            html.append("</head>\n");
            html.append("<body>\n");
            html.append("    <div class=\"container\">\n");
            html.append("        <div class=\"form-header\">\n");
            
            if (formData.pageTitle != null && !formData.pageTitle.trim().isEmpty()) {
                html.append("            <h1 class=\"form-title\">").append(escapeHtml(formData.pageTitle)).append("</h1>\n");
            }
            
            if (formData.pageDescription != null && !formData.pageDescription.trim().isEmpty()) {
                html.append("            <div class=\"form-description\">")
                    .append(sanitizeRichText(formData.pageDescription))
                    .append("</div>\n");
            }
            
            html.append("        </div>\n");
            html.append("        \n");
            html.append("        <div class=\"info-section\">\n");
            html.append("            <h4>Informations du partage</h4>\n");
            html.append("            <div class=\"info-item\">\n");
            html.append("                <span class=\"info-label\">Partagé par :</span> ").append(escapeHtml(formData.ownerEmail != null ? formData.ownerEmail : "Non spécifié")).append("\n");
            html.append("            </div>\n");
            html.append("            <div class=\"info-item\">\n");
            html.append("                <span class=\"info-label\">Partagé le :</span> ").append(formatDate(formData.createdAt)).append("\n");
            html.append("            </div>\n");
            html.append("            <div class=\"info-item\">\n");
            html.append("                <span class=\"info-label\">Destinataire :</span> ").append(escapeHtml(formData.recipientEmail != null ? formData.recipientEmail : "Non spécifié")).append("\n");
            html.append("            </div>\n");
            
            if (formData.validatedAt != null) {
                html.append("            <div class=\"info-item\">\n");
                html.append("                <span class=\"info-label\">Validé le :</span> ").append(formatDate(formData.validatedAt)).append("\n");
                html.append("            </div>\n");
            }
            
            if (formData.validatedBy != null && !formData.validatedBy.trim().isEmpty()) {
                html.append("            <div class=\"info-item\">\n");
                html.append("                <span class=\"info-label\">Validé par :</span> ").append(escapeHtml(formData.validatedBy)).append("\n");
                html.append("            </div>\n");
            }
            
            html.append("        </div>\n");
            html.append("        \n");
            html.append("        <div class=\"table-responsive\">\n");
            html.append("            <table class=\"table\">\n");
            html.append("                <thead>\n");
            html.append("                    <tr>\n");
            
            for (String col : columns) {
                html.append("                        <th>").append(escapeHtml(getColumnLabel(col, formData.columnLabels))).append("</th>\n");
            }
            
            html.append("                    </tr>\n");
            html.append("                </thead>\n");
            html.append("                <tbody>\n");
            
            if (formData.tableData != null) {
                for (int rowIndex = 0; rowIndex < formData.tableData.size(); rowIndex++) {
                    Map<String, Object> row = formData.tableData.get(rowIndex);
                    html.append("                    <tr>\n");
                    
                    for (String col : columns) {
                        boolean isEditable = isCellEditable(rowIndex, col, formData.tableDataEditableCells);
                        Object currentValueObj = row.get(col);
                        String currentValue = currentValueObj != null ? currentValueObj.toString() : "";
                        
                        String originalValue = "";
                        if (formData.originalTableData != null && rowIndex < formData.originalTableData.size()) {
                            Map<String, Object> originalRow = formData.originalTableData.get(rowIndex);
                            Object originalValueObj = originalRow.get(col);
                            originalValue = originalValueObj != null ? originalValueObj.toString() : "";
                        }
                        
                        boolean isModified = isEditable && !currentValue.equals(originalValue);
                        
                        String cellClass = "readonly-cell";
                        String indicator = "";
                        
                        if (isEditable) {
                            if (isModified) {
                                cellClass = "modified-cell";
                                indicator = "<span class=\"cell-indicator modified\"><i class=\"bi bi-pencil-square\" title=\"Valeur modifiée\"></i></span>";
                            } else {
                                cellClass = "editable-cell";
                            }
                        }
                        
                        html.append("                        <td class=\"").append(cellClass).append("\">\n");
                        html.append("                            ").append(escapeHtml(currentValue)).append("\n");
                        if (!indicator.isEmpty()) {
                            html.append("                            ").append(indicator).append("\n");
                        }
                        html.append("                        </td>\n");
                    }
                    
                    html.append("                    </tr>\n");
                }
            }
            
            html.append("                </tbody>\n");
            html.append("            </table>\n");
            html.append("        </div>\n");
            html.append("        \n");
            html.append("        <div class=\"form-footer\">\n");
            html.append("            <p>Formulaire généré le ").append(formatDateNow()).append("</p>\n");
            if (baseUrl != null && !baseUrl.isEmpty()) {
                html.append("            <p><a href=\"").append(escapeHtml(baseUrl)).append("\" target=\"_blank\" style=\"color: #6c757d; text-decoration: none;\">NovaPartage - Partagez vos données pas vos fichiers</a></p>\n");
            }
            html.append("        </div>\n");
            html.append("    </div>\n");
            html.append("</body>\n");
            html.append("</html>");
            
            return html.toString();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la génération du HTML");
            throw new RuntimeException("Erreur lors de la génération du HTML", e);
        }
    }
    
    private String generateStyles() {
        return "    <style>\n" +
               "        @page {\n" +
               "            margin: 20mm;\n" +
               "            size: A4;\n" +
               "        }\n" +
               "        \n" +
               "        @media print {\n" +
               "            thead { display: table-header-group; }\n" +
               "            tfoot { display: table-footer-group; }\n" +
               "        }\n" +
               "        \n" +
               "        * {\n" +
               "            box-sizing: border-box;\n" +
               "        }\n" +
               "        \n" +
               "        body {\n" +
               "            font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n" +
               "            line-height: 1.4;\n" +
               "            color: #212529;\n" +
               "            background-color: #f8f9fa;\n" +
               "            margin: 0;\n" +
               "            padding: 20px;\n" +
               "        }\n" +
               "        \n" +
               "        .container {\n" +
               "            max-width: 100%;\n" +
               "            margin: 0 auto;\n" +
               "            background: white;\n" +
               "            border-radius: 4px;\n" +
               "            box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);\n" +
               "            padding: 30px;\n" +
               "        }\n" +
               "        \n" +
               "        .form-header {\n" +
               "            text-align: center;\n" +
               "            border-bottom: 2px solid #e9ecef;\n" +
               "            padding-bottom: 10px;\n" +
               "            margin-bottom: 15px;\n" +
               "        }\n" +
               "        \n" +
               "        .form-title {\n" +
               "            color: #2c3e50;\n" +
               "            margin-bottom: 10px;\n" +
               "            font-size: 2rem;\n" +
               "            font-weight: 600;\n" +
               "        }\n" +
               "        \n" +
               "        .form-description {\n" +
               "            color: #6c757d;\n" +
               "            font-size: 1.1rem;\n" +
               "            margin-bottom: 15px;\n" +
               "            text-align: left;\n" +
               "        }\n" +
               "        \n" +
               "        .table-responsive {\n" +
               "            overflow-x: auto;\n" +
               "        }\n" +
               "        \n" +
               "        .table {\n" +
               "            width: 100%;\n" +
               "            margin-bottom: 1rem;\n" +
               "            color: #212529;\n" +
               "            border-collapse: collapse;\n" +
               "            table-layout: fixed;\n" +
               "        }\n" +
               "        \n" +
               "        .table th,\n" +
               "        .table td {\n" +
               "            padding: 0.75rem;\n" +
               "            vertical-align: top;\n" +
               "            border-top: 1px solid #dee2e6;\n" +
               "            border-left: 1px solid #dee2e6;\n" +
               "            border-right: 1px solid #dee2e6;\n" +
               "            word-wrap: break-word;\n" +
               "            overflow-wrap: break-word;\n" +
               "            max-width: 0;\n" +
               "        }\n" +
               "        \n" +
               "        .table th {\n" +
               "            background-color: #f8f9fa;\n" +
               "            font-weight: 600;\n" +
               "            text-align: center;\n" +
               "            border-bottom: 2px solid #dee2e6;\n" +
               "        }\n" +
               "        \n" +
               "        .table tbody tr:last-child td {\n" +
               "            border-bottom: 1px solid #dee2e6;\n" +
               "        }\n" +
               "        \n" +
               "        .table tbody tr {\n" +
               "            page-break-inside: avoid;\n" +
               "            break-inside: avoid;\n" +
               "        }\n" +
               "        \n" +
               "        .table thead {\n" +
               "            display: table-header-group;\n" +
               "        }\n" +
               "        \n" +
               "        .table thead tr {\n" +
               "            page-break-inside: avoid;\n" +
               "            page-break-after: avoid;\n" +
               "        }\n" +
               "        \n" +
               "        .table tfoot {\n" +
               "            display: table-footer-group;\n" +
               "        }\n" +
               "        \n" +
               "        .readonly-cell {\n" +
               "            background-color: #f8f9fa;\n" +
               "            color: #495057;\n" +
               "        }\n" +
               "        \n" +
               "        .editable-cell {\n" +
               "            background-color: #f8f9ff;\n" +
               "            color: #495057;\n" +
               "            border: 2px solid #0d6efd;\n" +
               "        }\n" +
               "        \n" +
               "        .modified-cell {\n" +
               "            background-color: #fff3cd;\n" +
               "            color: #495057;\n" +
               "            border: 2px solid #cf3916;\n" +
               "        }\n" +
               "        \n" +
               "        .cell-indicator {\n" +
               "            font-size: 0.75rem;\n" +
               "            margin-top: 4px;\n" +
               "            display: inline-block;\n" +
               "            color: #cf3916;\n" +
               "        }\n" +
               "        \n" +
               "        .cell-indicator.modified {\n" +
               "            color: #cf3916;\n" +
               "        }\n" +
               "        \n" +
               "        .cell-indicator.modified i {\n" +
               "            font-size: 0.9em;\n" +
               "            cursor: help;\n" +
               "        }\n" +
               "        \n" +
               "        .form-footer {\n" +
               "            margin-top: 15px;\n" +
               "            padding-top: 10px;\n" +
               "            border-top: 1px solid #e9ecef;\n" +
               "            text-align: center;\n" +
               "            color: #6c757d;\n" +
               "            font-size: 0.9rem;\n" +
               "        }\n" +
               "        \n" +
               "        .info-section {\n" +
               "            background-color: #e7f3ff;\n" +
               "            border: 1px solid #b3d9ff;\n" +
               "            border-radius: 3px;\n" +
               "            padding: 10px;\n" +
               "            margin-bottom: 15px;\n" +
               "        }\n" +
               "        \n" +
               "        .info-section h4 {\n" +
               "            color: #0056b3;\n" +
               "            margin-bottom: 8px;\n" +
               "            font-size: 11pt;\n" +
               "        }\n" +
               "        \n" +
               "        .info-item {\n" +
               "            margin-bottom: 5px;\n" +
               "        }\n" +
               "        \n" +
               "        .info-label {\n" +
               "            font-weight: 600;\n" +
               "            color: #495057;\n" +
               "        }\n" +
               "        \n" +
               "        @media print {\n" +
               "            body {\n" +
               "                background-color: white;\n" +
               "                padding: 0;\n" +
               "            }\n" +
               "            \n" +
               "            .container {\n" +
               "                box-shadow: none;\n" +
               "                border-radius: 0;\n" +
               "            }\n" +
               "        }\n" +
               "    </style>\n";
    }
    
    private List<String> getOrderedColumns(List<Map<String, Object>> tableData) {
        if (tableData == null || tableData.isEmpty()) {
            return new ArrayList<>();
        }
        
        Map<String, Object> firstRow = tableData.get(0);
        List<String> columnKeys = new ArrayList<>();
        
        int maxColIndex = -1;
        for (String key : firstRow.keySet()) {
            if (key.startsWith("column-")) {
                int colIndex = Integer.parseInt(key.replace("column-", ""));
                maxColIndex = Math.max(maxColIndex, colIndex);
            }
        }
        
        for (int i = 0; i <= maxColIndex; i++) {
            String columnKey = "column-" + i;
            if (firstRow.containsKey(columnKey)) {
                columnKeys.add(columnKey);
            }
        }
        
        return columnKeys;
    }
    
    private String getColumnLabel(String colKey, Map<String, String> columnLabels) {
        if (colKey.equals("_rowIndex")) {
            return "";
        }
        
        if (columnLabels != null && columnLabels.containsKey(colKey) && 
            columnLabels.get(colKey) != null && !columnLabels.get(colKey).trim().isEmpty()) {
            return columnLabels.get(colKey);
        }
        
        if (colKey.startsWith("column-")) {
            String columnIndex = colKey.replace("column-", "");
            try {
                int index = Integer.parseInt(columnIndex);
                return "Colonne " + (index + 1);
            } catch (NumberFormatException e) {
                return colKey;
            }
        }
        
        return colKey;
    }
    
    private boolean isCellEditable(int rowIndex, String colKey, List<SecureFormAccessData.CellPosition> editableCells) {
        if (editableCells == null || editableCells.isEmpty()) {
            return false;
        }
        
        return editableCells.stream()
            .anyMatch(cell -> cell.row == rowIndex && cell.col != null && cell.col.equals(colKey));
    }
    
    private String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        try {
            return dateTime.format(DATE_FORMATTER);
        } catch (Exception e) {
            LOG.warnf("Erreur lors du formatage de la date: %s", e.getMessage());
            return dateTime.toString();
        }
    }
    
    private String formatDateNow() {
        LocalDateTime now = LocalDateTime.now();
        return now.format(DATE_ONLY_FORMATTER) + " à " + now.format(TIME_FORMATTER);
    }
    
    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
    
    private String sanitizeRichText(String html) {
        if (html == null) {
            return "";
        }
        
        String sanitized = html.replaceAll("(?is)<\\s*(script|style)[^>]*>.*?<\\s*/\\s*\\1\\s*>", "");
        sanitized = sanitized.replaceAll("(?i)\\son[a-z]+\\s*=\\s*\"[^\"]*\"", "");
        sanitized = sanitized.replaceAll("(?i)\\son[a-z]+\\s*=\\s*'[^']*'", "");
        sanitized = sanitized.replaceAll("(?i)\\son[a-z]+\\s*=\\s*[^\\s>]+", "");
        
        return sanitized;
    }
    
    /**
     * Génère le CSV du formulaire à partir des données du partage
     * Format compatible Windows (point-virgule, UTF-8 avec BOM)
     */
    public byte[] generateFormCsv(SecureFormAccessData formData) {
        try {
            List<String> columns = getOrderedColumns(formData.tableData);
            StringBuilder csv = new StringBuilder();
            csv.append("\uFEFF");
            
            List<String> headerValues = new ArrayList<>();
            for (String col : columns) {
                String label = getColumnLabel(col, formData.columnLabels);
                headerValues.add(escapeCsvValue(label));
            }
            csv.append(String.join(";", headerValues));
            csv.append("\n");
            
            if (formData.tableData != null) {
                for (int rowIndex = 0; rowIndex < formData.tableData.size(); rowIndex++) {
                    Map<String, Object> row = formData.tableData.get(rowIndex);
                    List<String> rowValues = new ArrayList<>();
                    
                    for (String col : columns) {
                        Object valueObj = row.get(col);
                        String value = valueObj != null ? valueObj.toString() : "";
                        rowValues.add(escapeCsvValue(value));
                    }
                    
                    csv.append(String.join(";", rowValues));
                    csv.append("\n");
                }
            }
            
            return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la génération du CSV");
            throw new RuntimeException("Erreur lors de la génération du CSV", e);
        }
    }
    
    private String escapeCsvValue(String value) {
        if (value == null) {
            return "";
        }
        
        boolean needsQuotes = value.contains(";") || 
                             value.contains(",") || 
                             value.contains("\"") || 
                             value.contains("\n") || 
                             value.contains("\r");
        
        if (needsQuotes) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        
        return value;
    }
}
