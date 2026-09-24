package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.DemoEntitlement;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Période testeur (table ddsshare_demo_entitlements).
 */
@ApplicationScoped
public class DemoEntitlementService {

    public Optional<LocalDateTime> getActiveDemoValidUntil(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        String normalized = DemoInviteService.normalizeEmail(email);
        DemoEntitlement ent = DemoEntitlement.findById(normalized);
        if (ent == null) {
            return Optional.empty();
        }
        if (ent.validUntil.isAfter(LocalDateTime.now())) {
            return Optional.of(ent.validUntil);
        }
        return Optional.empty();
    }

    public boolean hasActiveDemoAccess(String email) {
        return getActiveDemoValidUntil(email).isPresent();
    }
}
