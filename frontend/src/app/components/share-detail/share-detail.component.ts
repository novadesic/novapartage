import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ShareService } from '../../services/share.service';
import { ShareTabdataService } from '../../services/share-tabdata.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { NotificationService } from '../../services/notification.service';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { UnifiedAuthState } from '../../services/unified-auth.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-share-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ThemeSelectorComponent, NavbarComponent, FooterComponent],
  templateUrl: './share-detail.component.html',
  styleUrls: ['./share-detail.component.scss']
})
export class ShareDetailComponent implements OnInit, OnDestroy {
  
  share: any = null;
  isLoading = true;
  error: string | null = null;
  shareId: string = '';
  isDownloading = false;
  private authStateSubscription?: Subscription;
  
  // Exposer l'AuthService pour le template
  authService = this._authService;
  
  // Options de durée de validité
  validityOptions = [
    { value: 1, label: '1 jour' },
    { value: 3, label: '3 jours' },
    { value: 7, label: '7 jours' }
  ];
  
  // État pour la régénération de liens
  regeneratingLinks: { [email: string]: boolean } = {};
  recipientLinks: { [email: string]: string } = {};
  
  accessTokens: any[] = [];
  loadingTokens = false;
  isRestricted = false;
  private subscriptionSub?: Subscription;

  constructor(
    private shareService: ShareService,
    private shareTabdataService: ShareTabdataService,
    private _authService: UnifiedAuthService,
    private subscriptionService: SubscriptionService,
    private logger: LoggerService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService,
    private confirmationModalService: ConfirmationModalService
  ) {}

