package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.Share;
import com.novadesic.novapartage.backend.model.AccessToken;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class StatusControlService {
    
    private static final Logger LOG = Logger.getLogger(StatusControlService.class);
    
    /**
     * Contrôle et met à jour le statut d'un token d'accès
     * Si le token est expiré, son statut passe à EXPIRED
     */
    @Transactional
    public void controlAccessTokenStatus(AccessToken token) {
        if (token == null) {
            return;
        }
        
        // 🔧 CORRECTION : Recharger l'entité dans le contexte de persistance pour éviter les erreurs de détachement
        AccessToken managedToken = AccessToken.findById(token.id);
        if (managedToken == null) {
            LOG.warnf("Token non trouvé lors du contrôle du statut: %s", token.id);
            return;
        }
        
        // Vérifier si le token est expiré
        boolean wasExpired = false;
        if (managedToken.isExpired() && managedToken.status == AccessToken.TokenStatus.ACTIVE) {
            LOG.infof("Token expiré détecté, mise à jour du statut: %s", managedToken.id);
            managedToken.expire();
            managedToken.persist();
            wasExpired = true;
        }
        
        // 🔧 NOUVEAU : Contrôler le statut du share après expiration d'un token
        // pour vérifier si le share doit passer à FINISHED
        if (wasExpired) {
            try {
                Share share = Share.findById(managedToken.shareId);
                if (share != null) {
                    controlShareStatus(share);
                }
            } catch (Exception e) {
                LOG.warnf("Erreur lors du contrôle du statut du share après expiration du token: %s", e.getMessage());
            }
        }
    }
    
    /**
     * Contrôle et met à jour le statut d'un share basé sur ses tokens d'accès
     * Si aucun accès actif, le statut passe à INACTIVE
     * Si au moins un accès actif, le statut passe à ACTIVE
     */
    @Transactional
    public void controlShareStatus(Share share) {
        if (share == null) {
            return;
        }
        
        // 🔧 CORRECTION : Recharger l'entité dans le contexte de persistance pour éviter les erreurs de détachement
        Share managedShare = Share.findById(share.id);
        if (managedShare == null) {
            LOG.warnf("Share non trouvé lors du contrôle du statut: %s", share.id);
            return;
        }
        
        // Ne pas modifier les shares en cours de création, supprimés ou terminés
        if (managedShare.status == Share.ShareStatus.NEW || 
            managedShare.status == Share.ShareStatus.DELETED || 
            managedShare.status == Share.ShareStatus.FINISHED) {
            return;
        }
        
        // Utiliser une requête optimisée pour compter les tokens actifs
        long activeTokensCount = AccessToken.count("shareId = ?1 and status = ?2 and expiresAt > ?3", 
            managedShare.id, AccessToken.TokenStatus.ACTIVE, LocalDateTime.now());
        
        // 🔧 NOUVEAU : Vérifier si tous les tokens sont validés ou expirés
        long totalTokensCount = AccessToken.count("shareId = ?1", managedShare.id);
        long validatedOrExpiredTokensCount = AccessToken.count(
            "shareId = ?1 and (status = ?2 or status = ?3)", 
            managedShare.id, 
            AccessToken.TokenStatus.VALIDATED, 
            AccessToken.TokenStatus.EXPIRED
        );
        
        // Mettre à jour le statut du share selon le nombre de tokens actifs
        Share.ShareStatus newStatus;
        if (activeTokensCount == 0) {
            // Aucun token actif
            if (totalTokensCount > 0 && validatedOrExpiredTokensCount == totalTokensCount) {
                // Tous les tokens sont validés ou expirés -> FINISHED
                newStatus = Share.ShareStatus.FINISHED;
                LOG.infof("Tous les tokens sont validés ou expirés pour le share %s (%d/%d)", 
                         managedShare.id, validatedOrExpiredTokensCount, totalTokensCount);
            } else {
                // Pas tous validés/expirés -> INACTIVE
                newStatus = Share.ShareStatus.INACTIVE;
            }
        } else {
            // Au moins un token actif -> ACTIVE
            newStatus = Share.ShareStatus.ACTIVE;
        }
        
        // Mettre à jour le statut seulement s'il a changé
        if (managedShare.status != newStatus) {
            LOG.infof("Mise à jour du statut du share %s: %s -> %s (tokens actifs: %d, total: %d, validés/expirés: %d)", 
                     managedShare.id, managedShare.status, newStatus, activeTokensCount, totalTokensCount, validatedOrExpiredTokensCount);
            managedShare.status = newStatus;
            managedShare.updateTimestamp();
            managedShare.persist();
        }
    }
    
    /**
     * Contrôle et met à jour le statut d'un share par son ID
     */
    public void controlShareStatusById(String shareId) {
        try {
            UUID shareUuid = UUID.fromString(shareId);
            Share share = Share.findById(shareUuid);
            if (share != null) {
                controlShareStatus(share);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle du statut du share %s: %s", shareId, e.getMessage());
        }
    }
    
    /**
     * Contrôle et met à jour le statut d'un token d'accès par son token
     */
    public void controlAccessTokenStatusByToken(String token) {
        try {
            AccessToken accessToken = AccessToken.findByToken(token);
            if (accessToken != null) {
                controlAccessTokenStatus(accessToken);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle du statut du token %s: %s", token, e.getMessage());
        }
    }
    
    /**
     * Contrôle et met à jour le statut d'un token d'accès par son ID
     */
    public void controlAccessTokenStatusById(String tokenId) {
        try {
            UUID tokenUuid = UUID.fromString(tokenId);
            AccessToken accessToken = AccessToken.findById(tokenUuid);
            if (accessToken != null) {
                controlAccessTokenStatus(accessToken);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle du statut du token %s: %s", tokenId, e.getMessage());
        }
    }
    
    /**
     * Contrôle et met à jour le statut de tous les tokens d'accès d'un share
     */
    @Transactional
    public void controlAllAccessTokensForShare(String shareId) {
        try {
            // Récupérer seulement les tokens ACTIVE qui sont expirés
            UUID shareUuid = UUID.fromString(shareId);
            List<AccessToken> expiredTokens = AccessToken.find(
                "shareId = ?1 and status = ?2 and expiresAt < ?3", 
                shareUuid, AccessToken.TokenStatus.ACTIVE, LocalDateTime.now()
            ).list();
            
            for (AccessToken token : expiredTokens) {
                token.expire();
                token.persist();
                LOG.infof("Token expiré marqué: %s", token.id);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle des tokens du share %s: %s", shareId, e.getMessage());
        }
    }
    
    /**
     * Contrôle et met à jour le statut de tous les shares d'un utilisateur
     */
    public void controlAllSharesForUser(String username) {
        try {
            // Récupérer seulement les shares ACTIVE qui pourraient avoir des tokens expirés
            List<Share> activeShares = Share.find(
                "ownerUsername = ?1 and status = ?2", 
                username, Share.ShareStatus.ACTIVE
            ).list();
            
            for (Share share : activeShares) {
                controlShareStatus(share);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle des shares de l'utilisateur %s: %s", username, e.getMessage());
        }
    }
    
    /**
     * Contrôle et met à jour le statut de tous les shares où un utilisateur est destinataire
     */
    public void controlAllSharesForRecipient(String userEmail) {
        try {
            // Récupérer seulement les shares ACTIVE où l'utilisateur est destinataire
            List<Share> activeShares = Share.find(
                "recipients.email = ?1 and status = ?2", 
                userEmail, Share.ShareStatus.ACTIVE
            ).list();
            
            for (Share share : activeShares) {
                controlShareStatus(share);
            }
        } catch (Exception e) {
            LOG.warnf("Erreur lors du contrôle des shares du destinataire %s: %s", userEmail, e.getMessage());
        }
    }
} 