package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.auth.CustomAuthService;
import com.novadesic.novapartage.backend.service.UserRightsService;
import com.novadesic.novapartage.backend.service.SubscriptionEnforcementService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.WebApplicationException;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Contrôleur pour les droits RGPD des utilisateurs
 * 
 * Endpoints:
 * - GET /api/user/data-export - Droit d'accès (Article 15 RGPD)
 * - DELETE /api/user/account - Droit à l'effacement (Article 17 RGPD)
 * - PUT /api/user/profile - Droit de rectification (Article 16 RGPD)
 * - GET /api/user/data-export?format=json - Droit à la portabilité (Article 20 RGPD)
 */
@Path("/api/user")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserRightsController {
    
    private static final Logger LOG = Logger.getLogger(UserRightsController.class);
    
    @Inject
    UserRightsService userRightsService;
    
    @Inject
    CustomAuthService authService;

    @Inject
    SubscriptionEnforcementService subscriptionEnforcement;
    
    /**
     * Valide l'authentification depuis le header Authorization
     */
    private CustomAuthService.UserInfo validateAuthFromHeader(String authHeader) {
        try {
            LOG.infof("🔍 UserRightsController - validateAuthFromHeader() appelé");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                CustomAuthService.UserInfo userInfo = authService.validateToken(token);
                if (userInfo != null) {
                    LOG.infof("✅ UserRightsController - Authentification réussie pour: %s", userInfo.email);
                    return userInfo;
                } else {
                    LOG.warn("❌ UserRightsController - Token invalide");
                }
            } else {
                LOG.warn("❌ UserRightsController - Pas de token Bearer");
            }
            
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Token d'authentification requis\"}")
                .build());
                
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ UserRightsController - Erreur lors de l'authentification");
            throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("{\"error\": \"Erreur d'authentification\"}")
                .build());
        }
    }
    
    /**
     * Exporte toutes les données d'un utilisateur (Article 15 RGPD - Droit d'accès)
     * GET /api/user/data-export
     * GET /api/user/data-export?format=json (pour la portabilité - Article 20)
     * 
     * @param authHeader Header Authorization avec le token JWT
     * @param format Format de l'export (json par défaut, csv optionnel)
     * @return Toutes les données de l'utilisateur au format JSON
     */
    @GET
    @Path("/data-export")
    public Response exportUserData(
            @HeaderParam("Authorization") String authHeader,
            @QueryParam("format") @DefaultValue("json") String format) {
        
        try {
            LOG.infof("📥 GET /api/user/data-export - Export des données RGPD demandé (format: %s)", format);
            
            // Authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String userEmail = userInfo.email;
            
            // Export des données
            Map<String, Object> exportData = userRightsService.exportUserData(userEmail);
            
            // Ajouter des métadonnées sur l'export
            exportData.put("exportFormat", format);
            exportData.put("exportPurpose", "RGPD - Droit d'accès (Article 15) et Portabilité (Article 20)");
            exportData.put("legalBasis", "Règlement Général sur la Protection des Données (RGPD)");
            
            // Pour le format CSV, on pourrait convertir, mais pour l'instant on retourne JSON
            // Le format CSV nécessiterait une conversion spécifique des données tabulaires
            if ("csv".equalsIgnoreCase(format)) {
                LOG.warnf("⚠️ Format CSV demandé mais non implémenté, retour en JSON");
                exportData.put("note", "Le format CSV n'est pas encore implémenté. Les données sont retournées en JSON.");
            }
            
            LOG.infof("✅ Export des données terminé pour %s", userEmail);
            
            return Response.ok(exportData)
                    .header("Content-Disposition", "attachment; filename=\"user-data-export-" + userEmail + "-" + System.currentTimeMillis() + ".json\"")
                    .build();
                    
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de l'export des données");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur lors de l'export des données"))
                    .build();
        }
    }
    
    /**
     * Supprime complètement le compte et toutes les données d'un utilisateur (Article 17 RGPD - Droit à l'effacement)
     * DELETE /api/user/account
     * 
     * ⚠️ ATTENTION: Cette action est irréversible !
     * 
     * @param authHeader Header Authorization avec le token JWT
     * @param confirmation Confirmation de suppression (optionnel, mais recommandé)
     * @return Rapport de suppression
     */
    @DELETE
    @Path("/account")
    public Response deleteUserAccount(
            @HeaderParam("Authorization") String authHeader,
            @QueryParam("confirm") @DefaultValue("false") String confirmation) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("🗑️ DELETE /api/user/account - Suppression de compte demandée");
            
            // Authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String userEmail = userInfo.email;
            
            // Vérification de confirmation (recommandé mais pas obligatoire pour l'API)
            // En production, on pourrait exiger une confirmation explicite
            boolean confirmed = "true".equalsIgnoreCase(confirmation) || "yes".equalsIgnoreCase(confirmation);
            if (!confirmed) {
                LOG.warnf("⚠️ Suppression de compte demandée sans confirmation explicite pour %s", userEmail);
                // On continue quand même, mais on logue l'avertissement
            }
            
            // Suppression complète
            Map<String, Object> deletionReport = userRightsService.deleteUserAccount(userEmail);
            
            // Ajouter des métadonnées
            deletionReport.put("deletionPurpose", "RGPD - Droit à l'effacement (Article 17)");
            deletionReport.put("legalBasis", "Règlement Général sur la Protection des Données (RGPD)");
            deletionReport.put("irreversible", true);
            
            LOG.infof("✅ Suppression de compte terminée pour %s", userEmail);
            
            return Response.ok(deletionReport)
                    .entity(deletionReport)
                    .build();
                    
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la suppression du compte");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur lors de la suppression du compte"))
                    .build();
        }
    }
    
    /**
     * Met à jour le profil utilisateur (Article 16 RGPD - Droit de rectification)
     * PUT /api/user/profile
     * 
     * @param authHeader Header Authorization avec le token JWT
     * @param requestBody Corps de la requête avec les champs à mettre à jour
     * @return Profil mis à jour
     */
    @PUT
    @Path("/profile")
    public Response updateUserProfile(
            @HeaderParam("Authorization") String authHeader,
            Map<String, Object> requestBody) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("✏️ PUT /api/user/profile - Mise à jour du profil demandée");
            
            // Authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String userEmail = userInfo.email;
            
            // Extraction des champs à mettre à jour
            String newEmail = requestBody != null && requestBody.containsKey("email") 
                    ? (String) requestBody.get("email") : null;
            String displayName = requestBody != null && requestBody.containsKey("displayName")
                    ? (String) requestBody.get("displayName") : null;
            
            // Validation
            if (newEmail == null && displayName == null) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(createErrorResponse("Aucun champ à mettre à jour. Fournissez 'email' ou 'displayName'."))
                        .build();
            }
            
            // Mise à jour
            Map<String, Object> updateReport = userRightsService.updateUserProfile(userEmail, newEmail, displayName);
            
            // Ajouter des métadonnées
            updateReport.put("updatePurpose", "RGPD - Droit de rectification (Article 16)");
            updateReport.put("legalBasis", "Règlement Général sur la Protection des Données (RGPD)");
            
            LOG.infof("✅ Mise à jour du profil terminée pour %s", userEmail);
            
            return Response.ok(updateReport).build();
            
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ Erreur lors de la mise à jour du profil");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Erreur lors de la mise à jour du profil"))
                    .build();
        }
    }
    
    /**
     * Crée une réponse d'erreur standardisée
     */
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", message);
        error.put("timestamp", System.currentTimeMillis());
        return error;
    }
}

