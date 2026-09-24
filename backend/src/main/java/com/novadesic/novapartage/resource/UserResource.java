package com.novadesic.novapartage.resource;

import com.novadesic.novapartage.backend.auth.CustomAuthService;
import com.novadesic.novapartage.backend.service.DemoEntitlementService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.container.ContainerRequestContext;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Path("/api/user")
public class UserResource {

    private static final Logger LOG = Logger.getLogger(UserResource.class);

    @Inject
    CustomAuthService authService;

    @Inject
    DemoEntitlementService demoEntitlementService;

    @Context
    ContainerRequestContext requestContext;

    @GET
    @Path("/profile")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getProfile() {
        try {
            LOG.infof("🔍 GET /api/user/profile - Endpoint appelé");
            
            CustomAuthService.UserInfo userInfo = authService.validateAuthFromContext(requestContext);
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Authentification requise\"}")
                    .build();
            }
            
            Map<String, Object> profile = new HashMap<>();
            profile.put("username", userInfo.email);
            profile.put("email", userInfo.email);
            profile.put("firstName", userInfo.name);
            profile.put("lastName", "");
            
            return Response.ok(profile).build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération du profil");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("{\"error\": \"Erreur interne\"}")
                .build();
        }
    }

    @GET
    @Path("/admin")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAdminInfo() {
        try {
            LOG.infof("🔍 GET /api/user/admin - Endpoint appelé");
            
            CustomAuthService.UserInfo userInfo = authService.validateAuthFromContext(requestContext);
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Authentification requise\"}")
                    .build();
            }
            
            Map<String, Object> adminInfo = new HashMap<>();
            adminInfo.put("message", "Bienvenue dans la zone d'administration");
            adminInfo.put("user", userInfo.email);
            adminInfo.put("timestamp", System.currentTimeMillis());
            
            return Response.ok(adminInfo).build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération des infos admin");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("{\"error\": \"Erreur interne\"}")
                .build();
        }
    }

    @GET
    @Path("/public")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getPublicInfo() {
        Map<String, Object> publicInfo = new HashMap<>();
        publicInfo.put("message", "Informations publiques");
        publicInfo.put("timestamp", System.currentTimeMillis());
        
        return Response.ok(publicInfo).build();
    }

    /**
     * Vérifie si l'utilisateur connecté a un abonnement actif.
     * GET /api/user/subscription/active
     */
    @GET
    @Path("/subscription/active")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSubscriptionActive(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                userInfo = authService.validateToken(token);
            }
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Authentification requise\"}")
                    .build();
            }
            Map<String, Object> body = buildSubscriptionBody(userInfo);
            return Response.ok(body).build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la vérification de l'abonnement");
            Map<String, Object> body = new HashMap<>();
            body.put("active", false);
            body.put("restricted", true);
            body.put("reason", "temporary");
            return Response.ok(body).build();
        }
    }

    /**
     * Données compte : droits et profil local (JWT).
     * GET /api/user/account
     */
    @GET
    @Path("/account")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAccount(@HeaderParam("Authorization") String authHeader) {
        try {
            CustomAuthService.UserInfo userInfo = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                userInfo = authService.validateToken(token);
            }
            if (userInfo == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("{\"error\": \"Authentification requise\"}")
                        .build();
            }
            String email = userInfo.email;
            Map<String, Object> subscription = buildSubscriptionBody(userInfo);
            Map<String, Object> member = buildMemberFromUserInfo(userInfo);
            List<Map<String, Object>> groups = List.of();

            LOG.infof("UserResource - GET /account pour %s : member=%s", email, member.keySet());

            Map<String, Object> body = new HashMap<>();
            body.put("subscription", subscription);
            body.put("member", member);
            body.put("groups", groups);
            return Response.ok(body).build();
        } catch (Exception e) {
            LOG.errorf(e, "Erreur lors de la récupération du compte");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"Erreur interne\"}")
                    .build();
        }
    }

    private Map<String, Object> buildSubscriptionBody(CustomAuthService.UserInfo userInfo) {
        Map<String, Object> body = new HashMap<>();
        Optional<LocalDateTime> demoUntil = demoEntitlementService.getActiveDemoValidUntil(userInfo.email);
        body.put("active", true);
        body.put("restricted", false);
        body.put("reason", (String) null);
        body.put("demoMode", demoUntil.isPresent() && !userInfo.isSuperadmin);
        body.put("demoExpiresAt", demoUntil.map(LocalDateTime::toString).orElse(null));
        return body;
    }

    private Map<String, Object> buildMemberFromUserInfo(CustomAuthService.UserInfo userInfo) {
        Map<String, Object> member = new HashMap<>();
        member.put("email", userInfo.email);
        if (userInfo.name != null && !userInfo.name.isBlank()) {
            member.put("firstname", userInfo.name);
            member.put("name", userInfo.name);
        }
        return member;
    }
}
