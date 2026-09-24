import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoggerService } from './logger.service';
import { UnifiedAuthService } from './unified-auth.service';
import { ModalService } from './modal.service';
import { ConfirmationModalService } from './confirmation-modal.service';

interface TokenResponse {
  token?: string | null;
  user?: any;
  session?: SessionInfo;
  error?: string;
  message?: string;
  forceReconnect?: boolean;
  reason?: string;
}

export interface SessionInfo {
  expiresAt: number;
  sessionExpiresAt: number;
  refreshCount: number;
  maxRefreshCount: number;
  canRefresh: boolean;
  forceReconnect: boolean;
  timeUntilExpiry: number;
  timeUntilSessionExpiry: number;
  warningThreshold: number;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionManagerService {
  private sessionInfo$ = new BehaviorSubject<SessionInfo | null>(null);
  private checkInterval?: Subscription;
  private activityCheckInterval?: Subscription;
  private lastActivityTime = Date.now();
  
  // Configuration
  private readonly CHECK_INTERVAL = 30000; // Vérifier toutes les 30 secondes (plus fréquent pour détecter l'expiration)
  private readonly ACTIVITY_CHECK_INTERVAL = 30000; // Vérifier l'activité toutes les 30 secondes
  private readonly INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes d'inactivité
  // Renouveler automatiquement si le token expire dans moins de X minutes
  // Cette valeur doit être inférieure à la durée d'expiration du token (JWT_EXPIRES_IN)
  // Exemple: si JWT_EXPIRES_IN=30m, mettre 5m (300s) permet de renouveler à 25 minutes
  // Si JWT_EXPIRES_IN=1h, mettre 10m (600s) permet de renouveler à 50 minutes
  private readonly AUTO_REFRESH_THRESHOLD = 300; // 5 minutes par défaut (adaptez selon JWT_EXPIRES_IN)

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private authService: UnifiedAuthService,
    private modalService: ModalService,
    private confirmationModal: ConfirmationModalService,
    private router: Router
  ) {
    this.setupActivityTracking();
  }

  /**
   * Récupère les informations de session depuis le backend
   */
  async getSessionInfo(): Promise<SessionInfo | null> {
    // Ne pas récupérer les infos si l'utilisateur n'est pas connecté
    if (!this.authService.isLoggedIn()) {
      return null;
    }

    try {
      const config = (this.authService as any).config;
      if (!config?.endpoint) {
        this.logger.warn('SessionManagerService - Configuration non disponible');
        return null;
      }

      const response = await firstValueFrom(
        this.http.get<TokenResponse>(
          `${config.endpoint}/api/auth/token`,
          { 
            withCredentials: true,
            // Ne pas intercepter cette requête pour éviter les boucles
            headers: {
              'X-Skip-Auth-Interceptor': 'true'
            }
          } as any
        )
      ) as TokenResponse;

      if (response?.session) {
        this.sessionInfo$.next(response.session);
        
        // Si la session force la reconnexion, gérer immédiatement
        if (response.session.forceReconnect) {
          this.handleForceReconnect(response.session);
          return null;
        }
        
        return response.session;
      }
      return null;
    } catch (error: any) {
      this.logger.error('SessionManagerService - Erreur lors de la récupération des infos de session:', error);
      
      // Gérer les erreurs 401 avec forceReconnect
      if (error.status === 401) {
        const errorData = error.error || {};
        if (errorData.forceReconnect || errorData.session?.forceReconnect) {
          this.handleForceReconnect(errorData.session || errorData);
          return null;
        }
      }
      
      return null;
    }
  }

