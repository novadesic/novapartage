package com.novadesic.novapartage.backend.model;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class AccessTokenTest {
    
    @Inject
    EntityManager em;
    
    private Share testShare;
    private AccessToken expiredToken;
    private AccessToken revokedToken;
    private AccessToken validatedToken;
    private AccessToken activeToken;
    
    @BeforeEach
    @Transactional
    void setUp() {
        // Créer un share de test
        testShare = new Share();
        testShare.fileName = "test.xlsx";
        testShare.ownerUsername = "testuser";
        testShare.ownerEmail = "testuser@example.com";
        testShare.status = Share.ShareStatus.ACTIVE;
        testShare.persist();
        
        // Créer un token expiré (il y a plus de 90 jours)
        expiredToken = new AccessToken(
            testShare.id,
            "user1@test.com",
            "expired-token",
            7,
            "testuser"
        );
        expiredToken.expiresAt = LocalDateTime.now().minusDays(100); // Il y a 100 jours
        expiredToken.status = AccessToken.TokenStatus.EXPIRED;
        expiredToken.persist();
        
        // Créer un token révoqué (il y a plus de 90 jours)
        revokedToken = new AccessToken(
            testShare.id,
            "user2@test.com",
            "revoked-token",
            7,
            "testuser"
        );
        revokedToken.expiresAt = LocalDateTime.now().minusDays(95); // Il y a 95 jours
        revokedToken.status = AccessToken.TokenStatus.REVOKED;
        revokedToken.persist();
        
        // Créer un token validé (il y a plus de 1 an)
        validatedToken = new AccessToken(
            testShare.id,
            "user3@test.com",
            "validated-token",
            7,
            "testuser"
        );
        validatedToken.status = AccessToken.TokenStatus.VALIDATED;
        validatedToken.validatedAt = LocalDateTime.now().minusYears(2); // Il y a 2 ans
        validatedToken.persist();
        
        // Créer un token actif (ne doit pas être supprimé)
        activeToken = new AccessToken(
            testShare.id,
            "user4@test.com",
            "active-token",
            7,
            "testuser"
        );
        activeToken.status = AccessToken.TokenStatus.ACTIVE;
        activeToken.expiresAt = LocalDateTime.now().plusDays(5); // Expire dans 5 jours
        activeToken.persist();
    }
    
    @AfterEach
    @Transactional
    void tearDown() {
        // Nettoyer les données de test
        if (expiredToken != null && AccessToken.findById(expiredToken.id) != null) {
            expiredToken.delete();
        }
        if (revokedToken != null && AccessToken.findById(revokedToken.id) != null) {
            revokedToken.delete();
        }
        if (validatedToken != null && AccessToken.findById(validatedToken.id) != null) {
            validatedToken.delete();
        }
        if (activeToken != null && AccessToken.findById(activeToken.id) != null) {
            activeToken.delete();
        }
        if (testShare != null && Share.findById(testShare.id) != null) {
            testShare.delete();
        }
    }
    
    @Test
    @Transactional
    void testDeleteExpiredTokens_ShouldDeleteOnlyExpiredAndRevoked() {
        // Exécuter la suppression
        int deletedCount = AccessToken.deleteExpiredTokens();
        
        // Vérifier que les tokens expirés et révoqués ont été supprimés
        assertNull(AccessToken.findById(expiredToken.id), "Le token expiré devrait être supprimé");
        assertNull(AccessToken.findById(revokedToken.id), "Le token révoqué devrait être supprimé");
        
        // Vérifier que le token actif n'a pas été supprimé
        assertNotNull(AccessToken.findById(activeToken.id), "Le token actif ne devrait pas être supprimé");
        
        // Vérifier que le token validé n'a pas été supprimé (il est géré par deleteValidatedTokens)
        assertNotNull(AccessToken.findById(validatedToken.id), "Le token validé ne devrait pas être supprimé par deleteExpiredTokens");
        
        // Vérifier le nombre de suppressions
        assertTrue(deletedCount >= 2, "Au moins 2 tokens devraient être supprimés");
    }
    
    @Test
    @Transactional
    void testDeleteExpiredTokens_ShouldRespect90DaysRetention() {
        // Créer un token expiré récent (il y a 30 jours - ne doit pas être supprimé)
        AccessToken recentExpiredToken = new AccessToken(
            testShare.id,
            "recent@test.com",
            "recent-expired-token",
            7,
            "testuser"
        );
        recentExpiredToken.expiresAt = LocalDateTime.now().minusDays(30); // Il y a seulement 30 jours
        recentExpiredToken.status = AccessToken.TokenStatus.EXPIRED;
        recentExpiredToken.persist();
        
        // Exécuter la suppression
        int deletedCount = AccessToken.deleteExpiredTokens();
        
        // Vérifier que le token récent n'a pas été supprimé
        assertNotNull(AccessToken.findById(recentExpiredToken.id), 
                     "Le token expiré récent (30 jours) ne devrait pas être supprimé");
        
        // Nettoyer
        recentExpiredToken.delete();
    }
    
    @Test
    @Transactional
    void testDeleteValidatedTokens_ShouldDeleteOnlyValidated() {
        // Exécuter la suppression
        int deletedCount = AccessToken.deleteValidatedTokens();
        
        // Vérifier que le token validé a été supprimé
        assertNull(AccessToken.findById(validatedToken.id), "Le token validé devrait être supprimé");
        
        // Vérifier que les autres tokens n'ont pas été supprimés
        assertNotNull(AccessToken.findById(activeToken.id), "Le token actif ne devrait pas être supprimé");
        
        // Vérifier le nombre de suppressions
        assertTrue(deletedCount >= 1, "Au moins 1 token validé devrait être supprimé");
    }
    
    @Test
    @Transactional
    void testDeleteValidatedTokens_ShouldRespect1YearRetention() {
        // Créer un token validé récent (il y a 6 mois - ne doit pas être supprimé)
        AccessToken recentValidatedToken = new AccessToken(
            testShare.id,
            "recent-validated@test.com",
            "recent-validated-token",
            7,
            "testuser"
        );
        recentValidatedToken.status = AccessToken.TokenStatus.VALIDATED;
        recentValidatedToken.validatedAt = LocalDateTime.now().minusMonths(6); // Il y a seulement 6 mois
        recentValidatedToken.persist();
        
        // Exécuter la suppression
        int deletedCount = AccessToken.deleteValidatedTokens();
        
        // Vérifier que le token validé récent n'a pas été supprimé
        assertNotNull(AccessToken.findById(recentValidatedToken.id), 
                     "Le token validé récent (6 mois) ne devrait pas être supprimé");
        
        // Nettoyer
        recentValidatedToken.delete();
    }
    
    @Test
    @Transactional
    void testIsActive_ShouldReturnTrueForActiveToken() {
        assertTrue(activeToken.isActive(), "Un token actif devrait retourner true");
    }
    
    @Test
    @Transactional
    void testIsActive_ShouldReturnFalseForExpiredToken() {
        assertFalse(expiredToken.isActive(), "Un token expiré devrait retourner false");
    }
    
    @Test
    @Transactional
    void testIsExpired_ShouldReturnTrueForExpiredToken() {
        assertTrue(expiredToken.isExpired(), "Un token expiré devrait retourner true pour isExpired()");
    }
    
    @Test
    @Transactional
    void testIsExpired_ShouldReturnFalseForActiveToken() {
        assertFalse(activeToken.isExpired(), "Un token actif ne devrait pas être expiré");
    }
    
    @Test
    @Transactional
    void testIsReadable_ShouldReturnTrueForValidatedToken() {
        assertTrue(validatedToken.isReadable(), "Un token validé devrait être lisible");
    }
    
    @Test
    @Transactional
    void testIsEditable_ShouldReturnTrueForActiveToken() {
        assertTrue(activeToken.isEditable(), "Un token actif devrait être éditable");
    }
    
    @Test
    @Transactional
    void testIsEditable_ShouldReturnFalseForExpiredToken() {
        assertFalse(expiredToken.isEditable(), "Un token expiré ne devrait pas être éditable");
    }
    
    @Test
    @Transactional
    void testRevoke_ShouldChangeStatusToRevoked() {
        activeToken.revoke();
        // Pas besoin de persist() car l'entité est déjà gérée par Hibernate dans la transaction
        em.flush(); // Forcer la synchronisation avec la base de données
        
        assertEquals(AccessToken.TokenStatus.REVOKED, activeToken.status, 
                    "Le statut devrait être REVOKED après revoke()");
    }
    
    @Test
    @Transactional
    void testExpire_ShouldChangeStatusToExpired() {
        activeToken.expire();
        em.flush();
        
        assertEquals(AccessToken.TokenStatus.EXPIRED, activeToken.status, 
                    "Le statut devrait être EXPIRED après expire()");
    }
    
    @Test
    @Transactional
    void testValidate_ShouldChangeStatusToValidated() {
        activeToken.validate();
        em.flush();
        
        assertEquals(AccessToken.TokenStatus.VALIDATED, activeToken.status, 
                    "Le statut devrait être VALIDATED après validate()");
        assertNotNull(activeToken.validatedAt, "validatedAt devrait être défini");
        assertEquals(activeToken.recipientEmail, activeToken.validatedBy, 
                    "validatedBy devrait être l'email du destinataire");
    }
    
    @Test
    @Transactional
    void testMarkAsUsed_ShouldIncrementUsageCount() {
        int initialCount = activeToken.usageCount;
        activeToken.markAsUsed();
        em.flush();
        
        assertEquals(initialCount + 1, activeToken.usageCount, 
                    "Le compteur d'utilisation devrait être incrémenté");
        assertNotNull(activeToken.lastUsedAt, "lastUsedAt devrait être défini");
    }
}

