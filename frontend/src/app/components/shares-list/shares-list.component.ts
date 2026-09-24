import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ShareService, ShareListResponse } from '../../services/share.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { EnvironmentService } from '../../services/environment.service';
import { LoggerService } from '../../services/logger.service';
import { NotificationService } from '../../services/notification.service';
import { UnifiedUser } from '../../services/unified-auth.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';

@Component({
  selector: 'app-shares-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './shares-list.component.html',
  styleUrls: ['./shares-list.component.scss']
})
export class SharesListComponent implements OnInit, OnDestroy {

  userShares: any[] = [];
  userAccessTokens: any[] = [];
  isLoading = true;
  error: string | null = null;
  currentUser: string = '';
  isRestricted = false;
  private subscriptionSub?: Subscription;

  sortField: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  sortedUserShares: any[] = [];
  accessSortField: string = 'createdAt';
  accessSortDirection: 'asc' | 'desc' = 'desc';
  sortedUserAccessTokens: any[] = [];
  showDeletedShares: boolean = false;
  showInactiveShares: boolean = true;
  showActiveAccess: boolean = true;
  showValidatedAccess: boolean = true;
  showTerminatedAccess: boolean = false;

  constructor(
    private shareService: ShareService,
    private authService: UnifiedAuthService,
    private subscriptionService: SubscriptionService,
    private environmentService: EnvironmentService,
    private logger: LoggerService,
    private notificationService: NotificationService,
    private confirmationModalService: ConfirmationModalService
  ) {}

  /** Nombre de partages actifs : seulement ACTIVE et NEW (exclut INACTIVE, FINISHED, DELETED) */
  get activeSharesCount(): number {
    const status = (s: any) => String(s.status || '').toUpperCase().trim();
    return this.userShares.filter(s => {
      const st = status(s);
      return st === 'ACTIVE' || st === 'NEW';
    }).length;
  }

  /** Limite atteinte ou dépassée : création désactivée */
  get isShareLimitReached(): boolean {
    return this.activeSharesCount >= this.environmentService.getMaxActiveShares();
  }

  /** Désactive la création de partage (restriction abonnement OU limite atteinte) */
  get canCreateShare(): boolean {
    return !this.isRestricted && !this.isShareLimitReached;
  }

  get maxActiveShares(): number {
    return this.environmentService.getMaxActiveShares();
  }

  async ngOnInit() {
    this.subscriptionSub = this.subscriptionService.subscriptionStatus$.subscribe(s => {
      this.isRestricted = s.restricted;
    });
    try {
      this.authService.getLoggedUser().subscribe({
        next: (profile) => {
          this.currentUser = this.getDisplayName(profile) || 'Utilisateur';
          this.logger.log('Profil utilisateur récupéré:', profile);
        },
        error: (error) => {
          this.logger.warn('Impossible de récupérer le profil utilisateur:', error);
          this.currentUser = 'Utilisateur';
        }
      });
    } catch (e) {
      this.logger.warn('Impossible de récupérer le profil utilisateur');
      this.currentUser = 'Utilisateur';
    }
    
    await this.loadShares();
  }

  ngOnDestroy(): void {
    this.subscriptionSub?.unsubscribe();
  }

