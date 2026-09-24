package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.service.ShareService;
import com.novadesic.novapartage.backend.service.HtmlGeneratorService;
import com.novadesic.novapartage.backend.model.dto.FormAccessData;
import com.novadesic.novapartage.backend.model.dto.SecureFormAccessData;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Path("/public-access")
@ApplicationScoped
public class PublicAccessController {
    
    private static final Logger LOG = Logger.getLogger(PublicAccessController.class);
    
    @Inject
    ShareService shareService;
    
    @Inject
    HtmlGeneratorService htmlGeneratorService;
    
    /**
     * Accède aux données d'un partage via un token (sans authentification)
     * GET /api/shares/access/{token}
     */
    @GET
    @Path("/access/{token}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response accessShareWithToken(@PathParam("token") String token) {
        try {
            LOG.infof("Accès au partage via token: %s", token);
            
            Object shareData = shareService.accessShareWithToken(token);
            
            return Response.ok(shareData).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide"))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token expiré ou invalide"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de l'accès au partage via token");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère les données du formulaire avec les configurations du destinataire via un token
     * Version sécurisée qui n'expose pas d'informations sensibles sur les fichiers
     * GET /api/shares/form/{token}
     * Supporte la pagination via les paramètres page et limit
     */
    @GET
    @Path("/form/{token}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getFormDataWithToken(@PathParam("token") String token,
                                        @QueryParam("page") Integer page,
                                        @QueryParam("limit") Integer limit) {
        try {
            LOG.infof("🔒 PublicAccessController.getFormDataWithToken() - Récupération sécurisée des données du formulaire via token: %s (page=%s, limit=%s)", 
                     token, page, limit);
            LOG.infof("🔒 PublicAccessController - Endpoint public accessible sans authentification");
            
            SecureFormAccessData formData = shareService.getFormDataWithToken(token, page, limit);
            
            LOG.infof("🔒 PublicAccessController - Données récupérées avec succès");
            return Response.ok(formData).build();
            
        } catch (IllegalArgumentException e) {
            LOG.warnf("❌ PublicAccessController - IllegalArgumentException: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide: " + e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            LOG.warnf("❌ PublicAccessController - SecurityException: %s", e.getMessage());
            LOG.warnf("❌ PublicAccessController - Stack trace:", e);
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token expiré ou invalide: " + e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "❌ PublicAccessController - Exception lors de la récupération des données du formulaire via token");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne: " + e.getMessage()))
                          .build();
        }
    }
    
    /**
     * Sauvegarde les données du formulaire via un token
     * POST /api/shares/form/{token}/save
     */
    @POST
    @Path("/form/{token}/save")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response saveFormData(@PathParam("token") String token, Map<String, Object> formData) {
        try {
            LOG.infof("Sauvegarde des données du formulaire via token: %s", token);
            
            boolean saved = shareService.saveFormData(token, formData);
            
            if (saved) {
                return Response.ok(createSuccessResponse("Données sauvegardées avec succès")).build();
            } else {
                return Response.status(Response.Status.BAD_REQUEST)
                              .entity(createErrorResponse("Impossible de sauvegarder les données"))
                              .build();
            }
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide"))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token expiré ou invalide"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la sauvegarde des données du formulaire via token");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Marque un token comme utilisé (appelé une seule fois à l'ouverture de la page)
     * POST /public-access/token/{token}/mark-used
     */
    @POST
    @Path("/token/{token}/mark-used")
    @Produces(MediaType.APPLICATION_JSON)
    public Response markTokenAsUsed(@PathParam("token") String token) {
        try {
            LOG.infof("Marquage du token comme utilisé: %s", token);
            
            boolean marked = shareService.markTokenAsUsed(token);
            
            if (marked) {
                return Response.ok(createSuccessResponse("Token marqué comme utilisé")).build();
            } else {
                return Response.status(Response.Status.BAD_REQUEST)
                              .entity(createErrorResponse("Impossible de marquer le token comme utilisé"))
                              .build();
            }
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide: " + e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token expiré ou invalide: " + e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors du marquage du token comme utilisé");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Valide un token d'accès (clôture l'accès et marque comme validé)
     * POST /api/shares/form/{token}/validate
     */
    @POST
    @Path("/form/{token}/validate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response validateAccessToken(@PathParam("token") String token, 
                                       Map<String, Object> requestBody) {
        String validatedBy = null;
        if (requestBody != null && requestBody.containsKey("validatedBy")) {
            validatedBy = (String) requestBody.get("validatedBy");
        }
        try {
            LOG.infof("Validation du token d'accès: %s par: %s", token, validatedBy);
            
            boolean validated = shareService.validateAccessToken(token, validatedBy);
            
            if (validated) {
                return Response.ok(createSuccessResponse("Accès validé avec succès")).build();
            } else {
                return Response.status(Response.Status.BAD_REQUEST)
                              .entity(createErrorResponse("Impossible de valider l'accès"))
                              .build();
            }
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide"))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token non actif"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la validation du token d'accès");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Génère et retourne le fichier HTML du formulaire via un token
     * GET /public-access/form/{token}/html
     */
    @GET
    @Path("/form/{token}/html")
    @Produces(MediaType.TEXT_HTML)
    public Response getFormHtml(@PathParam("token") String token) {
        try {
            LOG.infof("Génération du HTML du formulaire via token: %s", token);
            
            // Récupérer les données du formulaire (sans pagination pour avoir toutes les données)
            SecureFormAccessData formData = shareService.getFormDataWithToken(token, null, null);
            
            // Obtenir l'URL de base
            String baseUrl = getBaseUrl();
            
            // Générer le HTML
            String htmlContent = htmlGeneratorService.generateFormHtml(formData, baseUrl);
            
            // Retourner le HTML avec les en-têtes appropriés pour le téléchargement
            return Response.ok(htmlContent)
                    .header("Content-Disposition", "attachment; filename=\"" + generateFileName(formData) + "\"")
                    .header("Content-Type", "text/html;charset=UTF-8")
                    .build();
            
        } catch (IllegalArgumentException e) {
            LOG.errorf("Token invalide: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity("<html><body><h1>Erreur</h1><p>Token invalide</p></body></html>")
                          .build();
        } catch (SecurityException e) {
            LOG.errorf("Token expiré ou invalide: %s", e.getMessage());
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity("<html><body><h1>Erreur</h1><p>Token expiré ou invalide</p></body></html>")
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la génération du HTML du formulaire via token");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity("<html><body><h1>Erreur</h1><p>Erreur interne lors de la génération du HTML</p></body></html>")
                          .build();
        }
    }
    
    /**
     * Génère et retourne le fichier CSV du formulaire via un token
     * GET /public-access/form/{token}/csv
     */
    @GET
    @Path("/form/{token}/csv")
    @Produces("text/csv;charset=UTF-8")
    public Response getFormCsv(@PathParam("token") String token) {
        try {
            LOG.infof("Génération du CSV du formulaire via token: %s", token);
            
            // Récupérer les données du formulaire (sans pagination pour avoir toutes les données)
            SecureFormAccessData formData = shareService.getFormDataWithToken(token, null, null);
            
            // Générer le CSV
            byte[] csvContent = htmlGeneratorService.generateFormCsv(formData);
            
            // Retourner le CSV avec les en-têtes appropriés pour le téléchargement
            return Response.ok(csvContent)
                    .header("Content-Disposition", "attachment; filename=\"" + generateCsvFileName(formData) + "\"")
                    .header("Content-Type", "text/csv;charset=UTF-8")
                    .build();
            
        } catch (IllegalArgumentException e) {
            LOG.errorf("Token invalide: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse("Token invalide"))
                          .build();
        } catch (SecurityException e) {
            LOG.errorf("Token expiré ou invalide: %s", e.getMessage());
            return Response.status(Response.Status.UNAUTHORIZED)
                          .entity(createErrorResponse("Token expiré ou invalide"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la génération du CSV du formulaire via token");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne lors de la génération du CSV"))
                          .build();
        }
    }
    
    /**
     * Options CORS pour l'endpoint d'accès public
     */
    @OPTIONS
    @Path("/access/{token}")
    public Response options() {
        return Response.ok()
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, OPTIONS")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
                .build();
    }
    
    /**
     * Récupère l'URL de base de l'application
     */
    private String getBaseUrl() {
        // 1. APP_BASE_URL - URL complète de l'application
        String appBaseUrl = System.getenv("APP_BASE_URL");
        if (appBaseUrl != null && !appBaseUrl.trim().isEmpty()) {
            return appBaseUrl.trim();
        }
        
        // 2. FRONTEND_URL - URL du frontend
        String frontendUrl = System.getenv("FRONTEND_URL");
        if (frontendUrl != null && !frontendUrl.trim().isEmpty()) {
            return frontendUrl.trim();
        }
        
        // 3. APP_DOMAIN - nom de domaine de l'application
        String appDomain = System.getenv("APP_DOMAIN");
        if (appDomain != null && !appDomain.trim().isEmpty()) {
            String domain = appDomain.trim();
            // Détecter automatiquement le protocole (HTTP/HTTPS)
            String protocol = "https";
            if (domain.contains("localhost") || domain.contains("127.0.0.1")) {
                protocol = "http";
            }
            return protocol + "://" + domain;
        }
        
        // 4. Valeur par défaut pour le développement
        String quarkusProfile = System.getenv("QUARKUS_PROFILE");
        if ("dev".equals(quarkusProfile)) {
            return "http://localhost:4200";
        }
        
        // En production, utiliser localhost:80 (nginx)
        return "http://localhost";
    }
    
    /**
     * Génère un nom de fichier pour le téléchargement HTML
     */
    private String generateFileName(SecureFormAccessData formData) {
        String title = formData.pageTitle != null ? formData.pageTitle : "formulaire";
        // Nettoyer le titre pour le nom de fichier
        title = title.replaceAll("[^a-zA-Z0-9\\s-]", "").trim().replaceAll("\\s+", "_");
        
        String email = formData.recipientEmail != null ? formData.recipientEmail.split("@")[0] : "partage";
        String date = java.time.LocalDate.now().toString();
        
        return String.format("%s_%s_%s.html", title, email, date);
    }
    
    /**
     * Génère un nom de fichier pour le téléchargement CSV
     */
    private String generateCsvFileName(SecureFormAccessData formData) {
        String title = formData.pageTitle != null ? formData.pageTitle : "formulaire";
        // Nettoyer le titre pour le nom de fichier
        title = title.replaceAll("[^a-zA-Z0-9\\s-]", "").trim().replaceAll("\\s+", "_");
        
        String email = formData.recipientEmail != null ? formData.recipientEmail.split("@")[0] : "partage";
        String date = java.time.LocalDate.now().toString();
        
        return String.format("%s_%s_%s.csv", title, email, date);
    }
    
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", message);
        error.put("timestamp", System.currentTimeMillis());
        return error;
    }

    private Map<String, Object> createSuccessResponse(String message) {
        Map<String, Object> success = new HashMap<>();
        success.put("message", message);
        success.put("timestamp", System.currentTimeMillis());
        return success;
    }
} 