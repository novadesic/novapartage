package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.model.ExcelData;
import com.novadesic.novapartage.backend.model.dto.SimulateTabdataRequest;
import com.novadesic.novapartage.backend.service.ExcelService;
import com.novadesic.novapartage.backend.service.FileStorageService;
import com.novadesic.novapartage.backend.service.ShareService;
import com.novadesic.novapartage.backend.service.TabdataSimulationService;
import com.novadesic.novapartage.backend.service.SubscriptionEnforcementService;
import com.novadesic.novapartage.backend.auth.CustomAuthService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.annotations.providers.multipart.MultipartForm;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Path("/api/excel")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ExcelController {

    private static final Logger LOG = Logger.getLogger(ExcelController.class);

    @Inject
    ExcelService excelService;
    
    @Inject
    FileStorageService fileStorageService;
    
    @Inject
    ShareService shareService;
    
    @Inject
    TabdataSimulationService tabdataSimulationService;
    
    @Inject
    CustomAuthService authService;

    @Inject
    SubscriptionEnforcementService subscriptionEnforcement;

    /**
     * Valide l'authentification depuis le header Authorization
     */
    private CustomAuthService.UserInfo validateAuthFromHeader(String authHeader) {
        try {
            LOG.infof("🔍 ExcelController - validateAuthFromHeader() appelé");
            LOG.infof("🔍 ExcelController - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                LOG.infof("🔍 ExcelController - Token extrait, longueur: %d", token.length());
                
                CustomAuthService.UserInfo userInfo = authService.validateToken(token);
                if (userInfo != null) {
                    LOG.infof("✅ ExcelController - Authentification réussie pour: %s", userInfo.email);
                    return userInfo;
                } else {
                    LOG.warn("❌ ExcelController - Token invalide");
                }
            } else {
                LOG.warn("❌ ExcelController - Pas de token Bearer");
            }
            
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Token d'authentification requis\"}")
                .build());
                
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ ExcelController - Erreur lors de l'authentification");
            throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("{\"error\": \"Erreur d'authentification\"}")
                .build());
        }
    }

    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadExcel(@MultipartForm FileUploadForm form, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        LOG.info("=== DÉBUT uploadExcel ===");
        LOG.info("Form reçu - fileName: " + (form.fileName != null ? form.fileName : "NULL"));
        LOG.info("Form reçu - file: " + (form.file != null ? "PRÉSENT" : "NULL"));
        
        try {
            if (form.file == null || form.fileName == null || form.fileName.trim().isEmpty()) {
                LOG.error("Fichier manquant ou nom de fichier vide");
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("{\"error\": \"Fichier requis\"}")
                        .build();
            }

            // Vérifier l'extension du fichier
            String fileName = form.fileName.toLowerCase();
            LOG.info("Vérification extension - fileName: " + fileName);
            if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
                LOG.error("Format de fichier non supporté: " + fileName);
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("{\"error\": \"Format de fichier non supporté. Utilisez .xlsx ou .xls\"}")
                        .build();
            }

            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.info("Utilisateur authentifié: " + username);
            
            // SOLUTION ROBUSTE: Lire le fichier une seule fois en bytes
            LOG.info("Lecture du fichier en bytes...");
            byte[] fileBytes = form.file.readAllBytes();
            LOG.info("Fichier lu - taille: " + fileBytes.length + " bytes");
            
            // Vérifier la taille du fichier
            try {
                fileStorageService.validateFileSize(fileBytes.length);
                LOG.info("Taille du fichier validée: " + fileBytes.length + " bytes");
            } catch (IllegalArgumentException e) {
                LOG.error("Taille de fichier non autorisée: " + e.getMessage());
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("{\"error\": \"" + e.getMessage() + "\"}")
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
            String tempFileId = fileStorageService.storeTemporaryFile(storageInputStream, form.fileName, username);
            LOG.info("Fichier temporaire stocké - ID: " + tempFileId);
            
            // Enrichir les données avec l'ID temporaire
            LOG.info("Préparation de la réponse...");
            Map<String, Object> response = new HashMap<>();
            response.put("fileName", excelData.getFileName());
            response.put("rows", excelData.getRows());
            response.put("totalRows", excelData.getTotalRows());
            response.put("totalColumns", excelData.getTotalColumns());
            response.put("tempFileId", tempFileId); // ID pour référencer lors de la création du partage
            response.put("sheets", sheetsInfo); // Informations sur toutes les feuilles
            response.put("formulaCells", excelData.getFormulaCells() != null ? excelData.getFormulaCells() : List.of());
            
            LOG.info("=== FIN uploadExcel - SUCCÈS ===");
            return Response.ok(response).build();

        } catch (IllegalArgumentException e) {
            LOG.error("Erreur IllegalArgumentException: " + e.getMessage(), e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur IOException lors du traitement du fichier: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur lors du traitement du fichier: " + e.getMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue: " + e.getMessage(), e);
            LOG.error("Stack trace complet:", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur inattendue: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    @GET
    @Path("/sheets/{tempFileId}")
    public Response getExcelSheets(@PathParam("tempFileId") String tempFileId, @HeaderParam("Authorization") String authHeader) {
        LOG.info("=== DÉBUT getExcelSheets ===");
        LOG.info("TempFileId: " + tempFileId);
        
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.info("Utilisateur authentifié: " + username);
            
            // Récupérer le fichier temporaire
            InputStream fileStream = fileStorageService.getTemporaryFile(tempFileId, username);
            if (fileStream == null) {
                LOG.error("Fichier temporaire non trouvé: " + tempFileId);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Fichier temporaire non trouvé\"}")
                        .build();
            }
            
            // Récupérer les informations sur les feuilles
            String fileName = fileStorageService.getTemporaryFileName(tempFileId, username);
            java.util.List<Map<String, Object>> sheets = excelService.getExcelSheets(fileStream, fileName);
            
            LOG.info("Feuilles trouvées: " + sheets.size());
            
            Map<String, Object> response = new HashMap<>();
            response.put("sheets", sheets);
            response.put("totalSheets", sheets.size());
            response.put("fileName", fileName);
            
            LOG.info("=== FIN getExcelSheets - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            LOG.error("Erreur IllegalArgumentException: " + e.getMessage(), e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur IOException lors du traitement du fichier: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur lors du traitement du fichier: " + e.getMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur inattendue: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    @POST
    @Path("/process/{tempFileId}/{sheetIndex}")
    public Response processExcelWithSheet(@PathParam("tempFileId") String tempFileId, 
                                         @PathParam("sheetIndex") int sheetIndex,
                                         @QueryParam("page") Integer page,
                                         @QueryParam("limit") Integer limit,
                                         @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        LOG.info("=== DÉBUT processExcelWithSheet ===");
        LOG.info("TempFileId: " + tempFileId + ", SheetIndex: " + sheetIndex + ", Page: " + page + ", Limit: " + limit);
        
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.info("Utilisateur authentifié: " + username);
            
            // Récupérer le fichier temporaire
            InputStream fileStream = fileStorageService.getTemporaryFile(tempFileId, username);
            if (fileStream == null) {
                LOG.error("Fichier temporaire non trouvé: " + tempFileId);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Fichier temporaire non trouvé\"}")
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
            
            LOG.info("=== FIN processExcelWithSheet - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            LOG.error("Erreur IllegalArgumentException: " + e.getMessage(), e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur IOException lors du traitement du fichier: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur lors du traitement du fichier: " + e.getMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur inattendue: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    @GET
    @Path("/share/{shareId}/sheets")
    public Response getShareSheets(@PathParam("shareId") String shareId, @HeaderParam("Authorization") String authHeader) {
        LOG.info("=== DÉBUT getShareSheets ===");
        LOG.info("ShareId: " + shareId);
        
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.info("Utilisateur authentifié: " + username);
            
            // Récupérer le partage
            var share = shareService.getShareById(shareId);
            if (share == null) {
                LOG.error("Partage non trouvé: " + shareId);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Partage non trouvé\"}")
                        .build();
            }
            
            // Vérifier que l'utilisateur est le propriétaire
            if (!username.equals(share.ownerUsername)) {
                LOG.error("Accès non autorisé au partage: " + shareId);
                return Response.status(Response.Status.FORBIDDEN)
                        .entity("{\"error\": \"Accès non autorisé\"}")
                        .build();
            }
            
            // Récupérer le fichier du partage (avec déchiffrement si nécessaire)
            InputStream fileStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId);
            if (fileStream == null) {
                LOG.error("Fichier du partage non trouvé: " + share.filePath);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Fichier du partage non trouvé\"}")
                        .build();
            }
            
            // Récupérer les informations sur les feuilles
            java.util.List<Map<String, Object>> sheets = excelService.getExcelSheets(fileStream, share.originalFileName);
            
            LOG.info("Feuilles trouvées: " + sheets.size());
            
            Map<String, Object> response = new HashMap<>();
            response.put("sheets", sheets);
            response.put("totalSheets", sheets.size());
            response.put("fileName", share.originalFileName);
            response.put("selectedSheetIndex", share.selectedSheetIndex);
            
            LOG.info("=== FIN getShareSheets - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            LOG.error("Erreur IllegalArgumentException: " + e.getMessage(), e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur IOException lors du traitement du fichier: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur lors du traitement du fichier: " + e.getMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur inattendue: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    @POST
    @Path("/share/{shareId}/process/{sheetIndex}")
    public Response processShareWithSheet(@PathParam("shareId") String shareId, 
                                         @PathParam("sheetIndex") int sheetIndex,
                                         @QueryParam("page") Integer page,
                                         @QueryParam("limit") Integer limit,
                                         @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        LOG.info("=== DÉBUT processShareWithSheet ===");
        LOG.info("ShareId: " + shareId + ", SheetIndex: " + sheetIndex + ", Page: " + page + ", Limit: " + limit);
        
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.info("Utilisateur authentifié: " + username);
            
            // Récupérer le partage
            var share = shareService.getShareById(shareId);
            if (share == null) {
                LOG.error("Partage non trouvé: " + shareId);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Partage non trouvé\"}")
                        .build();
            }
            
            // Vérifier que l'utilisateur est le propriétaire
            if (!username.equals(share.ownerUsername)) {
                LOG.error("Accès non autorisé au partage: " + shareId);
                return Response.status(Response.Status.FORBIDDEN)
                        .entity("{\"error\": \"Accès non autorisé\"}")
                        .build();
            }
            
            // Récupérer le fichier du partage (avec déchiffrement si nécessaire)
            InputStream fileStream = fileStorageService.getFileDecrypted(share.filePath, share.isEncrypted, share.encryptionKeyId);
            if (fileStream == null) {
                LOG.error("Fichier du partage non trouvé: " + share.filePath);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"Fichier du partage non trouvé\"}")
                        .build();
            }
            
            // Traiter le fichier Excel avec la feuille spécifiée (avec pagination si demandée)
            ExcelData excelData;
            
            if (page != null || limit != null) {
                // Mode pagination
                excelData = excelService.processExcelFilePaginated(fileStream, share.originalFileName, sheetIndex, page, limit);
                LOG.info("Excel traité avec pagination - page: " + page + ", lignes retournées: " + excelData.getRows().size() + ", total: " + excelData.getTotalRows());
            } else {
                // Mode complet (rétrocompatibilité)
                excelData = excelService.processExcelFile(fileStream, share.originalFileName, sheetIndex);
                LOG.info("Données Excel traitées - Lignes: " + excelData.getTotalRows() + ", Colonnes: " + excelData.getTotalColumns());
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("fileName", share.originalFileName);
            response.put("rows", excelData.getRows());
            response.put("totalRows", excelData.getTotalRows());
            response.put("totalColumns", excelData.getTotalColumns());
            response.put("sheetIndex", sheetIndex);
            response.put("shareId", shareId);
            
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
            
            LOG.info("=== FIN processShareWithSheet - SUCCÈS ===");
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            LOG.error("Erreur IllegalArgumentException: " + e.getMessage(), e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        } catch (IOException e) {
            LOG.error("Erreur IOException lors du traitement du fichier: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur lors du traitement du fichier: " + e.getMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            LOG.error("Erreur inattendue: " + e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur inattendue: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    @GET
    @Path("/health")
    public Response health() {
        return Response.ok("{\"status\": \"OK\", \"service\": \"ddshare-backend\"}").build();
    }
    
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
                    .entity("{\"error\": \"Erreur lors de la récupération de la configuration\"}")
                    .build();
        }
    }

    @OPTIONS
    @Path("/upload")
    public Response options() {
        return Response.ok()
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
                .build();
    }
    
    /**
     * Simule les tabdata pour un destinataire (utilisateurs connectés)
     * POST /api/excel/simulate-tabdata
     */
    @POST
    @Path("/simulate-tabdata")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response simulateTabdata(SimulateTabdataRequest request, 
                                   @HeaderParam("Authorization") String authHeader,
                                   @QueryParam("page") Integer page,
                                   @QueryParam("limit") Integer limit) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("🎭 Simulation tabdata pour utilisateur connecté - tempFileId=%s, recipientEmail=%s, page=%s, limit=%s", 
                     request.tempFileId, request.recipientEmail, page, limit);
            
            // Valider l'authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(createErrorResponse("Authentification requise"))
                    .build();
            }
            
            String username = userInfo.email;
            LOG.infof("👤 Utilisateur authentifié: %s", username);
            
            // Valider la requête
            if (!request.isValid()) {
                LOG.warnf("❌ Requête invalide: %s", request.getValidationError());
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(createErrorResponse("Requête invalide: " + request.getValidationError()))
                    .build();
            }
            
            // Simuler les tabdata avec l'utilisateur authentifié
            Object simulatedData = tabdataSimulationService.simulateTabdataForRecipient(
                request.tempFileId, username, request, page, limit);
            
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

    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        return errorResponse;
    }

    public static class FileUploadForm {
        @FormParam("file")
        public InputStream file;
        
        @FormParam("fileName")
        public String fileName;
    }
} 