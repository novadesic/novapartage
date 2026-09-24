package com.novadesic.novapartage.backend.controller;

import com.novadesic.novapartage.backend.model.DemoInvite;
import com.novadesic.novapartage.backend.service.DemoInviteService;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Validation et réservation d'invitation démo (sans authentification).
 */
@Path("/api/public/demo-invites")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PublicDemoInviteController {

    private static final Logger LOG = Logger.getLogger(PublicDemoInviteController.class);

    @Inject
    DemoInviteService demoInviteService;

    @ConfigProperty(name = "app.demo.entitlement-days", defaultValue = "30")
    int entitlementDaysConfig;

    @GET
    @Path("/validate")
    public Response validate(@QueryParam("token") String token) {
        Map<String, Object> body = new HashMap<>();
        Optional<DemoInvite> opt = demoInviteService.findByRawToken(token);
        if (opt.isEmpty()) {
            body.put("valid", false);
            body.put("reason", "invalid");
            return Response.ok(body).build();
        }
        DemoInvite inv = opt.get();
        DemoInviteService.InviteState st = demoInviteService.classify(inv);
        body.put("inviteExpiresAt", inv.inviteExpiresAt.toString());
        body.put("entitlementDays", entitlementDaysConfig);
        if (st == DemoInviteService.InviteState.CONSUMED) {
            body.put("valid", false);
            body.put("reason", "consumed");
            return Response.ok(body).build();
        }
        if (st == DemoInviteService.InviteState.EXPIRED) {
            body.put("valid", false);
            body.put("reason", "expired");
            return Response.ok(body).build();
        }
        body.put("valid", true);
        body.put("reason", (String) null);
        return Response.ok(body).build();
    }

    @POST
    @Path("/reserve")
    public Response reserve(Map<String, String> bodyIn) {
        String token = bodyIn != null ? bodyIn.get("token") : null;
        String email = bodyIn != null ? bodyIn.get("email") : null;
        Map<String, Object> body = new HashMap<>();
        if (token == null || token.isBlank() || email == null || email.isBlank()) {
            return Response.status(400).entity(Map.of("error", "token et email requis")).build();
        }
        try {
            demoInviteService.reserve(token, email);
            body.put("ok", true);
            return Response.ok(body).build();
        } catch (DemoInviteService.DemoInviteException e) {
            LOG.warnf("reserve demo invite: %s", e.getMessage());
            body.put("ok", false);
            body.put("code", e.code);
            body.put("message", e.getMessage());
            return Response.status(400).entity(body).build();
        }
    }
}
