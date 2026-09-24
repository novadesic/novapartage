package com.novadesic.novapartage.backend.model.dto;

import com.novadesic.novapartage.backend.model.Recipient;
import java.time.LocalDateTime;
import java.util.List;

public class FormDataResponse {
    
    // Informations du partage
    public String shareId;
    public String fileName;
    public String originalFileName;
    public String ownerUsername;
    public String ownerEmail;
    public LocalDateTime createdAt;
    public LocalDateTime expiresAt;
    public String recipientEmail;
    
    // Configuration du formulaire
    public String selectedSheet;
    public int headerRow;
    public int dataStartRow;
    public String columnRange;
    public boolean includeFormulas;
    public boolean preserveFormatting;
    public List<String> detectedFields;
    
    // Données Excel
    public Object excelData;
    public List<String> headers;
    public int totalRows;
    public int totalColumns;
    
    // Configuration du destinataire
    public Recipient recipientConfig;
    
    public FormDataResponse() {
    }
} 