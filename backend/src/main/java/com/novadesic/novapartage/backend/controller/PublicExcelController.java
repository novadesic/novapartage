package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.model.dto.SimulateTabdataRequest;
import com.novadesic.novapartage.backend.service.ExcelService;
import com.novadesic.novapartage.backend.service.FileStorageService;
import com.novadesic.novapartage.backend.service.TabdataSimulationService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.annotations.providers.multipart.MultipartForm;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/api/public/excel")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PublicExcelController {

    private static final Logger LOG = Logger.getLogger(PublicExcelController.class);

    @Inject
    ExcelService excelService;
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    TabdataSimulationService tabdataSimulationService;

    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadExcel(@MultipartForm FileUploadForm form) {
        LOG.info("=== DÉBUT uploadExcel PUBLIC ===");
        LOG.info("Form reçu - fileName: " + (form.fileName != null ? form.fileName : "NULL"));
        LOG.info("Form reçu - file: " + (form.fileName != null ? "PRÉSENT" : "NULL"));
        
        try {
            if (form.file == null || form.fileName == null) {
                LOG.warn("Fichier ou nom de fichier manquant");
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(createErrorResponse("Fichier ou nom de fichier manquant"))
                    .build();
            }

            // Vérifier l'extension du fichier
            String fileName = form.fileName.toLowerCase();
            LOG.info("Vérification extension - fileName: " + fileName);
            if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
                LOG.error("Format de fichier non supporté: " + fileName);
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(createErrorResponse("Format de fichier non supporté. Utilisez .xlsx ou .xls"))
                        .build();
            }

            LOG.info("Traitement du fichier: " + form.fileName);
            
            // Lire le fichier en bytes
            LOG.info("Lecture du fichier en bytes...");
            byte[] fileBytes = Files.readAllBytes(form.file.toPath());
            LOG.info("Fichier lu - taille: " + fileBytes.length + " bytes");
            
            // Vérifier la taille du fichier
            try {
                fileStorageService.validateFileSize(fileBytes.length);
                LOG.info("Taille du fichier validée: " + fileBytes.length + " bytes");
            } catch (IllegalArgumentException e) {
                LOG.error("Taille de fichier non autorisée: " + e.getMessage());
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(createErrorResponse(e.getMessage()))
                        .build();
            }
            
            // Créer un InputStream pour le traitement Excel
            LOG.info("Création InputStream pour traitement Excel...");
            InputStream excelInputStream = new java.io.ByteArrayInputStream(fileBytes);
            LOG.info("Appel excelService.processExcelFile...");
            ExcelData excelData = excelService.processExcelFile(excelInputStream, form.fileName);
            LOG.info("Excel traité avec succès - lignes: " + excelData.getTotalRows() + ", colonnes: " + excelData.getTotalColumns());
            
            // Récupérer les informations sur toutes les feuilles
            LOG.info("Récupération des informations sur toutes les feuilles...");
            InputStream sheetsInputStream = new java.io.ByteArrayInputStream(fileBytes);
            List<Map<String, Object>> sheetsInfo = excelService.getExcelSheets(sheetsInputStream, form.fileName);
            LOG.info("Feuilles trouvées: " + sheetsInfo.size());
            
            // Créer un InputStream pour le stockage temporaire
            LOG.info("Création InputStream pour stockage temporaire...");
            InputStream storageInputStream = new java.io.ByteArrayInputStream(fileBytes);
            LOG.info("Appel fileStorageService.storeTemporaryFile...");
            String tempFileId = fileStorageService.storeTemporaryFile(storageInputStream, form.fileName, "guest_user");
            LOG.info("Fichier temporaire stocké - ID: " + tempFileId);
            
            // Créer la réponse
            Map<String, Object> response = new HashMap<>();
            response.put("tempFileId", tempFileId);
            response.put("fileName", excelData.getFileName());
            response.put("fileSize", fileBytes.length);
            response.put("rows", excelData.getRows());
            response.put("totalRows", excelData.getTotalRows());
            response.put("totalColumns", excelData.getTotalColumns());
            response.put("sheets", sheetsInfo);
            response.put("formulaCells", excelData.getFormulaCells() != null ? excelData.getFormulaCells() : List.of());
            
            LOG.info("=== FIN uploadExcel PUBLIC - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IOException e) {
            LOG.error("Erreur lors du traitement du fichier Excel", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(createErrorResponse("Erreur lors du traitement du fichier Excel: " + e.getMessage()))
                .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue lors de l'upload", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(createErrorResponse("Erreur inattendue: " + e.getMessage()))
                .build();
        }
    }
    
    /**
     * Simule les tabdata pour un destinataire (utilisateurs non connectés)
     * POST /api/public/excel/simulate-tabdata
     */
    @GET
    @Path("/config/max-file-size")
    public Response getMaxFileSize() {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("maxFileSize", fileStorageService.getMaxFileSizeString());
            response.put("maxFileSizeBytes", fileStorageService.getMaxFileSizeBytes());
            return Response.ok(response).build();
        } catch (Exception e) {
            LOG.error("Erreur lors de la récupération de la limite de taille de fichier", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur lors de la récupération de la configuration"))
                    .build();
        }
    }
    
    @POST
    @Path("/simulate-tabdata")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response simulateTabdata(SimulateTabdataRequest request,
                                   @QueryParam("page") Integer page,
                                   @QueryParam("limit") Integer limit) {
        try {
            LOG.infof("🎭 Simulation tabdata pour utilisateur invité - tempFileId=%s, recipientEmail=%s, page=%s, limit=%s", 
                     request.tempFileId, request.recipientEmail, page, limit);
            
            // Valider la requête
            if (!request.isValid()) {
                LOG.warnf("❌ Requête invalide: %s", request.getValidationError());
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(createErrorResponse("Requête invalide: " + request.getValidationError()))
                    .build();
            }
            
            // Simuler les tabdata avec "guest_user" comme nom d'utilisateur
            Object simulatedData = tabdataSimulationService.simulateTabdataForRecipient(
                request.tempFileId, "guest_user", request, page, limit);
            
            LOG.infof("✅ Simulation terminée avec succès pour %s", request.recipientEmail);
            
            return Response.ok(simulatedData).build();
            
        } catch (IllegalArgumentException e) {
            LOG.warnf("❌ Erreur de validation: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(createErrorResponse(e.getMessage()))
                .build();
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la simulation tabdata");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(createErrorResponse("Erreur interne lors de la simulation"))
                .build();
        }
    }

    /**
     * Traiter un fichier Excel temporaire avec un index de feuille spécifique (utilisateurs non connectés)
     * POST /api/public/excel/process/{tempFileId}/{sheetIndex}
     */
    @POST
    @Path("/process/{tempFileId}/{sheetIndex}")
    public Response processExcelWithSheet(@PathParam("tempFileId") String tempFileId, 
                                         @PathParam("sheetIndex") int sheetIndex,
                                         @QueryParam("page") Integer page,
                                         @QueryParam("limit") Integer limit) {
        LOG.info("=== DÉBUT processExcelWithSheet PUBLIC ===");
        LOG.info("TempFileId: " + tempFileId + ", SheetIndex: " + sheetIndex + ", Page: " + page + ", Limit: " + limit);
        
        try {
            // Utiliser "guest_user" pour les utilisateurs non connectés
            String username = "guest_user";
            LOG.info("Utilisateur invité: " + username);
            
            // Récupérer le fichier temporaire
            InputStream fileStream = fileStorageService.getTemporaryFile(tempFileId, username);
            if (fileStream == null) {
                LOG.error("Fichier temporaire non trouvé: " + tempFileId);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity(createErrorResponse("Fichier temporaire non trouvé"))
                        .build();
            }
            
            // Traiter le fichier Excel avec la feuille spécifiée (avec pagination si demandée)
            String fileName = fileStorageService.getTemporaryFileName(tempFileId, username);
            ExcelData excelData;
            
            if (page != null || limit != null) {
                // Mode pagination
                excelData = excelService.processExcelFilePaginated(fileStream, fileName, sheetIndex, page, limit);
                LOG.info("Excel traité avec pagination - page: " + page + ", lignes retournées: " + excelData.getRows().size() + ", total: " + excelData.getTotalRows());
            } else {
                // Mode complet (rétrocompatibilité)
                excelData = excelService.processExcelFile(fileStream, fileName, sheetIndex);
                LOG.info("Excel traité avec succès - lignes: " + excelData.getTotalRows() + ", colonnes: " + excelData.getTotalColumns());
            }
            
            // Préparer la réponse
            Map<String, Object> response = new HashMap<>();
            response.put("fileName", excelData.getFileName());
            response.put("rows", excelData.getRows());
            response.put("totalRows", excelData.getTotalRows());
            response.put("totalColumns", excelData.getTotalColumns());
            response.put("sheetIndex", sheetIndex);
            response.put("tempFileId", tempFileId);
            response.put("formulaCells", excelData.getFormulaCells() != null ? excelData.getFormulaCells() : List.of());
            
            // Ajouter les informations de pagination si applicable
            if (page != null || limit != null) {
                int pageSize = (limit != null && limit > 0) ? Math.min(limit, 1000) : 100;
                int pageNum = (page != null && page >= 0) ? page : 0;
                int startRow = pageNum * pageSize;
                boolean hasMore = (startRow + excelData.getRows().size()) < excelData.getTotalRows();
                
                response.put("page", pageNum);
                response.put("limit", pageSize);
                response.put("hasMore", hasMore);
            }
            
            LOG.info("=== FIN processExcelWithSheet PUBLIC - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            LOG.error("Erreur de validation: " + e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(createErrorResponse(e.getMessage()))
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur lors du traitement du fichier Excel", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur lors du traitement du fichier Excel: " + e.getMessage()))
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur inattendue: " + e.getMessage()))
                    .build();
        }
    }

    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        return errorResponse;
    }
    
    // Classe pour le formulaire multipart
    public static class FileUploadForm {
        @FormParam("file")
        public java.io.File file;
        
        @FormParam("fileName")
        public String fileName;
    }
}
