package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.auth.CustomAuthService;
import com.novadesic.novapartage.backend.service.DemoInviteService;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Création d'invitations démo (superadmins uniquement).
 */
@Path("/api/admin/demo-invites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminDemoInviteController {

    private static final Logger LOG = Logger.getLogger(AdminDemoInviteController.class);

    @Inject
    CustomAuthService authService;

    @Inject
    DemoInviteService demoInviteService;

    @POST
    public Response create(@HeaderParam("Authorization") String authHeader) {
        CustomAuthService.UserInfo user = requireSuperadmin(authHeader);
        try {
            DemoInviteService.CreatedInvite created = demoInviteService.createInvite(user.email);
            Map<String, Object> body = new HashMap<>();
            body.put("token", created.rawToken());
            body.put("inviteExpiresAt", created.inviteExpiresAt().toString());
            body.put("inviteValidityDays", created.inviteValidityDays());
            body.put("entitlementDays", created.entitlementDays());
            body.put("relativePath", "/demo-inscription?t=" + URLEncoder.encode(created.rawToken(), StandardCharsets.UTF_8));
            return Response.ok(body).build();
        } catch (Exception e) {
            LOG.errorf(e, "create demo invite failed");
            return Response.serverError().entity(Map.of("error", "Impossible de créer l'invitation")).build();
        }
    }

    private CustomAuthService.UserInfo requireSuperadmin(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new WebApplicationException(Response.status(401).entity(Map.of("error", "Authentification requise")).build());
        }
        CustomAuthService.UserInfo userInfo = authService.validateToken(authHeader.substring(7));
        if (userInfo == null) {
            throw new WebApplicationException(Response.status(401).entity(Map.of("error", "Token invalide")).build());
        }
        if (!userInfo.isSuperadmin) {
            throw new WebApplicationException(Response.status(403).entity(Map.of("error", "Réservé aux administrateurs")).build());
        }
        return userInfo;
    }
}
