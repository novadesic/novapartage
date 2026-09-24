import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UnifiedAuthService } from '../services/unified-auth.service';
import { SubscriptionService } from '../services/subscription.service';
import { AccountService } from '../services/account.service';
import { LoggerService } from '../services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: UnifiedAuthService,
    private subscriptionService: SubscriptionService,
    private accountService: AccountService,
    private router: Router,
    private logger: LoggerService
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    
    this.logger.log('\n\n\nAuthGuard - checking route:', state.url);
    this.logger.log('AuthGuard - route data:', route.data);
    
    try {
      // Vérifier si l'utilisateur est connecté (inclut la validation d'email)
      const isLoggedIn = this.authService.isLoggedIn();
      
      this.logger.log('AuthGuard - isLoggedIn:', isLoggedIn);
      if (!isLoggedIn && state.url === '/') {
        return true;
      }
      if (!isLoggedIn) {
        this.logger.log('AuthGuard - User not logged in, redirecting to /');
        this.router.navigate(['/']);
        return false;
      }

      // Si la route exige un abonnement : récupérer le statut (active / restreint) et autoriser l'accès en mode restreint
      const requiresSubscription = route.data['requiresSubscription'] === true;
      if (requiresSubscription) {
        const status = await firstValueFrom(this.subscriptionService.getSubscriptionStatus());
        if (status.restricted) {
          this.logger.log('AuthGuard - Mode restreint (reason=%s), accès autorisé en lecture seule', status.reason);
        }
        // On n'exclut plus : l'utilisateur accède à l'app en mode restreint (bandeau + actions désactivées)
      }

      // Charger une fois les données compte (droits, profil, groupes) pour la page "Votre compte"
      this.accountService.loadAccount().subscribe();

      // Vérifier les autorisations si spécifiées
      const authorities = route.data['authorities'] as string[];
      if (authorities && authorities.length > 0) {
        this.logger.log('AuthGuard - checking authorities:', authorities);
        
        // Récupérer les rôles de l'utilisateur pour debug
        const userRoles = this.authService.getUserRoles();
        this.logger.log('AuthGuard - user roles:', userRoles);
        
        // Pour le moment, accepter tous les utilisateurs connectés
        // TODO: Réactiver la vérification des rôles une fois le problème résolu
        this.logger.log('AuthGuard - Temporarily allowing all authenticated users');
        
        /*
        const hasAuthority = authorities.some(authority => {
          const hasRole = this.authService.hasRole(authority);
          this.logger.log(`AuthGuard - checking role '${authority}':`, hasRole);
          return hasRole;
        });
        
        this.logger.log('AuthGuard - hasAuthority:', hasAuthority);
        
        if (!hasAuthority) {
          this.logger.log('AuthGuard - User lacks required authorities, redirecting to /');
          // Rediriger vers la page d'accueil si pas les bonnes autorisations
          this.router.navigate(['/']);
          return false;
        }
        */
      }

      this.logger.log('AuthGuard - Access granted for route:', state.url);
      return true;
      
    } catch (error) {
      this.logger.error('AuthGuard - Error during authentication check:', error);
      // En cas d'erreur, vérifier si l'utilisateur est connecté
      const isLoggedIn = this.authService.isLoggedIn();
      if (isLoggedIn) {
        this.logger.log('AuthGuard - User is logged in but error occurred, redirecting to /home');
        this.router.navigate(['/home']);
      } else {
        this.logger.log('AuthGuard - User not logged in, redirecting to /');
        this.router.navigate(['/']);
      }
      return false;
    }
  }
} 