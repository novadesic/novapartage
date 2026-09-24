package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.auth.CustomAuthService;
import com.novadesic.novapartage.backend.service.DemoInviteService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Active la période testeur après authentification (e-mail vérifié).
 */
@Path("/api/demo-invites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DemoInviteActivationController {

    private static final Logger LOG = Logger.getLogger(DemoInviteActivationController.class);

    @Inject
    CustomAuthService authService;

    @Inject
    DemoInviteService demoInviteService;

    @POST
    @Path("/activate")
    public Response activate(@HeaderParam("Authorization") String authHeader, Map<String, String> bodyIn) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Response.status(401).entity(Map.of("error", "Authentification requise")).build();
        }
        CustomAuthService.UserInfo userInfo = authService.validateToken(authHeader.substring(7));
        if (userInfo == null) {
            return Response.status(401).entity(Map.of("error", "Token invalide")).build();
        }
        String token = bodyIn != null ? bodyIn.get("token") : null;
        if (token == null || token.isBlank()) {
            return Response.status(400).entity(Map.of("error", "token requis")).build();
        }
        try {
            LocalDateTime validUntil = demoInviteService.activate(token, userInfo.email);
            Map<String, Object> body = new HashMap<>();
            body.put("ok", true);
            body.put("demoValidUntil", validUntil.toString());
            return Response.ok(body).build();
        } catch (DemoInviteService.DemoInviteException e) {
            LOG.warnf("activate demo: %s", e.getMessage());
            Map<String, Object> err = new HashMap<>();
            err.put("ok", false);
            err.put("code", e.code);
            err.put("message", e.getMessage());
            return Response.status(400).entity(err).build();
        }
    }
}
