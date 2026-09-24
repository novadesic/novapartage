package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.model.dto.ShareRequest;
import com.novadesic.novapartage.backend.model.dto.ShareResponse;
import com.novadesic.novapartage.backend.model.dto.AccessTokenResponse;
import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.service.ShareService;
import com.novadesic.novapartage.backend.service.SubscriptionEnforcementService;
import com.novadesic.novapartage.backend.auth.CustomAuthService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Path("/api/shares")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ShareController {
    
    private static final Logger LOG = Logger.getLogger(ShareController.class);
    
    @Inject
    ShareService shareService;
    
    @Inject
    CustomAuthService authService;

    @Inject
    SubscriptionEnforcementService subscriptionEnforcement;

    /**
     * Valide l'authentification depuis le header Authorization
     */
    private CustomAuthService.UserInfo validateAuthFromHeader(String authHeader) {
        try {
            LOG.infof("🔍 ShareController - validateAuthFromHeader() appelé");
            LOG.infof("🔍 ShareController - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                LOG.infof("🔍 ShareController - Token extrait, longueur: %d", token.length());
                
                CustomAuthService.UserInfo userInfo = authService.validateToken(token);
                if (userInfo != null) {
                    LOG.infof("✅ ShareController - Authentification réussie pour: %s", userInfo.email);
                    return userInfo;
                } else {
                    LOG.warn("❌ ShareController - Token invalide");
                }
            } else {
                LOG.warn("❌ ShareController - Pas de token Bearer");
            }
            
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Token d'authentification requis\"}")
                .build());
                
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "❌ ShareController - Erreur lors de l'authentification");
            throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("{\"error\": \"Erreur d'authentification\"}")
                .build());
        }
    }
    
    /**
     * Endpoint de test pour l'authentification
     * GET /api/shares/test-auth
     */
    @GET
    @Path("/test-auth")
    public Response testAuth(@HeaderParam("Authorization") String authHeader) {
        try {
            LOG.infof("🧪 TEST AUTH - Endpoint appelé");
            LOG.infof("🧪 TEST AUTH - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                LOG.infof("🧪 TEST AUTH - Token extrait, longueur: %d", token.length());
                
                // Validation JWT simple
                if (token.startsWith("eyJ") && token.length() > 100) {
                    // Décoder le payload du JWT
                    String[] parts = token.split("\\.");
                    if (parts.length == 3) {
                        String payload = parts[1];
                        
                        // Ajouter du padding si nécessaire
                        while (payload.length() % 4 != 0) {
                            payload += "=";
                        }
                        
                        try {
                            String decodedPayload = new String(java.util.Base64.getUrlDecoder().decode(payload));
                            LOG.infof("🧪 TEST AUTH - Payload décodé: %s", decodedPayload);
                            
                            // Extraire l'email du payload JSON
                            if (decodedPayload.contains("\"email\"")) {
                                LOG.infof("✅ TEST AUTH - Authentification réussie");
                                return Response.ok()
                                    .entity("{\"message\": \"Authentification réussie\", \"token\": \"" + token.substring(0, 20) + "...\"}")
                                    .build();
                            }
                        } catch (Exception e) {
                            LOG.errorf(e, "❌ TEST AUTH - Erreur de décodage");
                        }
                    }
                }
                
                LOG.warn("❌ TEST AUTH - Token invalide");
            } else {
                LOG.warn("❌ TEST AUTH - Pas de token Bearer");
            }
            
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Authentification échouée\"}")
                .build();
        } catch (Exception e) {
            LOG.errorf(e, "❌ TEST AUTH - Erreur");
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Authentification échouée\"}")
                .build();
        }
    }
    
    /**
     * Crée un nouveau partage (finalisé - statut ACTIVE)
     * POST /api/shares
     */
    @POST
    public Response createShare(ShareRequest request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("🚀🚀🚀 CRÉATION DE PARTAGE - Endpoint appelé 🚀🚀🚀");
            LOG.infof("📊 Requête reçue: %s", request != null ? "OUI" : "NULL");
            
            if (request != null) {
                LOG.infof("📁 Nom du fichier: %s", request.fileName);
                LOG.infof("🆔 FileID: %s", request.fileId);
                LOG.infof("👥 Nombre de destinataires: %s", request.recipients != null ? request.recipients.size() : "NULL");
                LOG.infof("✅ Requête valide: %s", request.isValid());
                if (!request.isValid()) {
                    LOG.warnf("❌ Erreur de validation: %s", request.getValidationError());
                }
            }
            
            // Vérifier l'authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            String email = userInfo.email;
            
            LOG.infof("👤 Utilisateur: %s (%s)", username, email);
            
            ShareResponse response = shareService.createShare(request, username, email);
            
            return Response.status(Response.Status.CREATED)
                          .entity(response)
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Validation error: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la création du partage");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne lors de la création du partage"))
                          .build();
        }
    }
    
    /**
     * Sauvegarde un partage en cours de création (statut NEW)
     * POST /api/shares/save
     */
    @POST
    @Path("/save")
    public Response saveShare(ShareRequest request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("💾 Sauvegarde d'un partage en cours de création");
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            String email = userInfo.email;
            
            ShareResponse response = shareService.saveShare(request, username, email);
            
            return Response.status(Response.Status.CREATED)
                          .entity(response)
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Validation error: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la sauvegarde du partage");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne du serveur"))
                          .build();
        }
    }
    
    /**
     * Finalise un partage en cours de création (NEW -> ACTIVE)
     * POST /api/shares/{id}/finalize
     */
    @POST
    @Path("/{id}/finalize")
    public Response finalizeShare(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("🎯 Finalisation du partage %s", shareId);
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            ShareResponse response = shareService.finalizeShare(shareId, username);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la finalisation du partage");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne du serveur"))
                          .build();
        }
    }
    
    /**
     * Met à jour un partage en cours de création (statut NEW)
     * PUT /api/shares/{id}/update
     */
    @PUT
    @Path("/{id}/update")
    public Response updateNewShare(@PathParam("id") String shareId, ShareRequest request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("📝 Mise à jour du partage en cours de création %s", shareId);
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            ShareResponse response = shareService.updateNewShare(shareId, request, username);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la mise à jour du partage");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne du serveur"))
                          .build();
        }
    }
    
    /**
     * Récupère un partage par ID
     * GET /api/shares/{id}
     * GET /api/shares/{id}?metadata-only=true (pour récupérer seulement les métadonnées)
     */
    @GET
    @Path("/{id}")
    public Response getShare(@PathParam("id") String shareId, 
                           @QueryParam("metadata-only") @DefaultValue("false") boolean metadataOnly,
                           @HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            ShareResponse response = shareService.getShare(shareId, username, metadataOnly);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération du partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère tous les partages de l'utilisateur connecté
     * GET /api/shares
     */
    @GET
    public Response getUserShares(@HeaderParam("Authorization") String authHeader) {
        try {
            LOG.infof("🔍 GET /api/shares - Endpoint appelé");
            LOG.infof("🔍 GET /api/shares - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            LOG.infof("🔍 GET /api/shares - Authentification réussie pour: %s", username);
            
            List<ShareResponse> shares = shareService.getUserShares(username);
            LOG.infof("🔍 GET /api/shares - Nombre de partages récupérés: %d", shares.size());
            
            Map<String, Object> response = new HashMap<>();
            response.put("shares", shares);
            response.put("total", shares.size());
            
            return Response.ok(response).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des partages");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère les partages partagés avec l'utilisateur connecté
     * GET /api/shares/shared-with-me
     */
    @GET
    @Path("/shared-with-me")
    public Response getSharedWithMe(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String email = userInfo.email;
            
            List<ShareResponse> shares = shareService.getSharedWithUser(email);
            
            Map<String, Object> response = new HashMap<>();
            response.put("shares", shares);
            response.put("total", shares.size());
            
            return Response.ok(response).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des partages partagés");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Met à jour un partage
     * PUT /api/shares/{id}
     */
    @PUT
    @Path("/{id}")
    public Response updateShare(@PathParam("id") String shareId, ShareRequest request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            ShareResponse response = shareService.updateShare(shareId, request, username);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la mise à jour du partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Supprime un partage
     * DELETE /api/shares/{id}
     */
    @DELETE
    @Path("/{id}")
    public Response deleteShare(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            boolean deleted = shareService.deleteShare(shareId, username);
            
            if (deleted) {
                Map<String, Object> response = new HashMap<>();
                response.put("message", "Partage supprimé avec succès");
                response.put("shareId", shareId);
                return Response.ok(response).build();
            } else {
                return Response.status(Response.Status.NOT_FOUND)
                              .entity(createErrorResponse("Partage non trouvé ou accès non autorisé"))
                              .build();
            }
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la suppression du partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère les données d'un partage pour un destinataire
     * GET /api/shares/{id}/data
     */
    @GET
    @Path("/{id}/data")
    public Response getShareData(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String email = userInfo.email;
            
            Object data = shareService.getShareData(shareId, email);
            
            // Marquer comme accédé
            shareService.markAsAccessed(shareId, email);
            
            return Response.ok(data).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des données du partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Marque un partage comme consulté par un destinataire
     * POST /api/shares/{id}/access
     */
    @POST
    @Path("/{id}/access")
    public Response markAsAccessed(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String email = userInfo.email;
            
            shareService.markAsAccessed(shareId, email);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Accès enregistré");
            response.put("shareId", shareId);
            
            return Response.ok(response).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de l'enregistrement de l'accès au partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Endpoint de statistiques pour l'administrateur
     * GET /api/shares/stats
     */
    @GET
    @Path("/stats")
    public Response getShareStats(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            String email = userInfo.email;
            
            List<ShareResponse> userShares = shareService.getUserShares(username);
            List<ShareResponse> sharedWithUser = shareService.getSharedWithUser(email);
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalCreated", userShares.size());
            stats.put("totalReceived", sharedWithUser.size());
            stats.put("recentShares", userShares.stream().limit(5).toList());
            
            return Response.ok(stats).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des statistiques");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Génère un lien d'accès pour un destinataire
     * POST /api/shares/{id}/recipient-link
     */
    @POST
    @Path("/{id}/recipient-link")
    public Response generateRecipientLink(@PathParam("id") String shareId, Map<String, Object> request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            String recipientEmail = (String) request.get("email");
            Integer validityDays = (Integer) request.getOrDefault("validityDays", 7);
            
            if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                              .entity(createErrorResponse("Email du destinataire requis"))
                              .build();
            }
            
            LOG.infof("Génération de lien d'accès pour le partage %s, destinataire %s, durée %d jours", 
                     shareId, recipientEmail, validityDays);
            
            String accessUrl = shareService.generateRecipientLink(shareId, recipientEmail, validityDays, username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("accessUrl", accessUrl);
            response.put("recipientEmail", recipientEmail);
            response.put("validityDays", validityDays);
            response.put("shareId", shareId);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la génération du lien d'accès pour le partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère tous les tokens d'accès pour un partage
     * GET /api/shares/{id}/access-tokens
     */
    @GET
    @Path("/{id}/access-tokens")
    public Response getAccessTokens(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            java.util.List<AccessTokenResponse> tokens = shareService.getAccessTokensForShare(shareId, username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("tokens", tokens);
            response.put("total", tokens.size());
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des tokens pour le partage %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }

    /**
     * Renvoie l'email d'accès à un destinataire
     * POST /api/shares/{id}/resend-email
     */
    @POST
    @Path("/{id}/resend-email")
    public Response resendAccessEmail(@PathParam("id") String shareId, Map<String, Object> request, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            String recipientEmail = (String) request.get("email");
            
            if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                              .entity(createErrorResponse("Email du destinataire requis"))
                              .build();
            }
            
            LOG.infof("Renvoi de l'email d'accès pour le partage %s, destinataire %s", shareId, recipientEmail);
            
            shareService.resendAccessEmail(shareId, recipientEmail, username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Email d'accès renvoyé avec succès");
            response.put("recipientEmail", recipientEmail);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (IllegalStateException e) {
            return Response.status(Response.Status.CONFLICT)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors du renvoi de l'email d'accès");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur lors de l'envoi de l'email"))
                          .build();
        }
    }
    
    /**
     * Récupère tous les tokens d'accès de l'utilisateur connecté
     * GET /api/shares/my-access-tokens
     */
    @GET
    @Path("/my-access-tokens")
    public Response getMyAccessTokens(@HeaderParam("Authorization") String authHeader) {
        try {
            LOG.infof("🔍 GET /api/shares/my-access-tokens - Endpoint appelé");
            LOG.infof("🔍 GET /api/shares/my-access-tokens - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String userEmail = userInfo.email;
            LOG.infof("🔍 GET /api/shares/my-access-tokens - Authentification réussie pour: %s", userEmail);
            
            java.util.List<AccessTokenResponse> tokens = shareService.getUserAccessTokens(userEmail);
            
            LOG.infof("🔍 Tokens récupérés: %d", tokens.size());
            
            Map<String, Object> response = new HashMap<>();
            response.put("tokens", tokens);
            response.put("total", tokens.size());
            
            return Response.ok(response).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des tokens d'accès de l'utilisateur");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère tous les contacts utilisés par l'utilisateur connecté
     * GET /api/shares/my-contacts
     */
    @GET
    @Path("/my-contacts")
    public Response getMyContacts(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            List<ShareService.ContactInfo> contacts = shareService.getUserContacts(username);
            
            // Convertir en format compatible avec le frontend
            List<Map<String, String>> formattedContacts = contacts.stream()
                .map(contact -> {
                    Map<String, String> contactMap = new HashMap<>();
                    contactMap.put("email", contact.email);
                    contactMap.put("displayName", contact.displayName);
                    contactMap.put("formattedContact", contact.getFormattedContact());
                    return contactMap;
                })
                .collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("contacts", formattedContacts);
            response.put("total", formattedContacts.size());
            
            return Response.ok(response).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des contacts");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur lors de la récupération des contacts"))
                          .build();
        }
    }
    
    /**
     * Télécharge le fichier original d'un partage
     * GET /api/shares/{id}/file
     */
    @GET
    @Path("/{id}/file")
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    public Response downloadShareFile(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            LOG.infof("📥 Téléchargement du fichier pour le partage %s par %s", shareId, username);
            
            java.io.InputStream fileStream = shareService.getShareFile(shareId, username);
            
            // Récupérer le nom original du fichier
            Share share = shareService.getShareById(shareId);
            String fileName = share.originalFileName != null ? share.originalFileName : share.fileName;
            
            return Response.ok(fileStream)
                          .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Erreur de validation: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            LOG.warnf("Erreur de sécurité: %s", e.getMessage());
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors du téléchargement du fichier");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Télécharge le fichier avec les données mises à jour des accès validés
     * GET /api/shares/{id}/file-with-validated-data
     */
    @GET
    @Path("/{id}/file-with-validated-data")
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    public Response downloadShareFileWithValidatedData(@PathParam("id") String shareId, @HeaderParam("Authorization") String authHeader) {
        try {
            LOG.infof("📥 Téléchargement du fichier avec données validées - shareId=%s, authHeader=%s", 
                     shareId, authHeader != null ? "PRÉSENT" : "ABSENT");
            
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            LOG.infof("📥 Téléchargement du fichier avec données validées pour le partage %s par %s", shareId, username);
            
            byte[] fileBytes = shareService.getShareFileWithValidatedData(shareId, username);
            
            LOG.infof("📥 Fichier généré avec succès, taille: %d bytes", fileBytes.length);
            
            // Récupérer le nom original du fichier
            Share share = shareService.getShareById(shareId);
            String fileName = share.originalFileName != null ? share.originalFileName : share.fileName;
            
            LOG.infof("📥 Nom de fichier original: %s", fileName);
            
            // Ajouter un suffixe pour indiquer que c'est le fichier avec les données validées
            String updatedFileName;
            int lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                String baseName = fileName.substring(0, lastDotIndex);
                String extension = fileName.substring(lastDotIndex);
                updatedFileName = baseName + "_avec_donnees_validees" + extension;
            } else {
                // Pas d'extension, ajouter le suffixe à la fin
                updatedFileName = fileName + "_avec_donnees_validees";
            }
            
            LOG.infof("📥 Nom de fichier mis à jour: %s", updatedFileName);
            
            return Response.ok(fileBytes)
                          .header("Content-Disposition", "attachment; filename=\"" + updatedFileName + "\"")
                          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                          .build();
                          
        } catch (WebApplicationException e) {
            LOG.warnf("Erreur WebApplication: %s", e.getMessage());
            throw e; // Re-lancer les WebApplicationException (401, etc.)
        } catch (IllegalArgumentException e) {
            LOG.warnf("Erreur de validation: %s", e.getMessage());
            LOG.errorf(e, "Stack trace complète:");
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            LOG.warnf("Erreur de sécurité: %s", e.getMessage());
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors du téléchargement du fichier avec données validées");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Révoque un token d'accès
     * DELETE /api/shares/access-tokens/{tokenId}
     */
    @DELETE
    @Path("/access-tokens/{tokenId}")
    public Response revokeAccessToken(@PathParam("tokenId") String tokenId, @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            String username = userInfo.email;
            
            boolean revoked = shareService.revokeAccessToken(tokenId, username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Token révoqué avec succès");
            response.put("tokenId", tokenId);
            response.put("revoked", revoked);
            
            return Response.ok(response).build();
            
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la révocation du token %s", tokenId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Récupère le tabdata pour un destinataire spécifique
     */
    @GET
    @Path("/{id}/recipients/{email}/tabdata")
    public Response getRecipientTabdata(@PathParam("id") String shareId, 
                                       @PathParam("email") String recipientEmail,
                                       @HeaderParam("Authorization") String authHeader) {
        try {
            LOG.infof("📊 Récupération tabdata pour shareId=%s, recipientEmail=%s", shareId, recipientEmail);
            
            // Valider l'authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                              .entity(createErrorResponse("Authentification requise"))
                              .build();
            }
            
            // Récupérer le tabdata depuis la base (SANS ACCÈS FICHIER)
            Object tabdata = shareService.getShareData(shareId, recipientEmail);
            
            return Response.ok(tabdata).build();
            
        } catch (SecurityException e) {
            if (e.getMessage().contains("obsolète")) {
                LOG.warnf("⚠️ Tabdata obsolète pour %s - Code 409", recipientEmail);
                return Response.status(409)
                              .entity(createErrorResponse("Tabdata obsolète - recalcul nécessaire"))
                              .build();
            }
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération du tabdata pour %s", recipientEmail);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne"))
                          .build();
        }
    }
    
    /**
     * Recalcule le tabdata pour tous les destinataires d'un partage (propriétaire uniquement)
     */
    @POST
    @Path("/{id}/rebuild-tabdata")
    public Response rebuildTabdata(@PathParam("id") String shareId,
                                  @HeaderParam("Authorization") String authHeader) {
        Optional<Response> forbidden = subscriptionEnforcement.requireActiveSubscription(authHeader);
        if (forbidden.isPresent()) return forbidden.get();
        try {
            LOG.infof("🔄 Recalcul tabdata pour shareId=%s", shareId);
            
            // Valider l'authentification
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                              .entity(createErrorResponse("Authentification requise"))
                              .build();
            }
            
            // Vérifier que l'utilisateur est propriétaire
            Share share = shareService.getShareById(shareId);
            if (share == null) {
                return Response.status(Response.Status.NOT_FOUND)
                              .entity(createErrorResponse("Partage non trouvé"))
                              .build();
            }
            
            if (!share.ownerUsername.equals(userInfo.sub)) {
                return Response.status(Response.Status.FORBIDDEN)
                              .entity(createErrorResponse("Seul le propriétaire peut recalculer le tabdata"))
                              .build();
            }
            
            // Recalculer le tabdata pour tous les destinataires
            shareService.rebuildTabdataForAllRecipients(shareId, userInfo.sub);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Tabdata recalculé avec succès");
            response.put("shareId", shareId);
            response.put("timestamp", System.currentTimeMillis());
            
            return Response.ok(response).build();
            
        } catch (SecurityException e) {
            return Response.status(Response.Status.FORBIDDEN)
                          .entity(createErrorResponse("Accès non autorisé"))
                          .build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors du recalcul du tabdata pour %s", shareId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur lors du recalcul"))
                          .build();
        }
    }

    
    /**
     * Options CORS pour tous les endpoints
     */
    @OPTIONS
    @Path("/{path:.*}")
    public Response options() {
        return Response.ok()
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
                .build();
    }
    
    // Méthodes utilitaires privées
    
    private String getEmailFromToken(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = validateAuthFromHeader(authHeader);
            return userInfo != null ? userInfo.email : null;
        } catch (Exception e) {
            LOG.warnf("Impossible de récupérer l'email du token JWT: %s", e.getMessage());
            return null;
        }
    }
    
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", message);
        error.put("timestamp", System.currentTimeMillis());
        return error;
    }
} 