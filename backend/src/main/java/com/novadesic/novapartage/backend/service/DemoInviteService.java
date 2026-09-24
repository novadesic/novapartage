package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.DemoEntitlement;
import com.novadesic.novapartage.backend.model.DemoInvite;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import java.nio.charset.StandardCharsets;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Création d'invitations démo (usage unique), réservation e-mail, activation après auth.
 */
@ApplicationScoped
public class DemoInviteService {

    private static final Logger LOG = Logger.getLogger(DemoInviteService.class);

    private final SecureRandom secureRandom = new SecureRandom();

    @ConfigProperty(name = "app.demo.invite-validity-days", defaultValue = "60")
    int inviteValidityDays;

    @ConfigProperty(name = "app.demo.entitlement-days", defaultValue = "30")
    int entitlementDays;

    public static String sha256Hex(String rawToken) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256", e);
        }
    }

    /**
     * @return jeton brut (une seule fois) et date d'expiration du lien
     */
    @Transactional
    public CreatedInvite createInvite(String createdByEmail) {
        String normalizedCreator = normalizeEmail(createdByEmail);
        byte[] rnd = new byte[32];
        secureRandom.nextBytes(rnd);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(rnd);
        String hash = sha256Hex(rawToken);

        LocalDateTime now = LocalDateTime.now();
        DemoInvite inv = new DemoInvite();
        inv.tokenHash = hash;
        inv.createdByEmail = normalizedCreator;
        inv.createdAt = now;
        inv.inviteExpiresAt = now.plusDays(inviteValidityDays);
        inv.persist();

        LOG.infof("Demo invite created id=%d by %s, link expires %s", inv.id, normalizedCreator, inv.inviteExpiresAt);
        return new CreatedInvite(rawToken, inv.inviteExpiresAt, inviteValidityDays, entitlementDays);
    }

    public Optional<DemoInvite> findByRawToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        String hash = sha256Hex(rawToken.trim());
        return Optional.ofNullable(DemoInvite.find("tokenHash", hash).firstResult());
    }

    public record CreatedInvite(String rawToken, LocalDateTime inviteExpiresAt, int inviteValidityDays,
                                int entitlementDays) {}

    public enum InviteState {
        VALID,
        INVALID,
        EXPIRED,
        CONSUMED
    }

    public InviteState classify(DemoInvite inv) {
        if (inv == null) {
            return InviteState.INVALID;
        }
        if (inv.consumedAt != null) {
            return InviteState.CONSUMED;
        }
        if (LocalDateTime.now().isAfter(inv.inviteExpiresAt)) {
            return InviteState.EXPIRED;
        }
        return InviteState.VALID;
    }

    /**
     * Réserve l'invitation pour un e-mail (avant vérification de la boîte).
     */
    @Transactional
    public void reserve(String rawToken, String email) {
        String em = normalizeEmail(email);
        Optional<DemoInvite> opt = findByRawToken(rawToken);
        if (opt.isEmpty()) {
            throw new DemoInviteException("invalid_token", "Invitation invalide.");
        }
        DemoInvite inv = opt.get();
        InviteState st = classify(inv);
        if (st == InviteState.CONSUMED) {
            throw new DemoInviteException("consumed", "Cette invitation a déjà été utilisée.");
        }
        if (st == InviteState.EXPIRED) {
            throw new DemoInviteException("expired", "Ce lien d'invitation a expiré.");
        }

        if (inv.reservedEmail != null && !inv.reservedEmail.equals(em)) {
            throw new DemoInviteException("email_mismatch", "Cette invitation est déjà associée à une autre adresse e-mail.");
        }
        inv.reservedEmail = em;
        inv.reservedAt = LocalDateTime.now();
        LOG.infof("Demo invite %d reserved for %s", inv.id, em);
    }

    /**
     * Active la période testeur après connexion (JWT = e-mail vérifié).
     */
    @Transactional
    public LocalDateTime activate(String rawToken, String authenticatedEmail) {
        String em = normalizeEmail(authenticatedEmail);
        Optional<DemoInvite> opt = findByRawToken(rawToken);
        if (opt.isEmpty()) {
            throw new DemoInviteException("invalid_token", "Invitation invalide.");
        }
        DemoInvite inv = opt.get();
        InviteState st = classify(inv);
        if (st == InviteState.CONSUMED) {
            throw new DemoInviteException("consumed", "Cette invitation a déjà été utilisée.");
        }
        if (st == InviteState.EXPIRED) {
            throw new DemoInviteException("expired", "Ce lien d'invitation a expiré.");
        }
        if (inv.reservedEmail == null || !inv.reservedEmail.equals(em)) {
            throw new DemoInviteException("not_reserved",
                    "L'adresse e-mail ne correspond pas à celle saisie à l'étape précédente. Utilisez la même adresse ou recommencez.");
        }

        LocalDateTime validUntil = LocalDateTime.now().plusDays(entitlementDays);

        DemoEntitlement ent = DemoEntitlement.findById(em);
        if (ent == null) {
            ent = new DemoEntitlement();
            ent.email = em;
            ent.createdAt = LocalDateTime.now();
            ent.validUntil = validUntil;
            ent.inviteId = inv.id;
            ent.persist();
        } else {
            ent.validUntil = validUntil;
            ent.inviteId = inv.id;
        }

        inv.consumedAt = LocalDateTime.now();

        LOG.infof("Demo activated for %s until %s (invite %d)", em, validUntil, inv.id);
        return validUntil;
    }

    public static String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase();
    }

    public static class DemoInviteException extends RuntimeException {
        public final String code;

        public DemoInviteException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
