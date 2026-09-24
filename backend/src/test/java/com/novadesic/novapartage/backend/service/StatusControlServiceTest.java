package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import com.novadesic.novapartage.backend.model.Recipient;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class StatusControlServiceTest {
    
    @Inject
    StatusControlService statusControlService;
    
    private Share testShare;
    private AccessToken activeToken;
    private AccessToken expiredToken;
    
    @BeforeEach
    void setUp() {
        // Créer un share de test
        testShare = new Share();
        testShare.fileName = "test.xlsx";
        testShare.ownerUsername = "testuser";
        testShare.status = Share.ShareStatus.ACTIVE;
        testShare.recipients = Arrays.asList(
            new Recipient("user1@test.com"),
            new Recipient("user2@test.com")
        );
        testShare.persist();
        
        // Créer un token actif
        activeToken = new AccessToken(
            testShare.id,
            "user1@test.com",
            "active-token",
            7,
            "testuser"
        );
        activeToken.persist();
        
        // Créer un token expiré
        expiredToken = new AccessToken(
            testShare.id,
            "user2@test.com",
            "expired-token",
            1,
            "testuser"
        );
        expiredToken.expiresAt = LocalDateTime.now().minusDays(1);
        expiredToken.persist();
    }
    
    @AfterEach
    void tearDown() {
        // Nettoyer les données de test
        if (activeToken != null) {
            activeToken.delete();
        }
        if (expiredToken != null) {
            expiredToken.delete();
        }
        if (testShare != null) {
            testShare.delete();
        }
    }
    
    @Test
    void testControlAccessTokenStatus_ExpiredToken() {
        // Vérifier que le token expiré est marqué comme EXPIRED
        statusControlService.controlAccessTokenStatus(expiredToken);
        
        assertEquals(AccessToken.TokenStatus.EXPIRED, expiredToken.status);
    }
    
    @Test
    void testControlAccessTokenStatus_ActiveToken() {
        // Vérifier que le token actif reste ACTIVE
        AccessToken.TokenStatus originalStatus = activeToken.status;
        statusControlService.controlAccessTokenStatus(activeToken);
        
        assertEquals(originalStatus, activeToken.status);
    }
    
    @Test
    void testControlShareStatus_WithActiveTokens() {
        // Le share a un token actif, donc il doit rester ACTIVE
        statusControlService.controlShareStatus(testShare);
        
        assertEquals(Share.ShareStatus.ACTIVE, testShare.status);
    }
    
    @Test
    void testControlShareStatus_WithOnlyExpiredTokens() {
        // Supprimer le token actif
        activeToken.delete();
        
        // Marquer le token expiré comme EXPIRED
        expiredToken.expire();
        expiredToken.persist();
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(testShare);
        
        // Le share doit passer en INACTIVE car il n'a plus de tokens actifs
        assertEquals(Share.ShareStatus.INACTIVE, testShare.status);
    }
    
    @Test
    void testControlShareStatus_NewShare() {
        // Créer un share en statut NEW
        Share newShare = new Share();
        newShare.fileName = "new.xlsx";
        newShare.ownerUsername = "testuser";
        newShare.status = Share.ShareStatus.NEW;
        newShare.persist();
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(newShare);
        
        // Le share NEW doit rester NEW
        assertEquals(Share.ShareStatus.NEW, newShare.status);
        
        // Nettoyer
        newShare.delete();
    }
    
    @Test
    void testControlShareStatus_DeletedShare() {
        // Créer un share en statut DELETED
        Share deletedShare = new Share();
        deletedShare.fileName = "deleted.xlsx";
        deletedShare.ownerUsername = "testuser";
        deletedShare.status = Share.ShareStatus.DELETED;
        deletedShare.persist();
        
        // Contrôler le statut du share
        statusControlService.controlShareStatus(deletedShare);
        
        // Le share DELETED doit rester DELETED
        assertEquals(Share.ShareStatus.DELETED, deletedShare.status);
        
        // Nettoyer
        deletedShare.delete();
    }
    
    @Test
    void testControlAllAccessTokensForShare() {
        // Contrôler tous les tokens d'un share
        statusControlService.controlAllAccessTokensForShare(testShare.id.toString());
        
        // Vérifier que le token expiré a été marqué comme EXPIRED
        AccessToken refreshedExpiredToken = AccessToken.findById(expiredToken.id);
        assertEquals(AccessToken.TokenStatus.EXPIRED, refreshedExpiredToken.status);
        
        // Vérifier que le token actif reste ACTIVE
        AccessToken refreshedActiveToken = AccessToken.findById(activeToken.id);
        assertEquals(AccessToken.TokenStatus.ACTIVE, refreshedActiveToken.status);
    }
    
    @Test
    void testControlShareStatusById() {
        // Contrôler le statut d'un share par son ID
        statusControlService.controlShareStatusById(testShare.id.toString());
        
        // Vérifier que le share reste ACTIVE car il a un token actif
        Share refreshedShare = Share.findById(testShare.id);
        assertEquals(Share.ShareStatus.ACTIVE, refreshedShare.status);
    }
} 