  /**
   * Tente de renouveler le token
   */
  async refreshToken(): Promise<SessionInfo | null> {
    // Ne pas renouveler si l'utilisateur n'est pas connecté
    if (!this.authService.isLoggedIn()) {
      return null;
    }

    try {
      const config = (this.authService as any).config;
      if (!config?.endpoint) {
        this.logger.warn('SessionManagerService - Configuration non disponible pour le renouvellement');
        return null;
      }

      this.logger.log('SessionManagerService - Tentative de renouvellement du token');
      
      const response = await firstValueFrom(
        this.http.get<TokenResponse>(
          `${config.endpoint}/api/auth/token?refresh=true`,
          { 
            withCredentials: true,
            // Ne pas intercepter cette requête pour éviter les boucles
            headers: {
              'X-Skip-Auth-Interceptor': 'true'
            }
          } as any
        )
      ) as TokenResponse;

      if (response?.session) {
        if (response.session.forceReconnect) {
          this.handleForceReconnect(response.session);
          return null;
        }

        this.sessionInfo$.next(response.session);
        this.lastActivityTime = Date.now();
        return response.session;
      }
      return null;
    } catch (error: any) {
      this.logger.error('SessionManagerService - Erreur lors du renouvellement:', error);
      
      if (error.status === 401 && error.error?.forceReconnect) {
        this.handleForceReconnect(error.error.session || error.error);
      }
      
      return null;
    }
  }

  /**
   * Gère la reconnexion forcée
   */
  private handleForceReconnect(session: any) {
    this.logger.warn('SessionManagerService - Session expirée, reconnexion forcée:', session.reason);
    
    const userEmail = this.authService.getUserEmail();
    const reason = session.reason || 'session_expired';
    
    // Nettoyer l'état d'authentification
    this.authService.setUnauthenticated();
    
    // Afficher un modal de confirmation avec deux options
    const message = userEmail 
      ? `Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion à l'adresse ${userEmail} ?`
      : 'Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion ?';
    
    this.confirmationModal.show({
      title: 'Session expirée',
      message: message,
      type: 'warning',
      confirmText: 'Se reconnecter',
      cancelText: 'Revenir à l\'accueil',
      showCancel: true,
      primaryActionText: 'Se reconnecter',
      secondaryActionText: 'Revenir à l\'accueil',
      showSecondaryAction: true
    }, (result) => {
      if (result.confirmed) {
        // L'utilisateur choisit d'envoyer un code de reconnexion
        this.logger.log('SessionManagerService - Utilisateur choisit de recevoir un code de reconnexion');
        this.modalService.openEmailValidationModal({
          email: userEmail || undefined,
          isSessionExpired: true,
          reason: reason
        });
      } else {
        // L'utilisateur choisit de revenir à l'accueil
        this.logger.log('SessionManagerService - Utilisateur choisit de revenir à l\'accueil');
        this.router.navigate(['/'], { replaceUrl: false });
      }
    });
    
    this.logger.log('SessionManagerService - Modal de confirmation de session expirée affiché');
  }

