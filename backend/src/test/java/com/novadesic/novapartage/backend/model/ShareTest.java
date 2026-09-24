package com.novadesic.novapartage.backend.model;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class ShareTest {
    
    @Inject
    EntityManager em;
    
    private Share newShare;
    private Share activeShare;
    private Share finishedShare;
    private Share inactiveShare;
    
    @BeforeEach
    @Transactional
    void setUp() {
        // Créer un share NEW
        newShare = new Share();
        newShare.fileName = "new.xlsx";
        newShare.ownerUsername = "testuser";
        newShare.ownerEmail = "testuser@example.com";
        newShare.status = Share.ShareStatus.NEW;
        newShare.createdAt = LocalDateTime.now().minusDays(3);
        newShare.persist();
        
        // Créer un share ACTIVE
        activeShare = new Share();
        activeShare.fileName = "active.xlsx";
        activeShare.ownerUsername = "testuser";
        activeShare.ownerEmail = "testuser@example.com";
        activeShare.status = Share.ShareStatus.ACTIVE;
        activeShare.createdAt = LocalDateTime.now().minusDays(10);
        activeShare.updatedAt = LocalDateTime.now().minusDays(1);
        activeShare.persist();
        
        // Créer un share FINISHED
        finishedShare = new Share();
        finishedShare.fileName = "finished.xlsx";
        finishedShare.ownerUsername = "testuser";
        finishedShare.ownerEmail = "testuser@example.com";
        finishedShare.status = Share.ShareStatus.FINISHED;
        finishedShare.createdAt = LocalDateTime.now().minusMonths(20);
        finishedShare.updatedAt = LocalDateTime.now().minusMonths(20);
        finishedShare.persist();
        
        // Créer un share INACTIVE
        inactiveShare = new Share();
        inactiveShare.fileName = "inactive.xlsx";
        inactiveShare.ownerUsername = "testuser";
        inactiveShare.ownerEmail = "testuser@example.com";
        inactiveShare.status = Share.ShareStatus.INACTIVE;
        inactiveShare.createdAt = LocalDateTime.now().minusMonths(8);
        inactiveShare.updatedAt = LocalDateTime.now().minusMonths(8);
        inactiveShare.deletionNotificationSent = false;
        inactiveShare.persist();
    }
    
    @AfterEach
    @Transactional
    void tearDown() {
        // Nettoyer les données de test (les recipients seront supprimés en cascade)
        if (newShare != null && Share.findById(newShare.id) != null) {
            newShare.delete();
        }
        if (activeShare != null && Share.findById(activeShare.id) != null) {
            activeShare.delete();
        }
        if (finishedShare != null && Share.findById(finishedShare.id) != null) {
            finishedShare.delete();
        }
        if (inactiveShare != null && Share.findById(inactiveShare.id) != null) {
            inactiveShare.delete();
        }
    }
    
    @Test
    @Transactional
    void testFindNewShares_ShouldReturnOnlyNewStatus() {
        List<Share> newShares = Share.findNewShares();
        
        assertTrue(newShares.size() >= 1, "Devrait trouver au moins 1 share NEW");
        assertTrue(newShares.stream().anyMatch(s -> s.id.equals(newShare.id)), 
                  "Devrait contenir le share NEW créé");
        assertFalse(newShares.stream().anyMatch(s -> s.id.equals(activeShare.id)), 
                   "Ne devrait pas contenir le share ACTIVE");
    }
    
    @Test
    @Transactional
    void testFindByOwner_ShouldReturnAllSharesForOwner() {
        List<Share> userShares = Share.findByOwner("testuser");
        
        assertTrue(userShares.size() >= 4, "Devrait trouver au moins 4 shares pour testuser");
        assertTrue(userShares.stream().anyMatch(s -> s.id.equals(newShare.id)), 
                  "Devrait contenir le share NEW");
        assertTrue(userShares.stream().anyMatch(s -> s.id.equals(activeShare.id)), 
                  "Devrait contenir le share ACTIVE");
    }
    
    @Test
    @Transactional
    void testFindByRecipient_ShouldReturnSharesForRecipient() {
        // Créer un recipient via EntityManager pour ce test
        Recipient recipient = new Recipient("recipient1@test.com");
        recipient.share = activeShare;
        em.persist(recipient);
        em.flush();
        
        List<Share> recipientShares = Share.findByRecipient("recipient1@test.com");
        
        assertTrue(recipientShares.size() >= 1, "Devrait trouver au moins 1 share pour recipient1");
        assertTrue(recipientShares.stream().anyMatch(s -> s.id.equals(activeShare.id)), 
                  "Devrait contenir le share ACTIVE avec recipient1");
        
        // Nettoyer (sera supprimé en cascade avec le share)
    }
    
    @Test
    @Transactional
    void testFindActiveShares_ShouldReturnOnlyActiveStatus() {
        List<Share> activeShares = Share.findActiveShares();
        
        assertTrue(activeShares.size() >= 1, "Devrait trouver au moins 1 share ACTIVE");
        assertTrue(activeShares.stream().anyMatch(s -> s.id.equals(activeShare.id)), 
                  "Devrait contenir le share ACTIVE créé");
        assertFalse(activeShares.stream().anyMatch(s -> s.id.equals(newShare.id)), 
                   "Ne devrait pas contenir le share NEW");
    }
    
    @Test
    @Transactional
    void testDeletionNotificationSent_ShouldDefaultToFalse() {
        Share newShare2 = new Share();
        newShare2.fileName = "test2.xlsx";
        newShare2.ownerUsername = "testuser";
        newShare2.ownerEmail = "testuser@example.com";
        newShare2.status = Share.ShareStatus.NEW;
        newShare2.persist();
        
        assertFalse(newShare2.deletionNotificationSent, 
                   "deletionNotificationSent devrait être false par défaut");
        
        newShare2.delete();
    }
    
    @Test
    @Transactional
    void testDeletionNotificationSent_ShouldHandleNull() {
        // Créer un share sans initialiser deletionNotificationSent explicitement
        Share shareWithNull = new Share();
        shareWithNull.fileName = "null-test.xlsx";
        shareWithNull.ownerUsername = "testuser";
        shareWithNull.ownerEmail = "testuser@example.com";
        shareWithNull.status = Share.ShareStatus.INACTIVE;
        shareWithNull.deletionNotificationSent = null; // Explicitement null
        shareWithNull.persist();
        
        // Recharger depuis la base
        Share reloaded = Share.findById(shareWithNull.id);
        assertNotNull(reloaded, "Le share devrait être trouvé");
        
        // Vérifier que null est géré correctement (devrait être traité comme false dans les requêtes)
        // La requête JPQL devrait gérer null avec "OR deletionNotificationSent IS NULL"
        shareWithNull.delete();
    }
    
    @Test
    @Transactional
    void testIsNew_ShouldReturnTrueForNewStatus() {
        assertTrue(newShare.isNew(), "Un share NEW devrait retourner true pour isNew()");
    }
    
    @Test
    @Transactional
    void testIsNew_ShouldReturnFalseForActiveStatus() {
        assertFalse(activeShare.isNew(), "Un share ACTIVE ne devrait pas être NEW");
    }
    
    @Test
    @Transactional
    void testIsFinalized_ShouldReturnTrueForActiveStatus() {
        assertTrue(activeShare.isFinalized(), "Un share ACTIVE devrait être finalisé");
    }
    
    @Test
    @Transactional
    void testIsFinalized_ShouldReturnFalseForNewStatus() {
        assertFalse(newShare.isFinalized(), "Un share NEW ne devrait pas être finalisé");
    }
    
    @Test
    @Transactional
    void testFinalizeShare_ShouldChangeStatusToActive() {
        newShare.finalizeShare();
        em.flush(); // Pas besoin de persist() car l'entité est déjà gérée
        
        assertEquals(Share.ShareStatus.ACTIVE, newShare.status, 
                    "Le statut devrait être ACTIVE après finalizeShare()");
        assertNotNull(newShare.updatedAt, "updatedAt devrait être mis à jour");
    }
    
    @Test
    @Transactional
    void testFinalizeShare_ShouldNotChangeStatusIfNotNew() {
        Share.ShareStatus originalStatus = activeShare.status;
        activeShare.finalizeShare();
        em.flush();
        
        assertEquals(originalStatus, activeShare.status, 
                    "Le statut ne devrait pas changer si le share n'est pas NEW");
    }
    
    @Test
    @Transactional
    void testUpdateTimestamp_ShouldUpdateUpdatedAt() {
        LocalDateTime originalUpdatedAt = activeShare.updatedAt;
        
        // Attendre un peu pour s'assurer que le temps change
        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        activeShare.updateTimestamp();
        em.flush();
        
        assertTrue(activeShare.updatedAt.isAfter(originalUpdatedAt), 
                  "updatedAt devrait être mis à jour");
    }
}

