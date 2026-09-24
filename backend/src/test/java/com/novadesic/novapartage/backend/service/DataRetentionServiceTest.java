package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.FormSubmission;
import com.novadesic.novapartage.backend.model.Recipient;
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
public class DataRetentionServiceTest {
    
    @Inject
    DataRetentionService dataRetentionService;
    
    @Inject
    EntityManager em;
    
    private Share newShareOld;
    private Share newShareRecent;
    private Share finishedShareOld;
    private Share finishedShareRecent;
    private Share inactiveShareOld;
    private Share inactiveShareRecent;
    private AccessToken expiredToken;
    private AccessToken validatedToken;
    private FormSubmission orphanSubmission;
    
    @BeforeEach
    @Transactional
    void setUp() {
        // Créer un share NEW ancien (il y a 8 jours - devrait être supprimé)
        newShareOld = new Share();
        newShareOld.fileName = "old-new.xlsx";
        newShareOld.ownerUsername = "testuser";
        newShareOld.ownerEmail = "testuser@example.com";
        newShareOld.status = Share.ShareStatus.NEW;
        newShareOld.createdAt = LocalDateTime.now().minusDays(8);
        newShareOld.persist();
        
        // Créer un share NEW récent (il y a 3 jours - ne devrait pas être supprimé)
        newShareRecent = new Share();
        newShareRecent.fileName = "recent-new.xlsx";
        newShareRecent.ownerUsername = "testuser";
        newShareRecent.ownerEmail = "testuser@example.com";
        newShareRecent.status = Share.ShareStatus.NEW;
        newShareRecent.createdAt = LocalDateTime.now().minusDays(3);
        newShareRecent.persist();
        
        // Créer un share FINISHED ancien (il y a 19 mois - devrait être supprimé)
        finishedShareOld = new Share();
        finishedShareOld.fileName = "old-finished.xlsx";
        finishedShareOld.ownerUsername = "testuser";
        finishedShareOld.ownerEmail = "testuser@example.com";
        finishedShareOld.status = Share.ShareStatus.FINISHED;
        finishedShareOld.createdAt = LocalDateTime.now().minusMonths(19);
        finishedShareOld.updatedAt = LocalDateTime.now().minusMonths(19);
        finishedShareOld.persist();
        
        // Créer un share FINISHED récent (il y a 12 mois - ne devrait pas être supprimé)
        finishedShareRecent = new Share();
        finishedShareRecent.fileName = "recent-finished.xlsx";
        finishedShareRecent.ownerUsername = "testuser";
        finishedShareRecent.ownerEmail = "testuser@example.com";
        finishedShareRecent.status = Share.ShareStatus.FINISHED;
        finishedShareRecent.createdAt = LocalDateTime.now().minusMonths(12);
        finishedShareRecent.updatedAt = LocalDateTime.now().minusMonths(12);
        finishedShareRecent.persist();
        
        // Créer un share INACTIVE ancien (il y a 8 mois - devrait être supprimé)
        inactiveShareOld = new Share();
        inactiveShareOld.fileName = "old-inactive.xlsx";
        inactiveShareOld.ownerUsername = "testuser";
        inactiveShareOld.ownerEmail = "testuser@example.com";
        inactiveShareOld.status = Share.ShareStatus.INACTIVE;
        inactiveShareOld.createdAt = LocalDateTime.now().minusMonths(8);
        inactiveShareOld.updatedAt = LocalDateTime.now().minusMonths(8);
        inactiveShareOld.deletionNotificationSent = false;
        inactiveShareOld.persist();
        
        // Créer un share INACTIVE récent (il y a 5 mois - ne devrait pas être supprimé)
        inactiveShareRecent = new Share();
        inactiveShareRecent.fileName = "recent-inactive.xlsx";
        inactiveShareRecent.ownerUsername = "testuser";
        inactiveShareRecent.ownerEmail = "testuser@example.com";
        inactiveShareRecent.status = Share.ShareStatus.INACTIVE;
        inactiveShareRecent.createdAt = LocalDateTime.now().minusMonths(5);
        inactiveShareRecent.updatedAt = LocalDateTime.now().minusMonths(5);
        inactiveShareRecent.deletionNotificationSent = false;
        inactiveShareRecent.persist();
        
        // Créer un token expiré (il y a plus de 90 jours)
        expiredToken = new AccessToken(
            finishedShareOld.id,
            "expired@test.com",
            "expired-token",
            7,
            "testuser"
        );
        expiredToken.expiresAt = LocalDateTime.now().minusDays(100);
        expiredToken.status = AccessToken.TokenStatus.EXPIRED;
        expiredToken.persist();
        
        // Créer un token validé (il y a plus de 1 an)
        validatedToken = new AccessToken(
            finishedShareOld.id,
            "validated@test.com",
            "validated-token",
            7,
            "testuser"
        );
        validatedToken.status = AccessToken.TokenStatus.VALIDATED;
        validatedToken.validatedAt = LocalDateTime.now().minusYears(2);
        validatedToken.persist();
        
        // Créer une soumission orpheline (shareId n'existe plus, il y a plus de 1 an)
        UUID nonExistentShareId = UUID.randomUUID();
        orphanSubmission = new FormSubmission();
        orphanSubmission.shareId = nonExistentShareId;
        orphanSubmission.recipientEmail = "orphan@test.com";
        orphanSubmission.lastModifiedAt = LocalDateTime.now().minusYears(2);
        orphanSubmission.persist();
    }
    