  /**
   * Démarre le monitoring de la session
   */
  startSessionMonitoring() {
    if (this.checkInterval) {
      this.logger.log('SessionManagerService - Monitoring déjà démarré, arrêt et redémarrage');
      this.stopSessionMonitoring();
    }

    this.logger.log('SessionManagerService - Démarrage du monitoring de session');
    this.logger.log(`SessionManagerService - Intervalle de vérification: ${this.CHECK_INTERVAL}ms`);
    this.logger.log(`SessionManagerService - Seuil de renouvellement automatique: ${this.AUTO_REFRESH_THRESHOLD}s`);

    // Vérifier immédiatement
    this.getSessionInfo().then(sessionInfo => {
      if (sessionInfo) {
        this.logger.log('SessionManagerService - Informations de session initiales:', {
          timeUntilExpiry: sessionInfo.timeUntilExpiry,
          canRefresh: sessionInfo.canRefresh,
          forceReconnect: sessionInfo.forceReconnect
        });
      }
    }).catch(err => {
      this.logger.error('SessionManagerService - Erreur lors de la vérification initiale:', err);
    });

    // Vérifier périodiquement
    this.checkInterval = interval(this.CHECK_INTERVAL).subscribe(() => {
      if (!this.authService.isLoggedIn()) {
        // Arrêter le monitoring si l'utilisateur n'est plus connecté
        this.logger.log('SessionManagerService - Utilisateur non connecté, arrêt du monitoring');
        this.stopSessionMonitoring();
        return;
      }

      this.getSessionInfo().then(sessionInfo => {
        if (!sessionInfo) {
          this.logger.warn('SessionManagerService - Aucune information de session disponible');
          return;
        }

        // Log des informations de session pour debug
        const timeSinceActivity = Date.now() - this.lastActivityTime;
        const isUserActive = timeSinceActivity < this.INACTIVITY_THRESHOLD;
        
        this.logger.log('SessionManagerService - Vérification périodique:', {
          timeUntilExpiry: sessionInfo.timeUntilExpiry,
          canRefresh: sessionInfo.canRefresh,
          forceReconnect: sessionInfo.forceReconnect,
          isUserActive: isUserActive,
          timeSinceActivity: Math.floor(timeSinceActivity / 1000) + 's',
          shouldAutoRefresh: this.shouldAutoRefresh(sessionInfo)
        });

        if (sessionInfo.forceReconnect) {
          this.logger.warn('SessionManagerService - Reconnexion forcée détectée');
          this.handleForceReconnect(sessionInfo);
        } else if (this.shouldAutoRefresh(sessionInfo)) {
          // Renouvellement automatique si l'utilisateur est actif
          this.logger.log('SessionManagerService - Conditions remplies pour renouvellement automatique');
          this.logger.log('SessionManagerService - Renouvellement automatique du token');
          this.refreshToken().then(newSessionInfo => {
            if (newSessionInfo) {
              this.logger.log('SessionManagerService - Token renouvelé avec succès:', {
                timeUntilExpiry: newSessionInfo.timeUntilExpiry,
                refreshCount: newSessionInfo.refreshCount
              });
            }
          }).catch(err => {
            this.logger.error('SessionManagerService - Erreur lors du renouvellement automatique:', err);
          });
        } else {
          // Log pourquoi le renouvellement n'est pas effectué
          const reasons = [];
          if (sessionInfo.timeUntilExpiry >= this.AUTO_REFRESH_THRESHOLD) {
            reasons.push(`token expire dans ${sessionInfo.timeUntilExpiry}s (> ${this.AUTO_REFRESH_THRESHOLD}s)`);
          }
          if (timeSinceActivity >= this.INACTIVITY_THRESHOLD) {
            reasons.push(`utilisateur inactif depuis ${Math.floor(timeSinceActivity / 1000)}s`);
          }
          if (!sessionInfo.canRefresh || sessionInfo.forceReconnect) {
            reasons.push(`renouvellement non autorisé (canRefresh: ${sessionInfo.canRefresh}, forceReconnect: ${sessionInfo.forceReconnect})`);
          }
          if (reasons.length > 0) {
            this.logger.log('SessionManagerService - Renouvellement automatique non effectué:', reasons.join(', '));
          }
        }
      }).catch(err => {
        this.logger.error('SessionManagerService - Erreur lors de la vérification périodique:', err);
      });
    });

    this.logger.log('SessionManagerService - Monitoring de session démarré avec succès');
  }

  /**
   * Arrête le monitoring de la session
   */
  stopSessionMonitoring() {
    if (this.checkInterval) {
      this.checkInterval.unsubscribe();
      this.checkInterval = undefined;
    }
    if (this.activityCheckInterval) {
      this.activityCheckInterval.unsubscribe();
      this.activityCheckInterval = undefined;
    }
    this.logger.log('SessionManagerService - Monitoring de session arrêté');
  }

