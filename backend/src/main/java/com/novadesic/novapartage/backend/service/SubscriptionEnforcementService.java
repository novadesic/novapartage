package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.auth.CustomAuthService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;

import java.util.Optional;

/**
 * Vérifie que l'utilisateur est authentifié avant d'autoriser les mutations.
 * En self-host (sans Kooneo), tout utilisateur connecté a un accès complet.
 */
@ApplicationScoped
public class SubscriptionEnforcementService {

    /** Conservé pour compatibilité API / frontend (legacy Kooneo). */
    public static final String REASON_NO_SUBSCRIPTION = "no_subscription";

    @Inject
    CustomAuthService authService;

    /**
     * @param authHeader header Authorization (Bearer token)
     * @return Optional.empty() si l'utilisateur peut effectuer des mutations, sinon Response 401
     */
    public Optional<Response> requireActiveSubscription(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Optional.of(Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Authentification requise\"}")
                    .build());
        }
        String token = authHeader.substring(7);
        CustomAuthService.UserInfo userInfo = authService.validateToken(token);
        if (userInfo == null) {
            return Optional.of(Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Authentification requise\"}")
                    .build());
        }
        return Optional.empty();
    }
}