  async loadShares() {
    try {
      this.isLoading = true;
      this.error = null;
      

      
      // Charger les partages créés par l'utilisateur
      this.shareService.getUserShares().subscribe({
        next: (response: ShareListResponse) => {

          this.userShares = response.shares || [];
          this.applySort(); // Appliquer le tri initial
        },
        error: (error) => {
          this.logger.error('❌ Erreur partages utilisateur:', error);
          this.userShares = [];
          this.sortedUserShares = [];
        }
      });
      
      // Charger les tokens d'accès de l'utilisateur connecté
      this.shareService.getUserAccessTokens().subscribe({
        next: (response: any) => {

          this.logger.log('🔍 Structure de la réponse:', {
            hasResponse: !!response,
            hasTokens: !!(response && response.tokens),
            tokensLength: response?.tokens?.length || 0,
            responseKeys: response ? Object.keys(response) : []
          });
          this.userAccessTokens = response.tokens || [];

          this.debugAllTokens(); // Diagnostic
          this.applyAccessSort(); // Appliquer le tri initial

          this.isLoading = false;
        },
        error: (error) => {
          this.logger.error('❌ Erreur tokens d\'accès:', error);
          this.logger.error('❌ Détails de l\'erreur:', {
            status: error.status,
            message: error.message,
            error: error.error
          });
          this.userAccessTokens = [];
          this.sortedUserAccessTokens = [];
          this.isLoading = false;
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Erreur lors du chargement des partages:', error);
      this.error = 'Erreur lors du chargement des partages';
      this.isLoading = false;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  getRecipientsCount(share: any): number {
    return share.recipients ? share.recipients.length : 0;
  }

  // Calculer le total des accès d'un partage
  getTotalAccessCount(share: any): number {
    const active = share.activeTokensCount || 0;
    const expired = share.expiredTokensCount || 0;
    return active + expired;
  }

  // Méthodes de tri
  sortShares(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applySort();
  }

  applySort() {
    // Filtrer les partages selon les options
    let filteredShares = this.userShares.filter(share => {
      if (share.status === 'DELETED' && !this.showDeletedShares) {
        return false;
      }
      if (share.status === 'INACTIVE' && !this.showInactiveShares) {
        return false;
      }
      return true;
    });
    
    this.sortedUserShares = filteredShares.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortField) {
        case 'fileName':
          aValue = (a.originalFileName || a.fileName || '').toLowerCase();
          bValue = (b.originalFileName || b.fileName || '').toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt || 0);
          bValue = new Date(b.createdAt || 0);
          break;
        case 'recipients':
          aValue = this.getRecipientsCount(a);
          bValue = this.getRecipientsCount(b);
          break;
        case 'access':
          aValue = this.getTotalAccessCount(a);
          bValue = this.getTotalAccessCount(b);
          break;
        case 'status':
          aValue = this.getStatusLabel(a.status || 'ACTIVE').toLowerCase();
          bValue = this.getStatusLabel(b.status || 'ACTIVE').toLowerCase();
          break;
        default:
          aValue = a[this.sortField] || '';
          bValue = b[this.sortField] || '';
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getSortIcon(): string {
    return this.sortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
  }

  // Méthodes de tri pour les partages reçus
  sortAccessTokens(field: string) {
    if (this.accessSortField === field) {
      this.accessSortDirection = this.accessSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.accessSortField = field;
      this.accessSortDirection = 'asc';
    }
    this.applyAccessSort();
  }

  applyAccessSort() {
    this.logger.log('🔍 applyAccessSort - Filtres actuels:', {
      showActiveAccess: this.showActiveAccess,
      showValidatedAccess: this.showValidatedAccess,
      showTerminatedAccess: this.showTerminatedAccess
    });
    
    this.logger.log('🔍 applyAccessSort - Tokens avant filtrage:', this.userAccessTokens.map(t => ({
      id: t.id,
      status: t.status,
      pageTitle: t.pageTitle
    })));
    
    // Filtrer les accès selon les options
    let filteredTokens = this.userAccessTokens.filter(token => {
      this.logger.log(`🔍 Filtrage du token ${token.id} (${token.status}):`, {
        status: token.status,
        isActive: token.status === 'ACTIVE',
        isValidated: token.status === 'VALIDATED',
        isTerminated: token.status === 'EXPIRED' || token.status === 'REVOKED',
        showActive: this.showActiveAccess,
        showValidated: this.showValidatedAccess,
        showTerminated: this.showTerminatedAccess
      });
      
      // Accès actifs (ACTIVE uniquement)
      if (token.status === 'ACTIVE' && !this.showActiveAccess) {

        return false;
      }
      // Accès validés (VALIDATED uniquement)
      if (token.status === 'VALIDATED' && !this.showValidatedAccess) {

        return false;
      }
      // Accès terminés (EXPIRED, REVOKED)
      if ((token.status === 'EXPIRED' || token.status === 'REVOKED') && !this.showTerminatedAccess) {

        return false;
      }
      

      return true;
    });
    

    
    this.sortedUserAccessTokens = filteredTokens.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.accessSortField) {
        case 'pageTitle':
          aValue = (a.pageTitle || 'Formulaire de saisie').toLowerCase();
          bValue = (b.pageTitle || 'Formulaire de saisie').toLowerCase();
          break;
        case 'ownerUsername':
          aValue = (a.ownerUsername || a.ownerEmail || '').toLowerCase();
          bValue = (b.ownerUsername || b.ownerEmail || '').toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt || 0);
          bValue = new Date(b.createdAt || 0);
          break;
        case 'expiresAt':
          aValue = new Date(a.expiresAt || 0);
          bValue = new Date(b.expiresAt || 0);
          break;
        default:
          aValue = a[this.accessSortField] || '';
          bValue = b[this.accessSortField] || '';
      }

      if (aValue < bValue) {
        return this.accessSortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.accessSortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  getAccessSortIcon(): string {
    return this.accessSortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
  }

  // Méthode de diagnostic pour afficher tous les tokens
  debugAllTokens() {

    this.logger.log('🔍 Répartition par statut:', {
      ACTIVE: this.userAccessTokens.filter(t => t.status === 'ACTIVE').length,
      VALIDATED: this.userAccessTokens.filter(t => t.status === 'VALIDATED').length,
      EXPIRED: this.userAccessTokens.filter(t => t.status === 'EXPIRED').length,
      REVOKED: this.userAccessTokens.filter(t => t.status === 'REVOKED').length,
      TOTAL: this.userAccessTokens.length
    });
  }

  // Méthodes pour le statut des partages
  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Actif';
      case 'DELETED':
        return 'Supprimé';
      case 'ARCHIVED':
        return 'Archivé';
      default:
        return status || 'Actif';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success';
      case 'INACTIVE':
        return 'bg-secondary';
      case 'DELETED':
        return 'bg-dark';
      case 'ARCHIVED':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  }

  // Calculer le temps de validité restant d'un token
  getRemainingValidity(token: any): string {
    if (!token.expiresAt) return 'Pas de date d\'expiration';
    
    try {
      const expiryDate = new Date(token.expiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      
      if (diffTime <= 0) {
        return 'Expiré';
      }
      
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        return `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        return 'Moins d\'une minute';
      }
    } catch (error) {
      return 'Date invalide';
    }
  }

  // Obtenir la classe CSS pour l'état de validité
  getValidityClass(token: any): string {
    if (!token.expiresAt) return 'text-muted';
    
    try {
      const expiryDate = new Date(token.expiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      
      if (diffTime <= 0) {
        return 'text-danger';
      } else if (diffTime < 24 * 60 * 60 * 1000) { // Moins de 24h
        return 'text-warning';
      } else {
        return 'text-success';
      }
    } catch (error) {
      return 'text-muted';
    }
  }

  // Obtenir le statut d'un token d'accès
  getTokenStatusLabel(token: any): string {
    if (token.status === 'VALIDATED') {
      return 'Validé';
    } else if (token.status === 'ACTIVE') {
      return 'Actif';
    } else if (token.status === 'EXPIRED') {
      return 'Expiré';
    } else if (token.status === 'REVOKED') {
      return 'Révoqué';
    } else {
      return token.status || 'Actif';
    }
  }
  
  // Méthodes pour gérer les filtres
  toggleDeletedShares() {
    this.showDeletedShares = !this.showDeletedShares;
    this.applySort();
  }
  
  toggleInactiveShares() {
    this.showInactiveShares = !this.showInactiveShares;
    this.applySort();
  }
  
  toggleActiveAccess() {
    this.showActiveAccess = !this.showActiveAccess;
    this.applyAccessSort();
  }
  
  toggleValidatedAccess() {
    this.showValidatedAccess = !this.showValidatedAccess;

    this.applyAccessSort();
  }
  
  toggleTerminatedAccess() {
    this.showTerminatedAccess = !this.showTerminatedAccess;

    this.applyAccessSort();
  }

  // Obtenir la classe CSS pour le statut d'un token
  getTokenStatusClass(token: any): string {
    if (token.status === 'VALIDATED') {
      return 'bg-info';
    } else if (token.status === 'ACTIVE') {
      return 'bg-success';
    } else if (token.status === 'EXPIRED') {
      return 'bg-warning';
    } else if (token.status === 'REVOKED') {
      return 'bg-danger';
    } else {
      return 'bg-primary';
    }
  }

  // Déterminer si un token peut être ouvert (actif ou validé même expiré)
  canOpenToken(token: any): boolean {
    return token.status === 'ACTIVE' || token.status === 'VALIDATED';
  }

  // Obtenir le texte du statut avec temps restant si actif
  getTokenStatusWithTime(token: any): string {
    const statusLabel = this.getTokenStatusLabel(token);
    
    // Si le token est actif, ajouter le temps restant
    if (token.status === 'ACTIVE' && token.expiresAt) {
      const remainingTime = this.getRemainingValidity(token);
      if (remainingTime !== 'Expiré') {
        return `${statusLabel} (${remainingTime})`;
      }
    }
    
    return statusLabel;
  }

  onDeleteShare(shareId: string) {
    this.confirmationModalService.confirmDelete('Êtes-vous sûr de vouloir supprimer ce partage ?').then(confirmed => {
      if (confirmed) {
        this.shareService.deleteShare(shareId).subscribe({
          next: () => {
            this.loadShares(); // Recharger la liste
          },
          error: (error) => {
            this.logger.error('❌ Erreur suppression:', error);
            this.notificationService.error('Erreur lors de la suppression du partage');
          }
        });
      }
    });
  }

  /**
   * Obtient le nom d'affichage de l'utilisateur
   */
  private getDisplayName(profile: UnifiedUser | null | undefined): string {
    if (!profile) {
      return '';
    }

    // C'est un profil personnalisé
    const customUser = profile as UnifiedUser;
    return customUser.firstName || customUser.name || customUser.email || customUser.username || '';
  }

} 