  /**
   * Vérifie si le renouvellement automatique doit être effectué
   */
  private shouldAutoRefresh(sessionInfo: SessionInfo): boolean {
    // Renouveler automatiquement si:
    // 1. Le token expire dans moins de 5 minutes (AUTO_REFRESH_THRESHOLD)
    // 2. L'utilisateur est actif (activité récente)
    // 3. Le renouvellement est autorisé
    const isTokenExpiringSoon = sessionInfo.timeUntilExpiry < this.AUTO_REFRESH_THRESHOLD;
    const timeSinceActivity = Date.now() - this.lastActivityTime;
    const isUserActive = timeSinceActivity < this.INACTIVITY_THRESHOLD;
    const canRefresh = sessionInfo.canRefresh && !sessionInfo.forceReconnect;

    const shouldRefresh = isTokenExpiringSoon && isUserActive && canRefresh;
    
    // Log détaillé pour debug
    if (shouldRefresh) {
      this.logger.log('SessionManagerService - shouldAutoRefresh: true', {
        timeUntilExpiry: sessionInfo.timeUntilExpiry,
        isTokenExpiringSoon,
        timeSinceActivity: Math.floor(timeSinceActivity / 1000) + 's',
        isUserActive,
        canRefresh
      });
    }

    return shouldRefresh;
  }

  /**
   * Configure le suivi de l'activité utilisateur
   */
  private setupActivityTracking() {
    this.logger.log('SessionManagerService - Configuration du suivi d\'activité');
    
    // Écouter les événements d'activité
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    
    let activityCount = 0;
    events.forEach(event => {
      document.addEventListener(event, () => {
        const previousTime = this.lastActivityTime;
        this.lastActivityTime = Date.now();
        activityCount++;
        
        // Logger périodiquement pour debug (toutes les 50 activités)
        if (activityCount % 50 === 0) {
          this.logger.log('SessionManagerService - Activité détectée:', {
            event,
            timeSinceLastActivity: Math.floor((this.lastActivityTime - previousTime) / 1000) + 's',
            totalActivities: activityCount
          });
        }
      }, { passive: true });
    });

    this.logger.log(`SessionManagerService - ${events.length} événements d'activité configurés`);

    // Vérifier périodiquement l'activité
    this.activityCheckInterval = interval(this.ACTIVITY_CHECK_INTERVAL).subscribe(() => {
      // Mettre à jour le temps de dernière activité si nécessaire
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      const isUserActive = timeSinceActivity < this.INACTIVITY_THRESHOLD;
      
      if (isUserActive && this.authService.isLoggedIn()) {
        // Utilisateur actif, vérifier la session si nécessaire
        // Ne pas appeler getSessionInfo() trop souvent pour éviter les requêtes inutiles
        // On laisse le monitoring principal s'en charger
      }
    });
    
    this.logger.log('SessionManagerService - Suivi d\'activité configuré avec succès');
  }

  /**
   * Observable des informations de session
   */
  getSessionInfo$(): Observable<SessionInfo | null> {
    return this.sessionInfo$.asObservable();
  }

  /**
   * Obtient les informations de session actuelles
   */
  getCurrentSessionInfo(): SessionInfo | null {
    return this.sessionInfo$.value;
  }

  /**
   * Vérifie si une alerte doit être affichée
   */
  shouldShowWarning(): boolean {
    const sessionInfo = this.sessionInfo$.value;
    if (!sessionInfo) {
      return false;
    }

    // Afficher l'alerte si:
    // 1. Le token expire dans moins de 5 minutes
    // 2. La session n'est pas forcée à se reconnecter
    return sessionInfo.timeUntilExpiry < sessionInfo.warningThreshold && 
           !sessionInfo.forceReconnect;
  }

  /**
   * Obtient le niveau d'alerte (0 = pas d'alerte, 1 = avertissement, 2 = critique)
   */
  getAlertLevel(): 0 | 1 | 2 {
    const sessionInfo = this.sessionInfo$.value;
    if (!sessionInfo || sessionInfo.forceReconnect) {
      return 0;
    }

    const timeUntilExpiry = sessionInfo.timeUntilExpiry;
    
    if (timeUntilExpiry < 60) {
      return 2; // Critique: moins d'1 minute
    } else if (timeUntilExpiry < 300) {
      return 1; // Avertissement: moins de 5 minutes
    }
    
    return 0; // Pas d'alerte
  }

  /**
   * Formate le temps restant en format lisible
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}min`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}min`;
    }
  }
}

