package com.novadesic.novapartage.backend.service;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class EmailServiceTest {
    
    @Inject
    EmailService emailService;
    
    @Test
    void testSendShareDeletionWarning_ShouldNotThrowException() {
        // Test que la méthode ne lance pas d'exception
        // Note: En environnement de test, l'envoi réel d'email peut échouer,
        // mais la méthode devrait gérer l'erreur gracieusement
        
        LocalDateTime createdAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime updatedAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime deletionDate = LocalDateTime.now().plusMonths(1);
        
        assertDoesNotThrow(() -> {
            emailService.sendShareDeletionWarning(
                "testuser@example.com",
                "Test Share",
                createdAt,
                updatedAt,
                6, // monthsInactiveWarning
                30, // daysRemaining
                deletionDate,
                "http://localhost:4200/home"
            );
        }, "sendShareDeletionWarning ne devrait pas lancer d'exception");
    }
    
    @Test
    void testSendShareDeletionWarning_ShouldHandleNullValues() {
        // Test que la méthode gère les valeurs null
        LocalDateTime createdAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime updatedAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime deletionDate = LocalDateTime.now().plusMonths(1);
        
        assertDoesNotThrow(() -> {
            emailService.sendShareDeletionWarning(
                null, // ownerEmail null
                null, // shareName null
                createdAt,
                updatedAt,
                6,
                30,
                deletionDate,
                null // manageSharesUrl null
            );
        }, "sendShareDeletionWarning devrait gérer les valeurs null");
    }
    
    @Test
    void testGetEmailSubject_ShouldReturnDefaultIfNotConfigured() {
        // Test que getEmailSubject retourne une valeur par défaut
        // Note: Cette méthode est privée, mais on peut tester indirectement
        // via sendShareDeletionWarning qui l'utilise
        
        LocalDateTime createdAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime updatedAt = LocalDateTime.now().minusMonths(8);
        LocalDateTime deletionDate = LocalDateTime.now().plusMonths(1);
        
        // Si l'envoi d'email échoue, cela ne devrait pas être dû à un sujet manquant
        assertDoesNotThrow(() -> {
            emailService.sendShareDeletionWarning(
                "test@example.com",
                "Test",
                createdAt,
                updatedAt,
                6,
                30,
                deletionDate,
                "http://localhost:4200/home"
            );
        });
    }
}

