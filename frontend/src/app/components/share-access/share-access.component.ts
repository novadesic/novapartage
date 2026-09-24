import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ShareService, FormAccessData } from '../../services/share.service';
import { ShareTabdataService } from '../../services/share-tabdata.service';
import { LoggerService } from '../../services/logger.service';
import { NotificationService } from '../../services/notification.service';
import { UnifiedAuthService, UnifiedAuthState } from '../../services/unified-auth.service';
import { FormPreviewComponent } from '../form-preview/form-preview.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';

// Interfaces pour le nouveau système de mapping robuste
interface CellMapping {
  excelColumnKey: string;    // Clé Excel réelle (ex: "column-1")
  filteredColumnIndex: number; // Index dans le tableau filtré
  excelColumnIndex: number;   // Index Excel original
  excelRowIndex: number;      // Index Excel original
}

interface RowMapping {
  excelRowIndex: number;      // Index Excel original
  filteredRowIndex: number;   // Index dans le tableau filtré
}

@Component({
  selector: 'app-share-access',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FormPreviewComponent, FooterComponent, NavbarComponent],
  templateUrl: './share-access.component.html',
  styleUrls: ['./share-access.component.scss']
})
export class ShareAccessComponent implements OnInit, OnDestroy {
  
  formData: FormAccessData | null = null;
  isLoading = true;
  error: string | null = null;
  token: string = '';
  
  // Données pour le form preview
  tableData: any[] = [];
  originalTableData: any[] = []; // Données originales d'Excel
  columnLabels: { [colKey: string]: string } = {};
  pageTitle = '';
  pageDescription = '';
  editableCells: { row: number, col: string }[] = [];
  
  
  // État du formulaire
  hasEditableFields = false;
  isTokenValidated = false; // Indique si le token est validé (lecture seule)
  validatedAt: string | null = null; // Date de validation
  formValues: { [key: string]: any } = {};
  originalValues: { [key: string]: any } = {}; // Valeurs originales d'Excel pour détecter les modifications
  modifiedCells: Set<string> = new Set(); // Cellules modifiées

  // Authentification
  authState: UnifiedAuthState = {
    isAuthenticated: false,
    isEmailValidated: false
  };
  private authStateSubscription?: Subscription;
  
  // Modal de confirmation pour validation par le propriétaire
  showOwnerValidationModal = false;
  isOwnerValidating = false;

  // Helpers pour la compatibilité avec la nouvelle interface form-preview
  get columnLabelsForFormPreview() {
    const result: { [sheetIndex: string]: { [colKey: string]: string } } = {};
    result['0'] = this.columnLabels; // Utiliser la feuille 0 par défaut
    return result;
  }

  get editableCellsForFormPreview() {
    const result: { [sheetIndex: string]: { row: number, col: number }[] } = {};
    // Convertir les cellules éditables du format { row: number, col: string } vers { row: number, col: number }
    const convertedCells = this.editableCells.map(cell => ({
      row: cell.row,
      col: typeof cell.col === 'string' ? parseInt(cell.col.replace('column-', '')) : cell.col
    }));
    result['0'] = convertedCells; // Utiliser la feuille 0 par défaut
    return result;
  }

  constructor(
    private shareService: ShareService,
    private shareTabdataService: ShareTabdataService,
    private logger: LoggerService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService,
    private authService: UnifiedAuthService,
    private confirmationModalService: ConfirmationModalService
  ) {}