    @AfterEach
    @Transactional
    void tearDown() {
        // Nettoyer les données de test restantes
        if (orphanSubmission != null && FormSubmission.findById(orphanSubmission.id) != null) {
            orphanSubmission.delete();
        }
        if (validatedToken != null && AccessToken.findById(validatedToken.id) != null) {
            validatedToken.delete();
        }
        if (expiredToken != null && AccessToken.findById(expiredToken.id) != null) {
            expiredToken.delete();
        }
        if (newShareOld != null && Share.findById(newShareOld.id) != null) {
            newShareOld.delete();
        }
        if (newShareRecent != null && Share.findById(newShareRecent.id) != null) {
            newShareRecent.delete();
        }
        if (finishedShareOld != null && Share.findById(finishedShareOld.id) != null) {
            finishedShareOld.delete();
        }
        if (finishedShareRecent != null && Share.findById(finishedShareRecent.id) != null) {
            finishedShareRecent.delete();
        }
        if (inactiveShareOld != null && Share.findById(inactiveShareOld.id) != null) {
            inactiveShareOld.delete();
        }
        if (inactiveShareRecent != null && Share.findById(inactiveShareRecent.id) != null) {
            inactiveShareRecent.delete();
        }
    }
    
    @Test
    @Transactional
    void testCleanupNewShares_ShouldDeleteSharesOlderThan7Days() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupNewShares();
        
        // Vérifier que le share ancien a été supprimé
        assertNull(Share.findById(newShareOld.id), 
                  "Le share NEW ancien (8 jours) devrait être supprimé");
        
