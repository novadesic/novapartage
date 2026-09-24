import { Component, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { DestinatairesTabsComponent } from '../destinataires-tabs/destinataires-tabs.component';
import { TableauSelectionComponent } from '../tableau-selection/tableau-selection.component';
import { DestinatairesListComponent } from '../destinataires-list/destinataires-list.component';
import { FormConfiguratorComponent } from '../form-configurator/form-configurator.component';
import { FormsPreviewContainerComponent } from '../forms-preview-container/forms-preview-container.component';
import { FormPreviewComponent } from '../form-preview/form-preview.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { MessageDisplayComponent } from '../message-display/message-display.component';
import { ExcelService, ExcelData } from '../../services/excel.service';
import { FileUploadService } from '../../services/file-upload.service';
import { FileDataSharingService } from '../../services/file-data-sharing.service';
import { ShareService, ShareRequest, ContactInfo } from '../../services/share.service';
import { ShareTabdataService } from '../../services/share-tabdata.service';
import { LoggerService } from '../../services/logger.service';
import { MessageService } from '../../services/message.service';
import { EnvironmentService } from '../../services/environment.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';
import { NotificationService } from '../../services/notification.service';
import { SubscriptionService } from '../../services/subscription.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-new-share',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DestinatairesTabsComponent,
    TableauSelectionComponent,
    DestinatairesListComponent,
    FormConfiguratorComponent,
    FormsPreviewContainerComponent,
    FormPreviewComponent,
    NavbarComponent,
    MessageDisplayComponent
  ],
  templateUrl: './new-share.component.html',
  styleUrls: ['./new-share.component.scss']
})
export class NewShareComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('formPreview') formPreview?: FormPreviewComponent;

  // Navigation du wizard simple
  currentStep: number = 1;
  totalSteps: number = 4;
  

  // État de validation du tableau
  isTableauValid: boolean = true;

  // Données du wizard
  selectedFile: File | null = null;
  shareableData: any = {};
  recipients: any[] = [];
  permissions: any = {};
  
  // Propriétés pour l'upload Excel
  isUploading: boolean = false;
  uploadError: string | null = null;
  tempFileId: string | null = null; // ID temporaire du fichier uploadé
  shareId: string | null = null; // ID du partage existant (pour l'édition)
  
  // Propriétés pour la génération des liens d'accès
  isGeneratingLinks: boolean = false;
  linkGenerationProgress: number = 0;
  totalRecipients: number = 0;
  linksGenerated: number = 0;
  
  // Propriété pour marquer que la finalisation est en cours (optimisation)
  isFinalizing: boolean = false;
  
  // Propriétés pour la validation d'email
  showEmailValidationModal: boolean = false;
  showCodeValidationSuccessModal: boolean = false;
  userEmail: string = '';
  acceptTerms: boolean = false;
  verificationCode: string = '';

  // ViewChild pour le focus automatique des modals
  @ViewChild('recipientModal') recipientModal!: ElementRef;
  @ViewChild('recipientTextarea') recipientTextarea!: ElementRef;
  @ViewChild('emailValidationModal') emailValidationModal!: ElementRef;
  @ViewChild('emailInput') emailInput!: ElementRef;
  isSendingEmail: boolean = false;
  isVerifyingCode: boolean = false;
  isResendingCode: boolean = false;
  emailValidationSent: boolean = false;
  isUserEmailValidated: boolean = false;
  loginMethod: 'password' | 'code' | null = null;
  userPassword: string = '';
  showSharePassword = false;
  isLoggingInWithPassword: boolean = false;
  loginPasswordError: string = '';
  
  // Propriétés pour le partage en cours de création
  currentShareId: string | null = null; // ID du partage en cours de création
  isSaving: boolean = false; // Indique si une sauvegarde est en cours
  shareStatus: string | null = null; // Statut du partage actuel
  isLoadingExistingShare: boolean = false; // Indique si un partage existant est en cours de chargement
  
  // Propriétés pour les formulaires
  selectedPermission: string = 'read'; // Valeur par défaut : lecture seule
  allowComments: boolean = false;
  allowDownload: boolean = false;

  // Propriétés pour l'étape 2 - Données partageable
  selectedSheet: string = 'Feuille 1';
  headerRow: number = 1;
  dataStartRow: number = 2;
  columnRange: string = 'A:F';
  includeFormulas: boolean = false;
  preserveFormatting: boolean = true;

  // Données Excel chargées depuis le backend
  sheets: any[] = [];
  /** Cellules contenant des formules (indices relatifs à la première page) - pour l'affichage initial après upload */
  formulaCells: { row: number; col: string }[] = [];

  selectedSheetIndex = 0;
  // Feuille sélectionnée par destinataire (recipientIndex -> sheetIndex)
  recipientSelectedSheets: { [recipientIndex: number]: number | undefined } = {};
  // Données Excel chargées depuis le backend
  private _tableData: any[] = [];
  
  // Cache pour tableData pour éviter les recalculs constants
  private _cachedTableData: any[] = [];
  private _lastTableDataHash: string = '';
  private _lastActiveRecipientIndex: number = -1;
  private _lastActiveRecipientSheet: number = -1;
  
  // Cache pour getActiveRecipientSelection pour éviter les recalculs constants
  private _cachedActiveRecipientSelection: { row: number, col: number }[] = [];
  private _lastSelectionHash: string = '';
  
  // Propriétés pour la gestion intelligente de la mémoire
  private dataChunkSize: number = 1000;
  private loadedDataChunks: Map<number, any[]> = new Map();
  private memoryCleanupInterval: any;
  
  // Phase 2: Lazy loading des feuilles
  private readonly PAGE_SIZE: number = 100; // Nombre de lignes par page
  private loadedSheets: Set<number> = new Set(); // Feuilles chargées
  private recentlyUsedSheets: Set<number> = new Set(); // Feuilles récemment utilisées
  private readonly MAX_SHEETS_IN_MEMORY: number = 3; // Maximum de feuilles en mémoire
  private readonly MAX_ROWS_PER_SHEET: number = 1000; // Maximum de lignes par feuille en mémoire
  private sheetPageCache: Map<string, { page: number, data: any[] }[]> = new Map(); // Cache des pages par feuille
  // En-têtes potentiels par feuille (initialisés lors du chargement de la première page)
  private sheetHeaders: Map<number, { [colKey: string]: string }> = new Map(); // En-têtes par feuille (colKey -> label)
  
  // 🔒 SÉCURITÉ : Propriétés de simulation supprimées
  // Le form-preview gère maintenant sa propre simulation
  
  get tableData() {
    // Créer un hash simple pour détecter les changements
    const currentRecipientIndex = this.activeRecipientIndex;
    const currentRecipientSheet = this.recipientSelectedSheets[currentRecipientIndex] ?? 0;
    const sheetsHash = JSON.stringify(this.sheets?.map(s => s.data?.length || 0) || []);
    const cacheKey = `${currentRecipientIndex}-${currentRecipientSheet}-${sheetsHash}`;
    
    // Si rien n'a changé, retourner le cache
    if (this._lastTableDataHash === cacheKey && 
        this._lastActiveRecipientIndex === currentRecipientIndex && 
        this._lastActiveRecipientSheet === currentRecipientSheet) {
      return this._cachedTableData;
    }
    
    // Recalculer seulement si nécessaire
    this._lastTableDataHash = cacheKey;
    this._lastActiveRecipientIndex = currentRecipientIndex;
    this._lastActiveRecipientSheet = currentRecipientSheet;
    this._cachedTableData = this.calculateTableData();
    
    return this._cachedTableData;
  }
  
  private calculateTableData(): any[] {
    // Utiliser directement recipientSelectedSheets pour éviter la récursion
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    
    if (!this.sheets || this.sheets.length === 0 || !this.sheets[activeRecipientSheet]) {
      return [];
    }
    
    // Utiliser la gestion intelligente de la mémoire pour les gros fichiers
    const totalRows = this.sheets[activeRecipientSheet].data?.length || 0;
      
    if (totalRows > this.dataChunkSize) {
      // Charger seulement le premier chunk pour l'affichage initial
      const firstChunk = this.loadDataChunk(0);
      return firstChunk;
    }
    
    return this.sheets[activeRecipientSheet].data || [];
  }
  
  set tableData(data: any[]) {
    this._tableData = data;
  }

  // Champs détectés (se remplit automatiquement)
  detectedFields: any[] = [];

  activeRecipientIndex: number = 0;

  showNoRecipientModal = false;
  noRecipientTextarea = '';
  activeTab: 'manual' | 'contacts' = 'manual';
  
  
  // Propriétés pour la sélection de contacts existants
  userContacts: ContactInfo[] = [];
  selectedContacts: string[] = [];
  isLoadingContacts = false;
  contactsError: string | null = null;

  /**
   * Retourne les contacts triés par ordre alphabétique
   */
  get sortedUserContacts(): ContactInfo[] {
    return [...this.userContacts].sort((a, b) => {
      const nameA = (a.displayName || a.email || '').toLowerCase();
      const nameB = (b.displayName || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Retourne les contacts sélectionnés triés par ordre alphabétique
   */
  get sortedSelectedContacts(): string[] {
    return [...this.selectedContacts].sort((a, b) => {
      const nameA = a.toLowerCase();
      const nameB = b.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Vérifie si le bouton "Sauvegarder" doit être affiché
   * Le bouton n'est affiché que si le partage est en statut NEW ou s'il n'y a pas encore de partage
   * ET que l'utilisateur est connecté
   */
  canShowSaveButton(): boolean {
    return (this.shareStatus === null || this.shareStatus === 'NEW') && this.authService.isLoggedIn();
  }

  /**
   * Vérifie si on peut ajouter plus de destinataires
   */
  canAddMoreRecipients(): boolean {
    return this.recipients.length < this.maxRecipientsPerShare;
  }

  /**
   * Retourne le nombre de destinataires restants
   */
  getRemainingRecipientsCount(): number {
    return Math.max(0, this.maxRecipientsPerShare - this.recipients.length);
  }

  /**
   * Calcule le nombre de destinataires qui seraient ajoutés depuis le textarea
   */
  getPotentialRecipientsCount(): number {
    if (!this.noRecipientTextarea || !this.noRecipientTextarea.trim()) {
      return 0;
    }
    
    const contactLines = this.noRecipientTextarea.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && this.shareService.isValidContact(line));
    
    // Compter seulement les contacts qui ne sont pas déjà dans la liste
    let newContactsCount = 0;
    for (const contactLine of contactLines) {
      const parsedContact = this.shareService.parseContact(contactLine);
      if (!this.recipients.some(r => r.email === parsedContact.email)) {
        newContactsCount++;
      }
    }
    
    return newContactsCount;
  }

  /**
   * Vérifie si l'ajout des destinataires du textarea dépasserait la limite
   */
  wouldExceedLimit(): boolean {
    const potentialCount = this.getPotentialRecipientsCount();
    return (this.recipients.length + potentialCount) > this.maxRecipientsPerShare;
  }

  /**
   * Retourne le nombre de destinataires qui seraient ajoutés sans dépasser la limite
   */
  getValidRecipientsCount(): number {
    const potentialCount = this.getPotentialRecipientsCount();
    const remaining = this.getRemainingRecipientsCount();
    return Math.min(potentialCount, remaining);
  }

  // Propriétés pour les cellules éditables
  editableCells: { [recipientIndex: number]: { [sheetIndex: string]: { row: number, col: number }[] } } = {};

  // Propriétés pour les labels de colonnes
  columnLabels: { [recipientIndex: number]: { [sheetIndex: string]: { [colKey: string]: string } } } = {};
  
  // Limite de destinataires par partage
  maxRecipientsPerShare: number = 50;
  
  // Cache pour les en-têtes afin de forcer la mise à jour
  private _cachedHeaders: string[] = [];
  private _lastHeadersUpdate: number = 0;

  isRestricted = false;
  private subscriptionSub?: Subscription;

  constructor(
    public router: Router, 
    private route: ActivatedRoute,
    private excelService: ExcelService,
    private fileUploadService: FileUploadService,
    private fileDataSharingService: FileDataSharingService,
    public authService: UnifiedAuthService,
    private shareService: ShareService,
    private shareTabdataService: ShareTabdataService,
    private subscriptionService: SubscriptionService,
    private logger: LoggerService,
    private changeDetectorRef: ChangeDetectorRef,
    private confirmationModalService: ConfirmationModalService,
    private messageService: MessageService,
    private http: HttpClient,
    private envService: EnvironmentService,
    private notificationService: NotificationService
  ) {

  }

  ngOnInit() {
    this.subscriptionSub = this.subscriptionService.subscriptionStatus$.subscribe(s => {
      this.isRestricted = s.restricted;
    });
    const shareId = this.route.snapshot.paramMap.get('id');
    this.shareId = shareId;
    
    // Vérifier les paramètres de l'URL pour le fichier pré-chargé
    const queryParams = this.route.snapshot.queryParams;
    const step = queryParams['step'];
    const tempFileId = queryParams['tempFileId'];
    const fileName = queryParams['fileName'];
    
    // Vérifier si des données de fichier sont disponibles dans le service
    const sharedFileData = this.fileDataSharingService.getFileData();
    
    // Initialiser les cellules éditables pour éviter les erreurs d'accès
    this.editableCells = {};
    
    // Initialiser la limite de destinataires depuis la configuration
    this.maxRecipientsPerShare = this.envService.getMaxRecipientsPerShare();
    
    // Synchroniser les données avec le service de messages
    this.messageService.updateCurrentStep(this.currentStep);
    this.messageService.updateRecipients(this.recipients);
    this.messageService.updateFinalizingState(this.isFinalizing);
    
    if (shareId) {
      // Charger le partage existant de manière asynchrone sans bloquer l'UI
      this.loadExistingShare(shareId);
    } else if (this.authService.isLoggedIn()) {
      // Création d'un nouveau partage : vérifier la limite de partages actifs
      this.shareService.getUserShares().subscribe({
        next: (response) => {
          const shares = response.shares || [];
          const status = (s: any) => String(s.status || '').toUpperCase().trim();
          const activeCount = shares.filter((s: any) => {
            const st = status(s);
            return st === 'ACTIVE' || st === 'NEW';
          }).length;
          const maxActive = this.envService.getMaxActiveShares();
          if (activeCount >= maxActive) {
            this.notificationService.warning(
              `Limite de ${maxActive} partages actifs atteinte. Supprimez un partage pour en créer un nouveau.`,
              'Création impossible',
              8000
            );
            this.router.navigate(['/home']);
          }
        },
        error: () => {
          // En cas d'erreur (ex. token expiré), laisser l'utilisateur continuer
          // La création échouera côté backend si nécessaire
        }
      });
    }

    if (tempFileId && fileName && !shareId) {
      // Fichier pré-chargé depuis la page d'accueil
      this.tempFileId = tempFileId;
      this.selectedFile = new File([], fileName); // Créer un objet File factice pour l'affichage
      this.currentStep = step ? parseInt(step) : 1; // Démarrer à l'étape spécifiée ou 1 par défaut
      
      // Si on arrive à l'étape 1 avec un fichier déjà uploadé, passer automatiquement à l'étape 2
      if (this.currentStep === 1) {
        this.logger.log('Fichier pré-chargé depuis l\'index, passage automatique à l\'étape 2');
        this.currentStep = 2;
        
        // Utiliser les données du service de partage si disponibles
        if (sharedFileData) {
          this.logger.log('Données de fichier trouvées dans le service:', sharedFileData);
          this.loadFileDataFromSharedData(sharedFileData);
        } else {
          this.logger.warn('Aucune donnée de fichier trouvée dans le service, fallback vers API');
          // Fallback : essayer de charger depuis le backend (mais cela échouera probablement)
          this.loadFileDataFromTempId(tempFileId);
        }
      }
    }
    
    // Initialiser l'état d'authentification
    this.initializeAuthState();
    
    // Charger les contacts et tester la connexion en arrière-plan
    // pour ne pas bloquer l'affichage de la page
    setTimeout(() => {
      if (this.authService.isLoggedIn()) {
    this.loadUserContacts();
      this.testBackendConnectionIfAuthenticated();
      } else {
        // Utilisateur non connecté - pas de restauration nécessaire avec la nouvelle approche
      }
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    this.checkNoRecipient();
  }

  ngAfterViewInit() {
    // Observer les changements d'état des modals pour le focus automatique
    this.observeModalChanges();
  }

  ngDoCheck() {
    // Optimisation : ne vérifier que si nécessaire
    // Éviter les calculs coûteux à chaque cycle de détection
    if (this.currentStep === 2 && this.recipients.length === 0 && !this.currentShareId && !this.isLoadingExistingShare) {
      if (!this.showNoRecipientModal) {
      this.showNoRecipientModal = true;
      }
    }
  }

  // Détecter automatiquement les champs basés sur la ligne d'en-têtes
  detectFields() {
    if (!this.tableData || this.tableData.length === 0) {
      this.detectedFields = [];
      return;
    }
    
    const headerRowData = this.getRowData(this.headerRow);
    if (headerRowData) {
      // Utiliser une approche basée sur les indices pour garantir l'ordre
      const columnKeys: string[] = [];
      
      // Trouver le nombre maximum de colonnes
      let maxColIndex = -1;
      for (const key of Object.keys(headerRowData)) {
        if (key.startsWith('column-')) {
          const colIndex = parseInt(key.replace('column-', ''));
          maxColIndex = Math.max(maxColIndex, colIndex);
        }
      }
      
      // Générer les clés dans l'ordre correct
      for (let i = 0; i <= maxColIndex; i++) {
        const columnKey = `column-${i}`;
        if (headerRowData.hasOwnProperty(columnKey)) {
          columnKeys.push(columnKey);
        }
      }
      
      this.detectedFields = columnKeys.map((key, index) => ({
        key: key,
        name: headerRowData[key].toString().toUpperCase(),
        column: this.getColumnLetter(index),
        selected: true
      }));
    } else {
      this.detectedFields = [];
    }
  }

  // Obtenir les données d'une ligne spécifique
  getRowData(rowNumber: number): any {
    if (!this.tableData || this.tableData.length === 0) {
      return null;
    }
    
    if (rowNumber === 1) {
      // Ligne d'en-têtes (maintenant incluse dans les données)
      return this.tableData[0] || {};
    } else if (rowNumber >= 2 && rowNumber <= this.tableData.length) {
      // Lignes de données (index ajusté car l'en-tête est maintenant à l'index 0)
      const dataIndex = rowNumber - 1;
      return this.tableData[dataIndex];
    }
    return null;
  }

  // Convertir un index de colonne en lettre (0->A, 1->B, etc.)
  getColumnLetter(index: number): string {
    return String.fromCharCode(65 + index); // A=65
  }

  // Mettre à jour les curseurs avec validation des contraintes
  updateHeaderRow(newRow: number) {
    if (newRow >= 1 && newRow < this.dataStartRow) {
      this.headerRow = newRow;
      this.detectFields();
    }
  }

  updateDataStartRow(newRow: number) {
    if (newRow > this.headerRow && newRow <= this.tableData.length) {
      this.dataStartRow = newRow;
    }
  }

  // Obtenir le style pour les lignes selon leur type
  getRowStyle(rowIndex: number): any {
    const actualRow = rowIndex + 1;
    if (actualRow === this.headerRow) {
      return { 'background-color': '#fff3cd', 'border': '2px solid #856404' }; // Header highlight
    } else if (actualRow >= this.dataStartRow) {
      return { 'background-color': '#d1ecf1', 'border': '1px solid #bee5eb' }; // Data highlight
    }
    return { 'background-color': '#f8f9fa' }; // Default
  }

  // Vérifier si une ligne est sélectionnable comme en-tête
  canSelectAsHeader(rowIndex: number): boolean {
    const actualRow = rowIndex + 1;
    return actualRow < this.dataStartRow;
  }

  // Vérifier si une ligne est sélectionnable comme début de données
  canSelectAsData(rowIndex: number): boolean {
    const actualRow = rowIndex + 1;
    return actualRow > this.headerRow;
  }

  // Navigation
  canGoNext(): boolean {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return false;
    }
    
    switch (this.currentStep) {
      case 1: return this.isFileSelected() && !this.isUploading && !this.uploadError && this.sheets.length > 0;
      case 2: 
        const recipientsConfigured = this.areRecipientsConfigured();
        const allHaveSelection = this.allRecipientsHaveSelection();
        
        // Afficher un message si les destinataires n'ont pas tous une sélection
        if (recipientsConfigured && this.getRecipientsWithoutSelectionIndices().length > 0) {
          // Synchroniser les destinataires avec le service avant d'afficher le message
          this.messageService.updateRecipients(this.recipients);
          const missingRecipients = this.getRecipientsWithoutSelection();
          this.showUserMessage('warning', 
            `Veuillez faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
          );
        } else if (recipientsConfigured && allHaveSelection && !this.isTableauValid) {
          this.showUserMessage('error', 
            'Limite de colonnes dépassée. Veuillez désélectionner des colonnes pour continuer.'
          );
        } else if (recipientsConfigured && allHaveSelection && this.isTableauValid) {
          this.clearUserMessage();
        }
        
        return recipientsConfigured && allHaveSelection && this.isTableauValid;
      case 3: 
        // Vérifier que tous les destinataires ont une sélection avant de permettre l'accès à l'étape 3
        const canGoToStep3 = this.areRecipientsConfigured() && this.allRecipientsHaveSelection();
        if (!canGoToStep3) {
          // Synchroniser les destinataires avec le service avant d'afficher le message
          this.messageService.updateRecipients(this.recipients);
          const missingRecipients = this.getRecipientsWithoutSelection();
          this.showUserMessage('error', 
            `Impossible de continuer. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
          );
          return false;
        }
        
        if (!this.isTableauValid) {
          this.showUserMessage('error', 
            'Limite de colonnes dépassée. Veuillez désélectionner des colonnes pour continuer.'
          );
          return false;
        }
        return canGoToStep3 && this.arePermissionsConfigured() && this.isTableauValid;
      case 4: 
        // À l'étape 4, vérifier seulement que tous les destinataires ont une sélection
        // Les titres de formulaire sont saisis à cette étape, donc pas besoin de les vérifier pour l'accès
        const allHaveSelectionForStep4 = this.allRecipientsHaveSelection();
        
        if (!allHaveSelectionForStep4) {
          // Synchroniser les destinataires avec le service avant d'afficher le message
          this.messageService.updateRecipients(this.recipients);
          const missingRecipients = this.getRecipientsWithoutSelection();
          this.showUserMessage('error', 
            `Impossible de continuer. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
          );
          return false;
        }
        
        if (!this.isTableauValid) {
          this.showUserMessage('error', 
            'Limite de colonnes dépassée. Veuillez désélectionner des colonnes pour continuer.'
          );
          return false;
        }
        
        // Si tout est OK, effacer les messages d'erreur
        this.clearUserMessage();
        return true;
      default: return false;
    }
  }

  canGoPrevious(): boolean {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return false;
    }
    return this.currentStep > 1;
  }

  /**
   * Nombre de cellules formules dans les sélections éditables de tous les destinataires (feuille 0)
   */
  private getFormulaCellsCountInEditableSelection(): number {
    if (!this.formulaCells || this.formulaCells.length === 0) return 0;
    const formulaSet = new Set(this.formulaCells.map(c => `${c.row},${c.col}`));
    let count = 0;
    for (let i = 0; i < this.recipients.length; i++) {
      const sheetIndex = this.recipientSelectedSheets[i] ?? 0;
      if (sheetIndex !== 0) continue; // formulaCells ne couvre que la feuille 0
      const cells = this.editableCells[i]?.[String(sheetIndex)] || [];
      for (const cell of cells) {
        if (formulaSet.has(`${cell.row},column-${cell.col}`)) count++;
      }
    }
    return count;
  }

  async nextStep() {
    // Vérification supplémentaire pour les étapes 2->3 et 3->4
    if (this.currentStep === 2 && this.recipients.length > 0) {
      const allHaveSelection = this.allRecipientsHaveSelection();
      if (!allHaveSelection) {
        // Synchroniser les destinataires avec le service avant d'afficher le message
        this.messageService.updateRecipients(this.recipients);
        const missingRecipients = this.getRecipientsWithoutSelection();
        this.showUserMessage('error', 
          `Impossible de continuer. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
        );

        return;
      }
    }
    
    // Vérification supplémentaire pour l'étape 3->4
    if (this.currentStep === 3 && this.recipients.length > 0) {
      const allHaveSelection = this.allRecipientsHaveSelection();
      
      if (!allHaveSelection) {
        // Synchroniser les destinataires avec le service avant d'afficher le message
        this.messageService.updateRecipients(this.recipients);
        const missingRecipients = this.getRecipientsWithoutSelection();
        this.showUserMessage('error', 
          `Impossible de continuer. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
        );

        return;
      }
      
      // Si tout est OK, effacer les messages d'erreur
      this.clearUserMessage();
    }
    
    // Confirmation si passage 3->4 avec cellules formules dans la sélection éditables
    if (this.canGoNext() && this.currentStep === 3 && this.currentStep < this.totalSteps) {
      const formulaCount = this.getFormulaCellsCountInEditableSelection();
      if (formulaCount > 0) {
        const msg = formulaCount === 1
          ? 'Votre sélection contient 1 cellule calculée (formule) rendue éditable. Le destinataire pourra la modifier et remplacer la valeur calculée. Souhaitez-vous continuer ?'
          : `Votre sélection contient ${formulaCount} cellules calculées (formules) rendues éditables. Les destinataires pourront les modifier. Souhaitez-vous continuer ?`;
        const confirmed = await this.confirmationModalService.confirm(msg, 'Cellules calculées dans la sélection', 'warning');
        if (!confirmed) return;
      }
    }
    
    if (this.canGoNext() && this.currentStep < this.totalSteps) {
      const previousStep = this.currentStep;
      this.currentStep++;
      this.messageService.updateCurrentStep(this.currentStep);
      this.clearUserMessage(); // Effacer le message quand on passe à l'étape suivante
      this.checkNoRecipient();
      
      // Afficher un message informatif pour l'étape 2
      if (this.currentStep === 2) {
        this.showUserMessage('info', 'Sélectionnez les destinataires et configurez leurs zones de cellules éditables.');
      }
      
      // Initialiser les en-têtes automatiquement lors du passage à l'étape 3
      // IMPORTANT : Toujours forcer la réinitialisation pour garantir des valeurs correctes
      if (previousStep === 2 && this.currentStep === 3) {
        this.logger.log('📝 Passage à l\'étape 3 détecté (via nextStep), initialisation des en-têtes dans 100ms...');
        setTimeout(() => {
          this.logger.log('📝 Appel de initializeColumnLabelsFromSelections() avec forceReset=true');
          // Forcer la réinitialisation pour garantir des valeurs correctes
          this.initializeColumnLabelsFromSelections(true);
        }, 100);
      }
      
      // Afficher un message informatif pour l'étape 4
      if (this.currentStep === 4) {
        this.updateStep4InfoMessage();
        // Forcer la mise à jour des en-têtes lors du passage à l'étape 4
        this.forceHeadersUpdate();
        // Ouvrir le modal de titre pour le premier destinataire sans titre
        this.tryOpenTitleModalForFirstMissing();
      }
    }
  }

  previousStep() {
    if (this.canGoPrevious()) {
      this.currentStep--;
      this.messageService.updateCurrentStep(this.currentStep);
      this.clearUserMessage(); // Effacer le message quand on revient en arrière
      this.checkNoRecipient();
    }
  }

  async goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      // Vérifier si on essaie d'accéder aux étapes 3 ou 4 sans avoir toutes les sélections
      if ((step === 3 || step === 4) && this.recipients.length > 0) {
        const allHaveSelection = this.allRecipientsHaveSelection();
        if (!allHaveSelection) {
          const missingRecipients = this.getRecipientsWithoutSelection();
          this.showUserMessage('error', 
            `Impossible d'accéder à l'étape ${step}. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : ${missingRecipients.join(', ')}`
          );
          // Ne plus forcer le retour à l'étape 2, juste bloquer l'accès

          return;
        }
      }
      
      // Confirmation si accès à l'étape 4 depuis l'étape 3 avec cellules formules
      if (step === 4 && this.currentStep === 3 && this.recipients.length > 0) {
        const formulaCount = this.getFormulaCellsCountInEditableSelection();
        if (formulaCount > 0) {
          const msg = formulaCount === 1
            ? 'Votre sélection contient 1 cellule calculée (formule) rendue éditable. Le destinataire pourra la modifier et remplacer la valeur calculée. Souhaitez-vous continuer ?'
            : `Votre sélection contient ${formulaCount} cellules calculées (formules) rendues éditables. Les destinataires pourront les modifier. Souhaitez-vous continuer ?`;
          const confirmed = await this.confirmationModalService.confirm(msg, 'Cellules calculées dans la sélection', 'warning');
          if (!confirmed) return;
        }
      }
      
      this.currentStep = step;
      this.messageService.updateCurrentStep(this.currentStep);
      this.clearUserMessage(); // Effacer le message quand on change d'étape
      this.checkNoRecipient();
      
      // Afficher un message informatif pour l'étape 2 si on y va
      if (step === 2) {
        this.showUserMessage('info', 'Sélectionnez les destinataires et configurez leurs zones de cellules éditables.');
      }
      
      // Initialiser les en-têtes automatiquement lors du passage à l'étape 3
      // IMPORTANT : Toujours forcer la réinitialisation pour garantir des valeurs correctes
      if (step === 3) {
        this.logger.log('📝 Passage à l\'étape 3 détecté, initialisation des en-têtes dans 100ms...');
        // Attendre un peu pour s'assurer que les données sont disponibles
        setTimeout(() => {
          this.logger.log('📝 Appel de initializeColumnLabelsFromSelections() avec forceReset=true');
          // Forcer la réinitialisation pour garantir des valeurs correctes
          this.initializeColumnLabelsFromSelections(true);
        }, 100);
      }
      
      // Afficher un message informatif pour l'étape 4 si on y va
      if (step === 4) {
        this.updateStep4InfoMessage();
        // Forcer la mise à jour des en-têtes lors du passage à l'étape 4
        this.forceHeadersUpdate();
        // Ouvrir le modal de titre pour le premier destinataire sans titre
        this.tryOpenTitleModalForFirstMissing();
      }
    }
  }

  getStepTitle(step: number): string {
    switch (step) {
      case 1: return 'Sélectionner un fichier';
      case 2: return 'Destinataires & cellules';
      case 3: return 'Droits de modification';
      case 4: return 'Nommer les formulaires';
      default: return '';
    }
  }

  /**
   * Ouvre la modale d'édition de titre pour le premier destinataire sans titre
   * Attend que le chargement des données soit terminé avant d'ouvrir le modal
   */
  private tryOpenTitleModalForFirstMissing(): void {
    // Trouver le premier destinataire sans titre
    const missing = this.getRecipientsWithoutPageTitleIndices();
    if (this.currentStep !== 4 || missing.length === 0) return;

    const targetIndex = missing[0];
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < this.recipients.length) {
      // Se positionner sur ce destinataire
      this.activeRecipientIndex = targetIndex;
      
      // Attendre que le chargement des données soit terminé avant d'ouvrir la modale
      this.waitForDataLoading(() => {
        try {
          this.formPreview?.openEditModal('title');
        } catch {}
      });
    }
  }

  /**
   * Attend que le chargement des données soit terminé avant d'exécuter une action
   */
  private waitForDataLoading(callback: () => void, maxAttempts: number = 50, interval: number = 100): void {
    let attempts = 0;
    
    const checkLoading = () => {
      attempts++;
      
      // Vérifier si formPreview est disponible et si le chargement est terminé
      if (this.formPreview) {
        if (!this.formPreview.isSimulating) {
          // Le chargement est terminé, exécuter le callback après un court délai pour laisser Angular rendre
          setTimeout(() => {
            callback();
          }, 100);
          return;
        }
      } else {
        // formPreview n'est pas encore disponible, continuer à attendre
        if (attempts >= maxAttempts) {
          this.logger.log('waitForDataLoading: formPreview not available after maximum attempts, executing callback anyway');
          setTimeout(() => {
            callback();
          }, 100);
          return;
        }
        // Réessayer après l'intervalle
        setTimeout(checkLoading, interval);
        return;
      }
      
      // Si on a atteint le maximum de tentatives, exécuter quand même le callback
      if (attempts >= maxAttempts) {
        this.logger.log('waitForDataLoading: Maximum attempts reached, executing callback anyway');
        setTimeout(() => {
          callback();
        }, 100);
        return;
      }
      
      // Réessayer après l'intervalle
      setTimeout(checkLoading, interval);
    };
    
    // Démarrer la vérification
    checkLoading();
  }

  /**
   * Vérifie si on peut accéder à une étape spécifique
   */
  canAccessStep(step: number): boolean {
    switch (step) {
      case 1: return true; // Toujours accessible
      case 2: return this.isFileSelected() && !this.isUploading && !this.uploadError && this.sheets.length > 0;
      case 3: return this.areRecipientsConfigured() && this.allRecipientsHaveSelection();
      case 4: return this.areRecipientsConfigured() && this.allRecipientsHaveSelection();
      default: return false;
    }
  }

  // Validation methods
  isFileSelected(): boolean {
    // Si on a un partage existant, considérer qu'un fichier est sélectionné
    if (this.currentShareId !== null) {
      return true;
    }
    return this.selectedFile !== null;
  }

  isDataConfigured(): boolean {
    // Vérifier si nous avons des données de table ou si shareableData est configuré
    return this.tableData.length > 0 || Object.keys(this.shareableData).length > 0;
  }

  areRecipientsConfigured(): boolean {
    return this.recipients.length > 0;
  }

  arePermissionsConfigured(): boolean {
    // L'étape 3 affiche maintenant les données sélectionnées, pas de configuration de permissions spécifique
    return true;
  }

  // Méthode pour charger les données depuis le service de partage
  loadFileDataFromSharedData(sharedFileData: any): void {
    this.logger.log('Chargement des données depuis le service de partage:', sharedFileData);
    
    try {
      // Convertir les données des lignes au format attendu par tableau-selection
      const convertedRows = this.convertBackendDataToTableauFormat(sharedFileData.rowsData || []);
      this.logger.log('Données converties:', convertedRows);
      
      // Créer les feuilles avec les métadonnées et les données de la première feuille
      if (sharedFileData.sheetsData && Array.isArray(sharedFileData.sheetsData)) {
        this.sheets = sharedFileData.sheetsData.map((sheetInfo: any, index: number) => ({
          name: sheetInfo.name || `Feuille ${index + 1}`,
          index: index,
          data: index === 0 ? convertedRows : [], // Seule la première feuille a des données
          totalRows: index === 0 ? convertedRows.length : 0,
          totalColumns: index === 0 ? (convertedRows.length > 0 ? Object.keys(convertedRows[0]).length : 0) : 0
        }));
      }
      
      // Définir tableData avec les données converties
      this.tableData = convertedRows;
      this.logger.log('tableData défini avec les données converties:', this.tableData);
      
      // Sélectionner automatiquement la première feuille
      if (this.sheets.length > 0) {
        this.selectedSheet = this.sheets[0].name;
        this.selectedSheetIndex = 0;
        // Initialiser les en-têtes potentiels pour la première feuille
        if (this.sheets[0].data && this.sheets[0].data.length > 0) {
          this.initializeSheetHeaders(0, this.sheets[0].data);
        }
        this.onSheetChange(0);
      }
      
      // Mettre à jour le service de messages
      this.messageService.updateCurrentStep(this.currentStep);
      
      this.logger.log('Fichier pré-chargé avec succès depuis le service de partage, passage à l\'étape', this.currentStep);
      this.logger.log('Données des feuilles:', this.sheets);
      this.logger.log('tableData final:', this.tableData);
      
      // Nettoyer les données du service après utilisation
      this.fileDataSharingService.clearFileData();
      
    } catch (error) {
      this.logger.error('Erreur lors du chargement des données depuis le service:', error);
      this.uploadError = 'Erreur lors du chargement des données du fichier. Veuillez réessayer.';
      this.currentStep = 1; // Revenir à l'étape 1 en cas d'erreur
    }
  }

  // Méthode pour convertir les données du backend au format tableau-selection
  private convertBackendDataToTableauFormat(rows: any[]): any[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map(row => {
      const convertedRow: any = {};
      
      // Si les données sont déjà dans le bon format, les utiliser directement
      if (row['column-0'] !== undefined) {
        return row;
      }

      // Sinon, convertir les données au format column-X
      const values = Object.values(row);
      values.forEach((value, index) => {
        convertedRow[`column-${index}`] = value || '';
      });

      return convertedRow;
    });
  }

  // Méthode pour charger les données d'un fichier temporaire (fallback)
  loadFileDataFromTempId(tempFileId: string): void {
    this.logger.log('Chargement des données du fichier temporaire:', tempFileId);
    
    // Utiliser le service FileUpload pour récupérer les feuilles du fichier temporaire
    this.fileUploadService.getExcelSheets(tempFileId).subscribe({
      next: (response: any) => {
        this.logger.log('Feuilles du fichier chargées:', response);
        
        // Convertir les données au format attendu par tableau-selection
        const convertedSheets = this.fileUploadService.convertSheetsToTableauFormat(response.sheets || []);
        
        // Utiliser les données converties
        this.sheets = convertedSheets.map((sheetInfo: any, index: number) => ({
          name: sheetInfo.name || `Feuille ${index + 1}`,
          index: index,
          data: sheetInfo.data || [],
          totalRows: sheetInfo.totalRows || 0,
          totalColumns: sheetInfo.totalColumns || 0
        }));
        
        // Sélectionner automatiquement la première feuille
        if (this.sheets.length > 0) {
          this.selectedSheet = this.sheets[0].name;
          this.selectedSheetIndex = 0;
          this.onSheetChange(0);
        }
        
        // Mettre à jour le service de messages
        this.messageService.updateCurrentStep(this.currentStep);
        
        this.logger.log('Fichier pré-chargé avec succès, passage à l\'étape', this.currentStep);
      },
      error: (error) => {
        this.logger.error('Erreur lors du chargement des données du fichier temporaire:', error);
        this.uploadError = 'Erreur lors du chargement des données du fichier. Veuillez réessayer.';
        this.currentStep = 1; // Revenir à l'étape 1 en cas d'erreur
      }
    });
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    
    // Bloquer l'upload sur les partages existants
    if (this.currentShareId) {
      this.logger.warn('🚫 Upload de fichier par drag & drop bloqué pour le partage existant:', this.currentShareId);
      this.uploadError = 'Impossible de modifier le fichier d\'un partage existant.';
      return;
    }
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: any) {
    // Bloquer l'upload sur les partages existants
    if (this.currentShareId) {
      this.logger.warn('🚫 Upload de fichier bloqué pour le partage existant:', this.currentShareId);
      this.uploadError = 'Impossible de modifier le fichier d\'un partage existant.';
      return;
    }
    
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  handleFile(file: File) {
    if (!file) return;
    
    // Bloquer l'upload sur les partages existants
    if (this.currentShareId) {
      this.logger.warn('🚫 Upload de fichier bloqué pour le partage existant:', this.currentShareId);
      this.uploadError = 'Impossible de modifier le fichier d\'un partage existant.';
      return;
    }
    
    // Vérifier que c'est bien un fichier Excel (le backend ne supporte que .xlsx et .xls)
    const validExtensions = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      this.uploadError = 'Format de fichier non supporté. Le backend ne supporte que les fichiers .xlsx et .xls.';
      return;
    }
    
    // Nettoyer complètement toutes les anciennes données
    this.clearAllDataAndSelections();
    
    this.selectedFile = file;
    this.uploadError = null;
    this.isUploading = true;
    
    // Upload vers le backend (utiliser l'endpoint public pour les utilisateurs non connectés)
    const isPublic = !this.authService.isLoggedIn();
    this.excelService.uploadExcelFile(file, isPublic).subscribe({
      next: (response: any) => {

        
        // Stocker l'ID temporaire du fichier
        this.tempFileId = response.tempFileId;

        
        // Créer un objet ExcelData compatible
        const excelData: ExcelData = {
          fileName: response.fileName,
          rows: response.rows,
          totalRows: response.totalRows,
          totalColumns: response.totalColumns,
          formulaCells: response.formulaCells
        };
        // Stocker les cellules formules pour l'affichage dans tableau-selection
        this.formulaCells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
        
        // Convertir les données Excel en format compatible
        this.sheets = this.excelService.convertExcelDataToSheets(excelData);
        
        // Phase 2: Si le backend a fourni des informations sur toutes les feuilles, les utiliser
        // Ne charger que les métadonnées, pas les données (lazy loading)
        if (response.sheets && Array.isArray(response.sheets)) {
          this.sheets = response.sheets.map((sheetInfo: any, index: number) => ({
            name: sheetInfo.name || `Feuille ${index + 1}`,
            data: index === 0 ? this.sheets[0]?.data || [] : [], // Phase 2: Charger seulement la première feuille initialement
            index: sheetInfo.index || index,
            lastRowNum: sheetInfo.lastRowNum || 0,
            lastColNum: sheetInfo.lastColNum || 0,
            totalRows: sheetInfo.lastRowNum || 0,
            totalColumns: sheetInfo.lastColNum || 0,
            isLoaded: index === 0, // Seule la première feuille est considérée comme chargée
            hasMore: false // Sera mis à jour lors du chargement paginé
          }));
          
          // Marquer la première feuille comme chargée
          if (this.sheets.length > 0 && this.sheets[0].data && this.sheets[0].data.length > 0) {
            this.loadedSheets.add(0);
            this.recentlyUsedSheets.add(0);
            // Initialiser les en-têtes potentiels pour la première feuille
            this.initializeSheetHeaders(0, this.sheets[0].data);
          }
          
          this.logger.log('📊 Feuilles détectées:', this.sheets.map(s => ({ name: s.name, index: s.index })));
        }
        
        // Réinitialiser les index
        this.selectedSheetIndex = 0;
        this.activeRecipientIndex = 0;
        
        // Vérifier la cohérence des données
        if (!this.verifyDataConsistency()) {
          this.uploadError = 'Erreur lors de la vérification de cohérence des données';
          this.isUploading = false;
          return;
        }
        
        // Détecter les champs
        this.detectFields();
        
        // Configurer automatiquement les données partagées
        this.configureData();
        
        this.isUploading = false;

        
        // Passage automatique à l'étape 2 après un upload réussi
        setTimeout(() => {
          this.currentStep = 2;
          this.checkNoRecipient();
          
          // Démarrer le nettoyage automatique de la mémoire
          this.startMemoryCleanup();
        }, 1000); // Délai de 1 seconde pour laisser le temps à l'utilisateur de voir le succès
      },
      error: (error) => {
        this.logger.error('Erreur lors de l\'upload:', error);
        this.uploadError = error.message || 'Erreur lors de l\'upload du fichier';
        this.isUploading = false;
      }
    });
  }

  configureData() {
    const selectedFields = this.detectedFields.filter(field => field.selected);
    this.shareableData = {
      configured: true,
      sheet: this.selectedSheet,
      headerRow: this.headerRow,
      dataStartRow: this.dataStartRow,
      columnRange: this.columnRange,
      selectedFields: selectedFields,
      includeFormulas: this.includeFormulas,
      preserveFormatting: this.preserveFormatting,
      totalRows: this.tableData.length + 1, // +1 pour l'en-tête
      totalColumns: selectedFields.length
    };

  }

  // Méthodes pour la gestion intelligente de la mémoire
  
  /**
   * Charge un chunk de données en mémoire
   */
  /**
   * Vide le cache des données pour forcer le rechargement
   */
  private clearDataCache() {
    this.loadedDataChunks.clear();
    this._tableData = [];
    // Vider le cache de tableData
    this._cachedTableData = [];
    this._lastTableDataHash = '';
    this._lastActiveRecipientIndex = -1;
    this._lastActiveRecipientSheet = -1;
    // Vider le cache de sélection
    this._cachedActiveRecipientSelection = [];
    this._lastSelectionHash = '';
  }

  private loadDataChunk(chunkIndex: number): any[] {
    if (this.loadedDataChunks.has(chunkIndex)) {
      return this.loadedDataChunks.get(chunkIndex)!;
    }
    
    // Utiliser directement recipientSelectedSheets pour éviter la récursion
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    
    if (!this.sheets || this.sheets.length === 0 || !this.sheets[activeRecipientSheet]?.data) {
      return [];
    }
    
    const startIndex = chunkIndex * this.dataChunkSize;
    const endIndex = Math.min(startIndex + this.dataChunkSize, this.sheets[activeRecipientSheet].data.length);
    const chunk = this.sheets[activeRecipientSheet].data.slice(startIndex, endIndex);
    
    this.loadedDataChunks.set(chunkIndex, chunk);

    return chunk;
  }
  
  /**
   * Obtient les données visibles pour une plage de lignes
   */
  getVisibleData(startRow: number, endRow: number): any[] {
    // Utiliser directement recipientSelectedSheets pour éviter la récursion
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    
    if (!this.sheets || this.sheets.length === 0 || !this.sheets[activeRecipientSheet]?.data) {
      return [];
    }
    
    const startChunk = Math.floor(startRow / this.dataChunkSize);
    const endChunk = Math.floor(endRow / this.dataChunkSize);
    
    let visibleData: any[] = [];
    for (let i = startChunk; i <= endChunk; i++) {
      visibleData = visibleData.concat(this.loadDataChunk(i));
    }
    
    const startOffset = startRow % this.dataChunkSize;
    const endOffset = visibleData.length - ((endChunk + 1) * this.dataChunkSize - endRow);
    
    return visibleData.slice(startOffset, endOffset);
  }
  
  /**
   * Nettoie la mémoire en libérant les chunks non utilisés
   */
  private cleanupMemory() {
    if (this.loadedDataChunks.size <= 3) {
      return; // Garder au moins 3 chunks en mémoire
    }
    
    // Identifier les chunks visibles (approximation)
    const visibleChunks = new Set<number>();
    const currentChunk = Math.floor(this.selectedSheetIndex / this.dataChunkSize);
    
    // Garder le chunk actuel et les chunks adjacents
    for (let i = Math.max(0, currentChunk - 1); i <= currentChunk + 1; i++) {
      visibleChunks.add(i);
    }
    
    // Supprimer les chunks non visibles
    let cleanedCount = 0;
    for (const [chunkIndex, chunk] of this.loadedDataChunks.entries()) {
      if (!visibleChunks.has(chunkIndex)) {
        this.loadedDataChunks.delete(chunkIndex);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      // Nettoyage effectué
    }
    
    // Phase 2: Nettoyer aussi les feuilles non utilisées
    this.cleanupUnusedSheets();
  }
  
  /**
   * Phase 2: Nettoie les feuilles non utilisées pour libérer la mémoire
   */
  private cleanupUnusedSheets(): void {
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    
    // Garder les feuilles actives et récemment utilisées
    const sheetsToKeep = new Set<number>();
    sheetsToKeep.add(activeRecipientSheet);
    this.recentlyUsedSheets.forEach(sheetIndex => {
      sheetsToKeep.add(sheetIndex);
    });
    
    // Limiter à MAX_SHEETS_IN_MEMORY feuilles
    if (sheetsToKeep.size > this.MAX_SHEETS_IN_MEMORY) {
      // Garder seulement les plus récentes
      const sheetsArray = Array.from(sheetsToKeep);
      const sheetsToRemove = sheetsArray.slice(this.MAX_SHEETS_IN_MEMORY);
      sheetsToRemove.forEach(sheetIndex => {
        sheetsToKeep.delete(sheetIndex);
      });
    }
    
    // Nettoyer les feuilles non gardées
    this.sheets.forEach((sheet, index) => {
      if (!sheetsToKeep.has(index) && this.loadedSheets.has(index)) {
        // Libérer les données mais garder les métadonnées
        sheet.data = [];
        sheet.isLoaded = false;
        this.loadedSheets.delete(index);
        
        // Nettoyer aussi le cache des pages pour cette feuille
        this.sheetPageCache.delete(String(index));
      }
    });
  }
  
  /**
   * Phase 4: Gestion mémoire avancée avec limites strictes
   */
  private manageMemory(): void {
    // Limiter le nombre de feuilles en mémoire
    if (this.loadedSheets.size > this.MAX_SHEETS_IN_MEMORY) {
      const oldestSheet = this.getOldestLoadedSheet();
      if (oldestSheet !== -1) {
        this.unloadSheet(oldestSheet);
      }
    }
    
    // Limiter les lignes par feuille (garder seulement les premières pages)
    this.sheets.forEach((sheet, index) => {
      if (sheet.data && sheet.data.length > this.MAX_ROWS_PER_SHEET) {
        // Conserver seulement les premières pages
        const pagesToKeep = Math.ceil(this.MAX_ROWS_PER_SHEET / this.PAGE_SIZE);
        const cache = this.sheetPageCache.get(String(index)) || [];
        const pagesToRemove = cache.filter(p => p.page >= pagesToKeep);
        
        // Supprimer les pages en trop du cache
        pagesToRemove.forEach(pageData => {
          const cacheIndex = cache.indexOf(pageData);
          if (cacheIndex >= 0) {
            cache.splice(cacheIndex, 1);
          }
        });
        
        // Tronquer les données si nécessaire
        if (sheet.data.length > this.MAX_ROWS_PER_SHEET) {
          sheet.data = sheet.data.slice(0, this.MAX_ROWS_PER_SHEET);
          sheet.truncated = true;
        }
      }
    });
  }
  
  /**
   * Phase 4: Obtient la feuille la plus ancienne chargée
   */
  private getOldestLoadedSheet(): number {
    if (this.loadedSheets.size === 0) {
      return -1;
    }
    
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    
    // Trouver la feuille la plus ancienne (pas active, pas récemment utilisée)
    for (const sheetIndex of this.loadedSheets) {
      if (sheetIndex !== activeRecipientSheet && !this.recentlyUsedSheets.has(sheetIndex)) {
        return sheetIndex;
      }
    }
    
    // Si toutes sont actives ou récentes, retourner la première (sauf active)
    for (const sheetIndex of this.loadedSheets) {
      if (sheetIndex !== activeRecipientSheet) {
        return sheetIndex;
      }
    }
    
    return -1;
  }
  
  /**
   * Phase 4: Décharge une feuille de la mémoire
   */
  private unloadSheet(sheetIndex: number): void {
    if (this.sheets[sheetIndex]) {
      this.sheets[sheetIndex].data = [];
      this.sheets[sheetIndex].isLoaded = false;
      this.loadedSheets.delete(sheetIndex);
      this.sheetPageCache.delete(String(sheetIndex));
    }
  }
  
  
  /**
   * Démarre le nettoyage automatique de la mémoire
   */
  private startMemoryCleanup() {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    
    // Nettoyer la mémoire toutes les 30 secondes
    this.memoryCleanupInterval = setInterval(() => {
      this.cleanupMemory();
    }, 30000);
    

  }
  
  /**
   * Obtient des informations sur l'utilisation de la mémoire
   */
  getMemoryInfo(): { chunks: number; totalRows: number; estimatedMemory: string } {
    // Utiliser directement recipientSelectedSheets pour éviter la récursion
    const activeRecipientSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    const totalRows = this.sheets[activeRecipientSheet]?.data?.length || 0;
    const chunksCount = this.loadedDataChunks.size;
    
    // Estimation approximative de la mémoire utilisée (en MB)
    const estimatedMemoryMB = (chunksCount * this.dataChunkSize * 0.001).toFixed(2);
    
    return {
      chunks: chunksCount,
      totalRows: totalRows,
      estimatedMemory: `${estimatedMemoryMB} MB`
    };
  }

  addRecipient(emailInput: HTMLInputElement, rangeInput: HTMLInputElement) {
    if (emailInput.value && rangeInput.value) {
      const newRecipientIndex = this.recipients.length;
      this.recipients.push({
        email: emailInput.value,
        range: rangeInput.value
      });
      this.messageService.updateRecipients(this.recipients);
      
      // Définir la feuille sélectionnée pour le nouveau destinataire
      this.recipientSelectedSheets[newRecipientIndex] = this.selectedSheetIndex;
      
      emailInput.value = '';
      rangeInput.value = '';
    }
  }

  removeRecipient(index: number) {
    this.recipients.splice(index, 1);
    this.messageService.updateRecipients(this.recipients);
    
    // Nettoyer la feuille sélectionnée pour ce destinataire
    delete this.recipientSelectedSheets[index];
    
    // Réindexer les feuilles sélectionnées
    const newRecipientSelectedSheets: { [recipientIndex: number]: number | undefined } = {};
    Object.keys(this.recipientSelectedSheets).forEach(key => {
      const oldIndex = parseInt(key);
      if (oldIndex > index) {
        newRecipientSelectedSheets[oldIndex - 1] = this.recipientSelectedSheets[oldIndex];
      } else if (oldIndex < index) {
        newRecipientSelectedSheets[oldIndex] = this.recipientSelectedSheets[oldIndex];
      }
    });
    this.recipientSelectedSheets = newRecipientSelectedSheets;
  }

  configurePermissions() {
    this.permissions = {
      configured: true,
      type: this.selectedPermission,
      allowComments: this.allowComments,
      allowDownload: this.allowDownload
    };

  }

  getPermissionLabel(): string {
    switch (this.selectedPermission) {
      case 'read': return 'Lecture seule';
      case 'edit-own': return 'Édition de sa zone';
      case 'full': return 'Édition complète';
      default: return 'Non spécifié';
    }
  }

  /**
   * Obtient la liste des destinataires avec des titres incomplets
   */
  getRecipientsWithIncompleteTitles(): string[] {
    return this.recipients
      .filter((recipient, index) => {
        return !this.hasRecipientCustomTitle(index);
      })
      .map(recipient => recipient.displayName || recipient.email);
  }

  canFinalize(): boolean {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return false; // Désactiver le bouton pendant la finalisation
    }
    
    const fileSelected = this.isFileSelected();
    const dataConfigured = this.isDataConfigured();
    const recipientsConfigured = this.areRecipientsConfigured();
    const permissionsConfigured = this.arePermissionsConfigured();
    
    // Vérification supplémentaire pour l'étape 4 : titres personnalisés
    let titlesComplete = true;
    if (this.currentStep === 4) {
      titlesComplete = this.allRecipientsHaveCustomTitles();
      
      // Afficher un message d'erreur si des titres sont incomplets
      if (!titlesComplete) {
        const incompleteRecipients = this.getRecipientsWithIncompleteTitles();
        this.showUserMessage('error', 
          `Impossible de finaliser le partage. Veuillez personnaliser les titres pour les destinataires suivants : ${incompleteRecipients.join(', ')}`
        );
      } else {
        // Effacer le message d'erreur si tout est complet
        this.clearUserMessage();
      }
    }
    












    
    const result = fileSelected && dataConfigured && recipientsConfigured && permissionsConfigured && titlesComplete;

    
    return result;
  }

  /**
   * Sauvegarde le partage en cours de création (statut NEW)
   */
  sauvegarderPartage() {


    // Vérifier que nous avons un fichier
    if (!this.selectedFile) {
      this.uploadError = 'Erreur: Aucun fichier sélectionné.';
      return;
    }

    // Vérifier que nous avons un fileId valide
    if (!this.tempFileId) {
      this.uploadError = 'Erreur: Aucun fichier uploadé. Veuillez d\'abord uploader un fichier.';
      return;
    }

    // Vérifier la cohérence fichier-données
    if (!this.verifyFileDataConsistency()) {
      this.uploadError = 'Erreur: Incohérence entre le fichier et les données affichées. Veuillez recharger le fichier.';
      return;
    }

    this.logger.log('💾 Sauvegarde avec fichier:', {
      fileName: this.selectedFile.name,
      fileId: this.tempFileId,
      fileSize: this.selectedFile.size
    });

    this.logger.log('📊 État de recipientSelectedSheets avant sauvegarde:', this.recipientSelectedSheets);

    // Créer l'objet ShareRequest avec les données actuelles
    const shareRequest: ShareRequest = {
      fileName: this.selectedFile.name,
      // Ne pas envoyer le fileId pour les partages existants (fichier non modifiable)
      fileId: this.currentShareId ? undefined : this.tempFileId,
      
      // Configuration des données partagées (peut être partielle)
      selectedSheet: this.selectedSheet,
      selectedSheetIndex: this.selectedSheetIndex,
      headerRow: this.headerRow,
      dataStartRow: this.dataStartRow,
      columnRange: this.columnRange,
      includeFormulas: this.includeFormulas,
      preserveFormatting: this.preserveFormatting,
      detectedFields: this.detectedFields.map(field => field.name),
      
      // Destinataires avec leurs configurations (peut être vide)
      recipients: this.recipients.map((recipient, recipientIndex) => {
        // S'assurer que chaque destinataire a une feuille sélectionnée définie
        let selectedSheetIndex = this.recipientSelectedSheets[recipientIndex];
        
        // Si pas défini, utiliser la feuille du destinataire ou détecter automatiquement
        if (selectedSheetIndex === undefined) {
          if (recipient.selectedSheetIndex !== undefined && recipient.selectedSheetIndex !== null) {
            selectedSheetIndex = recipient.selectedSheetIndex;
            this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
          } else {
            // Détecter automatiquement la feuille avec des sélections
            selectedSheetIndex = this.detectSheetWithSelectionsForRecipient(recipientIndex);
            this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
          }
        }
        
        this.logger.log(`📊 Destinataire ${recipientIndex} (${recipient.email}): selectedSheetIndex = ${selectedSheetIndex}`);

        return {
        email: recipient.email,
        displayName: recipient.displayName || recipient.email,
        selectedSheetIndex: selectedSheetIndex,
        selections: recipient.selection || {},
        editableCells: this.editableCells[recipientIndex] || {},
        columnLabels: this.columnLabels[recipientIndex] || {},
        pageTitle: recipient.pageTitle || '',
        pageDescription: recipient.pageDescription || '',
        permission: recipient.permission,
        allowComments: recipient.allowComments,
        allowDownload: recipient.allowDownload
        };
      }),
      
      // Permissions globales
      selectedPermission: this.selectedPermission,
      allowComments: this.allowComments,
      allowDownload: this.allowDownload,
      
      // Données Excel pour validation
      headers: this.detectedFields.map(field => field.name),
      totalRows: this.tableData.length,
      totalColumns: this.getColumnCount()
    };



    // Indiquer que la sauvegarde est en cours
    this.isSaving = true;
    this.uploadError = null;

    // Si nous avons déjà un share en cours, le mettre à jour
    if (this.currentShareId) {
      this.shareService.updateNewShare(this.currentShareId, shareRequest).subscribe({
        next: (response) => {

          this.isSaving = false;
          this.currentShareId = response.id;
          this.shareStatus = response.status || 'NEW'; // Mettre à jour le statut
          
          // Afficher un message de confirmation

          
          // Nettoyer la mémoire avant la navigation pour optimiser les performances
          this.clearAllData();
          this.logger.log('🚀 Redirection vers /share/new/' + response.id);
          // Rediriger vers la page d'édition du partage mis à jour
          this.router.navigate(['/share/new', response.id]);
        },
        error: (error) => {
          this.logger.error('❌ Erreur mise à jour partage:', error);
          this.uploadError = error.message || 'Erreur lors de la mise à jour du partage';
          this.isSaving = false;
        }
      });
    } else {
      // Créer un nouveau share en statut NEW
      // Utiliser le bon service selon le statut de connexion
      const saveObservable = this.authService.isLoggedIn() 
        ? this.shareService.saveShare(shareRequest)
        : this.shareService.saveGuestShare(shareRequest);
      
      saveObservable.subscribe({
        next: (response) => {

          this.isSaving = false;
          this.currentShareId = response.id;
          this.shareStatus = response.status || 'NEW'; // Mettre à jour le statut
          
          // Afficher un message de confirmation

          // Nettoyer la mémoire avant la navigation pour optimiser les performances
          this.clearAllData();

          this.logger.log('🚀 Redirection vers /share/new/' + response.id);
          // Rediriger vers la page d'édition du partage sauvegardé
          this.router.navigate(['/share/new', response.id]);
        },
        error: (error) => {
          this.logger.error('❌ Erreur sauvegarde partage:', error);
          this.uploadError = error.message || 'Erreur lors de la sauvegarde du partage';
          this.isSaving = false;
        }
      });
    }
  }

  finaliserPartage() {
    this.logger.log('🔍 finaliserPartage() appelé');
    this.logger.log('🔍 État d\'authentification:', {
      isEmailValidated: this.authService.isEmailValidated(),
      isLoggedIn: this.authService.isLoggedIn(),
      userEmail: this.authService.getUserEmail()
    });
    
    // Vérifier si l'email utilisateur est validé (pour tous les utilisateurs, connectés ou non)
    if (!this.authService.isEmailValidated()) {
      this.logger.log('⚠️ Email non validé, ouverture de la modal de validation');
      this.showEmailValidationModal = true;
      return;
    }
    
    this.logger.log('✅ Email validé, procédure de finalisation...');
    
    // Vérifier que nous avons des destinataires
    if (!this.recipients || this.recipients.length === 0) {
      this.uploadError = 'Erreur: Aucun destinataire configuré.';
      return;
    }
    
    // Vérifier que tous les destinataires ont des titres personnalisés (étape 4)
    if (this.currentStep === 4) {
      const allHaveCustomTitles = this.allRecipientsHaveCustomTitles();
      if (!allHaveCustomTitles) {
        const incompleteRecipients = this.getRecipientsWithIncompleteTitles();
        this.showUserMessage('error', 
          `Impossible de finaliser le partage. Veuillez personnaliser les titres pour les destinataires suivants : ${incompleteRecipients.join(', ')}`
        );

        return;
      }
    }

    // Marquer que la finalisation est en cours pour arrêter les traitements inutiles
    this.isFinalizing = true;
    this.messageService.updateFinalizingState(this.isFinalizing);



    // Indiquer que la finalisation est en cours
    this.isUploading = true;
    this.uploadError = null;

    // Si nous n'avons pas de currentShareId, d'abord sauvegarder puis finaliser
    if (!this.currentShareId) {

      
      // Vérifier que nous avons un fileId valide
      if (!this.tempFileId) {
        this.uploadError = 'Erreur: Aucun fichier uploadé. Veuillez d\'abord uploader un fichier.';
        this.isUploading = false;
        return;
      }

      // Vérifier la cohérence fichier-données
      if (!this.verifyFileDataConsistency()) {
        this.uploadError = 'Erreur: Incohérence entre le fichier et les données affichées. Veuillez recharger le fichier.';
        this.isUploading = false;
        return;
      }

      this.logger.log('💾 Finalisation avec fichier:', {
        fileName: this.selectedFile?.name,
        fileId: this.tempFileId,
        fileSize: this.selectedFile?.size
      });

      // Créer l'objet ShareRequest avec les données actuelles
      const shareRequest: ShareRequest = {
        fileName: this.selectedFile?.name || 'fichier.xlsx',
        // Ne pas envoyer le fileId pour les partages existants (fichier non modifiable)
        fileId: this.currentShareId ? undefined : this.tempFileId,
        
        // Configuration des données partagées
        selectedSheet: this.selectedSheet,
        selectedSheetIndex: this.selectedSheetIndex,
        headerRow: this.headerRow,
        dataStartRow: this.dataStartRow,
        columnRange: this.columnRange,
        includeFormulas: this.includeFormulas,
        preserveFormatting: this.preserveFormatting,
        detectedFields: this.detectedFields.map(field => field.name),
        
        // Destinataires avec leurs configurations
        recipients: this.recipients.map((recipient, recipientIndex) => {

          // S'assurer que chaque destinataire a une feuille sélectionnée définie
        let selectedSheetIndex = this.recipientSelectedSheets[recipientIndex];
        
        // Si pas défini, utiliser la feuille du destinataire ou détecter automatiquement
        if (selectedSheetIndex === undefined) {
          if (recipient.selectedSheetIndex !== undefined && recipient.selectedSheetIndex !== null) {
            selectedSheetIndex = recipient.selectedSheetIndex;
            this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
          } else {
            // Détecter automatiquement la feuille avec des sélections
            selectedSheetIndex = this.detectSheetWithSelectionsForRecipient(recipientIndex);
            this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
          }
        }
        
        this.logger.log(`📊 Destinataire ${recipientIndex} (${recipient.email}): selectedSheetIndex = ${selectedSheetIndex}`);
          return {
            email: recipient.email,
            displayName: recipient.displayName || recipient.email,
            selections: recipient.selection || {},
            editableCells: this.editableCells[recipientIndex] || {},
            columnLabels: this.columnLabels[recipientIndex] || {},
            pageTitle: recipient.pageTitle || '',
            pageDescription: recipient.pageDescription || '',
            permission: recipient.permission,
            allowComments: recipient.allowComments,
            allowDownload: recipient.allowDownload,
            selectedSheetIndex: selectedSheetIndex
          };
        }),
        
        // Permissions globales
        selectedPermission: this.selectedPermission,
        allowComments: this.allowComments,
        allowDownload: this.allowDownload,
        
        // Données Excel pour validation
        headers: this.detectedFields.map(field => field.name),
        totalRows: this.tableData.length,
        totalColumns: this.getColumnCount()
      };



      // Choisir le service approprié selon le statut de connexion
      const saveService = this.authService.isLoggedIn() ? 
        this.shareService.saveShare(shareRequest) : 
        this.shareService.saveGuestShare(shareRequest);

      // Sauvegarder puis finaliser automatiquement
      saveService.subscribe({
        next: (saveResponse) => {

          this.currentShareId = saveResponse.id;
          
          // Choisir le service de finalisation approprié selon le statut de connexion
          const finalizeService = this.authService.isLoggedIn() ? 
            this.shareService.finalizeShare(this.currentShareId) : 
            this.shareService.finalizeGuestShare(this.currentShareId);
          
          // Maintenant finaliser le partage
          finalizeService.subscribe({
            next: (finalizeResponse) => {
              // Log de confirmation
              
              // Recalculer le tabdata pour tous les destinataires après finalisation
              this.shareTabdataService.rebuildTabdata(finalizeResponse.id).subscribe({
                next: () => {
                  this.logger.log('✅ Tabdata recalculé avec succès après finalisation');
                },
                error: (error) => {
                  this.logger.warn('⚠️ Erreur lors du recalcul du tabdata:', error);
                  // Ne pas faire échouer la finalisation
                }
              });
              
              // 🔧 CORRECTION : Les tokens d'accès sont déjà créés automatiquement par le backend lors de la finalisation
              // Plus besoin d'appeler generateAccessLinksForAllRecipients()
              this.logger.log('✅ Finalisation terminée - Les tokens d\'accès ont été créés automatiquement par le backend');
              
              // Fermer le modal et rediriger
              this.isGeneratingLinks = false;
              this.isUploading = false;
              
              // Rediriger vers la page du partage créé
              const shareUrl = window.location.origin + '/share/' + finalizeResponse.id;
              this.logger.log('✅ Redirection vers ' + shareUrl);
              
              // Nettoyer la mémoire avant la navigation pour optimiser les performances
              this.clearAllData();
              this.logger.log('🚀 Redirection vers /share/' + finalizeResponse.id);
              this.router.navigate(['/share', finalizeResponse.id]);
            },
            error: (finalizeError) => {
              this.logger.error('❌❌❌ ERREUR FINALISATION PARTAGE ❌❌❌');
              this.logger.error('📊 Erreur complète:', finalizeError);
              this.logger.error('📝 Message:', finalizeError.message);
              this.logger.error('🔢 Status:', finalizeError.status);
              this.uploadError = finalizeError.message || 'Erreur lors de la finalisation du partage';
              this.isUploading = false;
            }
          });
        },
        error: (saveError) => {
          this.logger.error('❌ Erreur sauvegarde automatique:', saveError);
          this.uploadError = saveError.message || 'Erreur lors de la sauvegarde automatique du partage';
          this.isUploading = false;
        }
      });
    } else {
      // Finaliser le partage existant
      // Vérifier le statut du partage pour déterminer l'action à effectuer
      if (!this.currentShareId) {
        this.uploadError = 'Erreur: ID du partage manquant';
        this.isUploading = false;
        return;
      }
      
      // OPTIMISATION: Utiliser getShareMetadata() pour éviter de charger les données Excel inutilement
      // Cette méthode ne charge que les métadonnées (statut, destinataires, etc.) sans les données Excel
      const startTime = performance.now();
      const metadataService = this.authService.isLoggedIn() ? 
        this.shareService.getShareMetadata(this.currentShareId) : 
        this.shareService.getGuestShareMetadata(this.currentShareId);
      
      metadataService.subscribe({
        next: (shareResponse: any) => {
          const endTime = performance.now();

          
          if (shareResponse.status === 'NEW') {
            // Si le partage est en statut NEW, le finaliser
            const finalizeService = this.authService.isLoggedIn() ? 
              this.shareService.finalizeShare(this.currentShareId!) : 
              this.shareService.finalizeGuestShare(this.currentShareId!);
            
            finalizeService.subscribe({
      next: (response) => {
                // Log de confirmation
        
        // 🔧 CORRECTION : Les tokens d'accès sont déjà créés automatiquement par le backend lors de la finalisation
        // Plus besoin d'appeler generateAccessLinksForAllRecipients()
        this.logger.log('✅ Finalisation terminée - Les tokens d\'accès ont été créés automatiquement par le backend');
        
        // Fermer le modal et rediriger
        this.isGeneratingLinks = false;
        this.isUploading = false;
        
        // Rediriger vers la page du partage créé
        const shareUrl = window.location.origin + '/share/' + response.id;
        this.logger.log('✅ Redirection vers ' + shareUrl);
        
        // Nettoyer la mémoire avant la navigation pour optimiser les performances
        this.clearAllData();
        
        // Ajouter un délai pour laisser l'initialisation se terminer
        setTimeout(() => {
          window.location.href = shareUrl;
        }, 100);
      },
      error: (error) => {
        this.logger.error('❌ Erreur lors de la finalisation:', error);
        this.isGeneratingLinks = false;
        this.isUploading = false;
        this.uploadError = 'Erreur lors de la finalisation du partage.';
      }
    });
          } else {
            // Si le partage est déjà finalisé, le mettre à jour

            
            // Créer l'objet ShareRequest avec les données actuelles
            const shareRequest: ShareRequest = {
              fileName: this.selectedFile?.name || 'fichier.xlsx',
              fileId: this.tempFileId || '',
              
              // Configuration des données partagées
              selectedSheet: this.selectedSheet,
              selectedSheetIndex: this.selectedSheetIndex,
              headerRow: this.headerRow,
              dataStartRow: this.dataStartRow,
              columnRange: this.columnRange,
              includeFormulas: this.includeFormulas,
              preserveFormatting: this.preserveFormatting,
              detectedFields: this.detectedFields.map(field => field.name),
              
              // Destinataires avec leurs configurations
              recipients: this.recipients.map((recipient, recipientIndex) => {
                // S'assurer que chaque destinataire a une feuille sélectionnée définie
                let selectedSheetIndex = this.recipientSelectedSheets[recipientIndex];
                
                // Si pas défini, utiliser la feuille du destinataire ou détecter automatiquement
                if (selectedSheetIndex === undefined) {
                  if (recipient.selectedSheetIndex !== undefined && recipient.selectedSheetIndex !== null) {
                    selectedSheetIndex = recipient.selectedSheetIndex;
                    this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
                  } else {
                    // Détecter automatiquement la feuille avec des sélections
                    selectedSheetIndex = this.detectSheetWithSelectionsForRecipient(recipientIndex);
                    this.recipientSelectedSheets[recipientIndex] = selectedSheetIndex;
                  }
                }
                
                this.logger.log(`📊 UPDATE - Destinataire ${recipientIndex} (${recipient.email}): selectedSheetIndex = ${selectedSheetIndex}`);
                
                return {
                  email: recipient.email,
                  displayName: recipient.displayName || recipient.email,
                  selectedSheetIndex: selectedSheetIndex,
                  selections: recipient.selection || {},
                  editableCells: this.editableCells[recipientIndex] || {},
                  columnLabels: this.columnLabels[recipientIndex] || {},
                  pageTitle: recipient.pageTitle || '',
                  pageDescription: recipient.pageDescription || '',
                  permission: recipient.permission,
                  allowComments: recipient.allowComments,
                  allowDownload: recipient.allowDownload
                };
              }),
              
              // Permissions globales
              selectedPermission: this.selectedPermission,
              allowComments: this.allowComments,
              allowDownload: this.allowDownload,
              
              // Données Excel pour validation
              headers: this.detectedFields.map(field => field.name),
              totalRows: this.tableData.length,
              totalColumns: this.getColumnCount()
            };

            this.shareService.updateShare(this.currentShareId!, shareRequest).subscribe({
              next: (response) => {
                this.logger.log('✅ Mise à jour du partage réussie:', response);
                this.logger.log('📊 ID du partage:', response.id);
                this.logger.log('📊 Statut du partage:', response.status);

                // 🔧 CORRECTION : Recalculer le tabdata pour tous les destinataires après mise à jour
                this.shareTabdataService.rebuildTabdata(response.id).subscribe({
                  next: () => {
                    this.logger.log('✅ Tabdata recalculé avec succès après mise à jour');
                  },
                  error: (error) => {
                    this.logger.warn('⚠️ Erreur lors du recalcul du tabdata:', error);
                    // Ne pas faire échouer la mise à jour
                  }
                });

                this.isUploading = false;
                
                // Log de confirmation
                this.logger.log('🎉 Partage mis à jour avec succès, redirection en cours...');

                // Sauvegarder l'ID du partage avant le nettoyage
                const shareId = response.id;
                this.logger.log('💾 ID du partage sauvegardé:', shareId);

                // Nettoyer la mémoire avant la navigation pour optimiser les performances
                this.logger.log('🔧 Début du nettoyage de la mémoire...');
                try {
                  this.clearAllData();
                  this.logger.log('✅ Nettoyage terminé, redirection en cours...');
                  this.logger.log('🔧 Immédiatement après clearAllData()');
                } catch (error) {
                  this.logger.error('❌ Erreur lors du nettoyage:', error);
                  this.logger.error('❌ Stack trace:', (error as Error).stack);
                }
                
                this.logger.log('🔧 Après le try-catch du nettoyage');
                
                // Rediriger immédiatement vers la page du partage mis à jour
                this.logger.log('🚀 Redirection vers /share/' + shareId);
                this.logger.log('🔧 Avant router.navigate');
                
                this.router.navigate(['/share', shareId]).then(success => {
                  this.logger.log('🔧 Dans le then de router.navigate, success:', success);
                  if (success) {
                    this.logger.log('✅ Redirection réussie');
                  } else {
                    this.logger.error('❌ Échec de la redirection');
                  }
                }).catch(error => {
                  this.logger.error('❌ Erreur lors de la redirection:', error);
                  this.logger.error('❌ Stack trace redirection:', (error as Error).stack);
                });
                
                this.logger.log('🔧 Après router.navigate');
              },
              error: (error) => {
                this.logger.error('❌❌❌ ERREUR MISE À JOUR PARTAGE ❌❌❌');
                this.logger.error('📊 Erreur complète:', error);
                this.logger.error('📝 Message:', error.message);
                this.logger.error('🔢 Status:', error.status);
                this.uploadError = error.message || 'Erreur lors de la mise à jour du partage';
                this.isUploading = false;
              }
            });
          }
        },
        error: (error) => {
          this.logger.error('❌ Erreur lors de la récupération du statut du partage:', error);
          this.uploadError = 'Erreur lors de la récupération du statut du partage';
          this.isUploading = false;
        }
      });
    }
  }

  // Changement d'onglet destinataire
  onActiveRecipientChange(index: number) {
    this.activeRecipientIndex = index;
    
    // S'assurer que recipientSelectedSheets est initialisé pour ce destinataire
    if (this.recipientSelectedSheets[index] === undefined) {
      this.recipientSelectedSheets[index] = 0; // Valeur par défaut
    }
    
    // Vider le cache des données pour forcer le rechargement avec la feuille du nouveau destinataire
    this.clearDataCache();
    
    // 🔒 SÉCURITÉ : Plus besoin d'invalider le cache, le form-preview gère sa propre simulation
    
    // S'assurer que les cellules éditables sont initialisées pour ce destinataire
    this.initializeEditableCellsForRecipient(index);
    
    // Charger les données de la feuille sélectionnée de ce destinataire
    const recipientSelectedSheet = this.recipientSelectedSheets[index] ?? 0;
    this.loadSheetDataForRecipient(recipientSelectedSheet);
    
    // Mettre à jour le message d'information si on est à l'étape 4
    if (this.currentStep === 4) {
      this.updateStep4InfoMessage();
    }
  }

  /**
   * Vérifie si on doit retourner à l'étape 2 après l'ajout d'un destinataire
   * Si on est aux étapes 3 ou 4 et qu'un nouveau destinataire n'a pas de sélection
   */
  checkReturnToStep2AfterRecipientAddition() {
    // Si on est aux étapes 3 ou 4 et qu'il y a des destinataires sans sélection
    if ((this.currentStep === 3 || this.currentStep === 4) && this.recipients.length > 0) {
      const allHaveSelection = this.allRecipientsHaveSelection();
      if (!allHaveSelection) {

        this.currentStep = 2;
        this.showUserMessage('info', 'Nouveau destinataire ajouté. Veuillez configurer sa sélection de cellules.');
      }
    }
  }

  // Ajout d'un destinataire (exemple simplifié)
  onAddRecipient(email: string) {
    const selection: { [sheetIndex: string]: { row: number, col: number }[] } = {};
    for (let i = 0; i < this.sheets.length; i++) {
      selection[i.toString()] = [];
    }
    const newRecipientIndex = this.recipients.length;
    this.recipients.push({
      email,
      selection
    });
    this.messageService.updateRecipients(this.recipients);
    
    // Définir la feuille sélectionnée pour le nouveau destinataire
    this.recipientSelectedSheets[newRecipientIndex] = this.selectedSheetIndex;
    
    this.activeRecipientIndex = this.recipients.length - 1;
    this.initializeEditableCellsForRecipient(this.activeRecipientIndex);
    this.checkNoRecipient();
    
    // Vérifier si on doit retourner à l'étape 2
    this.checkReturnToStep2AfterRecipientAddition();
  }

  // Suppression d'un destinataire
  onRemoveRecipient(index: number) {
    this.recipients.splice(index, 1);
    this.messageService.updateRecipients(this.recipients);
    if (this.activeRecipientIndex >= this.recipients.length) {
      this.activeRecipientIndex = this.recipients.length - 1;
    }
    if (this.activeRecipientIndex < 0) {
      this.activeRecipientIndex = 0;
    }
    this.checkNoRecipient();
  }

  // Mise à jour de la sélection de cellules pour le destinataire actif
  onSelectionChange(newSelection: { row: number, col: number }[]) {



    
    if (!this.recipients[this.activeRecipientIndex]) {
      this.logger.warn('⚠️ Destinataire actif non trouvé, création d\'un nouveau');
      this.recipients[this.activeRecipientIndex] = { 
        email: '', 
        displayName: '',
        selection: {},
        permission: 'read',
        allowComments: false,
        allowDownload: false
      };
    }
    
    if (!this.recipients[this.activeRecipientIndex].selection) {

      this.recipients[this.activeRecipientIndex].selection = {};
    }
    
    const recipientSelectedSheet = this.getRecipientSelectedSheet(this.activeRecipientIndex);
    const sheetKey = recipientSelectedSheet.toString();
    this.recipients[this.activeRecipientIndex].selection[sheetKey] = newSelection;
  
    // 🔒 SÉCURITÉ : Plus besoin d'invalider le cache, le form-preview gère sa propre simulation
  
    // Mettre à jour le message utilisateur si on est à l'étape 2
    if (this.currentStep === 2) {
      this.canGoNext(); // Cela va mettre à jour le message automatiquement
    }
  }

  // Mise à jour de la validation du tableau
  onTableauValidationChange(isValid: boolean) {
    this.isTableauValid = isValid;

    
    // Mettre à jour le message utilisateur si on est aux étapes 2, 3 ou 4
    if (this.currentStep >= 2 && this.currentStep <= 4) {
      this.canGoNext(); // Cela va mettre à jour le message automatiquement
    }
  }

  // Mise à jour des cellules éditables pour le destinataire actif
  onEditableCellsChange(editableCells: { row: number, col: number }[]) {
    // ALERT 8: Dans le handler parent (seulement si problème)
    const columns = new Set<number>();
    editableCells.forEach(cell => columns.add(cell.col));
    const columnsArray = Array.from(columns).sort((a, b) => a - b);
    if (columnsArray.length > 1) {
      console.log(`⚠️ ALERT 8 - Dans onEditableCellsChange (parent) - PROBLÈME: Nombre de cellules: ${editableCells.length}, Colonnes: [${columnsArray.join(', ')}]`);
    }
    
    if (!this.editableCells[this.activeRecipientIndex]) {
      this.editableCells[this.activeRecipientIndex] = {};
    }
    const recipientSelectedSheet = this.getRecipientSelectedSheet(this.activeRecipientIndex);
    this.editableCells[this.activeRecipientIndex][recipientSelectedSheet.toString()] = [...editableCells];
    
    // ALERT 9: Après la mise à jour dans le parent (seulement si problème)
    const columnsAfter = new Set<number>();
    this.editableCells[this.activeRecipientIndex][recipientSelectedSheet.toString()].forEach((cell: { row: number, col: number }) => columnsAfter.add(cell.col));
    const columnsAfterArray = Array.from(columnsAfter).sort((a, b) => a - b);
    if (columnsAfterArray.length > 1) {
      console.log(`⚠️ ALERT 9 - Après mise à jour dans parent - PROBLÈME: Colonnes stockées: [${columnsAfterArray.join(', ')}]`);
    }
    
    // 🔒 SÉCURITÉ : Plus besoin d'invalider le cache, le form-preview gère sa propre simulation
  }

  // Initialisation des cellules éditables pour un nouveau destinataire
  initializeEditableCellsForRecipient(recipientIndex: number) {
    if (!this.editableCells[recipientIndex]) {
      this.editableCells[recipientIndex] = {};
    }
    // Initialiser toutes les feuilles avec un tableau vide
    for (let i = 0; i < this.sheets.length; i++) {
      if (!this.editableCells[recipientIndex][i.toString()]) {
        this.editableCells[recipientIndex][i.toString()] = [];
      }
    }
  }

  checkNoRecipient() {
    // La modal ne s'ouvre automatiquement que si on est à l'étape 2 et qu'il n'y a pas de destinataires
    // Mais elle peut être ouverte manuellement via le bouton
    // Ne pas ouvrir la modal si on est en train de charger un partage existant
    if (this.currentStep === 2 && this.recipients.length === 0 && !this.currentShareId && !this.isLoadingExistingShare) {
      this.showNoRecipientModal = true;
    }
    
  }

  /**
   * Ouvre la modal d'ajout de contacts
   */
  openContactsModal() {



    
    this.showNoRecipientModal = true;
    
    // Réinitialiser l'onglet actif à 'manual' par défaut
    this.activeTab = 'manual';
    
    // Charger les contacts existants seulement s'ils ne sont pas déjà chargés
    if (this.userContacts.length === 0 && !this.isLoadingContacts) {

      this.loadUserContacts();
    } else {

    }
    
    // La détection des changements se fera automatiquement
  }

  /**
   * Définit l'onglet actif
   */
  setActiveTab(tab: 'manual' | 'contacts') {
    this.activeTab = tab;
    if (tab === 'contacts' && this.userContacts.length === 0 && !this.isLoadingContacts) {
      this.loadUserContacts();
    }
  }

  /**
   * Affiche un message à l'utilisateur
   */
  showUserMessage(type: 'info' | 'warning' | 'error' | 'success', text: string) {
    this.messageService.showMessage(type, text);
  }

  /**
   * Efface le message utilisateur
   */
  clearUserMessage() {
    this.messageService.clearMessage();
  }


  /**
   * Vérifie si tous les destinataires ont une sélection de cellules
   */
  allRecipientsHaveSelection(): boolean {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return true; // Retourner true pour éviter les calculs inutiles
    }
    
    if (this.recipients.length === 0) {
      return false;
    }
    
    return this.recipients.every((recipient, index) => {
      const recipientSelectedSheet = this.getRecipientSelectedSheet(index);
      const selection = recipient.selection?.[recipientSelectedSheet.toString()];
      return selection && selection.length > 0;
    });
  }

  /**
   * Obtient la liste des destinataires sans sélection
   */
  getRecipientsWithoutSelection(): string[] {



    
    const recipientsWithoutSelection = this.recipients
      .filter((recipient, index) => {
        const recipientSelectedSheet = this.getRecipientSelectedSheet(index);
        const selection = recipient.selection?.[recipientSelectedSheet.toString()];

        return !selection || selection.length === 0;
      })
      .map(recipient => recipient.displayName || recipient.email);
    

    return recipientsWithoutSelection;
  }

  /**
   * Obtient les indices des destinataires sans sélection
   */
  getRecipientsWithoutSelectionIndices(): number[] {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return []; // Retourner un tableau vide pour éviter les calculs inutiles
    }

    const indices = this.recipients
      .map((recipient, recipientIndex) => ({ recipient, recipientIndex }))
      .filter(({ recipient, recipientIndex }) => {
        const recipientSelectedSheet = this.getRecipientSelectedSheet(recipientIndex);
        const selection = recipient.selection?.[recipientSelectedSheet.toString()];
       /* this.logger.log(`🔍 Destinataire ${recipientIndex} (${recipient.email}):`, {
          hasSelection: !!recipient.selection,
          selectionKeys: recipient.selection ? Object.keys(recipient.selection) : [],
          currentSheetKey: recipientSelectedSheet.toString(),
          selection: selection,
          hasSelectionForCurrentSheet: !!(selection && selection.length > 0)
        });*/
        return !selection || selection.length === 0;
      })
      .map(({ recipientIndex }) => recipientIndex);
    

    return indices;
  }

  /**
   * Active un destinataire spécifique par son index
   */
  activateRecipient(index: number) {
    if (index >= 0 && index < this.recipients.length) {
      this.activeRecipientIndex = index;
      
    }
  }

  /**
   * Charge les contacts existants de l'utilisateur
   */
  loadUserContacts() {

    this.isLoadingContacts = true;
    this.contactsError = null;
    
    this.shareService.getUserContacts().subscribe({
      next: (response) => {

        this.userContacts = response.contacts || [];
        this.isLoadingContacts = false;
        

        
        // Définir l'onglet actif par défaut : contacts si disponibles, sinon manuel
        if (this.userContacts.length > 0 && this.activeTab === 'manual') {
          this.activeTab = 'contacts';
        }
        
        // Une seule détection de changements suffit
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        this.isLoadingContacts = false;
        this.contactsError = 'Erreur lors du chargement des contacts';
        this.logger.error('❌ Erreur chargement contacts:', error);
        this.logger.error('❌ Détails de l\'erreur:', error.message || error);
        
        // Détection de changements en cas d'erreur
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  /**
   * Sélectionne/désélectionne un contact
   */
  toggleContactSelection(contact: ContactInfo | string) {
    let formattedContact: string;
    
    if (typeof contact === 'string') {
      formattedContact = contact;
    } else {
      formattedContact = contact.formattedContact;
    }
    
    const index = this.selectedContacts.indexOf(formattedContact);
    if (index > -1) {
      this.selectedContacts.splice(index, 1);
    } else {
      this.selectedContacts.push(formattedContact);
    }
    // Log silencieux pour les contacts sélectionnés
  }

  /**
   * Ajoute les contacts sélectionnés comme destinataires
   */
  addSelectedContacts() {
    let addedCount = 0;
    let skippedCount = 0;
    
    this.selectedContacts.forEach(contactString => {
      // Vérifier la limite de destinataires
      if (!this.canAddMoreRecipients()) {
        this.logger.warn(`⚠️ Limite de destinataires atteinte (${this.maxRecipientsPerShare}). Contact ignoré: ${contactString}`);
        skippedCount++;
        return;
      }
      
      const parsedContact = this.shareService.parseContact(contactString);
      
      if (!this.recipients.some(r => r.email === parsedContact.email)) {
        const selection: { [sheetIndex: string]: { row: number, col: number }[] } = {};
        for (let i = 0; i < this.sheets.length; i++) {
          selection[i.toString()] = [];
        }
        const newRecipientIndex = this.recipients.length;
        this.recipients.push({ 
          email: parsedContact.email, 
          displayName: parsedContact.displayName || parsedContact.email,
          selection,
          permission: 'read',
          allowComments: false,
          allowDownload: false
        });
        this.messageService.updateRecipients(this.recipients);
        addedCount++;
        
        // Définir la feuille sélectionnée pour le nouveau destinataire
        this.recipientSelectedSheets[newRecipientIndex] = this.selectedSheetIndex;
        
        // Initialiser les cellules éditables pour ce nouveau destinataire
        this.initializeEditableCellsForRecipient(this.recipients.length - 1);
      } else {
        this.logger.warn(`⚠️ Contact déjà présent ignoré: ${parsedContact.email}`);
        skippedCount++;
      }
    });
    
    // Afficher un message de feedback
    if (addedCount > 0) {
      this.logger.log(`✅ ${addedCount} destinataire(s) ajouté(s) avec succès`);
    }
    if (skippedCount > 0) {
      this.logger.warn(`⚠️ ${skippedCount} contact(s) ignoré(s) (limite atteinte ou doublons)`);
    }
    
    this.selectedContacts = [];
    this.showNoRecipientModal = false;
    
    // Vérifier si on doit retourner à l'étape 2
    this.checkReturnToStep2AfterRecipientAddition();
    
    // Log silencieux pour les contacts ajoutés
  }

  onAddMultipleRecipients(text: string) {
    const contactLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const contactLine of contactLines) {
      // Vérifier la limite de destinataires
      if (!this.canAddMoreRecipients()) {
        this.logger.warn(`⚠️ Limite de destinataires atteinte (${this.maxRecipientsPerShare}). Contact ignoré: ${contactLine}`);
        skippedCount++;
        continue;
      }
      
      // Valider le format du contact
      if (!this.shareService.isValidContact(contactLine)) {
        this.logger.warn(`⚠️ Contact invalide ignoré: ${contactLine}`);
        skippedCount++;
        continue;
      }
      
      const parsedContact = this.shareService.parseContact(contactLine);
      
      if (!this.recipients.some(r => r.email === parsedContact.email)) {
        const selection: { [sheetIndex: string]: { row: number, col: number }[] } = {};
        for (let i = 0; i < this.sheets.length; i++) {
          selection[i.toString()] = [];
        }
        const newRecipientIndex = this.recipients.length;
        this.recipients.push({ 
          email: parsedContact.email, 
          displayName: parsedContact.displayName || parsedContact.email,
          selection,
          permission: 'read',
          allowComments: false,
          allowDownload: false
        });
        this.messageService.updateRecipients(this.recipients);
        addedCount++;
        
        // Définir la feuille sélectionnée pour le nouveau destinataire
        this.recipientSelectedSheets[newRecipientIndex] = this.selectedSheetIndex;
        
        // Initialiser les cellules éditables pour ce nouveau destinataire
        this.initializeEditableCellsForRecipient(this.recipients.length - 1);
      } else {
        this.logger.warn(`⚠️ Contact déjà présent ignoré: ${parsedContact.email}`);
        skippedCount++;
      }
    }
    
    // Afficher un message de feedback
    if (addedCount > 0) {
      this.logger.log(`✅ ${addedCount} destinataire(s) ajouté(s) avec succès`);
    }
    if (skippedCount > 0) {
      this.logger.warn(`⚠️ ${skippedCount} contact(s) ignoré(s) (limite atteinte, doublons ou format invalide)`);
    }
    
    this.noRecipientTextarea = '';
    this.showNoRecipientModal = false;
    
    // Vérifier si on doit retourner à l'étape 2
    this.checkReturnToStep2AfterRecipientAddition();
    
    // Log silencieux pour les destinataires ajoutés
  }

  // Gestion des labels de colonnes pour form-configurator
  onColumnLabelsChange(labels: { [colKey: string]: string }) {
    if (!this.columnLabels[this.activeRecipientIndex]) {
      this.columnLabels[this.activeRecipientIndex] = {};
    }
    const recipientSelectedSheet = this.getRecipientSelectedSheet(this.activeRecipientIndex);
    this.columnLabels[this.activeRecipientIndex][recipientSelectedSheet.toString()] = labels;
    
    // Forcer la mise à jour des en-têtes
    this.forceHeadersUpdate();
  }

  /**
   * Réinitialise les en-têtes pour le destinataire actif et la feuille sélectionnée
   * Supprime les labels existants et les recalcule depuis les sélections
   */
  resetColumnLabelsForActiveRecipient(): void {
    const recipientIndex = this.activeRecipientIndex;
    const recipientSelectedSheet = this.getRecipientSelectedSheet(recipientIndex);
    const sheetKey = recipientSelectedSheet.toString();
    
    this.logger.log(`🔄 Réinitialisation des en-têtes pour destinataire ${recipientIndex}, feuille ${sheetKey}`);
    
    // Supprimer les labels existants pour ce destinataire et cette feuille
    if (this.columnLabels[recipientIndex] && this.columnLabels[recipientIndex][sheetKey]) {
      this.columnLabels[recipientIndex][sheetKey] = {};
      this.logger.log(`🗑️ Labels supprimés pour destinataire ${recipientIndex}, feuille ${sheetKey}`);
    }
    
    // Forcer la mise à jour des en-têtes
    this.forceHeadersUpdate();
    
    // Réinitialiser les en-têtes depuis les sélections avec forceReset=true
    this.initializeColumnLabelsFromSelections(true);
    
    this.showUserMessage('success', 'En-têtes réinitialisés. Les valeurs seront recalculées depuis les sélections.');
  }
  
  /**
   * Force la mise à jour des en-têtes en invalidant le cache
   */
  private forceHeadersUpdate() {
    this._cachedHeaders = [];
    this._lastHeadersUpdate = 0;
    // Pas besoin de forcer la détection ici, elle se fera automatiquement
  }

  /**
   * Vérifie si un destinataire a un titre personnalisé
   * Seul le titre est requis, la description est optionnelle
   */
  hasRecipientCustomTitle(recipientIndex: number): boolean {
    const recipientSelectedSheet = this.getRecipientSelectedSheet(recipientIndex);
    const sheetKey = recipientSelectedSheet.toString();
    
    // Vérifier si le titre existe et n'est pas vide
    const recipient = this.recipients[recipientIndex];
    const titleValue = recipient?.pageTitle;
    const hasCustomTitle = titleValue !== undefined && titleValue !== null && titleValue.trim().length > 0;
    



    
    return hasCustomTitle;
  }

  /**
   * Vérifie si tous les destinataires ont des titres personnalisés
   */
  allRecipientsHaveCustomTitles(): boolean {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return true; // Retourner true pour éviter les calculs inutiles
    }
    
    if (this.recipients.length === 0) {
      return false;
    }
    
    return this.recipients.every((recipient, index) => {
      return this.hasRecipientCustomTitle(index);
    });
  }

  /**
   * Met à jour le message d'information de l'étape 4 selon l'état des modifications
   */
  updateStep4InfoMessage() {
    this.logger.log('updateStep4InfoMessage appelée', {
      currentStep: this.currentStep,
      stackTrace: new Error().stack
    });
    if (this.currentStep === 4) {
      // Vérifier d'abord s'il y a des destinataires sans titre de formulaire
      if (!this.allRecipientsHavePageTitle()) {
        this.logger.log('updateStep4InfoMessage : allRecipientsHavePageTitle false');
        const missingRecipientsIndices = this.getRecipientsWithoutPageTitleIndices();
        const missingRecipients = missingRecipientsIndices.map(index => 
          this.recipients[index].displayName || this.recipients[index].email
        );
        // Afficher le message d'erreur
        const newMessage = `Veuillez d'abord saissir un titre de formulaire pour les destinataires suivants : ${missingRecipients.join(', ')}`;
        this.showUserMessage('warning', newMessage);
      } else {
        // Tous les destinataires ont des titres obligatoires, vérifier s'ils ont des titres personnalisés
        if (this.allRecipientsHaveCustomTitles()) {
          // Tous les destinataires ont des titres personnalisés
          this.logger.log('updateStep4InfoMessage : allRecipientsHaveCustomTitles true');
          this.clearUserMessage();
        } else {
          // Certains destinataires n'ont pas encore de personnalisation
          const infoMessage = 'Prévisualisez le formulaire HTML qui sera généré pour chaque destinataire. Vous pouvez modifier les titres en cliquant sur les boutons d\'édition.';
          this.showUserMessage('info', infoMessage);
        }
      }
    }
  }

  // Gestion des titres de pages pour form-preview
  onPageTitleChange(data: {recipientIndex: number, title: string}) {
    // Mettre à jour directement la propriété du destinataire
    if (this.recipients[data.recipientIndex]) {
      this.recipients[data.recipientIndex].pageTitle = data.title;
      this.messageService.updateRecipients(this.recipients);
    }
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
  }

  // Gestion des descriptions de pages pour form-preview
  onPageDescriptionChange(data: {recipientIndex: number, description: string}) {
    // Mettre à jour directement la propriété du destinataire
    if (this.recipients[data.recipientIndex]) {
      this.recipients[data.recipientIndex].pageDescription = data.description;
    }
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
  }

  // Gestion des titres de pages pour tous les destinataires
  onPageTitleChangeToAll(title: string) {
    // Appliquer le titre à tous les destinataires
    this.recipients.forEach((recipient, index) => {
        this.recipients[index].pageTitle = title;
    });
    
    this.messageService.updateRecipients(this.recipients);
    
    // Afficher un message de confirmation
    this.showUserMessage('success', `Titre appliqué à tous les destinataires (${this.recipients.length} destinataire(s))`);
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
  }

  // Gestion des descriptions de pages pour tous les destinataires
  onPageDescriptionChangeToAll(description: string) {
    // Appliquer la description à tous les destinataires
    this.recipients.forEach((recipient, index) => {
        this.recipients[index].pageDescription = description;
    });
    
    // Afficher un message de confirmation
    this.showUserMessage('success', `Description appliquée à tous les destinataires (${this.recipients.length} destinataire(s))`);
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
  }

  // Gestion du titre de page : appliquer et passer au destinataire suivant
  onPageTitleChangeAndNext(title: string) {
    // Appliquer le titre au destinataire actuel
    if (this.recipients[this.activeRecipientIndex]) {
      this.recipients[this.activeRecipientIndex].pageTitle = title;
      this.messageService.updateRecipients(this.recipients);
    }
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
    
    // Passer au destinataire suivant si possible
    if (this.activeRecipientIndex < this.recipients.length - 1) {
      this.activeRecipientIndex++;
      // Ouvrir automatiquement le modal d'édition pour le destinataire suivant
      setTimeout(() => {
        if (this.formPreview) {
          this.formPreview.openEditModal('title');
        }
      }, 100);
    }
  }

  // Gestion de la description de page : appliquer et passer au destinataire suivant
  onPageDescriptionChangeAndNext(description: string) {
    // Appliquer la description au destinataire actuel
    if (this.recipients[this.activeRecipientIndex]) {
      this.recipients[this.activeRecipientIndex].pageDescription = description;
    }
    
    // Mettre à jour le message d'information de l'étape 4
    this.updateStep4InfoMessage();
    
    // Passer au destinataire suivant si possible
    if (this.activeRecipientIndex < this.recipients.length - 1) {
      this.activeRecipientIndex++;
      // Ouvrir automatiquement le modal d'édition pour le destinataire suivant
      setTimeout(() => {
        if (this.formPreview) {
          this.formPreview.openEditModal('description');
        }
      }, 100);
    }
  }

  // Obtenir les labels de colonnes pour un destinataire et une feuille
  getColumnLabelsForRecipient(recipientIndex: number, sheetIndex: number): { [colKey: string]: string } {
    return this.columnLabels[recipientIndex]?.[sheetIndex] || {};
  }

  /**
   * Initialise automatiquement les en-têtes de colonnes pour tous les destinataires
   * selon les règles :
   * - Pour chaque colonne avec une cellule sélectionnée, parcourir toutes les lignes depuis le début
   * - Prendre la première valeur non vide trouvée dans cette colonne qui N'EST PAS dans une cellule sélectionnée
   * - Si aucune valeur non sélectionnée n'est trouvée, utiliser la valeur de la première cellule sélectionnée (même si vide)
   * 
   * @param forceReset Si true, supprime les labels existants avant de recalculer
   */
  private initializeColumnLabelsFromSelections(forceReset: boolean = false): void {
    this.logger.log('📝 DÉBUT initialisation des en-têtes', {
      sheetsLength: this.sheets?.length || 0,
      recipientsLength: this.recipients?.length || 0,
      tableDataLength: this.tableData?.length || 0,
      tempFileId: this.tempFileId,
      currentShareId: this.currentShareId
    });

    if (!this.sheets || this.sheets.length === 0 || !this.recipients || this.recipients.length === 0) {
      this.logger.log('⚠️ Impossible d\'initialiser les en-têtes : sheets ou recipients manquants', {
        sheetsLength: this.sheets?.length || 0,
        recipientsLength: this.recipients?.length || 0
      });
      return;
    }

    // Étape 1 : Identifier toutes les feuilles nécessaires
    // IMPORTANT : Toujours charger la première page pour calculer les en-têtes correctement
    // même si la feuille est déjà chargée (car les données peuvent être différentes si l'utilisateur a scrollé)
    const sheetsToLoad = new Set<number>();
    const recipientSheetPairs: Array<{ recipientIndex: number, sheetIndex: number, sheetKey: string }> = [];

    this.recipients.forEach((recipient, recipientIndex) => {
      if (!recipient.selection) {
        return;
      }

      Object.keys(recipient.selection).forEach(sheetKey => {
        const sheetIndex = parseInt(sheetKey);
        const selections = recipient.selection[sheetKey] || [];

        if (selections.length === 0) {
          return;
        }

        recipientSheetPairs.push({ recipientIndex, sheetIndex, sheetKey });

        // Toujours charger la première page pour calculer les en-têtes
        // même si la feuille est déjà chargée (les données peuvent être différentes)
        sheetsToLoad.add(sheetIndex);
      });
    });

    // Si des données doivent être chargées, les charger d'abord
    if (sheetsToLoad.size > 0) {
      this.logger.log(`📝 Chargement de ${sheetsToLoad.size} feuille(s) manquante(s):`, Array.from(sheetsToLoad));
      const loadPromises: Promise<void>[] = [];

      sheetsToLoad.forEach(sheetIndex => {
        const promise = new Promise<void>((resolve, reject) => {
          if (this.currentShareId) {
            // Phase 2: Charger seulement la première page pour l'initialisation des en-têtes
            const isPublic = !this.authService.isLoggedIn();
            this.excelService.processShareWithSheet(this.currentShareId, sheetIndex, 0, this.PAGE_SIZE, isPublic).subscribe({
              next: (response: any) => {
                const excelData: ExcelData = {
                  fileName: response.fileName,
                  rows: response.rows,
                  totalRows: response.totalRows,
                  totalColumns: response.totalColumns
                };
                const sheetData = this.excelService.convertExcelDataToSheets(excelData);
                if (sheetData[0] && sheetData[0].data) {
                  this.sheets[sheetIndex].data = sheetData[0].data;
                  this.sheets[sheetIndex].totalRows = response.totalRows;
                  this.sheets[sheetIndex].hasMore = response.hasMore;
                  this.loadedSheets.add(sheetIndex);
                  // Initialiser les en-têtes potentiels lors du chargement de la première page
                  this.initializeSheetHeaders(sheetIndex, sheetData[0].data);
                  this.logger.log(`✅ Données chargées pour feuille ${sheetIndex}: ${sheetData[0].data.length} lignes`);
                }
                resolve();
              },
              error: (error) => {
                this.logger.warn(`⚠️ Erreur lors du chargement de la feuille ${sheetIndex}:`, error);
                resolve(); // Continuer même en cas d'erreur
              }
            });
          } else if (this.tempFileId) {
            // Phase 2: Charger seulement la première page pour l'initialisation des en-têtes
            const isPublic = !this.authService.isLoggedIn();
            this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, 0, this.PAGE_SIZE, isPublic).subscribe({
              next: (response: any) => {
                const excelData: ExcelData = {
                  fileName: response.fileName,
                  rows: response.rows,
                  totalRows: response.totalRows,
                  totalColumns: response.totalColumns
                };
                const sheetData = this.excelService.convertExcelDataToSheets(excelData);
                if (sheetData[0] && sheetData[0].data) {
                  this.sheets[sheetIndex].data = sheetData[0].data;
                  this.sheets[sheetIndex].totalRows = response.totalRows;
                  this.sheets[sheetIndex].hasMore = response.hasMore;
                  this.loadedSheets.add(sheetIndex);
                  // Initialiser les en-têtes potentiels lors du chargement de la première page
                  this.initializeSheetHeaders(sheetIndex, sheetData[0].data);
                  this.logger.log(`✅ Données chargées pour feuille ${sheetIndex}: ${sheetData[0].data.length} lignes`);
                }
                resolve();
              },
              error: (error) => {
                this.logger.warn(`⚠️ Erreur lors du chargement de la feuille ${sheetIndex}:`, error);
                resolve(); // Continuer même en cas d'erreur
              }
            });
          } else {
            this.logger.warn(`⚠️ Impossible de charger la feuille ${sheetIndex} : ni tempFileId ni currentShareId`);
            resolve();
          }
        });
        loadPromises.push(promise);
      });

      // Attendre que toutes les données soient chargées
      Promise.all(loadPromises).then(async () => {
        this.logger.log('✅ Toutes les données sont chargées, initialisation des en-têtes...');
        await this.doInitializeColumnLabels(recipientSheetPairs, forceReset);
      });
    } else {
      // Toutes les données sont déjà disponibles
      this.logger.log('✅ Toutes les données sont déjà disponibles, initialisation des en-têtes...');
      this.doInitializeColumnLabels(recipientSheetPairs, forceReset).catch(error => {
        this.logger.error('❌ Erreur lors de l\'initialisation des en-têtes:', error);
      });
    }
  }

  private async doInitializeColumnLabels(recipientSheetPairs: Array<{ recipientIndex: number, sheetIndex: number, sheetKey: string }>, forceReset: boolean = false): Promise<void> {
    const allInitializedLabels: { [recipientIndex: number]: { [sheetKey: string]: { [colKey: string]: string } } } = {};

    // Étape 1 : Identifier toutes les feuilles qui ont besoin de charger la première page
    // IMPORTANT : Toujours charger la première page pour avoir les bonnes données
    // même si les en-têtes sont déjà initialisés (ils peuvent être incorrects)
    const sheetsToInitialize = new Set<number>();
    recipientSheetPairs.forEach(({ sheetIndex }) => {
      // Toujours charger la première page pour calculer les en-têtes correctement
      sheetsToInitialize.add(sheetIndex);
    });

    // Étape 2 : Charger la première page pour toutes les feuilles manquantes en parallèle
    // On stocke les données de la première page pour chaque feuille pour calculer les en-têtes
    const firstPageData: Map<number, any[]> = new Map();
    
    if (sheetsToInitialize.size > 0) {
      this.logger.log(`📝 Chargement de la première page pour ${sheetsToInitialize.size} feuille(s):`, Array.from(sheetsToInitialize));
      const initPromises: Promise<void>[] = [];

      sheetsToInitialize.forEach(sheetIndex => {
        const initPromise = new Promise<void>((resolve) => {
          if (this.currentShareId) {
            const isPublic = !this.authService.isLoggedIn();
            this.excelService.processShareWithSheet(this.currentShareId, sheetIndex, 0, this.PAGE_SIZE, isPublic).subscribe({
              next: (response: any) => {
                const excelData: ExcelData = {
                  fileName: response.fileName,
                  rows: response.rows,
                  totalRows: response.totalRows,
                  totalColumns: response.totalColumns
                };
                const sheetData = this.excelService.convertExcelDataToSheets(excelData);
                if (sheetData[0] && sheetData[0].data) {
                  firstPageData.set(sheetIndex, sheetData[0].data);
                  this.logger.log(`✅ Première page chargée pour la feuille ${sheetIndex}: ${sheetData[0].data.length} lignes`);
                }
                resolve();
              },
              error: (error) => {
                this.logger.warn(`⚠️ Erreur lors du chargement de la première page pour la feuille ${sheetIndex}:`, error);
                resolve();
              }
            });
          } else if (this.tempFileId) {
            const isPublic = !this.authService.isLoggedIn();
            this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, 0, this.PAGE_SIZE, isPublic).subscribe({
              next: (response: any) => {
                const excelData: ExcelData = {
                  fileName: response.fileName,
                  rows: response.rows,
                  totalRows: response.totalRows,
                  totalColumns: response.totalColumns
                };
                const sheetData = this.excelService.convertExcelDataToSheets(excelData);
                if (sheetData[0] && sheetData[0].data) {
                  firstPageData.set(sheetIndex, sheetData[0].data);
                  this.logger.log(`✅ Première page chargée pour la feuille ${sheetIndex}: ${sheetData[0].data.length} lignes`);
                }
                resolve();
              },
              error: (error) => {
                this.logger.warn(`⚠️ Erreur lors du chargement de la première page pour la feuille ${sheetIndex}:`, error);
                resolve();
              }
            });
          } else {
            this.logger.warn(`⚠️ Impossible de charger la première page pour la feuille ${sheetIndex}`);
            resolve();
          }
        });
        initPromises.push(initPromise);
      });

      // Attendre que toutes les feuilles soient chargées
      await Promise.all(initPromises);
      this.logger.log('✅ Toutes les premières pages sont chargées, calcul des en-têtes...');
    }
    
    // Pour les feuilles déjà initialisées, récupérer les données de la première page depuis le cache
    recipientSheetPairs.forEach(({ sheetIndex }) => {
      if (!firstPageData.has(sheetIndex) && this.sheetPageCache.has(String(sheetIndex))) {
        const cache = this.sheetPageCache.get(String(sheetIndex)) || [];
        const firstPage = cache.find(p => p.page === 0);
        if (firstPage) {
          firstPageData.set(sheetIndex, firstPage.data);
        }
      }
      // Si toujours pas de données, essayer depuis sheets[sheetIndex].data (première page chargée)
      if (!firstPageData.has(sheetIndex) && this.sheets[sheetIndex]?.data && this.sheets[sheetIndex].data.length > 0) {
        firstPageData.set(sheetIndex, this.sheets[sheetIndex].data);
      }
    });

    // Étape 3 : Pour chaque paire destinataire/feuille, calculer les en-têtes en tenant compte des sélections
    recipientSheetPairs.forEach(({ recipientIndex, sheetIndex, sheetKey }) => {
      const recipient = this.recipients[recipientIndex];
      const selections = recipient.selection[sheetKey] || [];

      this.logger.log(`📝 Traitement destinataire ${recipientIndex}, feuille ${sheetKey}`, {
        email: recipient.email,
        selectionsCount: selections.length,
        hasFirstPageData: firstPageData.has(sheetIndex)
      });

      if (selections.length === 0) {
        return;
      }

      // Vérifier qu'on a les données de la première page
      if (!firstPageData.has(sheetIndex)) {
        this.logger.warn(`⚠️ Pas de données de première page pour la feuille ${sheetIndex}, impossible de calculer les en-têtes`);
        return;
      }

      const sheetData = firstPageData.get(sheetIndex)!;

      // Initialiser la structure si nécessaire
      if (!this.columnLabels[recipientIndex]) {
        this.columnLabels[recipientIndex] = {};
      }
      if (!this.columnLabels[recipientIndex][sheetKey]) {
        this.columnLabels[recipientIndex][sheetKey] = {};
      }
      if (!allInitializedLabels[recipientIndex]) {
        allInitializedLabels[recipientIndex] = {};
      }
      if (!allInitializedLabels[recipientIndex][sheetKey]) {
        allInitializedLabels[recipientIndex][sheetKey] = {};
      }

      // Créer un Set des cellules sélectionnées pour vérification rapide
      // IMPORTANT : Les sélections utilisent des indices absolus (depuis le début du fichier)
      // mais sheetData ne contient que la première page (lignes 0 à PAGE_SIZE-1)
      // On doit donc créer deux sets : un pour les cellules de la première page, un pour toutes
      const selectedCellsInFirstPage = new Set<string>(); // Cellules sélectionnées dans la première page
      const selectedCellsAll = new Set<string>(); // Toutes les cellules sélectionnées (pour référence)
      const firstSelectedCellByColumn: { [col: number]: { row: number, value: string } } = {}; // Première cellule sélectionnée par colonne
      
      this.logger.log(`🔍 Analyse de ${selections.length} sélections pour la feuille ${sheetIndex}`);
      
      selections.forEach((cell: { row: number, col: number }) => {
        const cellKey = `${cell.row}-${cell.col}`;
        selectedCellsAll.add(cellKey);
        
        // Si la cellule est dans la première page (row < PAGE_SIZE), l'ajouter au set de la première page
        if (cell.row < this.PAGE_SIZE) {
          selectedCellsInFirstPage.add(`${cell.row}-${cell.col}`);
        }
        
        // Enregistrer la première cellule sélectionnée de chaque colonne (pour fallback)
        if (!firstSelectedCellByColumn[cell.col] || cell.row < firstSelectedCellByColumn[cell.col].row) {
          firstSelectedCellByColumn[cell.col] = { row: cell.row, value: '' };
        }
      });

      this.logger.log(`📊 Statistiques: ${selectedCellsInFirstPage.size} cellules sélectionnées dans la première page sur ${selections.length} totales`);
      this.logger.log(`📊 Premières cellules sélectionnées par colonne:`, firstSelectedCellByColumn);

      // Obtenir les colonnes sélectionnées (uniques)
      const selectedColumns = new Set<number>();
      selections.forEach((cell: { row: number, col: number }) => {
        selectedColumns.add(cell.col);
      });

      this.logger.log(`📝 Colonnes sélectionnées pour feuille ${sheetKey}:`, Array.from(selectedColumns));
      this.logger.log(`📝 Données de la première page disponibles: ${sheetData.length} lignes (PAGE_SIZE=${this.PAGE_SIZE})`);

      // Si forceReset est true, supprimer tous les labels existants pour ce destinataire et cette feuille
      if (forceReset) {
        this.logger.log(`🔄 Mode forceReset activé, suppression des labels existants pour destinataire ${recipientIndex}, feuille ${sheetKey}`);
        this.columnLabels[recipientIndex][sheetKey] = {};
      }

      // Pour chaque colonne sélectionnée, trouver le label
      selectedColumns.forEach(colIndex => {
        const columnKey = `column-${colIndex}`;
        
        // Vérifier si un label existe déjà (sauf si forceReset)
        const existingLabel = this.columnLabels[recipientIndex][sheetKey][columnKey];
        if (existingLabel && !forceReset) {
          // Label déjà défini, ne pas le réinitialiser
          this.logger.log(`⏭️ Label déjà défini pour ${columnKey}: "${existingLabel}", on passe (forceReset=${forceReset})`);
          return;
        }
        
        if (existingLabel && forceReset) {
          this.logger.log(`🔄 Réinitialisation forcée pour ${columnKey}, ancien label: "${existingLabel}"`);
        } else {
          this.logger.log(`🔄 Début du calcul pour ${columnKey}...`);
        }

        let label: string = ''; // Valeur par défaut : chaîne vide si aucune valeur trouvée
        let firstSelectedValue: string = ''; // Valeur de la première cellule sélectionnée (fallback)
        let firstSelectedRow: number = -1; // Ligne de la première cellule sélectionnée

        // Algorithme corrigé : Parcourir toutes les lignes de la première page depuis le début
        // et prendre la première valeur non vide qui N'EST PAS dans une cellule sélectionnée
        this.logger.log(`📝 Calcul de l'en-tête pour ${columnKey} (feuille ${sheetIndex}), ${sheetData.length} lignes à parcourir`);
        this.logger.log(`📝 Cellules sélectionnées dans la première page pour cette colonne:`, 
          Array.from(selectedCellsInFirstPage).filter(key => key.endsWith(`-${colIndex}`)));
        
        for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
          const row = sheetData[rowIndex];
          if (row && row[columnKey] !== undefined && row[columnKey] !== null) {
            const value = String(row[columnKey]).trim();
            const isSelected = selectedCellsInFirstPage.has(`${rowIndex}-${colIndex}`);
            
            // Log de débogage pour les premières lignes
            if (rowIndex < 10) {
              this.logger.log(`  Ligne ${rowIndex}: value="${value}", isSelected=${isSelected}, cellKey="${rowIndex}-${colIndex}"`);
            }
            
            // Si c'est la première cellule sélectionnée de cette colonne, la sauvegarder pour fallback
            if (isSelected && firstSelectedValue === '' && value !== '') {
              firstSelectedValue = value;
              firstSelectedRow = rowIndex;
              this.logger.log(`  ✅ Première valeur sélectionnée trouvée à la ligne ${rowIndex}: "${firstSelectedValue}"`);
            }
            
            // Si la valeur est non vide et que la cellule n'est PAS sélectionnée, l'utiliser
            if (value !== '' && !isSelected) {
              label = value;
              this.logger.log(`🎯 En-tête trouvé pour ${columnKey} (feuille ${sheetIndex}, ligne ${rowIndex}): "${label}" (non sélectionnée)`);
              break;
            }
          } else if (rowIndex < 10) {
            this.logger.log(`  Ligne ${rowIndex}: pas de valeur pour ${columnKey}`);
          }
        }
        
        // Si aucune valeur non sélectionnée n'a été trouvée dans la première page,
        // vérifier si on peut charger la valeur de la première cellule sélectionnée (même si elle est hors première page)
        if (!label && firstSelectedCellByColumn[colIndex]) {
          const firstSelected = firstSelectedCellByColumn[colIndex];
          if (firstSelected.row < this.PAGE_SIZE) {
            // La première cellule sélectionnée est dans la première page, utiliser sa valeur
            if (firstSelectedValue !== '') {
              label = firstSelectedValue;
              this.logger.log(`📝 En-tête fallback utilisé pour ${columnKey} (feuille ${sheetIndex}): "${label}" (première valeur sélectionnée, ligne ${firstSelectedRow})`);
            }
          } else {
            // La première cellule sélectionnée est hors première page, on ne peut pas la charger ici
            this.logger.warn(`⚠️ Première cellule sélectionnée pour ${columnKey} est à la ligne ${firstSelected.row} (hors première page), impossible de charger sa valeur`);
          }
        }
        
        // Log si aucun label n'a été trouvé
        if (!label) {
          this.logger.warn(`⚠️ Aucun en-tête trouvé pour ${columnKey} (feuille ${sheetIndex}), firstSelectedValue="${firstSelectedValue}"`);
        }

        // Sauvegarder le label
        this.columnLabels[recipientIndex][sheetKey][columnKey] = label;
        allInitializedLabels[recipientIndex][sheetKey][columnKey] = label;
        this.logger.log(`💾 Label sauvegardé pour ${columnKey}: "${label}"`);
      });
      
      this.logger.log(`✅ Traitement terminé pour destinataire ${recipientIndex}, feuille ${sheetKey}`);
    });

    // Afficher un seul log avec tous les en-têtes initialisés
    this.logger.log('📝 En-têtes initialisés:', allInitializedLabels);
    this.changeDetectorRef.detectChanges();
  }

  getHeaders(): string[] {
    // Créer une clé unique pour le cache basée sur les paramètres qui affectent les en-têtes
    const cacheKey = `${this.activeRecipientIndex}-${this.selectedSheetIndex}-${JSON.stringify(this.columnLabels[this.activeRecipientIndex]?.[this.selectedSheetIndex] || {})}`;
    const currentTime = Date.now();
    
    // Vérifier si le cache est encore valide (moins de 100ms)
    if (this._cachedHeaders.length > 0 && currentTime - this._lastHeadersUpdate < 100) {
      return this._cachedHeaders;
    }
    
    // Utiliser les mêmes en-têtes que form-configurator
    const activeRecipient = this.recipients[this.activeRecipientIndex];
    if (!activeRecipient) {
      this._cachedHeaders = this.detectedFields.map(field => field.name);
      this._lastHeadersUpdate = currentTime;
      return this._cachedHeaders;
    }
    
    const columnLabels = this.getColumnLabelsForRecipient(this.activeRecipientIndex, this.selectedSheetIndex);
    
    // Obtenir l'ordre des colonnes à partir des données filtrées
    const filteredData = this.getFilteredTableData();
    if (filteredData.length > 0 && filteredData[0].__columnOrder) {
      this._cachedHeaders = filteredData[0].__columnOrder.map((colKey: string) => {
        // Utiliser les labels personnalisés si disponibles, sinon les valeurs d'en-tête
        if (columnLabels[colKey] !== undefined) {
          return columnLabels[colKey];
        }
        
        // Utiliser les valeurs d'en-tête des données filtrées
        const colIndex = parseInt(colKey.replace('column-', ''));
        const headerValue = filteredData[0].__headerValues?.[colIndex];
        if (headerValue) {
          return headerValue;
        }
        
        // Fallback sur le nom de la colonne
        return colKey;
      });
    } else {
      // Fallback sur les champs détectés
      this._cachedHeaders = this.detectedFields.map(field => field.name);
    }
    
    this._lastHeadersUpdate = currentTime;
    return this._cachedHeaders;
  }

  // Obtenir le nombre de colonnes dans la feuille actuelle
  getColumnCount(): number {
    if (!this.tableData || this.tableData.length === 0) {
      return 0;
    }
    return Object.keys(this.tableData[0]).length;
  }

  /**
   * Teste la connexion au backend seulement si l'utilisateur est connecté
   */
  testBackendConnectionIfAuthenticated() {
    // Utiliser la méthode synchrone pour de meilleures performances
    const isLoggedIn = this.authService.isLoggedIn();
    
    if (isLoggedIn) {
      // Test de connexion en arrière-plan sans bloquer l'UI
      this.excelService.checkHealth().subscribe({
        next: (response) => {
          // Connexion OK, pas besoin de log
        },
        error: (error) => {
          this.logger.error('❌ Backend non accessible:', error);
          if (error.message.includes('401')) {
            this.uploadError = 'Erreur d\'authentification. Veuillez vous reconnecter.';
          } else {
            this.uploadError = 'Le backend n\'est pas accessible. Vérifiez qu\'il est démarré.';
          }
        }
      });
    }
  }

  /**
   * Génère automatiquement les liens d'accès de 7 jours pour tous les destinataires
   */
  generateAccessLinksForAllRecipients(shareId: string, recipients: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!recipients || recipients.length === 0) {
        resolve();
        return;
      }

      // Initialiser le progrès
      this.isGeneratingLinks = true;
      this.totalRecipients = recipients.length;
      this.linksGenerated = 0;
      this.linkGenerationProgress = 0;

      let completedRequests = 0;
      let hasError = false;
      
      // Timeout de sécurité (30 secondes maximum)
      const timeout = setTimeout(() => {
        if (completedRequests < this.totalRecipients) {
          this.logger.error('❌ Timeout lors de la génération des liens');
          hasError = true;
          completedRequests = this.totalRecipients;
          reject(new Error('Timeout lors de la génération des liens'));
        }
      }, 30000);

      recipients.forEach((recipient, index) => {
      this.shareService.generateRecipientLink(shareId, recipient.email, 7).subscribe({
        next: (response: any) => {
            this.linksGenerated++;
            completedRequests++;
            this.linkGenerationProgress = Math.round((completedRequests / this.totalRecipients) * 100);

            // Si tous les liens ont été générés
            if (completedRequests === this.totalRecipients) {
              clearTimeout(timeout);
              // Ne pas fermer isGeneratingLinks ici, laisser l'appelant le faire
              resolve();
            }
        },
        error: (error: any) => {
          this.logger.error(`❌ Erreur génération lien pour ${recipient.email}:`, error);
            hasError = true;
            completedRequests++;
            
            // Si tous les liens ont été traités (avec ou sans erreur)
            if (completedRequests === this.totalRecipients) {
              clearTimeout(timeout);
              // Ne pas fermer isGeneratingLinks ici, laisser l'appelant le faire
              if (hasError) {
                reject(new Error('Certains liens n\'ont pas pu être générés'));
              } else {
                resolve();
              }
            }
          }
        });
      });
    });
  }

  /**
   * Initialise les composants après le chargement des données
   */
  private initializeComponentsAfterLoad() {

    
    // Forcer la détection des champs si nécessaire
    if (this.detectedFields.length === 0 && this.tableData.length > 0) {

      this.detectFields();
    }
    
    // Initialiser les cellules éditables pour chaque destinataire
    this.recipients.forEach((recipient, index) => {

      this.initializeEditableCellsForRecipient(index);
    });
    
    // S'assurer que les données sont bien initialisées








    
    // Forcer la mise à jour des composants enfants avec plusieurs tentatives
    this.forceComponentUpdate();
    
    // Forcer une détection des changements supplémentaire
    setTimeout(() => {

      this.changeDetectorRef.detectChanges();
      
      // Vérifier que les données sont bien passées aux composants




    }, 100);
  }
  
  /**
   * Obtient la sélection pour le destinataire actif et la feuille sélectionnée
   */
  getActiveRecipientSelection(): { row: number, col: number }[] {
    // Créer un hash simple pour détecter les changements
    const currentRecipientIndex = this.activeRecipientIndex;
    const currentRecipient = this.recipients[currentRecipientIndex];
    const selectionHash = currentRecipient?.selection ? JSON.stringify(currentRecipient.selection) : '';
    const cacheKey = `${currentRecipientIndex}-${selectionHash}`;
    
    // Si rien n'a changé, retourner le cache
    if (this._lastSelectionHash === cacheKey) {
      return this._cachedActiveRecipientSelection;
    }
    
    // Recalculer seulement si nécessaire
    this._lastSelectionHash = cacheKey;
    this._cachedActiveRecipientSelection = this.calculateActiveRecipientSelection();
    
    return this._cachedActiveRecipientSelection;
  }
  
  private calculateActiveRecipientSelection(): { row: number, col: number }[] {
    if (!this.recipients || this.recipients.length === 0) {
      return [];
    }
    
    const activeRecipient = this.recipients[this.activeRecipientIndex];
    if (!activeRecipient) {
      return [];
    }
    
    if (!activeRecipient.selection) {
      return [];
    }
    
    // Utiliser directement recipientSelectedSheets pour éviter la récursion
    const recipientSelectedSheet = this.recipientSelectedSheets[this.activeRecipientIndex] ?? 0;
    const sheetKey = recipientSelectedSheet.toString();
    
    const selection = activeRecipient.selection[sheetKey] || [];
    return selection;
  }

  /**
   * Crée des données filtrées pour form-configurator contenant uniquement les cellules sélectionnées
   * avec conservation des IDs d'origine (row, col) et de l'ordre des colonnes
   * Les cellules non sélectionnées sont vides
   */
  getFilteredTableData(): any[] {
    const selection = this.getActiveRecipientSelection();
    
    if (!selection || selection.length === 0 || !this.tableData || this.tableData.length === 0) {
      return [];
    }
    



    
    // Obtenir l'ordre des colonnes à partir de la première ligne (en-têtes)
    const headerRow = this.tableData[0];
    
    // Utiliser une approche basée sur les indices pour garantir l'ordre (comme dans tableau-selection)
    const columnKeys: string[] = [];
    
    // Trouver le nombre maximum de colonnes
    let maxColIndex = -1;
    for (const key of Object.keys(headerRow)) {
      if (key.startsWith('column-')) {
        const colIndex = parseInt(key.replace('column-', ''));
        maxColIndex = Math.max(maxColIndex, colIndex);
      }
    }
    
    // Générer les clés dans l'ordre correct
    for (let i = 0; i <= maxColIndex; i++) {
      const columnKey = `column-${i}`;
      if (headerRow.hasOwnProperty(columnKey)) {
        columnKeys.push(columnKey);
      }
    }
    

    
    // Récupérer les valeurs d'en-tête réelles (première ligne des données)
    const headerValues: { [colIndex: number]: string } = {};
    columnKeys.forEach((key, index) => {
      if (headerRow[key] !== undefined && headerRow[key] !== null && headerRow[key] !== '') {
        headerValues[index] = String(headerRow[key]);
      }
    });

    
    // Créer un Map pour organiser les cellules par ligne
    const cellsByRow = new Map<number, { col: number, value: any, originalRow: number, originalCol: number, columnKey: string }[]>();
    
    // Obtenir toutes les colonnes qui ont au moins une cellule sélectionnée
    const selectedColumns = new Set<number>();
    selection.forEach(cell => {
      selectedColumns.add(cell.col);
    });
    
    // Parcourir la sélection et extraire les valeurs
    selection.forEach(cell => {
      const { row, col } = cell;
      
      // Vérifier que la ligne et la colonne existent dans les données
      if (row >= 0 && row < this.tableData.length && col >= 0 && col < columnKeys.length) {
        const rowData = this.tableData[row];
        const columnKey = columnKeys[col];
        const value = rowData[columnKey];
        
        // Ajouter la cellule à la ligne correspondante
        if (!cellsByRow.has(row)) {
          cellsByRow.set(row, []);
        }
        
        cellsByRow.get(row)!.push({
          col,
          value,
          originalRow: row,
          originalCol: col,
          columnKey: columnKey
        });
      }
    });
    
    // Créer les données filtrées en conservant l'ordre des lignes et des colonnes
    const filteredData: any[] = [];
    
    // Inclure toutes les lignes qui ont des cellules sélectionnées
    const sortedRows = Array.from(cellsByRow.keys()).sort((a, b) => a - b);
    
    // Pour chaque ligne avec des cellules sélectionnées, inclure toutes les colonnes sélectionnées
    sortedRows.forEach(rowIndex => {
      const cells = cellsByRow.get(rowIndex)!;
      
      // Créer un objet pour cette ligne avec toutes les colonnes sélectionnées
      const filteredRow: any = {
        __originalRowIndex: rowIndex, // Conserver l'index de ligne original
        __selectedCells: cells, // Conserver les informations des cellules sélectionnées
        __columnOrder: Array.from(selectedColumns).sort((a, b) => a - b).map(col => `column-${col}`), // Toutes les colonnes sélectionnées
        __headerValues: headerValues // Conserver les valeurs d'en-tête
      };
      
      // Initialiser toutes les colonnes sélectionnées avec des valeurs vides
      Array.from(selectedColumns).sort((a, b) => a - b).forEach(col => {
        const columnKey = `column-${col}`;
        filteredRow[columnKey] = ''; // Valeur vide par défaut
      });
      
      // Remplir seulement les cellules réellement sélectionnées
      cells.forEach(cell => {
        const columnKey = `column-${cell.col}`;
        filteredRow[columnKey] = cell.value; // Valeur de la cellule sélectionnée
      });
      
      filteredData.push(filteredRow);
    });




   /* this.logger.log('- Vérification ordre colonnes:', filteredData[0]?.__columnOrder?.map((col: string) => {
      const index = parseInt(col.replace('column-', ''));
      const headerValue = filteredData[0]?.__headerValues?.[index];
      return `${col} (index: ${index}) -> "${headerValue}"`;
    }));*/

    
    return filteredData;
  }

  // 🔒 SÉCURITÉ : Méthode getSimulatedTabdata() supprimée
  // Le form-preview utilise maintenant directement la simulation via ses propres inputs

  // 🔒 SÉCURITÉ : Méthodes de simulation supprimées
  // Le form-preview gère maintenant sa propre simulation de manière sécurisée

  /**
   * Helper pour form-preview : Convertit editableCells au bon format
   */
  getEditableCellsForFormPreview(): { [sheetIndex: string]: { row: number, col: number }[] } {
    const result: { [sheetIndex: string]: { row: number, col: number }[] } = {};
    const recipientIndex = this.activeRecipientIndex;
    
    if (this.editableCells[recipientIndex]) {
      for (const [sheetKey, cells] of Object.entries(this.editableCells[recipientIndex])) {
        result[sheetKey] = cells;
      }
    }
    
    return result;
  }

  /**
   * Helper pour form-preview : Convertit columnLabels au bon format
   */
  getColumnLabelsForFormPreview(): { [sheetIndex: string]: { [colKey: string]: string } } {
    const result: { [sheetIndex: string]: { [colKey: string]: string } } = {};
    const recipientIndex = this.activeRecipientIndex;
    
    if (this.columnLabels[recipientIndex]) {
      for (const [sheetKey, labels] of Object.entries(this.columnLabels[recipientIndex])) {
        result[sheetKey] = labels;
      }
    }
    
    return result;
  }

  /**
   * Force la mise à jour des composants enfants (version optimisée)
   */
  private forceComponentUpdate() {
    // Version optimisée : une seule mise à jour avec debounce
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
    }
    
    this._updateTimeout = setTimeout(() => {
      // Mise à jour unique et efficace
        this.tableData = [...this.tableData];
        this.recipients = [...this.recipients];
        this.sheets = [...this.sheets];
        this.changeDetectorRef.detectChanges();
    }, 50); // Délai réduit pour une meilleure réactivité
  }
  
  private _updateTimeout: any = null;



  /**
   * Charge un partage existant en statut NEW
   */
  async loadExistingShare(shareId: string) {
    try {
      this.isLoadingExistingShare = true;
      
      this.shareService.getShare(shareId).subscribe({
        next: (response: any) => {

          
          // Charger les données du partage (peu importe le statut)
          this.currentShareId = shareId;
          this.shareStatus = response.status || null; // Stocker le statut du partage
          this.selectedFile = { name: response.fileName } as File;
          this.tempFileId = response.fileId || '';
          
          // Configuration des données
          this.selectedSheet = response.selectedSheet || 'Feuille 1';
          this.selectedSheetIndex = response.selectedSheetIndex || 0;
          this.logger.log('📊 Configuration feuille:', {
            selectedSheet: this.selectedSheet,
            selectedSheetIndex: this.selectedSheetIndex,
            responseSelectedSheetIndex: response.selectedSheetIndex
          });
          this.headerRow = response.headerRow || 1;
          this.dataStartRow = response.dataStartRow || 2;
          this.columnRange = response.columnRange || 'A:F';
          this.includeFormulas = response.includeFormulas || false;
          this.preserveFormatting = response.preserveFormatting || true;
          
          // Destinataires
          this.recipients = (response.recipients || []).map((recipient: any, index: number) => {

            
            // S'assurer que chaque destinataire a une structure complète
            let selectionData = recipient.selections || {};
            
            // Si les sélections sont dans un format différent, essayer de les convertir
            if (recipient.selection && !recipient.selections) {
              selectionData = recipient.selection;
            }
            
            // Si les sélections sont un tableau au lieu d'un objet, les convertir
            if (Array.isArray(selectionData)) {
              selectionData = { '0': selectionData }; // Mettre dans la feuille 0
            }
            
            const convertedRecipient = {
              email: recipient.email || '',
              displayName: recipient.displayName || recipient.email || '',
              selectedSheetIndex: recipient.selectedSheetIndex || 0, // Initialiser la feuille sélectionnée
              selection: selectionData, // Utiliser les données de sélection converties
              permission: recipient.permission || 'read',
              allowComments: recipient.allowComments || false,
              allowDownload: recipient.allowDownload || false,
              // Autres propriétés du backend
              pageTitle: recipient.pageTitle,
              pageDescription: recipient.pageDescription
            };
            




            
            return convertedRecipient;
          });
          
          // Initialiser les feuilles sélectionnées des destinataires
          this.recipients.forEach((recipient, index) => {
            // Si le destinataire a une feuille définie dans le backend, l'utiliser
            if (recipient.selectedSheetIndex !== undefined && recipient.selectedSheetIndex !== null) {
              this.recipientSelectedSheets[index] = recipient.selectedSheetIndex;
            } else {
              // Sinon, détecter automatiquement la feuille avec des sélections
              const detectedSheet = this.detectSheetWithSelectionsForRecipient(index);
              this.recipientSelectedSheets[index] = detectedSheet;
            }
          });
          
          // Permissions
          this.selectedPermission = response.selectedPermission || 'read';
          this.allowComments = response.allowComments || false;
          this.allowDownload = response.allowDownload || false;
          
          // Charger les données Excel si disponibles
          if (response.totalColumns > 0) {
            // Générer les champs détectés basés sur le nombre de colonnes
            this.detectedFields = Array.from({ length: response.totalColumns }, (_, index) => ({
              key: `column-${index}`,
              name: `Colonne ${index + 1}`,
              column: this.getColumnLetter(index),
              selected: true
            }));
          }
          
          // OPTIMISATION: Charger les données Excel seulement si elles ne sont pas déjà en mémoire
          if (response.excelData && (!this.tableData || this.tableData.length === 0)) {

            
            // Créer un objet ExcelData compatible
            const excelDataObj: ExcelData = {
              fileName: response.fileName || 'fichier.xlsx',
              rows: response.excelData.rows || response.excelData,
              totalRows: response.totalRows || 0,
              totalColumns: response.totalColumns || 0
            };
            
            // Convertir les données Excel en format compatible
            this.sheets = this.excelService.convertExcelDataToSheets(excelDataObj);


            
            // Charger les données de la feuille sélectionnée
            if (this.sheets.length > 0 && this.sheets[this.selectedSheetIndex]) {
              const sheetData = this.sheets[this.selectedSheetIndex].data;

              if (sheetData && sheetData.length > 0) {
                this.tableData = sheetData; // Utiliser directement les données sans conversion


              } else {
                this.logger.warn('⚠️ Pas de données dans la feuille sélectionnée');
              }
            }
            
            // Détecter les champs automatiquement
            this.detectFields();


          } else if (this.tableData && this.tableData.length > 0) {

            
            // Vérifier que les champs sont dans le bon ordre
            this.detectedFields.forEach((field, index) => {

            });
            
            // Initialiser shareableData pour permettre la finalisation
            this.shareableData = {
              configured: true,
              sheet: this.selectedSheet,
              headerRow: this.headerRow,
              dataStartRow: this.dataStartRow,
              columnRange: this.columnRange,
              includeFormulas: this.includeFormulas,
              preserveFormatting: this.preserveFormatting,
              fields: this.detectedFields,
              selectedFields: this.detectedFields,
              totalRows: response.totalRows || 0,
              totalColumns: response.totalColumns || 0
            };

          } else {
            this.logger.warn('⚠️ Pas de données Excel dans la réponse');
          }
          
          // Charger les cellules éditables et labels
          if (response.recipients) {
            response.recipients.forEach((recipient: any, index: number) => {
              // Initialiser les cellules éditables pour ce destinataire
              this.initializeEditableCellsForRecipient(index);
              
              if (recipient.editableCells) {
                this.editableCells[index] = recipient.editableCells;
              }
              if (recipient.columnLabels) {
                this.columnLabels[index] = recipient.columnLabels;
              }
              // Les pageTitle et pageDescription sont déjà dans l'objet recipient
              // Pas besoin de les charger dans des structures séparées
            });
          }
          
          // S'assurer qu'il y a un destinataire actif
          if (this.recipients.length > 0) {
            this.activeRecipientIndex = 0; // Premier destinataire actif
            this.currentStep = 2; // Étape des destinataires

          } else {
            this.logger.warn('⚠️ Aucun destinataire trouvé');
          }
          
          // Charger les feuilles du partage existant APRÈS avoir configuré les destinataires
          this.loadShareSheets(shareId);
          
          // Initialiser les composants après le chargement complet des données
          // Utiliser un délai plus long pour s'assurer que tout est chargé
          setTimeout(() => {






            
            // Forcer la détection des changements plusieurs fois
            this.initializeComponentsAfterLoad();
            this.forceComponentUpdate();
            
            // Forcer une nouvelle détection des changements après un délai supplémentaire
            setTimeout(() => {

              this.changeDetectorRef.detectChanges();
              this.forceComponentUpdate();
              this.isLoadingExistingShare = false;
            }, 500);
          }, 300);
          

        },
        error: (error: any) => {
          this.logger.error('❌ Erreur lors du chargement du partage existant:', error);
          this.uploadError = 'Impossible de charger le partage existant';
          this.isLoadingExistingShare = false;
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Erreur lors du chargement du partage existant:', error);
      this.uploadError = 'Erreur lors du chargement du partage existant';
      this.isLoadingExistingShare = false;
    }
  }

  /**
   * Charge les feuilles d'un partage existant
   */
  loadShareSheets(shareId: string) {
    this.excelService.getShareSheets(shareId).subscribe({
      next: (response: any) => {
        // Convertir les données de feuilles en format compatible
        this.sheets = this.excelService.convertMultipleSheetsToFormat(response.sheets);
        
        // Détecter automatiquement la feuille avec des sélections
        const sheetWithSelections = this.detectSheetWithSelections();
        this.selectedSheetIndex = sheetWithSelections;
        
        this.logger.log('📊 Feuille sélectionnée automatiquement:', {
          selectedSheetIndex: this.selectedSheetIndex,
          totalSheets: this.sheets.length
        });
        
        // Charger les données de toutes les feuilles
        this.loadAllSheetsData(shareId);
      },
      error: (error) => {
        this.logger.error('❌ Erreur lors du chargement des feuilles du partage:', error);
        this.uploadError = 'Erreur lors du chargement des feuilles: ' + error.message;
      }
    });
  }

  /**
   * Charge les données de toutes les feuilles
   */
  private loadAllSheetsData(shareId: string) {
    if (!this.sheets || this.sheets.length === 0) {
      return;
    }

    // Charger les données de chaque feuille
    const loadPromises = this.sheets.map((sheet, index) => {
      return new Promise<void>((resolve) => {
        const isPublic = !this.authService.isLoggedIn();
        this.excelService.processShareWithSheet(shareId, index, undefined, undefined, isPublic).subscribe({
          next: (response: any) => {
            const excelData: ExcelData = {
              fileName: response.fileName,
              rows: response.rows,
              totalRows: response.totalRows,
              totalColumns: response.totalColumns
            };
            const sheetData = this.excelService.convertExcelDataToSheets(excelData);
            if (sheetData[0] && sheetData[0].data) {
              this.sheets[index].data = sheetData[0].data;
              // Initialiser les en-têtes potentiels lors du chargement de la feuille
              this.initializeSheetHeaders(index, sheetData[0].data);
            }
            resolve();
          },
          error: (error) => {
            this.logger.warn(`⚠️ Erreur lors du chargement de la feuille ${index}:`, error);
            resolve(); // Continuer même en cas d'erreur
          }
        });
      });
    });

    // Attendre que toutes les feuilles soient chargées
    Promise.all(loadPromises).then(() => {
      this.logger.log('✅ Toutes les feuilles chargées');
      
      // Vider le cache car les données ont changé
      this.clearDataCache();
      
      // Maintenant que les données sont chargées, détecter les feuilles avec des sélections
      this.recipients.forEach((recipient, index) => {
        // Si le destinataire n'a pas de feuille définie, détecter automatiquement
        if (this.recipientSelectedSheets[index] === undefined) {
          const detectedSheet = this.detectSheetWithSelectionsForRecipient(index);
          this.recipientSelectedSheets[index] = detectedSheet;
          this.logger.log(`📊 Feuille détectée pour le destinataire ${index}: ${detectedSheet}`);
        }
      });
      
      // Charger les données de la feuille sélectionnée du destinataire actif
      const activeRecipientSheet = this.getRecipientSelectedSheet(this.activeRecipientIndex);
      this.loadSheetDataForRecipient(activeRecipientSheet);
    });
  }

  /**
   * Charge les données d'une feuille spécifique d'un partage existant (avec pagination)
   * Phase 2: Charge seulement la première page
   */
  loadShareSheetData(shareId: string, sheetIndex: number) {
    if (!shareId) {
      this.logger.error('❌ Aucun ID de partage disponible');
      return;
    }
    
    // Phase 2: Utiliser le lazy loading avec pagination
    this.loadSheetPage(sheetIndex, 0);
  }

  /**
   * Détecte automatiquement la feuille avec des sélections de cellules
   */
  detectSheetWithSelections(): number {
    if (!this.recipients || this.recipients.length === 0) {
      return 0; // Par défaut, feuille 0
    }
    
    // Chercher la première feuille qui contient des sélections
    for (let sheetIndex = 0; sheetIndex < this.sheets.length; sheetIndex++) {
      const sheetKey = sheetIndex.toString();
      
      // Vérifier si au moins un destinataire a des sélections sur cette feuille
      const hasSelections = this.recipients.some(recipient => {
        const selections = recipient.selection?.[sheetKey];
        return selections && selections.length > 0;
      });
      
      if (hasSelections) {
        this.logger.log(`📊 Feuille avec sélections détectée: ${sheetIndex}`);
        return sheetIndex;
      }
    }
    
    // Si aucune feuille n'a de sélections, retourner la feuille par défaut
    return 0;
  }


  /**
   * Gère le changement de feuille
   */
  onSheetChange(sheetIndex: number) {
    this.selectedSheetIndex = sheetIndex;
    
    // Forcer la mise à jour des en-têtes
    this.forceHeadersUpdate();
    
    // Si on a un partage existant, charger les données de la nouvelle feuille
    if (this.currentShareId) {
      this.loadShareSheetData(this.currentShareId, sheetIndex);
    } else {
      // Pour les nouveaux partages, utiliser les données déjà chargées
      if (this.sheets[sheetIndex] && this.sheets[sheetIndex].data) {
        this.tableData = this.sheets[sheetIndex].data;
        this.detectFields();
        this.verifyDataConsistency();
        this.configureData();
      }
    }
  }

  /**
   * Gère le changement de feuille pour un destinataire spécifique
   */
  onRecipientSheetChange(recipientIndex: number, sheetIndex: number) {
    this.logger.log(`🔄 Changement de feuille pour le destinataire ${recipientIndex}: ${this.recipientSelectedSheets[recipientIndex]} → ${sheetIndex}`);
    this.logger.log(`📊 Destinataires avant changement: ${this.recipients.length}`, this.recipients.map(r => r.email));
    
    this.recipientSelectedSheets[recipientIndex] = sheetIndex;
    
    // Vider le cache des données pour forcer le rechargement avec la nouvelle feuille
    this.clearDataCache();
    
    // Mettre à jour les données du destinataire si nécessaire
    this.updateRecipientData(recipientIndex, sheetIndex);
    
    this.logger.log(`📊 Destinataires après changement: ${this.recipients.length}`, this.recipients.map(r => r.email));
  }

  /**
   * Obtient la feuille sélectionnée pour un destinataire
   */
  getRecipientSelectedSheet(recipientIndex: number): number {
    // Si une feuille est explicitement définie pour ce destinataire, l'utiliser
    if (this.recipientSelectedSheets[recipientIndex] !== undefined) {
      return this.recipientSelectedSheets[recipientIndex]!;
    }
    
    // Si les données ne sont pas encore chargées, retourner la feuille par défaut
    if (!this.sheets || this.sheets.length === 0) {
      return 0;
    }
    
    // Protection contre la récursion - définir temporairement à 0 pendant la détection
    this.recipientSelectedSheets[recipientIndex] = 0;
    
    // Sinon, détecter automatiquement la feuille avec des sélections pour ce destinataire
    const detectedSheet = this.detectSheetWithSelectionsForRecipient(recipientIndex);
    this.recipientSelectedSheets[recipientIndex] = detectedSheet;
    
    return detectedSheet;
  }

  /**
   * Détecte automatiquement la feuille avec des sélections pour un destinataire
   */
  private detectSheetWithSelectionsForRecipient(recipientIndex: number): number {
    if (!this.recipients[recipientIndex] || !this.recipients[recipientIndex].selection) {
      return 0; // Par défaut, feuille 0
    }
    
    const recipient = this.recipients[recipientIndex];
    const selectionData = recipient.selection;
    
    // Chercher la première feuille qui a des sélections
    for (const sheetKey of Object.keys(selectionData)) {
      const selections = selectionData[sheetKey];
      if (selections && Array.isArray(selections) && selections.length > 0) {
        const sheetIndex = parseInt(sheetKey);
        if (!isNaN(sheetIndex)) {
          return sheetIndex;
        }
      }
    }
    
    return 0; // Par défaut, feuille 0
  }

  /**
   * Met à jour les données du destinataire après changement de feuille
   */
  private updateRecipientData(recipientIndex: number, sheetIndex: number) {
    this.logger.log(`Mise à jour des données pour le destinataire ${recipientIndex} avec la feuille ${sheetIndex}`);
    
    // Si c'est le destinataire actif, mettre à jour les données affichées
    if (recipientIndex === this.activeRecipientIndex) {
      this.loadSheetDataForRecipient(sheetIndex);
    }
  }

  /**
   * Charge les données d'une feuille spécifique pour le destinataire actif (avec lazy loading)
   * Phase 2: Charge uniquement la première page si la feuille n'est pas encore chargée
   */
  private loadSheetDataForRecipient(sheetIndex: number) {
    if (!this.sheets || this.sheets.length === 0 || !this.sheets[sheetIndex]) {
      this.logger.warn(`Feuille ${sheetIndex} non trouvée`);
      return;
    }

    // Marquer la feuille comme récemment utilisée
    this.recentlyUsedSheets.add(sheetIndex);
    
    // Si les données de cette feuille sont déjà chargées (au moins partiellement), les utiliser
    if (this.sheets[sheetIndex].data && this.sheets[sheetIndex].data.length > 0) {
      this.tableData = this.sheets[sheetIndex].data;
      return;
    }

    // Phase 2: Charger seulement la première page (100 lignes)
    this.loadSheetPage(sheetIndex, 0);
  }
  
  /**
   * Phase 2: Charge une page spécifique d'une feuille
   */
  private loadSheetPage(sheetIndex: number, page: number = 0): void {
    const cacheKey = `${sheetIndex}-${page}`;
    
    // Vérifier si la page est déjà en cache
    const sheetCache = this.sheetPageCache.get(String(sheetIndex)) || [];
    const cachedPage = sheetCache.find(p => p.page === page);
    if (cachedPage) {
      // Utiliser les données en cache
      if (!this.sheets[sheetIndex].data || this.sheets[sheetIndex].data.length === 0) {
        this.sheets[sheetIndex].data = cachedPage.data;
      }
      this.tableData = this.sheets[sheetIndex].data;
      this.detectFields();
      this.verifyDataConsistency(false);
      this.configureData();
      this.changeDetectorRef.detectChanges();
      return;
    }

    // Charger la page depuis le backend
    if (this.tempFileId) {
      const isPublic = !this.authService.isLoggedIn();
      this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, page, this.PAGE_SIZE, isPublic).subscribe({
        next: (response: any) => {
          const excelData: ExcelData = {
            fileName: response.fileName,
            rows: response.rows,
            totalRows: response.totalRows,
            totalColumns: response.totalColumns,
            page: response.page,
            limit: response.limit,
            hasMore: response.hasMore
          };
          
          // Mettre à jour les métadonnées de la feuille
          if (this.sheets[sheetIndex]) {
            this.sheets[sheetIndex].totalRows = response.totalRows;
            this.sheets[sheetIndex].totalColumns = response.totalColumns;
            this.sheets[sheetIndex].hasMore = response.hasMore;
            this.sheets[sheetIndex].isLoaded = true;
          }
          
          const sheetData = this.excelService.convertExcelDataToSheets(excelData);
          if (sheetData[0] && sheetData[0].data) {
            // Mettre en cache la page
            if (!this.sheetPageCache.has(String(sheetIndex))) {
              this.sheetPageCache.set(String(sheetIndex), []);
            }
            this.sheetPageCache.get(String(sheetIndex))!.push({ page, data: sheetData[0].data });
            
            // Si c'est la première page, l'utiliser directement
            if (page === 0) {
              this.sheets[sheetIndex].data = sheetData[0].data;
              this.tableData = sheetData[0].data;
              this.loadedSheets.add(sheetIndex);
              // Initialiser les en-têtes potentiels lors du chargement de la première page
              this.initializeSheetHeaders(sheetIndex, sheetData[0].data);
            }
            
            this.detectFields();
            this.verifyDataConsistency(false);
            this.configureData();
            this.manageMemory(); // Phase 4: Gérer la mémoire
            this.changeDetectorRef.detectChanges();
          }
        },
        error: (error) => {
          this.logger.error(`Erreur lors du chargement de la page ${page} de la feuille ${sheetIndex}:`, error);
          
          // Si erreur 401 et qu'on utilisait l'endpoint privé, réessayer avec l'endpoint public
          if (error.status === 401 && !isPublic && this.tempFileId) {
            this.logger.log('Tentative avec l\'endpoint public après erreur 401');
            const publicLoadPromise = this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, page, this.PAGE_SIZE, true);
            publicLoadPromise.subscribe({
              next: (response: any) => {
                const excelData: ExcelData = {
                  fileName: response.fileName,
                  rows: response.rows,
                  totalRows: response.totalRows,
                  totalColumns: response.totalColumns,
                  page: response.page,
                  limit: response.limit,
                  hasMore: response.hasMore
                };
                
                if (this.sheets[sheetIndex]) {
                  this.sheets[sheetIndex].totalRows = response.totalRows;
                  this.sheets[sheetIndex].totalColumns = response.totalColumns;
                  this.sheets[sheetIndex].hasMore = response.hasMore;
                  this.sheets[sheetIndex].isLoaded = true;
                }
                
                const sheetData = this.excelService.convertExcelDataToSheets(excelData);
                if (sheetData[0] && sheetData[0].data) {
                  if (!this.sheetPageCache.has(String(sheetIndex))) {
                    this.sheetPageCache.set(String(sheetIndex), []);
                  }
                  this.sheetPageCache.get(String(sheetIndex))!.push({ page, data: sheetData[0].data });
                  
                  if (page === 0) {
                    this.sheets[sheetIndex].data = sheetData[0].data;
                    this.tableData = sheetData[0].data;
                    this.loadedSheets.add(sheetIndex);
                    // Initialiser les en-têtes potentiels lors du chargement de la première page
                    this.initializeSheetHeaders(sheetIndex, sheetData[0].data);
                  }
                  
                  this.detectFields();
                  this.verifyDataConsistency(false);
                  this.configureData();
                  this.manageMemory();
                  this.changeDetectorRef.detectChanges();
                }
              },
              error: (publicError: any) => {
                this.logger.error(`Erreur avec l'endpoint public:`, publicError);
              }
            });
          }
        }
      });
    } else if (this.currentShareId) {
      const isPublic = !this.authService.isLoggedIn();
      this.excelService.processShareWithSheet(this.currentShareId, sheetIndex, page, this.PAGE_SIZE, isPublic).subscribe({
        next: (response: any) => {
          const excelData: ExcelData = {
            fileName: response.fileName,
            rows: response.rows,
            totalRows: response.totalRows,
            totalColumns: response.totalColumns,
            page: response.page,
            limit: response.limit,
            hasMore: response.hasMore
          };
          
          // Mettre à jour les métadonnées de la feuille
          if (this.sheets[sheetIndex]) {
            this.sheets[sheetIndex].totalRows = response.totalRows;
            this.sheets[sheetIndex].totalColumns = response.totalColumns;
            this.sheets[sheetIndex].hasMore = response.hasMore;
            this.sheets[sheetIndex].isLoaded = true;
          }
          
          const sheetData = this.excelService.convertExcelDataToSheets(excelData);
          if (sheetData[0] && sheetData[0].data) {
            // Mettre en cache la page
            if (!this.sheetPageCache.has(String(sheetIndex))) {
              this.sheetPageCache.set(String(sheetIndex), []);
            }
            this.sheetPageCache.get(String(sheetIndex))!.push({ page, data: sheetData[0].data });
            
            // Si c'est la première page, l'utiliser directement
            if (page === 0) {
              this.sheets[sheetIndex].data = sheetData[0].data;
              this.tableData = sheetData[0].data;
              this.loadedSheets.add(sheetIndex);
              // Initialiser les en-têtes potentiels lors du chargement de la première page
              this.initializeSheetHeaders(sheetIndex, sheetData[0].data);
            }
            
            this.detectFields();
            this.verifyDataConsistency(false);
            this.configureData();
            this.manageMemory(); // Phase 4: Gérer la mémoire
            this.changeDetectorRef.detectChanges();
          }
        },
        error: (error) => {
          this.logger.error(`Erreur lors du chargement de la page ${page} de la feuille ${sheetIndex}:`, error);
        }
      });
    } else {
      // Fallback : utiliser les données existantes
      this.tableData = this.sheets[sheetIndex].data || [];
    }
  }

  /**
   * Initialise les en-têtes potentiels pour une feuille lors du chargement de la première page
   * Parcourt toutes les lignes de la première page et trouve la première valeur non vide pour chaque colonne
   */
  private initializeSheetHeaders(sheetIndex: number, sheetData: any[]): void {
    if (!sheetData || sheetData.length === 0) {
      return;
    }

    // Si les en-têtes sont déjà initialisés pour cette feuille, ne pas les réinitialiser
    if (this.sheetHeaders.has(sheetIndex)) {
      return;
    }

    const headers: { [colKey: string]: string } = {};

    // Trouver toutes les colonnes disponibles dans la première ligne
    const firstRow = sheetData[0];
    const columnKeys: string[] = [];
    
    // Trouver le nombre maximum de colonnes
    let maxColIndex = -1;
    for (const key of Object.keys(firstRow)) {
      if (key.startsWith('column-')) {
        const colIndex = parseInt(key.replace('column-', ''));
        maxColIndex = Math.max(maxColIndex, colIndex);
      }
    }
    
    // Générer les clés dans l'ordre correct
    for (let i = 0; i <= maxColIndex; i++) {
      const columnKey = `column-${i}`;
      if (firstRow.hasOwnProperty(columnKey)) {
        columnKeys.push(columnKey);
      }
    }

    // Pour chaque colonne, trouver la première valeur non vide
    columnKeys.forEach(columnKey => {
      let label: string = '';
      
      // Parcourir toutes les lignes depuis le début
      for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];
        if (row && row[columnKey] !== undefined && row[columnKey] !== null) {
          const value = String(row[columnKey]).trim();
          if (value !== '') {
            // Première valeur non vide trouvée
            label = value;
            break;
          }
        }
      }
      
      headers[columnKey] = label;
    });

    // Stocker les en-têtes pour cette feuille
    this.sheetHeaders.set(sheetIndex, headers);
    this.logger.log(`📝 En-têtes initialisés pour la feuille ${sheetIndex}:`, headers);
  }

  /**
   * Obtient la valeur d'affichage du titre pour un destinataire
   * Retourne la valeur personnalisée ou une chaîne vide si non définie
   */
  getDisplayPageTitle(recipientIndex: number): string {
    // Utiliser directement la valeur du destinataire
    const recipient = this.recipients[recipientIndex];
    if (recipient && recipient.pageTitle) {
      return recipient.pageTitle;
    }
    
    // Sinon, retourner une chaîne vide
    return '';
  }

  /**
   * Obtient la valeur d'affichage de la description pour un destinataire
   * Retourne la valeur personnalisée ou une chaîne vide si non définie
   */
  getDisplayPageDescription(recipientIndex: number): string {
    // Utiliser directement la valeur du destinataire
    const recipient = this.recipients[recipientIndex];
    if (recipient && recipient.pageDescription) {
      return recipient.pageDescription;
    }
    
    // Sinon, retourner une chaîne vide
    return '';
  }

  /**
   * Vérifie que tous les destinataires ont un titre de formulaire
   */
  allRecipientsHavePageTitle(): boolean {
    this.logger.log('Vérification de tous les destinataires ont un titre de formulaire');
    if (this.recipients.length === 0) return false;
    
    return this.recipients.every((recipient, index) => {
      const pageTitle = recipient.pageTitle;
      return pageTitle && pageTitle.trim().length > 0;
    });
  }

  /**
   * Obtient les indices des destinataires sans titre de formulaire
   */
  getRecipientsWithoutPageTitleIndices(): number[] {
    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (this.isFinalizing) {
      return [];
    }

    return this.recipients
      .map((recipient, recipientIndex) => ({ recipient, recipientIndex }))
      .filter(({ recipient }) => {
        const pageTitle = recipient.pageTitle;
        return !pageTitle || pageTitle.trim().length === 0;
      })
      .map(({ recipientIndex }) => recipientIndex);
  }

  /**
   * Détermine le type de message d'erreur à afficher selon l'étape et le type de problème
   */
  getErrorMessageType(): 'selection' | 'pageTitle' | null {
    if (this.currentStep === 4) {
      // À l'étape 4, vérifier d'abord les sélections, puis les titres
      if (!this.allRecipientsHaveSelection()) {
        return 'selection';
      }
      if (!this.allRecipientsHavePageTitle()) {
        return 'pageTitle';
      }
    } else if (this.currentStep === 2 || this.currentStep === 3) {
      // Aux étapes 2 et 3, vérifier seulement les sélections
      if (!this.allRecipientsHaveSelection()) {
        return 'selection';
      }
    }
    return null;
  }

  /**
   * Nettoie complètement toutes les données et sélections lors du changement de fichier
   */
  clearAllDataAndSelections() {

    
    // Nettoyer la mémoire des chunks
    this.loadedDataChunks.clear();
    
    // Réinitialiser les données Excel
    this.sheets = [];
    this.formulaCells = [];
    this._tableData = [];
    this.selectedSheetIndex = 0;
    
    // Réinitialiser les destinataires et leurs sélections
    this.recipients = [];
    this.activeRecipientIndex = 0;
    
    // Réinitialiser les champs détectés
    this.detectedFields = [];
    
    // Réinitialiser les données partagées
    this.shareableData = {};
    
    // Réinitialiser les permissions et configurations
    this.selectedPermission = 'read';
    this.allowComments = false;
    this.allowDownload = false;
    
    // Réinitialiser les cellules éditables
    this.editableCells = {};
    
    // Les titres et descriptions sont maintenant dans les destinataires
    // Pas besoin de les réinitialiser séparément
    
    // Réinitialiser les labels de colonnes
    this.columnLabels = {};
    
    // Réinitialiser les en-têtes potentiels par feuille
    this.sheetHeaders.clear();
    
    // Réinitialiser les messages utilisateur
    this.clearUserMessage();
    
    // Arrêter le nettoyage automatique
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
    

  }
  
  /**
   * Vérifie la cohérence des données après le chargement d'un nouveau fichier
   */
  private verifyDataConsistency(isNewFile: boolean = true): boolean {

    
    let isConsistent = true;
    
    // Vérifier que les sheets sont chargés
    if (!this.sheets || this.sheets.length === 0) {
      this.logger.error('❌ Aucune feuille Excel chargée');
      isConsistent = false;
    } else {

    }
    
    // Vérifier que les données sont présentes
    const currentSheetIndex = this.getRecipientSelectedSheet(this.activeRecipientIndex);
    if (!this.sheets[currentSheetIndex]?.data) {
      this.logger.error('❌ Aucune donnée dans la feuille sélectionnée');
      isConsistent = false;
    } else {
      const dataLength = this.sheets[currentSheetIndex].data.length;

      
      // Vérifier la cohérence des colonnes
      if (dataLength > 0) {
        const firstRow = this.sheets[currentSheetIndex].data[0];
        const columnCount = Object.keys(firstRow).length;

      }
    }
    
    // Vérifier que la mémoire est vide (nouveau fichier)
    if (this.loadedDataChunks.size > 0) {
      this.logger.warn('⚠️ Des chunks de données sont encore en mémoire');
      this.loadedDataChunks.clear();
    }
    
    // Vérifier que les destinataires sont vides (seulement pour les nouveaux fichiers)
    if (isNewFile && this.recipients.length > 0 && !this.currentShareId) {
      this.logger.warn('⚠️ Des destinataires sont encore présents');
      this.recipients = [];
    }
    
    // Vérifier que les sélections sont vides (seulement pour les nouveaux fichiers)
    if (isNewFile && Object.keys(this.editableCells).length > 0 && !this.currentShareId) {
      this.logger.warn('⚠️ Des cellules éditables sont encore configurées');
      this.editableCells = {};
    }
    
    if (isConsistent) {

      
      // Forcer la mise à jour des composants enfants
      this.forceChildComponentsUpdate();
    } else {
      this.logger.error('❌ Vérification de cohérence échouée - Problèmes détectés');
    }
    
    return isConsistent;
  }
  
  /**
   * Force la mise à jour des composants enfants après un changement de fichier
   */
  private forceChildComponentsUpdate() {

    
    // Forcer la détection de changements
    this.changeDetectorRef.detectChanges();
    
    // Réinitialiser les données de table pour forcer la mise à jour
    this._tableData = [];
    
    // Forcer la mise à jour des composants enfants en modifiant temporairement les références
    if (this.sheets.length > 0) {
      // Créer une nouvelle référence pour forcer la mise à jour
      this.sheets = [...this.sheets];
    }
    

  }
  
  /**
   * Vérifie que le fichier à sauvegarder correspond aux données affichées
   */
  private verifyFileDataConsistency(): boolean {

    
    if (!this.selectedFile || !this.tempFileId) {
      this.logger.error('❌ Fichier ou fileId manquant');
      return false;
    }
    
    if (!this.sheets || this.sheets.length === 0) {
      this.logger.error('❌ Aucune donnée Excel chargée');
      return false;
    }
    
    const currentData = this.sheets[this.selectedSheetIndex]?.data;
    if (!currentData || currentData.length === 0) {
      this.logger.error('❌ Aucune donnée dans la feuille active');
      return false;
    }
    
    this.logger.log('✅ Cohérence fichier-données vérifiée:', {
      fileName: this.selectedFile.name,
      fileId: this.tempFileId,
      dataRows: currentData.length,
      dataColumns: Object.keys(currentData[0] || {}).length
    });
    
    return true;
  }

  /**
   * Nettoie toutes les données lourdes pour libérer la mémoire avant la navigation
   */
  clearAllData() {
    this.logger.log('🧹🧹🧹 NETTOYAGE DE LA MÉMOIRE AVANT NAVIGATION 🧹🧹🧹');
    this.logger.log('🧹 Nettoyage de la mémoire avant navigation...');
    
    // Vider les données du tableau
    this.tableData = [];
    this.logger.log('🧹 Données du tableau vidées');
    
    // Vider les données des feuilles Excel
    this.sheets = [];
    this.selectedSheetIndex = 0;
    this.logger.log('🧹 Données des feuilles vidées');
    
    // Vider les données des destinataires
    this.recipients = [];
    this.activeRecipientIndex = 0;
    this.recipientSelectedSheets = {};
    this.editableCells = {};
    this.columnLabels = {};
    this.sheetHeaders.clear();
    this.logger.log('🧹 Données des destinataires vidées');
    
    // Vider les données du fichier
    this.selectedFile = null;
    this.tempFileId = null;
    this.logger.log('🧹 Données du fichier vidées');
    this.uploadError = null;
    
    // Vider les données de configuration
    this.currentShareId = null;
    this.shareStatus = null;
    this.isSaving = false;
    
    // Vider les messages utilisateur
    this.clearUserMessage();
    
    // Vider les données de contacts
    this.userContacts = [];
    this.selectedContacts = [];
    this.contactsError = null;
    this.isLoadingContacts = false;
    
    // Vider les données de validation
    this.isTableauValid = true;
    this.isFinalizing = false;
    this.messageService.updateFinalizingState(this.isFinalizing);
    this.isUploading = false;
    this.isGeneratingLinks = false;
    this.linkGenerationProgress = 0;
    this.totalRecipients = 0;
    this.linksGenerated = 0;
    
    // Forcer le garbage collection si disponible
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    this.logger.log('✅ Mémoire nettoyée avec succès');
    this.logger.log('🔧 Fin de clearAllData() - retour normal');
  }

  ngOnDestroy() {
    this.subscriptionSub?.unsubscribe();
    this.clearAllData();
    
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
    
  }

  // ===== MÉTHODES D'INITIALISATION =====

  private initializeAuthState() {
    // Valider et nettoyer l'état d'authentification
    this.authService.getAuthState$().subscribe((authState) => {
      // Vérifier si l'email est déjà validé et le token est valide
      if (authState.isEmailValidated && authState.isAuthenticated) {
        this.isUserEmailValidated = true;
        this.userEmail = authState.userEmail || '';
      } else {
        // État invalide, nettoyer
        this.isUserEmailValidated = false;
        this.userEmail = '';
      }
    });
  }

  // ===== MÉTHODES DE VALIDATION D'EMAIL =====

  // Envoyer le code de vérification
  sendEmailVerification() {
    if (!this.userEmail || !this.acceptTerms) {
      return;
    }
    
    this.isSendingEmail = true;
    this.loginMethod = 'code';
    
    this.authService.sendEmailVerification(this.userEmail).subscribe({
      next: (response: any) => {
        this.emailValidationSent = true;
        this.isSendingEmail = false;
      },
      error: (error: any) => {
        this.isSendingEmail = false;
        this.logger.error('NewShare - Erreur lors de l\'envoi de la vérification:', error);
        this.logger.error('NewShare - Status de l\'erreur:', error?.status);
        
        // Gestion spécifique de l'erreur 429 (Too Many Requests)
        if (error?.status === 429) {
          this.logger.log('NewShare - Erreur 429 détectée, affichage dans le modal existant');
          this.uploadError = 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
        } else {
          this.uploadError = 'Erreur lors de l\'envoi du code de vérification. Veuillez réessayer.';
        }
      }
    });
  }

  // Vérifier l'état d'authentification
  private checkAuthenticationStatus(): void {
    // Récupérer l'état d'authentification depuis l'auth-service
    this.authService.getAuthState$().subscribe({
      next: (authState: any) => {
        this.logger.log('NewShare - État d\'authentification récupéré:', authState);
        
        // Mettre à jour l'état local
        this.isUserEmailValidated = authState.isAuthenticated && authState.isEmailValidated;
      },
      error: (error) => {
        this.logger.error('Erreur lors de la récupération de l\'état d\'authentification:', error);
      }
    });
  }

  // Vérifier le code
  verifyEmailCode() {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      return;
    }
    
    // Nettoyer le code (supprimer les espaces et caractères non numériques)
    const cleanCode = this.verificationCode.replace(/\D/g, '');
    
    if (cleanCode.length !== 6) {
      this.uploadError = 'Le code doit contenir exactement 6 chiffres';
      return;
    }
    
    this.isVerifyingCode = true;
    
    this.logger.log('Envoi de la vérification:', {
      email: this.userEmail,
      code: cleanCode,
      purpose: 'share_creation'
    });
    
    this.authService.verifyEmailCode(this.userEmail, cleanCode).subscribe({
      next: (response: any) => {
        this.logger.log('✅ Code de vérification validé avec succès:', response);
        
        // Code validé avec succès !
        this.isUserEmailValidated = true;
        this.showEmailValidationModal = false;
        this.emailValidationSent = false;
        
        // Code validé avec succès !
        this.authService.setEmailValidated(this.userEmail, response.token, response.user);
        
        // Récupérer l'état d'authentification depuis l'auth-service
        this.checkAuthenticationStatus();
        
        this.logger.log('🔧 État d\'authentification après mise à jour:', {
          isEmailValidated: this.authService.isEmailValidated(),
          isLoggedIn: this.authService.isLoggedIn(),
          userEmail: this.authService.getUserEmail()
        });
        
        // Afficher le modal de succès au lieu de finaliser automatiquement
        this.showCodeValidationSuccessModal = true;
        this.isVerifyingCode = false;
      },
      error: (error: any) => {
        this.logger.error('Erreur de vérification:', error);
        if (error.error?.error === 'Code incorrect') {
          this.uploadError = `Code incorrect. ${error.error.attemptsLeft} tentatives restantes.`;
        } else if (error.error?.error === 'Code expiré') {
          this.uploadError = 'Le code a expiré. Veuillez demander un nouveau code.';
          this.emailValidationSent = false;
        } else if (error.error?.error === 'Code non trouvé') {
          this.uploadError = 'Aucun code trouvé pour cet email. Veuillez demander un nouveau code.';
          this.emailValidationSent = false;
        } else if (error.error?.error === 'Trop de tentatives') {
          this.uploadError = 'Trop de tentatives. Veuillez demander un nouveau code.';
          this.emailValidationSent = false;
        } else {
          this.uploadError = `Erreur lors de la vérification du code: ${error.error?.message || error.message || 'Erreur inconnue'}`;
        }
        this.isVerifyingCode = false;
      }
    });
  }

  // Renvoyer le code
  resendVerificationCode() {
    this.isResendingCode = true;
    
    this.authService.sendEmailVerification(this.userEmail).subscribe({
      next: (response: any) => {
        this.showUserMessage('success', 'Nouveau code de vérification envoyé');
        this.isResendingCode = false;
      },
      error: (error: any) => {
        this.isResendingCode = false;
        this.logger.error('NewShare - Erreur lors du renvoi du code:', error);
        this.logger.error('NewShare - Status de l\'erreur:', error?.status);
        
        // Gestion spécifique de l'erreur 429 (Too Many Requests)
        if (error?.status === 429) {
          this.logger.log('NewShare - Erreur 429 détectée lors du renvoi, affichage dans le modal existant');
          this.uploadError = 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
        } else {
          this.uploadError = 'Erreur lors du renvoi du code. Veuillez réessayer.';
        }
      }
    });
  }

  // Filtrer l'input du code de vérification (seulement les chiffres)
  onVerificationCodeInput(event: any) {
    const value = event.target.value;
    const numericValue = value.replace(/\D/g, '');
    if (numericValue !== value) {
      this.verificationCode = numericValue;
      event.target.value = numericValue;
    }
  }

  // Fermer la modal de validation d'email
  closeEmailValidationModal() {
    this.showEmailValidationModal = false;
    this.emailValidationSent = false;
    this.verificationCode = '';
    this.userEmail = '';
    this.acceptTerms = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.showSharePassword = false;
    this.loginPasswordError = '';
    this.uploadError = null; // Réinitialiser l'erreur
  }

  choosePasswordLogin(): void {
    this.loginMethod = 'password';
    this.loginPasswordError = '';
  }

  backToLoginChoice(): void {
    this.loginMethod = null;
    this.emailValidationSent = false;
    this.verificationCode = '';
    this.userPassword = '';
    this.showSharePassword = false;
    this.loginPasswordError = '';
  }

  onEmailStepSubmit(event: Event): void {
    event.preventDefault();
  }

  async loginWithPassword(): Promise<void> {
    if (!this.userEmail || !this.userPassword) return;
    
    this.isLoggingInWithPassword = true;
    this.loginPasswordError = '';
    
    try {
      await this.authService.loginWithPassword(this.userEmail, this.userPassword);
      this.isUserEmailValidated = true;
      this.showEmailValidationModal = false;
      this.checkAuthenticationStatus();
      this.showCodeValidationSuccessModal = true;
    } catch (error: any) {
      this.loginPasswordError = error?.error?.message || 'Email ou mot de passe incorrect';
    } finally {
      this.isLoggingInWithPassword = false;
    }
  }

  // Fermer la modal de succès validation de code
  closeCodeValidationSuccessModal() {
    this.showCodeValidationSuccessModal = false;
  }

  // Finaliser le partage depuis le modal de validation
  finaliserPartageFromModal() {
    this.showCodeValidationSuccessModal = false;
    this.logger.log('🚀 Finalisation du partage depuis le modal...');
    this.finaliserPartage();
  }

  // Observer les changements d'état des modals pour le focus automatique
  observeModalChanges() {
    // Observer les changements de showNoRecipientModal
    let previousShowNoRecipientModal = this.showNoRecipientModal;
    setInterval(() => {
      if (this.showNoRecipientModal && !previousShowNoRecipientModal) {
        // Modal des destinataires vient de s'ouvrir
        setTimeout(() => this.focusFirstInputInModal('recipient'), 100);
      }
      previousShowNoRecipientModal = this.showNoRecipientModal;
    }, 100);

    // Observer les changements de showEmailValidationModal
    let previousShowEmailValidationModal = this.showEmailValidationModal;
    setInterval(() => {
      if (this.showEmailValidationModal && !previousShowEmailValidationModal) {
        // Modal de validation d'email vient de s'ouvrir
        setTimeout(() => this.focusFirstInputInModal('email'), 100);
      }
      previousShowEmailValidationModal = this.showEmailValidationModal;
    }, 100);
  }

  // Focus automatique sur le premier input/textarea d'un modal
  focusFirstInputInModal(modalType: 'recipient' | 'email') {
    try {
      let elementToFocus: ElementRef | undefined;
      
      if (modalType === 'recipient') {
        elementToFocus = this.recipientTextarea;
      } else if (modalType === 'email') {
        elementToFocus = this.emailInput;
      }

      if (elementToFocus && elementToFocus.nativeElement) {
        elementToFocus.nativeElement.focus();
        this.logger.log(`Focus automatique appliqué sur le modal ${modalType}`);
      }
    } catch (error) {
      this.logger.warn(`Erreur lors du focus automatique sur le modal ${modalType}:`, error);
    }
  }

  getMaxFileSize(): string {
    return this.envService.getMaxFileSizeFormatted();
  }

  formatFileSize(bytes: number): string {
    return this.envService.formatFileSize(bytes);
  }
}