  async ngOnInit() {
    this.subscriptionSub = this.subscriptionService.subscriptionStatus$.subscribe(s => {
      this.isRestricted = s.restricted;
    });
    this.logger.log('🔍 ShareDetail - ngOnInit() appelé');
    
    try {
    // Récupérer l'ID du partage depuis l'URL
    this.shareId = this.route.snapshot.paramMap.get('id') || '';
    this.logger.log('🔍 ShareDetail - shareId récupéré depuis l\'URL:', this.shareId);
    
    if (!this.shareId) {
      this.logger.error('❌ ShareDetail - ID de partage manquant');
      this.error = 'ID de partage manquant';
      this.isLoading = false;
      return;
    }
    
      this.logger.log('🔍 ShareDetail - Début de waitForUserAuthentication()');
      // Attendre que l'utilisateur soit chargé avant de continuer
      await this.waitForUserAuthentication();
      
      this.logger.log('🔍 ShareDetail - Début de loadShareDetails()');
      // Charger les détails du partage
    await this.loadShareDetails();
      
    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'initialisation:', error);
      this.error = 'Erreur lors de l\'initialisation';
      this.isLoading = false;
    }
  }

  /**
   * Attend que l'utilisateur soit authentifié
   */
  private async waitForUserAuthentication(): Promise<void> {
    this.logger.log('🔍 ShareDetail - waitForUserAuthentication() appelé');
    
    return new Promise((resolve, reject) => {
      // Attendre un peu pour laisser le temps à l'état d'authentification de se propager
      setTimeout(() => {
        this.authStateSubscription = this.authService.getAuthState$().subscribe({
          next: (authState: UnifiedAuthState) => {
            this.logger.log('🔍 ShareDetail - État d\'authentification reçu:', authState);
            
            if (authState.isAuthenticated && authState.isEmailValidated) {
              this.logger.log('✅ ShareDetail - Utilisateur authentifié via validation d\'email:', authState.userEmail);
              resolve();
            } else if (this.authService.isLoggedIn()) {
              // Fallback vers l'ancienne méthode si l'état n'est pas encore propagé
              this.logger.log('✅ ShareDetail - Utilisateur authentifié via service classique');
              resolve();
            } else {
              this.logger.warn('⚠️ ShareDetail - Utilisateur non authentifié');
              reject(new Error('User not logged in or user profile was not loaded.'));
            }
          },
          error: (error) => {
            this.logger.error('❌ ShareDetail - Erreur d\'authentification:', error);
            reject(new Error('User not logged in or user profile was not loaded.'));
          }
        });
      }, 100); // Délai de 100ms pour laisser le temps à l'état de se propager
    });
  }

  async loadShareDetails() {
    try {
      this.logger.log('🔍 ShareDetail - loadShareDetails() appelé pour shareId:', this.shareId);
      this.isLoading = true;
      this.error = null;
      
      this.logger.log('🔍 ShareDetail - Appel à getShareMetadata avec shareId:', this.shareId);
      
      // Charger directement les métadonnées du partage (plus récentes)
      this.shareService.getShareMetadata(this.shareId).subscribe({
        next: (response: any) => {
          this.logger.log('✅ ShareDetail - Réponse reçue du backend:', response);
          this.share = response;
          
          // Vérifier le statut du partage
          if (response.status === 'NEW') {
            this.logger.log('🔄 ShareDetail - Partage en statut NEW, redirection vers édition');
            // Si le partage est encore en statut NEW, rediriger vers l'édition
            this.router.navigate(['/share/new', this.shareId]);
            return;
          }
          
          this.logger.log('✅ ShareDetail - Partage chargé avec succès, statut:', response.status);
          
          // Vérifier que l'utilisateur actuel est le créateur du partage
          this.checkUserPermissions();
          
          this.isLoading = false;
        },
        error: (error: any) => {
          this.logger.error('❌ ShareDetail - Erreur récupération détails partage:', error);
          this.logger.error('❌ ShareDetail - Détails de l\'erreur:', {
            status: error.status,
            message: error.message,
            url: error.url
          });
          this.error = 'Impossible de charger les détails du partage';
          this.isLoading = false;
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Erreur lors du chargement des détails:', error);
      this.error = 'Erreur lors du chargement des détails du partage';
      this.isLoading = false;
    }
  }

  // Vérifier les permissions de l'utilisateur
  async checkUserPermissions() {
    this.logger.log('🔍 ShareDetail - checkUserPermissions() appelé');
    
    return new Promise<void>((resolve, reject) => {
      // Utiliser le service d'état d'authentification
      this.authStateSubscription = this.authService.getAuthState$().subscribe({
        next: (authState: UnifiedAuthState) => {
          try {
            // Vérifier si l'utilisateur est authentifié
            if (!authState.isAuthenticated || !authState.isEmailValidated) {
              this.logger.warn('⚠️ ShareDetail - Utilisateur non authentifié');
              this.error = 'Vous devez être connecté pour accéder à cette page.';
              this.share = null;
              reject(new Error('Utilisateur non authentifié'));
              return;
            }

            const currentUserEmail = authState.userEmail || authState.userInfo?.email;
            
            this.logger.log('🔍 ShareDetail - Vérification des permissions:', {
              currentUser: currentUserEmail,
              shareOwner: this.share?.ownerEmail,
              shareOwnerUsername: this.share?.ownerUsername,
              authState: authState
            });
            
            // Vérifier si l'utilisateur actuel est le créateur du partage
            const isOwner = this.share?.ownerEmail === currentUserEmail || 
                           this.share?.ownerUsername === currentUserEmail;
            
            if (!isOwner) {
              this.logger.warn('⚠️ ShareDetail - Accès non autorisé: utilisateur non créateur du partage');
              this.error = 'Accès non autorisé. Seul le créateur du partage peut accéder à cette page.';
              this.share = null;
              reject(new Error('Accès non autorisé'));
              return;
            }
            
            this.logger.log('✅ ShareDetail - Permissions vérifiées, chargement des access-tokens');
            
            // Charger les tokens d'accès après vérification des permissions
            this.loadAccessTokens().then(() => {
              resolve();
            }).catch((error: any) => {
              this.logger.error('❌ ShareDetail - Erreur lors du chargement des access-tokens:', error);
              reject(error);
            });
          } catch (error) {
            this.logger.error('❌ ShareDetail - Erreur lors de la vérification des permissions:', error);
            reject(error);
          }
        },
        error: (error) => {
          this.logger.error('❌ ShareDetail - Erreur lors de la récupération de l\'état d\'authentification:', error);
          reject(error);
        }
      });
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  getRecipientsCount(): number {
    return this.share?.recipients ? this.share.recipients.length : 0;
  }

  onDeleteShare() {
    this.confirmationModalService.confirmDelete('Êtes-vous sûr de vouloir supprimer ce partage ?').then(confirmed => {
      if (confirmed) {
        this.shareService.deleteShare(this.shareId).subscribe({
          next: () => {
            this.router.navigate(['/home']); // Retour à la liste
          },
          error: (error: any) => {
            this.logger.error('❌ Erreur suppression:', error);
            this.notificationService.error('Erreur lors de la suppression du partage');
          }
        });
      }
    });
  }

  onBackToList() {
    this.router.navigate(['/']);
  }

  /**
   * Redirige vers la page de redéfinition du partage
   */
  onRedefineShare() {
    // Vérifier que l'utilisateur est le créateur du partage
    if (!this.share || !this.share.ownerUsername || this.share.ownerUsername !== this.authService.getUsername()) {
      this.notificationService.error('Vous n\'êtes pas autorisé à redéfinir ce partage');
      return;
    }
    

    this.notificationService.info('Redirection vers l\'éditeur de partage...');
    this.router.navigate(['/share/new', this.shareId]);
  }

  getFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notificationService.success('Lien copié dans le presse-papiers', 'Copié');
    }).catch(err => {
      this.logger.error('Erreur lors de la copie:', err);
      this.notificationService.error('Erreur lors de la copie du lien');
    });
  }

  openDownloadUrl(url: string) {
    window.open(url, '_blank');
  }

  downloadShareFile() {
    if (!this.share || this.isDownloading) return;
    
    this.isDownloading = true;
    
    this.shareService.downloadShareFile(this.share.id).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Utiliser le nom original du fichier
        const fileName = this.share.originalFileName || this.share.fileName;
        link.download = fileName;
        
        // Déclencher le téléchargement
        document.body.appendChild(link);
        link.click();
        
        // Nettoyer
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.notificationService.success('Fichier téléchargé avec succès');
        this.isDownloading = false;

      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors du téléchargement:', error);
        this.notificationService.error('Erreur lors du téléchargement du fichier');
        this.isDownloading = false;
      }
    });
  }

  downloadShareFileWithValidatedData() {
    if (!this.share || this.isDownloading) return;
    
    this.isDownloading = true;
    
    this.shareService.downloadShareFileWithValidatedData(this.share.id).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Utiliser le nom original du fichier avec suffixe
        const fileName = this.share.originalFileName || this.share.fileName;
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.'));
        const updatedFileName = baseName + '_avec_donnees_validees' + extension;
        link.download = updatedFileName;
        
        // Déclencher le téléchargement
        document.body.appendChild(link);
        link.click();
        
        // Nettoyer
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.notificationService.success('Fichier avec données validées téléchargé avec succès');
        this.isDownloading = false;

      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors du téléchargement avec données validées:', error);
        this.notificationService.error('Erreur lors du téléchargement du fichier avec données validées');
        this.isDownloading = false;
      }
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.logger.log('Déconnexion réussie');
      },
      error: (error) => {
        this.logger.error('Erreur lors de la déconnexion:', error);
        // La déconnexion locale est déjà gérée dans le service
      }
    });
  }

  // Générer un lien d'accès pour un destinataire
  generateAccessLink(recipient: any, validityDays: number = 7) {

    this.regeneratingLinks[recipient.email] = true;
    
    this.shareService.generateRecipientLink(this.shareId, recipient.email, validityDays).subscribe({
      next: (response: any) => {

        this.recipientLinks[recipient.email] = response.accessUrl;
        this.regeneratingLinks[recipient.email] = false;
        
        // Recharger les tokens d'accès pour mettre à jour l'affichage

        this.loadAccessTokens();
        
        // Confirmation à l'utilisateur

      },
      error: (error: any) => {
        this.logger.error('❌ Erreur génération lien pour', recipient.email, ':', error);
        this.regeneratingLinks[recipient.email] = false;
        this.notificationService.error('Erreur lors de la génération du lien d\'accès');
      }
    });
  }

  // Renvoyer l'email d'accès à un destinataire
  resendAccessEmail(recipient: any) {
    this.logger.log('📧 Renvoi de l\'email d\'accès pour:', recipient.email);
    
    // Vérifier qu'il y a au moins un token d'accès
    const hasActiveToken = this.hasActiveTokenForRecipient(recipient.email) || this.hasValidatedTokenForRecipient(recipient.email);
    
    if (!hasActiveToken) {
      this.notificationService.error('Aucun lien d\'accès disponible pour ce destinataire. Veuillez d\'abord générer un lien d\'accès.');
      return;
    }
    
    this.shareService.resendAccessEmail(this.shareId, recipient.email).subscribe({
      next: (response: any) => {
        this.logger.log('✅ Email d\'accès renvoyé:', response);
        this.notificationService.success('Email d\'accès renvoyé avec succès à ' + recipient.email);
      },
      error: (error: any) => {
        this.logger.error('❌ Erreur renvoi email pour', recipient.email, ':', error);
        
        if (error.status === 409) {
          this.notificationService.error(error.error?.message || 'Aucun lien d\'accès disponible pour ce destinataire');
        } else {
          this.notificationService.error('Erreur lors du renvoi de l\'email d\'accès');
        }
      }
    });
  }

  // Copier le lien d'accès dans le presse-papiers
  copyAccessLink(recipient: any) {
    const link = this.recipientLinks[recipient.email];
    if (link) {
      this.copyToClipboard(link);
    } else {
      // Générer le lien s'il n'existe pas encore
      this.generateAccessLink(recipient);
    }
  }

  // Obtenir le lien d'accès pour un destinataire
  getAccessLink(recipient: any): string {
    return this.recipientLinks[recipient.email] || '';
  }

  // Vérifier si un lien existe pour un destinataire
  hasAccessLink(recipient: any): boolean {
    return !!this.recipientLinks[recipient.email];
  }

  // Charger les tokens d'accès
  async loadAccessTokens() {
    this.logger.log('🔍 ShareDetail - loadAccessTokens() appelé pour shareId:', this.shareId);
    
    try {
      this.loadingTokens = true;

      this.logger.log('🔍 ShareDetail - Appel à getAccessTokens avec shareId:', this.shareId);
      
      this.shareService.getAccessTokens(this.shareId).subscribe({
        next: (response: any) => {
          this.logger.log('✅ ShareDetail - Réponse reçue pour getAccessTokens:', response);
          this.accessTokens = response.tokens || [];
          this._invalidateTokensCache(); // Invalider le cache
          this.logger.log('✅ ShareDetail - Tokens d\'accès récupérés:', {
            count: this.accessTokens.length,
            tokens: this.accessTokens,
            validatedCount: this.accessTokens.filter((token: any) => token.status === 'VALIDATED').length
          });
          this.loadingTokens = false;
        },
        error: (error: any) => {
          this.logger.error('❌ ShareDetail - Erreur récupération tokens:', error);
          this.logger.error('❌ ShareDetail - Détails de l\'erreur getAccessTokens:', {
            status: error.status,
            message: error.message,
            url: error.url
          });
          this.accessTokens = [];
          this._invalidateTokensCache(); // Invalider le cache
          this.loadingTokens = false;
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Erreur lors du chargement des tokens:', error);
      this.accessTokens = [];
      this._invalidateTokensCache(); // Invalider le cache
      this.loadingTokens = false;
    }
  }

  // Révoquer un token d'accès
  revokeToken(tokenId: string) {
    this.confirmationModalService.confirm('Êtes-vous sûr de vouloir révoquer ce token d\'accès ?', 'Confirmer la révocation').then(confirmed => {
      if (confirmed) {
        this.shareService.revokeAccessToken(tokenId).subscribe({
          next: () => {
            this.loadAccessTokens(); // Recharger la liste
          },
          error: (error: any) => {
            this.logger.error('❌ Erreur révocation:', error);
            this.notificationService.error('Erreur lors de la révocation du token');
          }
        });
      }
    });
  }

  // Cache pour les tokens par destinataire
  private _tokensCache: { [email: string]: any[] } = {};
  private _lastTokensUpdate: number = 0;
  private readonly CACHE_DURATION = 1000; // 1 seconde
  
  // Invalider le cache des tokens
  private _invalidateTokensCache(): void {
    this._tokensCache = {};
    this._lastTokensUpdate = 0;
  }
  
  // Obtenir les tokens pour un destinataire (avec cache)
  getTokensForRecipient(recipientEmail: string): any[] {
    const now = Date.now();
    
    // Invalider le cache si les tokens ont changé
    if (now - this._lastTokensUpdate > this.CACHE_DURATION) {
      this._tokensCache = {};
      this._lastTokensUpdate = now;
    }
    
    // Utiliser le cache si disponible
    if (this._tokensCache[recipientEmail]) {
      return this._tokensCache[recipientEmail];
    }
    
    // Calculer et mettre en cache
    const tokens = this.accessTokens.filter(token => token.recipientEmail === recipientEmail);
    this._tokensCache[recipientEmail] = tokens;
    
    return tokens;
  }

  // Formater la date d'expiration
  formatExpirationDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return 'Expiré';
      } else if (diffDays === 0) {
        return 'Expire aujourd\'hui';
      } else if (diffDays === 1) {
        return 'Expire demain';
      } else {
        return `Expire dans ${diffDays} jours`;
      }
    } catch {
      return dateString;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Actif';
      case 'EXPIRED':
        return 'Expiré';
      case 'REVOKED':
        return 'Révoqué';
      case 'VALIDATED':
        return 'Validé';
      default:
        return status;
    }
  }

  hasValidatedAccess(): boolean {
    if (!this.accessTokens || this.accessTokens.length === 0) {
      return false;
    }
    
    return this.accessTokens.some((token: any) => token.status === 'VALIDATED');
  }

  getValidatedTokensCount(): number {
    if (!this.accessTokens || this.accessTokens.length === 0) {
      return 0;
    }
    return this.accessTokens.filter((token: any) => token.status === 'VALIDATED').length;
  }

  hasValidatedTokenForRecipient(recipientEmail: string): boolean {
    if (!this.accessTokens || this.accessTokens.length === 0) {
      return false;
    }
    return this.accessTokens.some((token: any) => 
      token.recipientEmail === recipientEmail && token.status === 'VALIDATED'
    );
  }

  hasActiveTokenForRecipient(recipientEmail: string): boolean {
    if (!this.accessTokens || this.accessTokens.length === 0) {
      return false;
    }
    return this.accessTokens.some((token: any) => 
      token.recipientEmail === recipientEmail && token.status === 'ACTIVE'
    );
  }

  /**
   * Recalcule le tabdata pour tous les destinataires (propriétaire uniquement)
   */
  rebuildTabdata() {
    if (!this.share || !this.share.id) {
      this.notificationService.error('Partage non trouvé');
      return;
    }

    this.logger.log('🔄 Recalcul tabdata pour shareId:', this.share.id);
    
    this.shareTabdataService.rebuildTabdata(this.share.id).subscribe({
      next: (response) => {
        this.logger.log('✅ Tabdata recalculé avec succès:', response);
        this.notificationService.success('Données recalculées avec succès pour tous les destinataires');
      },
      error: (error) => {
        this.logger.error('❌ Erreur lors du recalcul du tabdata:', error);
        this.notificationService.error('Erreur lors du recalcul des données');
      }
    });
  }

  ngOnDestroy() {
    this.authStateSubscription?.unsubscribe();
    this.subscriptionSub?.unsubscribe();
  }
} 