        // Vérifier que le share récent n'a pas été supprimé
        assertNotNull(Share.findById(newShareRecent.id), 
                     "Le share NEW récent (3 jours) ne devrait pas être supprimé");
    }
    
    @Test
    @Transactional
    void testCleanupNewShares_ShouldNotDeleteRecentShares() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupNewShares();
        
        // Vérifier que le share récent existe toujours
        Share found = Share.findById(newShareRecent.id);
        assertNotNull(found, "Le share NEW récent devrait toujours exister");
        assertEquals(Share.ShareStatus.NEW, found.status, 
                    "Le statut devrait rester NEW");
    }
    
    @Test
    @Transactional
    void testCleanupFinishedShares_ShouldDeleteSharesOlderThan18Months() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupFinishedShares();
        
        // Vérifier que le share ancien a été supprimé
        assertNull(Share.findById(finishedShareOld.id), 
                  "Le share FINISHED ancien (19 mois) devrait être supprimé");
        
        // Vérifier que le share récent n'a pas été supprimé
        assertNotNull(Share.findById(finishedShareRecent.id), 
                     "Le share FINISHED récent (12 mois) ne devrait pas être supprimé");
    }
    
    @Test
    @Transactional
    void testCleanupFinishedShares_ShouldNotDeleteRecentFinishedShares() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupFinishedShares();
        
        // Vérifier que le share récent existe toujours
        Share found = Share.findById(finishedShareRecent.id);
        assertNotNull(found, "Le share FINISHED récent devrait toujours exister");
        assertEquals(Share.ShareStatus.FINISHED, found.status, 
                    "Le statut devrait rester FINISHED");
    }
    
    @Test
    @Transactional
    void testCleanupInactiveShares_ShouldDeleteSharesOlderThan7Months() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupInactiveShares();
        
        // Vérifier que le share ancien a été supprimé
        assertNull(Share.findById(inactiveShareOld.id), 
                  "Le share INACTIVE ancien (8 mois) devrait être supprimé");
        
        // Vérifier que le share récent n'a pas été supprimé
        assertNotNull(Share.findById(inactiveShareRecent.id), 
                     "Le share INACTIVE récent (5 mois) ne devrait pas être supprimé");
    }
    
    @Test
    @Transactional
    void testCleanupInactiveShares_ShouldSendWarningAt6Months() {
        // Créer un share INACTIVE à 6 mois (devrait recevoir une notification)
        Share inactiveAt6Months = new Share();
        inactiveAt6Months.fileName = "inactive-6months.xlsx";
        inactiveAt6Months.ownerUsername = "testuser";
        inactiveAt6Months.ownerEmail = "testuser@example.com";
        inactiveAt6Months.status = Share.ShareStatus.INACTIVE;
        inactiveAt6Months.createdAt = LocalDateTime.now().minusMonths(6).minusDays(1);
        inactiveAt6Months.updatedAt = LocalDateTime.now().minusMonths(6).minusDays(1);
        inactiveAt6Months.deletionNotificationSent = false;
        inactiveAt6Months.persist();
        em.flush(); // S'assurer que le share est persisté avant de créer le recipient
        em.clear(); // Détacher le share du contexte de persistance
        
        // Recharger le share pour qu'il soit dans le contexte de persistance
        Share managedShare = Share.findById(inactiveAt6Months.id);
        
        // Créer un recipient pour le share via EntityManager
        Recipient recipient = new Recipient("recipient@test.com");
        recipient.share = managedShare; // Utiliser le share géré
        recipient.pageTitle = "Test Form";
        em.persist(recipient);
        em.flush();
        
        // Exécuter le nettoyage
        dataRetentionService.cleanupInactiveShares();
        
        // Recharger le share
        Share reloaded = Share.findById(inactiveAt6Months.id);
        assertNotNull(reloaded, "Le share devrait toujours exister (pas encore supprimé)");
        assertTrue(reloaded.deletionNotificationSent, 
                  "deletionNotificationSent devrait être true après l'envoi de la notification");
        
        // Nettoyer (recipient sera supprimé en cascade)
        inactiveAt6Months.delete();
    }
    
    @Test
    @Transactional
    void testCleanupInactiveShares_ShouldNotSendDuplicateWarnings() {
        // Créer un share INACTIVE qui a déjà reçu une notification
        Share inactiveWithNotification = new Share();
        inactiveWithNotification.fileName = "inactive-notified.xlsx";
        inactiveWithNotification.ownerUsername = "testuser";
        inactiveWithNotification.ownerEmail = "testuser@example.com";
        inactiveWithNotification.status = Share.ShareStatus.INACTIVE;
        inactiveWithNotification.createdAt = LocalDateTime.now().minusMonths(6).minusDays(1);
        inactiveWithNotification.updatedAt = LocalDateTime.now().minusMonths(6).minusDays(1);
        inactiveWithNotification.deletionNotificationSent = true; // Déjà notifié
        inactiveWithNotification.persist();
        
        // Exécuter le nettoyage
        dataRetentionService.cleanupInactiveShares();
        
        // Vérifier que le share existe toujours (pas encore supprimé car seulement 6 mois)
        Share reloaded = Share.findById(inactiveWithNotification.id);
        assertNotNull(reloaded, "Le share devrait toujours exister");
        assertTrue(reloaded.deletionNotificationSent, 
                  "deletionNotificationSent devrait rester true");
        
        // Nettoyer
        inactiveWithNotification.delete();
    }
    
    @Test
    @Transactional
    void testCleanupExpiredTokens_ShouldDeleteTokensOlderThan90Days() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupExpiredTokens();
        
        // Vérifier que le token expiré a été supprimé
        assertNull(AccessToken.findById(expiredToken.id), 
                  "Le token expiré (100 jours) devrait être supprimé");
    }
    
    @Test
    @Transactional
    void testCleanupValidatedTokens_ShouldDeleteTokensOlderThan1Year() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupValidatedTokens();
        
        // Vérifier que le token validé a été supprimé
        assertNull(AccessToken.findById(validatedToken.id), 
                  "Le token validé (2 ans) devrait être supprimé");
    }
    
    @Test
    @Transactional
    void testCleanupOrphanFormSubmissions_ShouldDeleteOrphanSubmissions() {
        // Exécuter le nettoyage
        dataRetentionService.cleanupOrphanFormSubmissions();
        
        // Vérifier que la soumission orpheline a été supprimée
        assertNull(FormSubmission.findById(orphanSubmission.id), 
                  "La soumission orpheline (2 ans) devrait être supprimée");
    }
    
    @Test
    @Transactional
    void testCleanupOrphanFormSubmissions_ShouldRespect1YearRetention() {
        // Créer une soumission orpheline récente (il y a 6 mois - ne devrait pas être supprimée)
        UUID nonExistentShareId = UUID.randomUUID();
        FormSubmission recentOrphan = new FormSubmission();
        recentOrphan.shareId = nonExistentShareId;
        recentOrphan.recipientEmail = "recent-orphan@test.com";
        recentOrphan.lastModifiedAt = LocalDateTime.now().minusMonths(6);
        recentOrphan.persist();
        
        // Exécuter le nettoyage
        dataRetentionService.cleanupOrphanFormSubmissions();
        
        // Vérifier que la soumission récente n'a pas été supprimée
        assertNotNull(FormSubmission.findById(recentOrphan.id), 
                     "La soumission orpheline récente (6 mois) ne devrait pas être supprimée");
        
        // Nettoyer
        recentOrphan.delete();
    }
    
    @Test
    @Transactional
    void testCleanupOrphanFormSubmissions_ShouldNotDeleteActiveSubmissions() {
        // Créer une soumission avec un shareId valide
        Share activeShare = new Share();
        activeShare.fileName = "active-for-submission.xlsx";
        activeShare.ownerUsername = "testuser";
        activeShare.ownerEmail = "testuser@example.com";
        activeShare.status = Share.ShareStatus.ACTIVE;
        activeShare.persist();
        
        FormSubmission activeSubmission = new FormSubmission();
        activeSubmission.shareId = activeShare.id;
        activeSubmission.recipientEmail = "active@test.com";
        activeSubmission.lastModifiedAt = LocalDateTime.now().minusYears(2);
        activeSubmission.persist();
        
        // Exécuter le nettoyage
        dataRetentionService.cleanupOrphanFormSubmissions();
        
        // Vérifier que la soumission active n'a pas été supprimée
        assertNotNull(FormSubmission.findById(activeSubmission.id), 
                     "La soumission avec shareId valide ne devrait pas être supprimée");
        
        // Nettoyer
        activeSubmission.delete();
        activeShare.delete();
    }
}

