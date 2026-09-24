package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.model.dto.ShareRequest;
import com.novadesic.novapartage.backend.model.dto.ShareResponse;
import com.novadesic.novapartage.backend.service.ShareService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;

@Path("/api/guest/shares")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GuestShareController {
    
    private static final Logger LOG = Logger.getLogger(GuestShareController.class);
    
    @Inject
    ShareService shareService;
    
    /**
     * Sauvegarde un partage en mode invité (statut NEW)
     * POST /api/guest/shares/save
     */
    @POST
    @Path("/save")
    public Response saveGuestShare(ShareRequest request) {
        try {
            LOG.infof("💾 Sauvegarde d'un partage invité en cours de création");
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
            
            // Utiliser un utilisateur temporaire pour les partages invités
            String guestUsername = "guest_" + System.currentTimeMillis();
            String guestEmail = "guest@example.com";
            
            LOG.infof("👤 Utilisateur invité: %s (%s)", guestUsername, guestEmail);
            
            ShareResponse response = shareService.saveShare(request, guestUsername, guestEmail);
            
            return Response.status(Response.Status.CREATED)
                          .entity(response)
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Validation error: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la sauvegarde du partage invité");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne lors de la sauvegarde du partage"))
                          .build();
        }
    }
    
    /**
     * Finalise un partage invité après authentification
     * POST /api/guest/shares/{id}/finalize
     */
    @POST
    @Path("/{id}/finalize")
    public Response finalizeGuestShare(@PathParam("id") String shareId) {
        try {
            LOG.infof("🚀 Finalisation d'un partage invité: %s", shareId);
            
            // Récupérer l'utilisateur authentifié depuis le token JWT
            // Note: Cette méthode sera appelée après authentification
            String username = "guest_user"; // Utilisateur temporaire pour les partages invités
            ShareResponse response = shareService.finalizeShare(shareId, username);
            
            return Response.status(Response.Status.OK)
                          .entity(response)
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Validation error: %s", e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                          .entity(createErrorResponse(e.getMessage()))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la finalisation du partage invité");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne lors de la finalisation du partage"))
                          .build();
        }
    }
    
    /**
     * Récupère les métadonnées d'un partage invité
     * GET /api/guest/shares/{id}
     */
    @GET
    @Path("/{id}")
    public Response getGuestShare(@PathParam("id") String shareId) {
        try {
            LOG.infof("📋 Récupération des métadonnées du partage invité: %s", shareId);
            
            // Utiliser getShare avec metadataOnly=true pour récupérer seulement les métadonnées
            String username = "guest_user"; // Utilisateur temporaire pour les partages invités
            ShareResponse response = shareService.getShare(shareId, username, true);
            
            return Response.status(Response.Status.OK)
                          .entity(response)
                          .build();
                          
        } catch (IllegalArgumentException e) {
            LOG.warnf("Share not found: %s", e.getMessage());
            return Response.status(Response.Status.NOT_FOUND)
                          .entity(createErrorResponse("Partage non trouvé"))
                          .build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération du partage invité");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(createErrorResponse("Erreur interne lors de la récupération du partage"))
                          .build();
        }
    }
    
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        return errorResponse;
    }
}