  async ngOnInit() {
    // S'abonner aux changements d'état d'authentification
    this.authStateSubscription = this.authService.getAuthState$().subscribe(
      (state: UnifiedAuthState) => {
        this.authState = state;
        this.logger.log('ShareAccess - État d\'authentification mis à jour:', state);
      }
    );
    
    // Nettoyer l'URL des paramètres d'authentification indésirables
    this.cleanUrl();
    
    // Récupérer le token depuis l'URL
    this.token = this.route.snapshot.paramMap.get('token') || '';
    
    if (!this.token) {
      this.error = 'Token d\'accès manquant';
      this.isLoading = false;
      return;
    }
    
    await this.loadFormData();
  }

  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
  }

  private getEmailFromCookie(): string {
    const userCookie = this.getCookie('novapartage_user');
    if (userCookie) {
      try {
        const user = JSON.parse(userCookie);
        return user.email || '';
      } catch (error) {
        this.logger.warn('Erreur lors du parsing du cookie utilisateur:', error);
        return '';
      }
    }
    return '';
  }

  private getCookie(name: string): string {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  }

  async loadFormData() {
    try {
      this.isLoading = true;
      this.error = null;
      
      // Marquer le token comme utilisé une seule fois à l'ouverture
      this.shareService.markTokenAsUsed(this.token).subscribe({
        next: () => {
          this.logger.log('✅ Token marqué comme utilisé');
        },
        error: (error: any) => {
          // Ne pas bloquer le chargement si l'appel échoue (token peut être déjà marqué)
          this.logger.warn('⚠️ Impossible de marquer le token comme utilisé:', error);
        }
      });
      
      // Charger la première page complète (pas limit=1) pour avoir les infos du formulaire et les editableCells corrects
      const PAGE_SIZE = 20;
      this.shareService.getFormDataWithToken(this.token, 1, PAGE_SIZE).subscribe({
        next: (response: FormAccessData) => {
          this.formData = response;
          this.setupFormData();
          
          // Charger toutes les données originales (sans pagination) pour initialiser originalValues
          // Cela permet d'avoir les bonnes clés pour toutes les cellules éditables
          this.shareService.getFormDataWithToken(this.token).subscribe({
            next: (allDataResponse: FormAccessData) => {
              // Utiliser toutes les données originales pour initialiser originalValues
              this.originalTableData = allDataResponse.originalTableData || [];
              // 🔧 CORRECTION : Initialiser originalValues pour toutes les cellules éditables (pas seulement la première page)
              this.initializeOriginalValuesRobust();
              this.isLoading = false;
            },
            error: (error: any) => {
              this.logger.error('❌ Erreur récupération données complètes:', error);
              // Continuer même en cas d'erreur, on a déjà les métadonnées
              this.isLoading = false;
            }
          });
        },
        error: (error: any) => {
          this.logger.error('❌ Erreur récupération données formulaire:', error);
          
          // Vérifier si c'est une erreur de tabdata obsolète
          if (this.shareTabdataService.isTabdataObsoleteError(error)) {
            this.handleObsoleteTabdata();
          }
          // Vérifier si c'est une erreur d'autorisation (token expiré ou invalide)
          else if (error.status === 401) {
            // Token expiré ou invalide - vérifier s'il s'agit d'un accès validé
            this.handleExpiredToken();
          } else {
            this.error = 'Erreur lors du chargement des données du formulaire';
          }
          this.isLoading = false;
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Erreur lors du chargement des données:', error);
      this.error = 'Erreur lors du chargement des données du formulaire';
      this.isLoading = false;
    }
  }

  private handleObsoleteTabdata() {
    this.logger.warn('⚠️ Tabdata obsolète détecté');
    this.error = 'Les données de ce partage sont obsolètes et nécessitent une mise à jour. Veuillez contacter l\'expéditeur pour qu\'il recalculé les données.';
    this.showObsoleteTabdataWarning();
  }

  private showObsoleteTabdataWarning() {
    // Afficher un message d'avertissement avec des informations utiles
    this.notificationService.warning('Données obsolètes - Contactez l\'expéditeur pour une mise à jour');
  }

  private handleExpiredToken() {
    // Pour un token expiré, on peut essayer de récupérer des informations de base
    // ou afficher un message plus informatif
    this.error = 'Ce lien d\'accès a expiré. Si vous avez déjà validé ce formulaire, contactez l\'expéditeur pour un nouveau lien.';
    
    // Optionnel : essayer de récupérer des informations de base sur le partage
    // même si le token est expiré, pour donner plus de contexte à l'utilisateur
    this.showExpiredTokenInfo();
  }

  private showExpiredTokenInfo() {
    // Afficher des informations de base même pour un token expiré
    // Cela peut aider l'utilisateur à comprendre de quoi il s'agit

    // Récupérer l'email depuis l'URL ou les cookies
    const emailFromUrl = this.route.snapshot.queryParams['email'];
    const emailFromCookie = this.getEmailFromCookie();
    const email = emailFromUrl || emailFromCookie || '';

    // Créer un message informatif avec option de connexion
    const expiredMessage = `
      <div class="text-center py-5">
        <div class="alert alert-warning mx-auto" style="max-width: 600px;">
          <i class="bi bi-exclamation-triangle me-2" style="font-size: 2rem;"></i>
          <h4 class="alert-heading">Lien d'accès expiré</h4>
          <p class="mb-3">
            Ce lien d'accès a expiré et n'est plus accessible. 
            Vous pouvez demander un nouveau lien de connexion.
          </p>
          <div class="mt-3">
            <button class="btn btn-outline-secondary me-2" onclick="window.history.back()">
              <i class="bi bi-arrow-left me-1"></i>Retour
            </button>
            <button class="btn btn-primary" onclick="window.location.href='/?showLogin=true&expired=true${email ? '&email=' + encodeURIComponent(email) : ''}'">
              <i class="bi bi-box-arrow-in-right me-1"></i>Demander un nouveau lien
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remplacer le contenu principal par le message d'expiration
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.innerHTML = expiredMessage;
    }
  }

  setupFormData() {
    if (!this.formData) return;

    // Utiliser directement les données du tableau (fusionnées)
    this.tableData = this.formData.tableData || [];
    
    // Récupérer les données originales d'Excel
    this.originalTableData = this.formData.originalTableData || [];
    
    // Récupérer les cellules éditables
            this.editableCells = this.formData.tableDataEditableCells || [];

    
    // Récupérer les labels de colonnes
    this.columnLabels = this.formData.columnLabels || {};
    
    // Récupérer le titre et la description
    this.pageTitle = this.formData.pageTitle ;
    this.pageDescription = this.formData.pageDescription ;
    
    
    // Vérifier le statut du token
    this.isTokenValidated = this.formData.tokenStatus === 'VALIDATED';
    this.validatedAt = this.formData.validatedAt || null;
    
    // Vérifier s'il y a des champs éditables ET que le token n'est pas validé
    this.hasEditableFields = this.editableCells.length > 0 && !this.isTokenValidated;
    
          // Initialiser les valeurs originales pour détecter les modifications
      this.initializeOriginalValuesRobust();
    
    this.logger.log('📋 Configuration du formulaire:', {
      tableData: this.tableData.length,
      originalTableData: this.originalTableData.length,
      editableCells: this.editableCells.length,
      columnLabels: Object.keys(this.columnLabels).length,
      pageTitle: this.pageTitle,
      pageDescription: this.pageDescription,
      tokenStatus: this.formData.tokenStatus,
      isTokenValidated: this.isTokenValidated,
      validatedAt: this.validatedAt,
      hasEditableFields: this.hasEditableFields
    });
  }

  initializeOriginalValues() {
    this.originalValues = {};
    this.modifiedCells.clear();
    
    // Stocker les VRAIES valeurs originales d'Excel pour détecter les modifications
    for (const cell of this.editableCells) {
      const rowIndex = cell.row;
      const columnKey = cell.col; // Maintenant cell.col contient directement le nom de la colonne
      
      if (this.originalTableData[rowIndex]) {
        const originalValue = this.originalTableData[rowIndex][columnKey] || '';
        // Utiliser le nouveau format de clés : rowIndex-columnKey
        const cellKey = `${rowIndex}-${columnKey}`;
        this.originalValues[cellKey] = originalValue;
        

      } else {
        this.logger.warn(`⚠️ Ligne invalide: ${rowIndex} pour la colonne ${columnKey}`);
      }
    }
    

  }

  /**
   * Nouveau système de mapping robuste des cellules
   * Construit un mapping entre les indices filtrés et les clés Excel réelles
   */
  private buildRobustCellMapping(): Map<string, CellMapping> {
    const cellMapping = new Map<string, CellMapping>();
    
    if (this.originalTableData.length === 0 || this.editableCells.length === 0) {

      return cellMapping;
    }
    
    // Récupérer toutes les colonnes Excel disponibles
    const firstRow = this.originalTableData[0];
    const availableExcelColumns = Object.keys(firstRow)
      .filter(key => key.startsWith('column-'))
      .sort((a, b) => {
        const aIndex = parseInt(a.replace('column-', ''));
        const bIndex = parseInt(b.replace('column-', ''));
        return aIndex - bIndex;
      });
    

    
    // Construire le mapping pour chaque cellule éditable
    for (const cell of this.editableCells) {
      const filteredRowIndex = cell.row;
      const excelColumnKey = cell.col; // Maintenant cell.col contient directement le nom de la colonne
      
      // Vérifier que la colonne existe dans le tableau filtré
      if (this.tableData[filteredRowIndex] && this.tableData[filteredRowIndex].hasOwnProperty(excelColumnKey)) {
        const excelColumnIndex = parseInt(excelColumnKey.replace('column-', ''));
        
        // Trouver l'index Excel de la ligne correspondante
        const excelRowIndex = this.findExcelRowIndex(filteredRowIndex);
        
        // Trouver l'index de la colonne dans le tableau filtré
        const filteredColumnKeys = Object.keys(this.tableData[filteredRowIndex] || {})
          .filter(key => key.startsWith('column-'))
          .sort((a, b) => {
            const aIndex = parseInt(a.replace('column-', ''));
            const bIndex = parseInt(b.replace('column-', ''));
            return aIndex - bIndex;
          });
        
        const filteredColumnIndex = filteredColumnKeys.indexOf(excelColumnKey);
        
        const mapping: CellMapping = {
          excelColumnKey,
          filteredColumnIndex,
          excelColumnIndex,
          excelRowIndex
        };
        
        const cellKey = `${filteredRowIndex}-${filteredColumnIndex}`;
        cellMapping.set(cellKey, mapping);
        

      } else {
        this.logger.warn(`⚠️ Colonne ${excelColumnKey} non trouvée dans la ligne ${filteredRowIndex}`);
      }
    }
    
    return cellMapping;
  }

  /**
   * Trouve l'index Excel correspondant à un index filtré
   */
  private findExcelRowIndex(filteredRowIndex: number): number {
    // Pour l'instant, on suppose que l'index filtré correspond à l'index Excel
    // Cette logique peut être améliorée si nécessaire
    return filteredRowIndex;
  }

  /**
   * Initialise les valeurs originales avec le nouveau système de mapping robuste
   * Utilise directement originalTableData qui contient toutes les cellules éditables avec leurs index absolus
   * 🔧 CORRECTION : originalTableData contient déjà toutes les cellules éditables (optimisation backend)
   * Il suffit de parcourir originalTableData et d'initialiser originalValues pour toutes les cellules présentes
   * En mode readOnly (token validé), initialise aussi formValues avec les valeurs soumises depuis tableData
   */
  private initializeOriginalValuesRobust() {
    this.originalValues = {};
    this.modifiedCells.clear();
    this.formValues = {};
    
    // Si on n'a pas les données nécessaires, ne rien faire
    if (!this.originalTableData || this.originalTableData.length === 0) {
      this.logger.warn('⚠️ Données insuffisantes pour initialiser originalValues');
      return;
    }
    
    // 🔧 CORRECTION : Parcourir originalTableData qui contient toutes les cellules éditables
    // originalTableData est indexé avec des index absolus (0, 1, 2, ..., totalRows-1)
    // Chaque ligne contient seulement les colonnes éditables pour cette ligne
    for (let absoluteRowIndex = 0; absoluteRowIndex < this.originalTableData.length; absoluteRowIndex++) {
      const row = this.originalTableData[absoluteRowIndex];
      if (row && typeof row === 'object') {
        // Parcourir toutes les colonnes de cette ligne (qui sont toutes éditables)
        for (const columnKey in row) {
          if (columnKey.startsWith('column-')) {
            const originalValue = row[columnKey] || '';
            
            // Créer la clé au format utilisé par form-preview : `${absoluteRowIndex}-${columnKey}`
            const cellKey = `${absoluteRowIndex}-${columnKey}`;
            
            // Stocker la valeur originale
            this.originalValues[cellKey] = originalValue;
            
            // 🔧 CORRECTION : En mode readOnly (token validé), initialiser formValues avec les valeurs soumises depuis tableData
            // tableData contient les données fusionnées (originales + soumises) du backend
            if (this.isTokenValidated && this.tableData && absoluteRowIndex < this.tableData.length) {
              const submittedRow = this.tableData[absoluteRowIndex];
              const submittedValue = submittedRow && typeof submittedRow === 'object' ? submittedRow[columnKey] : originalValue;
              this.formValues[cellKey] = submittedValue !== undefined && submittedValue !== null ? submittedValue : originalValue;
            } else {
              // Initialiser formValues avec la valeur originale (sera mise à jour par form-preview si modifiée)
              this.formValues[cellKey] = originalValue;
            }
          }
        }
      }
    }
    
    this.logger.log('📋 originalValues initialisés pour toutes les cellules éditables:', {
      originalTableDataLength: this.originalTableData.length,
      originalValuesCount: Object.keys(this.originalValues).length,
      formValuesCount: Object.keys(this.formValues).length,
      isTokenValidated: this.isTokenValidated,
      tableDataLength: this.tableData?.length || 0,
      sampleKeys: Object.keys(this.originalValues).slice(0, 5)
    });
  }

  /**
   * Obtient les valeurs modifiées pour la sauvegarde avec le nouveau système
   */
  private getModifiedValuesForSave(): { [key: string]: any } {
    const modifiedValues: { [key: string]: any } = {};
    
    for (const cellKey of this.modifiedCells) {
      if (this.formValues[cellKey] !== undefined) {
        modifiedValues[cellKey] = this.formValues[cellKey];
      }
    }
    

    return modifiedValues;
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

  getExpiryDate(): string {
    if (!this.formData?.expiresAt) return 'Pas de date d\'expiration';
    return this.formatDate(this.formData.expiresAt);
  }

  saveForm() {
    if (!this.hasEditableFields) return;
    
    // Utiliser la nouvelle méthode robuste pour obtenir les valeurs modifiées
    const modifiedValues = this.getModifiedValuesForSave();
    
    if (Object.keys(modifiedValues).length === 0) {
      this.notificationService.warning('Aucune modification à sauvegarder');
      return;
    }
    

    
    // Appeler le service de sauvegarde
    this.shareService.saveFormData(this.token, modifiedValues).subscribe({
      next: (response: any) => {

        this.notificationService.success('Formulaire sauvegardé avec succès !');
        
        // Recharger le formulaire pour afficher les données mises à jour
        this.reloadFormData();
      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors de la sauvegarde:', error);
        this.notificationService.error('Erreur lors de la sauvegarde du formulaire');
      }
    });
  }

  validateForm() {
    // Vérifier l'authentification et les permissions
    const validationResult = this.checkValidationPermissions();
    
    if (validationResult.canValidate) {
      if (validationResult.requiresConfirmation) {
        // Afficher le modal de confirmation pour le propriétaire
        this.showOwnerValidationModal = true;
      } else {
        // Validation directe
        this.performValidation();
      }
    } else {
      // Refuser la validation
      this.notificationService.error(validationResult.errorMessage || 'Validation non autorisée');
    }
  }

  /**
   * Vérifie les permissions de validation
   */
  private checkValidationPermissions(): { canValidate: boolean, requiresConfirmation: boolean, errorMessage?: string } {
    // Si l'utilisateur n'est pas connecté, il peut valider normalement (comportement existant)
    if (!this.authState.isAuthenticated || !this.authState.userEmail) {
      return { canValidate: true, requiresConfirmation: false };
    }

    const userEmail = this.authState.userEmail;
    const recipientEmail = this.formData?.recipientEmail;
    const ownerEmail = this.formData?.ownerEmail;

    this.logger.log('ShareAccess - Vérification des permissions:', {
      userEmail,
      recipientEmail,
      ownerEmail
    });

    // Si l'utilisateur est le destinataire, validation normale
    if (userEmail === recipientEmail) {
      return { canValidate: true, requiresConfirmation: false };
    }

    // Si l'utilisateur est le propriétaire, validation avec confirmation
    if (userEmail === ownerEmail) {
      return { 
        canValidate: true, 
        requiresConfirmation: true,
        errorMessage: 'Vous allez valider les données à la place du destinataire'
      };
    }

    // Si l'utilisateur n'est ni le destinataire ni le propriétaire, refuser
    return { 
      canValidate: false, 
      requiresConfirmation: false,
      errorMessage: 'Vous n\'êtes pas autorisé à valider ce formulaire'
    };
  }

  /**
   * Effectue la validation après confirmation
   * @param closeModalCallback Fonction optionnelle à appeler pour fermer le modal après validation réussie
   */
  private performValidation(closeModalCallback?: () => void) {
    // Demander confirmation à l'utilisateur
    const modifiedValues = this.getModifiedValuesForSave();
    const confirmMessage = 'Voulez-vous valider ce formulaire ? L\'accès sera clôturé.';
    
    // Utiliser le modal de confirmation au lieu de confirm() natif
    this.confirmationModalService.confirm(confirmMessage, 'Confirmer la validation').then(confirmed => {
      if (!confirmed) {
        // L'utilisateur a annulé - réinitialiser l'état du modal si on vient du modal
        if (closeModalCallback) {
          // Si on vient du modal, on ne le ferme pas mais on réinitialise juste l'état de chargement
          // Le modal reste ouvert pour permettre à l'utilisateur de réessayer ou d'annuler
          this.isOwnerValidating = false;
        }
        return;
      }
      
      // Continuer avec la validation
      this.continueValidation(modifiedValues, closeModalCallback);
    });
  }
  
  /**
   * Continue la validation après confirmation
   */
  private continueValidation(modifiedValues: { [key: string]: any }, closeModalCallback?: () => void): void {
    // D'abord, sauvegarder le formulaire s'il y a des modifications
    if (Object.keys(modifiedValues).length > 0) {
      this.logger.log('💾 Sauvegarde des modifications avant validation...');
      
      // Sauvegarder d'abord
      this.shareService.saveFormData(this.token, modifiedValues).subscribe({
        next: (saveResponse: any) => {
          this.logger.log('✅ Formulaire sauvegardé avant validation:', saveResponse);
          
          // Puis valider
          this.executeValidation(closeModalCallback);
        },
        error: (saveError: any) => {
          this.logger.error('❌ Erreur lors de la sauvegarde avant validation:', saveError);
          this.notificationService.error('Erreur lors de la sauvegarde du formulaire');
          
          // Fermer le modal et réinitialiser l'état en cas d'erreur
          if (closeModalCallback) {
            closeModalCallback();
          }
        }
      });
    } else {
      this.logger.log('ℹ️ Aucune modification à sauvegarder, validation directe...');
      // Pas de modifications, valider directement
      this.executeValidation(closeModalCallback);
    }
  }

  private executeValidation(closeModalCallback?: () => void) {
    // Déterminer qui valide
    const validatedBy = this.authState.isAuthenticated && this.authState.userEmail 
      ? this.authState.userEmail 
      : undefined;
    
    // Appeler le service de validation
    this.shareService.validateAccessToken(this.token, validatedBy).subscribe({
      next: (response: any) => {
        this.logger.log('✅ Formulaire validé avec succès:', response);
        this.notificationService.success('Formulaire validé avec succès ! L\'accès a été clôturé.');
        
        // Fermer le modal si un callback est fourni
        if (closeModalCallback) {
          closeModalCallback();
        }
        
        // Rediriger vers une page de confirmation ou afficher un message
        this.showValidationSuccess();
      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors de la validation:', error);
        this.notificationService.error('Erreur lors de la validation du formulaire');
        
        // Fermer le modal et réinitialiser l'état même en cas d'erreur
        if (closeModalCallback) {
          closeModalCallback();
        }
      }
    });
  }

  /**
   * Confirme la validation par le propriétaire
   */
  async confirmOwnerValidation() {
    this.isOwnerValidating = true;
    
    // Callback pour fermer le modal après validation réussie
    const closeModal = () => {
      this.showOwnerValidationModal = false;
      this.isOwnerValidating = false;
    };
    
    // Passer le callback pour fermer le modal après validation réussie
    this.performValidation(closeModal);
    
    // Note: Si performValidation retourne immédiatement (annulation de confirmation),
    // le modal reste ouvert et isOwnerValidating sera réinitialisé dans le callback
    // en cas de succès, ou dans le gestionnaire d'erreur en cas d'échec
  }

  /**
   * Annule la validation par le propriétaire
   */
  cancelOwnerValidation() {
    this.showOwnerValidationModal = false;
    this.isOwnerValidating = false;
  }

  showValidationSuccess() {
    // Afficher un message de succès et désactiver les interactions
    this.error = null;
    this.isLoading = false;
    
    // Créer un message de succès
    const successMessage = `
      <div class="text-center py-5">
        <div class="alert alert-success mx-auto" style="max-width: 600px;">
          <i class="bi bi-check-circle me-2" style="font-size: 2rem;"></i>
          <h4 class="alert-heading">Formulaire validé avec succès !</h4>
          <p class="mb-0">
            Votre formulaire a été validé et l'accès a été clôturé. 
            Le créateur du partage sera notifié de votre validation.
          </p>
        </div>
      </div>
    `;
    
    // Remplacer le contenu principal par le message de succès
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.innerHTML = successMessage;
    }
  }

  updateOriginalValuesAfterSave(modifiedValues: { [key: string]: any }) {
    // NE PAS mettre à jour les valeurs originales - elles doivent rester les vraies valeurs d'Excel
    // Seulement vider les cellules modifiées car elles ont été sauvegardées
    this.modifiedCells.clear();
    

  }

  reloadFormData() {

    
    // Recharger les données du formulaire
    this.loadFormData();
  }

  cleanUrl() {
    // Nettoyer l'URL des paramètres Keycloak indésirables
    const currentUrl = window.location.href;
    
    // Vérifier s'il y a des paramètres Keycloak dans l'URL
    if (currentUrl.includes('#iss=') || currentUrl.includes('&iss=')) {

      
      // Extraire le chemin de base sans les paramètres
      const url = new URL(currentUrl);
      const basePath = url.pathname;
      
      // Reconstruire l'URL propre
      const cleanUrl = window.location.origin + basePath;
      
      // Remplacer l'URL dans l'historique sans recharger la page
      window.history.replaceState({}, document.title, cleanUrl);
      

    }
  }

  // Méthode pour vérifier si une cellule a été modifiée
  isCellModified(rowIndex: number, colKey: string): boolean {
    const cellKey = `${rowIndex}-${colKey}`;
    return this.modifiedCells.has(cellKey);
  }

  // Méthode pour obtenir le nombre de modifications
  getModifiedCount(): number {
    return this.modifiedCells.size;
  }

  // Méthode pour gérer les événements de modification de cellules
  onCellModified(event: { cellKey: string, isModified: boolean }) {
    if (event.isModified) {
      this.modifiedCells.add(event.cellKey);
    } else {
      this.modifiedCells.delete(event.cellKey);
    }
    

  }

  getFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  downloadFormAsHtml() {
    if (!this.token) {
      this.notificationService.error('Token d\'accès manquant');
      return;
    }
    
    // Appeler le backend pour générer et télécharger le HTML
    this.shareService.downloadFormAsHtml(this.token).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Utiliser le titre du formulaire pour le nom du fichier
        const title = this.pageTitle ? this.pageTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_') : 'formulaire';
        const email = this.formData?.recipientEmail || 'partage';
        const date = new Date().toISOString().split('T')[0];
        link.download = `${title}_${email}_${date}.html`;
        
        // Déclencher le téléchargement
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Libérer l'URL
        window.URL.revokeObjectURL(url);
        
        this.notificationService.success('Formulaire téléchargé avec succès !');
      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors du téléchargement du HTML:', error);
        this.notificationService.error('Erreur lors du téléchargement du formulaire');
      }
    });
  }

  downloadFormAsCsv() {
    if (!this.token) {
      this.notificationService.error('Token d\'accès manquant');
      return;
    }
    
    // Appeler le backend pour générer et télécharger le CSV
    this.shareService.downloadFormAsCsv(this.token).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Utiliser le titre du formulaire pour le nom du fichier
        const title = this.pageTitle ? this.pageTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_') : 'formulaire';
        const email = this.formData?.recipientEmail || 'partage';
        const date = new Date().toISOString().split('T')[0];
        link.download = `${title}_${email}_${date}.csv`;
        
        // Déclencher le téléchargement
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Libérer l'URL
        window.URL.revokeObjectURL(url);
        
        this.notificationService.success('Fichier CSV téléchargé avec succès !');
      },
      error: (error: any) => {
        this.logger.error('❌ Erreur lors du téléchargement du CSV:', error);
        this.notificationService.error('Erreur lors du téléchargement du fichier CSV');
      }
    });
  }

} 