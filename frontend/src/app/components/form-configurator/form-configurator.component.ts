import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../services/logger.service';
import { ShareTabdataService, SimulateTabdataRequest } from '../../services/share-tabdata.service';
import { ExcelService, ExcelData } from '../../services/excel.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';

@Component({
  selector: 'app-form-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-configurator.component.html',
  styleUrl: './form-configurator.component.scss'
})
export class FormConfiguratorComponent implements OnInit, OnChanges {
  constructor(
    private logger: LoggerService,
    private shareTabdataService: ShareTabdataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}
  
  // Injection du service Excel pour le chargement paginé
  private excelService = inject(ExcelService);
  private authService = inject(UnifiedAuthService);

  // 🔒 SÉCURITÉ : Interface sécurisée pour la simulation (comme form-preview)
  @Input() tempFileId: string = '';
  @Input() shareId: string = ''; // Pour les partages existants
  @Input() recipientEmail: string = '';
  @Input() selectedSheetIndex: number = 0;
  @Input() selections: { [sheetIndex: string]: { row: number, col: number }[] } = {};

  // 🔒 SÉCURITÉ : Interface legacy (dépréciée) pour compatibilité
  @Input() data: any[] = []; // ⚠️ DÉPRÉCIÉ : Utiliser tempFileId/shareId + simulation à la place
  @Input() selection: { row: number, col: number }[] = []; // ⚠️ DÉPRÉCIÉ : Utiliser selections à la place

  // Données simulées (privées)
  private simulatedData: any[] = [];
  public isSimulating = false; // Public pour l'affichage du spinner
  private lastSimulationParams: string = ''; // Pour éviter les simulations inutiles
  
  // Phase 3: Cache des pages chargées pour optimisation mémoire
  private pageCache: Map<number, any[]> = new Map();
  private formulaCellsCache: Map<number, { row: number; col: string }[]> = new Map();
  private loadedPages: Set<number> = new Set();
  private readonly PAGE_SIZE: number = 20;
  private isLoadingPage: boolean = false;
  private totalRowsFromBackend: number = 0;
  private hasMoreFromBackend: boolean = false;
  
  // Phase 3: Propriétés pour le chargement paginé depuis le backend
  @Input() totalRows?: number; // Nombre total de lignes disponibles
  @Input() hasMore?: boolean; // Indique s'il y a plus de données à charger

  @Input() columnLabels: { [colKey: string]: string } | { [sheetIndex: string]: { [colKey: string]: string } } = {};
  
  // Propriété privée pour stocker editableCells
  private _editableCells: { row: number, col: number }[] = [];
  
  // Getter pour editableCells
  get editableCells(): { row: number, col: number }[] {
    return this._editableCells;
  }
  
  // Setter pour editableCells avec surveillance
  @Input() set editableCells(value: { row: number, col: number }[]) {
    const prevColumns = new Set<number>();
    this._editableCells.forEach(cell => prevColumns.add(cell.col));
    const currColumns = new Set<number>();
    (value || []).forEach(cell => currColumns.add(cell.col));
    const prevColsArray = Array.from(prevColumns).sort((a, b) => a - b);
    const currColsArray = Array.from(currColumns).sort((a, b) => a - b);
    
    if (prevColsArray.join(',') !== currColsArray.join(',')) {
      console.log(`⚠️ ALERT 13 - Setter editableCells - Précédent: [${prevColsArray.join(', ')}] (${this._editableCells.length} cellules), Nouveau: [${currColsArray.join(', ')}] (${(value || []).length} cellules)`);
      if (currColsArray.length > 1) {
        console.log('⚠️ ALERT 13 - PROBLÈME: Plus d\'une colonne dans le setter! Stack trace:', new Error().stack);
      }
    }
    
    this._editableCells = value || [];
  }
  
  @Output() columnLabelsChange = new EventEmitter<{ [colKey: string]: string }>();
  @Output() editableCellsChange = new EventEmitter<{ row: number, col: number }[]>();
  @Output() resetColumnLabels = new EventEmitter<void>();

  /**
   * Helper pour vérifier si columnLabels est au format avec sheetIndex
   */
  private isColumnLabelsWithSheetIndex(): boolean {
    if (!this.columnLabels || typeof this.columnLabels !== 'object') {
      return false;
    }
    const sheetKey = String(this.selectedSheetIndex);
    const sheetLabels = (this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } })[sheetKey];
    return sheetLabels !== undefined && typeof sheetLabels === 'object';
  }

  /**
   * Helper pour obtenir les labels de colonnes pour la feuille actuelle
   */
  private getSheetColumnLabels(): { [colKey: string]: string } {
    const sheetKey = String(this.selectedSheetIndex);
    if (this.isColumnLabelsWithSheetIndex()) {
      return ((this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } })[sheetKey] || {});
    }
    return (this.columnLabels as { [colKey: string]: string }) || {};
  }

  // Propriétés pour la sélection de cellules éditables
  isSelecting = false;
  selectionMode: 'auto' | 'select-only' | 'deselect-only' = 'auto';
  selectionType: 'cell' | 'row' | 'column' = 'cell';
  startCell: { row: number, col: number } | null = null;
  
  // Propriété pour suivre quelle colonne est en mode édition
  editingColumnKey: string | null = null;
  editingColumnValue: string = '';
  
  // Compteur pour détecter les appels multiples
  private selectColumnCallCount: number = 0;

  // Ajout pour le mode auto : mémoriser l'état initial de la sélection
  private initialEditableCells: { row: number, col: number }[] = [];
  private lastDragRange: { start: { row: number, col: number }, end: { row: number, col: number } } | null = null;
  
  // Propriétés pour suivre la position de la souris
  private currentHoveredRow: number = -1;
  private currentHoveredCol: number = -1;

  // Propriétés pour le virtual scroll
  public itemHeight: number = 32; // Hauteur d'une ligne en pixels
  public containerHeight: number = 500; // Hauteur du conteneur visible
  public visibleItems: number = 0; // Nombre d'éléments visibles
  public scrollTop: number = 0; // Position de scroll
  public startIndex: number = 0; // Index de début des éléments visibles
  public endIndex: number = 0; // Index de fin des éléments visibles
  public virtualSelectedData: any[] = []; // Données virtuelles affichées
  
  // Cache pour selectedData pour éviter les recalculs constants
  private _selectedData: any[] = [];
  private _lastDataHash: string = '';
  private _lastSelectionHash: string = '';
  /** Cellules formules (simulateTabdata) ou cumul depuis processExcelWithSheet */
  private normalizedFormulaCells: { row: number; col: string }[] = [];

  // Propriétés pour les largeurs de colonnes
  public columnWidths: { [key: string]: number } = {};
  public minColumnWidth: number = 100; // Largeur minimale d'une colonne (plus large pour les labels)
  public maxColumnWidth: number = 350; // Largeur maximale d'une colonne
  public defaultColumnWidth: number = 150; // Largeur par défaut

  ngOnInit() {
    this.calculateVisibleItems();
    // Démarrer la simulation si les paramètres backend sont disponibles
    if ((this.tempFileId || this.shareId) && this.recipientEmail) {
      this.simulateTabdataSecure();
    }
    this.updateVirtualData();
    this.calculateColumnWidths();
  }

  ngOnChanges(changes: SimpleChanges) {
    // ALERT 10: Détection de ngOnChanges (seulement si problème détecté)
    if (changes['editableCells']) {
      const prev = changes['editableCells'].previousValue || [];
      const curr = changes['editableCells'].currentValue || [];
      const prevColumns = new Set<number>();
      prev.forEach((cell: { row: number, col: number }) => prevColumns.add(cell.col));
      const currColumns = new Set<number>();
      curr.forEach((cell: { row: number, col: number }) => currColumns.add(cell.col));
      const prevColsArray = Array.from(prevColumns).sort((a, b) => a - b);
      const currColsArray = Array.from(currColumns).sort((a, b) => a - b);
      if (currColsArray.length > 1 || (prevColsArray.length !== currColsArray.length && currColsArray.length > 0)) {
        console.log(`⚠️ ALERT 10 - ngOnChanges editableCells - PROBLÈME: Précédent: [${prevColsArray.join(', ')}] (${prev.length} cellules), Actuel: [${currColsArray.join(', ')}] (${curr.length} cellules), Changement: ${changes['editableCells'].firstChange ? 'PREMIER' : 'MISE À JOUR'}`);
      }
    }
    
    // Phase 3: Réinitialiser le cache des pages si on change de feuille ou de sélections
    if (changes['selectedSheetIndex'] || changes['selections']) {
      this.pageCache.clear();
      this.formulaCellsCache.clear();
      this.normalizedFormulaCells = [];
      this.loadedPages.clear();
      this.totalRowsFromBackend = 0;
      this.hasMoreFromBackend = false;
    }
    
    // Phase 3: Mettre à jour les métadonnées depuis les Inputs
    if (changes['totalRows']) {
      this.totalRowsFromBackend = this.totalRows || 0;
    }
    if (changes['hasMore']) {
      this.hasMoreFromBackend = this.hasMore || false;
    }
    
    // Réagir aux changements pour le mode backend
    // IMPORTANT: Ne pas déclencher la simulation lors de changements de columnLabels ou editableCells
    // car ce sont des modifications locales qui ne nécessitent pas de recharger les données
    if ((this.tempFileId || this.shareId) && this.recipientEmail) {
      if (changes['tempFileId'] || changes['shareId'] || changes['recipientEmail'] || 
          changes['selectedSheetIndex'] || changes['selections']) {
        this.simulateTabdataSecure();
      }
    }
    
    // Réagir aux changements de données pour le mode legacy
    if (changes['data'] || changes['selection'] || changes['editableCells']) {
      // Vider le cache pour forcer le recalcul
      this._selectedData = [];
      this._lastDataHash = '';
      this._lastSelectionHash = '';
      
      this.scrollTop = 0;
      this.updateVirtualData();
      
      // Initialiser les labels de colonnes et émettre les changements
      this.initializeColumnLabels();
      
      this.calculateColumnWidths();
    }
  }

  /**
   * Simule les tabdata depuis le backend (comme form-preview)
   * Phase 3: Charge maintenant seulement la première page pour optimiser la mémoire
   */
  private simulateTabdataSecure(): void {
    // Vérifier que tous les paramètres requis sont présents
    if ((!this.tempFileId && !this.shareId) || !this.recipientEmail) {
      this.simulatedData = [];
      return;
    }

    if (this.isSimulating) {
      return; // Éviter les appels multiples
    }

    // Créer une signature des paramètres pour éviter les simulations inutiles
    // IMPORTANT: Ne pas inclure columnLabels dans la signature car cela déclencherait
    // une nouvelle simulation à chaque modification d'en-tête
    const currentParams = JSON.stringify({
      tempFileId: this.tempFileId,
      shareId: this.shareId,
      recipientEmail: this.recipientEmail,
      selectedSheetIndex: this.selectedSheetIndex,
      selections: this.selections
    });

    if (this.lastSimulationParams === currentParams) {
      return; // Les paramètres n'ont pas changé, pas besoin de re-simuler
    }

    this.isSimulating = true;
    
    // Phase 3: Réinitialiser le cache des pages
    this.pageCache.clear();
    this.loadedPages.clear();
    this.totalRowsFromBackend = 0;
    this.hasMoreFromBackend = false;

    // Phase 3: Charger la première page via ExcelService pour optimiser la mémoire
    if (this.excelService && (this.tempFileId || this.shareId)) {
      // Détecter si l'utilisateur est connecté pour utiliser l'endpoint approprié
      const isPublic = !this.authService.isLoggedIn();
      
      const loadPromise = this.tempFileId 
        ? this.excelService.processExcelWithSheet(this.tempFileId, this.selectedSheetIndex, 0, this.PAGE_SIZE, isPublic)
        : this.excelService.processShareWithSheet(this.shareId!, this.selectedSheetIndex, 0, this.PAGE_SIZE, isPublic);
      
      loadPromise.subscribe({
        next: (response: ExcelData) => {
          const pageData = response.rows || [];
          const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
          this.formulaCellsCache.set(0, cells);
          
          // Appliquer le filtrage selon les sélections
          const filteredPageData = this.filterDataBySelections(pageData, 0);
          
          // Stocker dans le cache et dans simulatedData (pour compatibilité)
          this.pageCache.set(0, filteredPageData);
          this.loadedPages.add(0);
          this.simulatedData = filteredPageData; // Première page pour compatibilité
          this.totalRowsFromBackend = response.totalRows || 0;
          this.hasMoreFromBackend = response.hasMore || false;
          
          this.isSimulating = false;
          this.lastSimulationParams = currentParams;
          
          // Vider le cache pour forcer le recalcul
          this._selectedData = [];
          this._lastDataHash = '';
          this._lastSelectionHash = '';
          
          this.scrollTop = 0;
          this.updateVirtualData();
          this.initializeColumnLabels();
          this.calculateColumnWidths();
          this.changeDetectorRef.detectChanges();
        },
        error: (error) => {
          this.logger.error('Erreur lors du chargement de la première page:', error);
          
          // Si erreur 401 et qu'on utilisait l'endpoint privé, réessayer avec l'endpoint public
          if (error.status === 401 && !isPublic && this.tempFileId) {
            this.logger.log('Tentative avec l\'endpoint public après erreur 401');
            const publicLoadPromise = this.excelService.processExcelWithSheet(this.tempFileId, this.selectedSheetIndex, 0, this.PAGE_SIZE, true);
            publicLoadPromise.subscribe({
              next: (response: ExcelData) => {
                const pageData = response.rows || [];
                const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
                this.formulaCellsCache.set(0, cells);
                const filteredPageData = this.filterDataBySelections(pageData, 0);
                this.pageCache.set(0, filteredPageData);
                this.loadedPages.add(0);
                this.simulatedData = filteredPageData;
                this.totalRowsFromBackend = response.totalRows || 0;
                this.hasMoreFromBackend = response.hasMore || false;
                this.isSimulating = false;
                this.lastSimulationParams = currentParams;
                this._selectedData = [];
                this._lastDataHash = '';
                this._lastSelectionHash = '';
                this.scrollTop = 0;
                this.updateVirtualData();
                this.initializeColumnLabels();
                this.calculateColumnWidths();
                this.changeDetectorRef.detectChanges();
              },
              error: (publicError: any) => {
                this.logger.error('Erreur avec l\'endpoint public:', publicError);
                // Fallback vers l'ancienne méthode si le chargement paginé échoue
                this.simulateTabdataLegacy(currentParams);
              }
            });
          } else {
            // Fallback vers l'ancienne méthode si le chargement paginé échoue
            this.simulateTabdataLegacy(currentParams);
          }
        }
      });
    } else {
      // Fallback vers l'ancienne méthode si ExcelService n'est pas disponible
      this.simulateTabdataLegacy(currentParams);
    }
  }
  
  /**
   * Méthode legacy pour simuler les tabdata (chargement complet)
   */
  private simulateTabdataLegacy(currentParams: string): void {
    // Construire la requête de simulation
    const request: SimulateTabdataRequest = {
      tempFileId: this.tempFileId || '',
      shareId: this.shareId || '',
      recipientEmail: this.recipientEmail,
      selectedSheetIndex: this.selectedSheetIndex,
      selections: this.selections,
      editableCells: {}, // Form-configurator n'a besoin que des sélections pour l'affichage
      columnLabels: this.getColumnLabelsForSimulation()
    };

    // Appeler le service de simulation
    this.shareTabdataService.simulateTabdata(request).subscribe({
      next: (simulatedData) => {
        // Extraire les données du tableau depuis la réponse
        let tableData: any[] = [];
        if (simulatedData && simulatedData.rows) {
          tableData = simulatedData.rows;
        } else if (Array.isArray(simulatedData)) {
          tableData = simulatedData;
        }
        
        // 🔧 CORRECTION : Mettre à jour columnLabels avec les index convertis depuis la réponse
        if (simulatedData && (simulatedData as any).tableDataFormulaCells && Array.isArray((simulatedData as any).tableDataFormulaCells)) {
          this.normalizedFormulaCells = (simulatedData as any).tableDataFormulaCells.map((cell: any) => ({
            row: cell.row ?? 0,
            col: cell.col ?? ''
          }));
        } else {
          this.normalizedFormulaCells = [];
        }
        
        if (simulatedData && simulatedData.columnLabels) {
          const sheetKey = String(this.selectedSheetIndex);
          const responseLabels = simulatedData.columnLabels[sheetKey];
          if (responseLabels) {
            // Mettre à jour columnLabels avec les nouveaux index (column-0, column-1, etc.)
            if (this.isColumnLabelsWithSheetIndex()) {
              const typedLabels = this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } };
              typedLabels[sheetKey] = { ...typedLabels[sheetKey], ...responseLabels };
            } else {
              // Convertir au format avec sheetIndex
              this.columnLabels = {
                [sheetKey]: { ...(this.columnLabels as { [colKey: string]: string } || {}), ...responseLabels }
              };
            }
            this.columnLabelsChange.emit(responseLabels);
            this.logger.log('✅ ColumnLabels mis à jour depuis la réponse avec les nouveaux index:', responseLabels);
          }
        }
        
        this.simulatedData = tableData;
        this.isSimulating = false;
        this.lastSimulationParams = currentParams;
        
        // Vider le cache pour forcer le recalcul
        this._selectedData = [];
        this._lastDataHash = '';
        this._lastSelectionHash = '';
        
        this.scrollTop = 0;
        this.updateVirtualData();
        this.initializeColumnLabels();
        this.calculateColumnWidths();
        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        this.simulatedData = [];
        this.isSimulating = false;
        this.lastSimulationParams = ''; // Réinitialiser pour permettre une nouvelle tentative
        this._selectedData = [];
        this.updateVirtualData();
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  /**
   * Convertit columnLabels au format attendu par la simulation
   * 🔧 CORRECTION : Convertit les index des colonnes du fichier Excel original (column-2, column-3, etc.)
   * vers les index du tableData filtré (column-0, column-1, etc.)
   */
  private getColumnLabelsForSimulation(): { [sheetIndex: string]: { [colKey: string]: string } } {
    if (!this.columnLabels || typeof this.columnLabels !== 'object') {
      return {};
    }

    const sheetKey = String(this.selectedSheetIndex);
    let originalLabels: { [colKey: string]: string } = {};

    // Récupérer les labels originaux
    if (this.isColumnLabelsWithSheetIndex()) {
      const typedLabels = this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } };
      originalLabels = typedLabels[sheetKey] || {};
    } else {
      originalLabels = this.columnLabels as { [colKey: string]: string };
    }

    if (Object.keys(originalLabels).length === 0) {
      return { [sheetKey]: {} };
    }

    // 🔧 CORRECTION : Extraire les colonnes uniques sélectionnées depuis selections
    const sheetSelections = this.selections[sheetKey] || [];
    const selectedColumns = new Set<number>();
    sheetSelections.forEach(cell => {
      selectedColumns.add(cell.col);
    });

    // Trier les colonnes sélectionnées
    const sortedSelectedColumns = Array.from(selectedColumns).sort((a, b) => a - b);

    // Créer le mapping : index original -> nouvel index (0, 1, 2, ...)
    const columnMapping: { [originalCol: number]: number } = {};
    sortedSelectedColumns.forEach((originalCol, newIndex) => {
      columnMapping[originalCol] = newIndex;
    });

    // Convertir les columnLabels en utilisant le mapping
    const convertedLabels: { [colKey: string]: string } = {};
    Object.keys(originalLabels).forEach(originalColKey => {
      if (originalColKey.startsWith('column-')) {
        const originalColIndex = parseInt(originalColKey.replace('column-', ''));
        if (columnMapping.hasOwnProperty(originalColIndex)) {
          const newColIndex = columnMapping[originalColIndex];
          const newColKey = `column-${newColIndex}`;
          convertedLabels[newColKey] = originalLabels[originalColKey];
          this.logger.log(`🔧 Conversion columnLabels pour simulation: ${originalColKey} -> ${newColKey} (label: ${originalLabels[originalColKey]})`);
        }
      }
    });

    this.logger.log(`✅ ColumnLabels convertis pour simulation: ${Object.keys(convertedLabels).length} labels`, convertedLabels);
    return { [sheetKey]: convertedLabels };
  }

  /**
   * Getter pour les données (utilise la simulation ou les données legacy)
   */
  get displayData(): any[] {
    // Mode sécurisé : utiliser les données simulées
    if ((this.tempFileId || this.shareId) && this.recipientEmail) {
      return this.simulatedData;
    }
    
    // Mode legacy : utiliser les données passées directement
    return this.data || [];
  }
  

  // Méthodes pour le virtual scroll
  calculateVisibleItems() {
    this.visibleItems = Math.ceil(this.containerHeight / this.itemHeight) + 2; // +2 lignes de buffer seulement
  }

  updateVirtualData() {
    // Phase 3: Utiliser la méthode avec pagination si on a accès au backend
    if (this.excelService && (this.tempFileId || this.shareId)) {
      this.updateVirtualDataWithPages();
    } else {
      // Mode classique sans pagination
      if (!this.selectedData || this.selectedData.length === 0) {
        this.virtualSelectedData = [];
        this.startIndex = 0;
        this.endIndex = 0;
        return;
      }

      // Calculer les lignes visibles sans buffer
      const visibleRows = Math.ceil(this.containerHeight / this.itemHeight);
      
      // Calculer l'index de début avec un buffer minimal
      this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - 1);
      
      // Calculer l'index de fin avec seulement 2 lignes de buffer
      this.endIndex = Math.min(this.startIndex + visibleRows + 2, this.selectedData.length);
      
      // Ajuster l'index de début si on dépasse la fin
      if (this.endIndex - this.startIndex < visibleRows + 2 && this.startIndex > 0) {
        this.startIndex = Math.max(0, this.endIndex - visibleRows - 2);
      }
      
      this.virtualSelectedData = this.selectedData.slice(this.startIndex, this.endIndex);
    }
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    this.scrollTop = target.scrollTop;
    this.updateVirtualData();
    
    // Phase 3: Charger les pages suivantes si nécessaire
    this.loadNextPageIfNeeded(target);
  }
  
  /**
   * Phase 3: Charge la page suivante si on approche de la fin des données visibles
   */
  private loadNextPageIfNeeded(container: HTMLElement): void {
    if (!this.excelService || this.isLoadingPage) {
      return;
    }
    
    // Calculer si on approche de la fin (80% du scroll)
    const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight);
    
    // Si on a des sélections, déterminer quelles pages brutes charger
    if (this.selections && Object.keys(this.selections).length > 0) {
      const sheetKey = String(this.selectedSheetIndex);
      const sheetSelections = this.selections[sheetKey] || [];
      
      if (sheetSelections.length > 0) {
        // Créer un tableau trié des lignes brutes uniques
        const uniqueRows = Array.from(new Set(sheetSelections.map(cell => cell.row))).sort((a, b) => a - b);
        
        // Déterminer quelles lignes filtrées sont visibles
        const visibleFilteredStart = this.startIndex;
        const visibleFilteredEnd = this.endIndex;
        
        // Trouver les lignes brutes correspondantes
        const visibleRawRows = uniqueRows.slice(visibleFilteredStart, visibleFilteredEnd);
        
        if (visibleRawRows.length > 0) {
          // Trouver la page brute maximale nécessaire
          const maxRawRow = Math.max(...visibleRawRows);
          const maxPage = Math.floor(maxRawRow / this.PAGE_SIZE);
          
          // Charger les pages nécessaires
          for (let page = 0; page <= maxPage + 1; page++) {
            if (!this.loadedPages.has(page) && (this.hasMoreFromBackend || this.hasMore || page <= maxPage)) {
              if (scrollPercentage > 0.5) {
                this.loadPage(page);
              }
            }
          }
        }
      }
    } else {
      // Mode sans filtrage : charger les pages brutes directement
      const currentPage = Math.floor(this.endIndex / this.PAGE_SIZE);
      const nextPage = currentPage + 1;
      
      // Si on est à 80% du scroll et qu'il y a plus de données, charger la page suivante
      if (scrollPercentage > 0.8 && !this.loadedPages.has(nextPage) && (this.hasMoreFromBackend || this.hasMore)) {
        this.loadPage(nextPage);
      }
      
      // Prefetching - charger la page suivante si on est à 50% du scroll
      if (scrollPercentage > 0.5 && !this.loadedPages.has(nextPage + 1) && (this.hasMoreFromBackend || this.hasMore)) {
        setTimeout(() => this.loadPage(nextPage + 1), 100);
      }
    }
  }
  
  /**
   * Phase 3: Charge une page spécifique depuis le backend et applique le filtrage
   */
  private loadPage(page: number): void {
    if (!this.excelService || this.isLoadingPage || this.loadedPages.has(page)) {
      return;
    }
    
    this.isLoadingPage = true;
    const sheetIndex = this.selectedSheetIndex;
    
    // Détecter si l'utilisateur est connecté pour utiliser l'endpoint approprié
    const isPublic = !this.authService.isLoggedIn();
    
    const loadPromise = this.tempFileId 
      ? this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, page, this.PAGE_SIZE, isPublic)
      : this.shareId 
        ? this.excelService.processShareWithSheet(this.shareId, sheetIndex, page, this.PAGE_SIZE, isPublic)
        : null;
    
    if (!loadPromise) {
      this.isLoadingPage = false;
      return;
    }
    
    loadPromise.subscribe({
      next: (response: ExcelData) => {
        const pageData = response.rows || [];
        const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
        this.formulaCellsCache.set(page, cells);
        
        // Appliquer le filtrage selon les sélections
        const filteredPageData = this.filterDataBySelections(pageData, page);
        
        this.pageCache.set(page, filteredPageData);
        this.loadedPages.add(page);
        this.totalRowsFromBackend = response.totalRows || 0;
        this.hasMoreFromBackend = response.hasMore || false;
        
        this.isLoadingPage = false;
        this.updateVirtualData();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: any) => {
        this.logger.error(`Erreur lors du chargement de la page ${page}:`, error);
        
        // Si erreur 401 et qu'on utilisait l'endpoint privé, réessayer avec l'endpoint public
        if (error.status === 401 && !isPublic && this.tempFileId) {
          this.logger.log('Tentative avec l\'endpoint public après erreur 401');
          this.loadPagePublic(page);
        } else {
          this.isLoadingPage = false;
        }
      }
    });
  }
  
  /**
   * Charge une page en utilisant l'endpoint public (pour utilisateurs non connectés)
   */
  private loadPagePublic(page: number): void {
    if (!this.excelService || this.isLoadingPage || this.loadedPages.has(page)) {
      return;
    }
    
    const sheetIndex = this.selectedSheetIndex;
    
    const loadPromise = this.tempFileId 
      ? this.excelService.processExcelWithSheet(this.tempFileId, sheetIndex, page, this.PAGE_SIZE, true)
      : null;
    
    if (!loadPromise) {
      this.isLoadingPage = false;
      return;
    }
    
    loadPromise.subscribe({
      next: (response: ExcelData) => {
        const pageData = response.rows || [];
        const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
        this.formulaCellsCache.set(page, cells);
        
        // Appliquer le filtrage selon les sélections
        const filteredPageData = this.filterDataBySelections(pageData, page);
        
        this.pageCache.set(page, filteredPageData);
        this.loadedPages.add(page);
        this.totalRowsFromBackend = response.totalRows || 0;
        this.hasMoreFromBackend = response.hasMore || false;
        
        this.isLoadingPage = false;
        this.updateVirtualData();
        this.changeDetectorRef.detectChanges();
      },
      error: (error: any) => {
        this.logger.error(`Erreur lors du chargement de la page ${page} (endpoint public):`, error);
        this.isLoadingPage = false;
      }
    });
  }
  
  /**
   * Filtre les données d'une page selon les sélections
   */
  private filterDataBySelections(pageData: any[], page: number): any[] {
    if (!this.selections || Object.keys(this.selections).length === 0) {
      return pageData;
    }
    
    const sheetKey = String(this.selectedSheetIndex);
    const sheetSelections = this.selections[sheetKey] || [];
    
    if (sheetSelections.length === 0) {
      return [];
    }
    
    // Créer une map des cellules sélectionnées pour cette page
    const pageStartRow = page * this.PAGE_SIZE;
    const cellMap = new Map<number, Set<number>>();
    
    sheetSelections.forEach(cell => {
      // Vérifier si la cellule appartient à cette page
      if (cell.row >= pageStartRow && cell.row < pageStartRow + this.PAGE_SIZE) {
        const localRowIndex = cell.row - pageStartRow;
        if (!cellMap.has(localRowIndex)) {
          cellMap.set(localRowIndex, new Set<number>());
        }
        cellMap.get(localRowIndex)!.add(cell.col);
      }
    });
    
    // Filtrer les lignes de la page
    const result: any[] = [];
    pageData.forEach((row, localIndex) => {
      if (cellMap.has(localIndex)) {
        const filteredRow: any = {};
        const selectedCols = cellMap.get(localIndex)!;
        
        // Extraire seulement les colonnes sélectionnées
        selectedCols.forEach(colIndex => {
          const colKey = `column-${colIndex}`;
          if (row[colKey] !== undefined) {
            filteredRow[colKey] = row[colKey];
          }
        });
        
        if (Object.keys(filteredRow).length > 0) {
          // Ajouter les métadonnées pour la cohérence
          filteredRow.__originalRowIndex = pageStartRow + localIndex;
          result.push(filteredRow);
        }
      }
    });
    
    return result;
  }
  
  /**
   * Phase 3: Met à jour les données virtuelles en incluant les pages chargées
   */
  private updateVirtualDataWithPages(): void {
    const selectedData = this.selectedData;
    if (!selectedData || selectedData.length === 0) {
      this.virtualSelectedData = [];
      this.startIndex = 0;
      this.endIndex = 0;
      return;
    }

    const visibleRows = Math.ceil(this.containerHeight / this.itemHeight);
    this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - 1);
    this.endIndex = Math.min(this.startIndex + visibleRows + 2, this.getTotalAvailableRows());
    
    if (this.endIndex - this.startIndex < visibleRows + 2 && this.startIndex > 0) {
      this.startIndex = Math.max(0, this.endIndex - visibleRows - 2);
    }
    
    // Construire les données virtuelles en incluant les pages en cache
    this.virtualSelectedData = this.buildVirtualDataFromPages(this.startIndex, this.endIndex);
  }
  
  /**
   * Phase 3: Construit les données virtuelles à partir des pages en cache
   * Les indices start et end sont basés sur les lignes filtrées (après sélection)
   */
  private buildVirtualDataFromPages(start: number, end: number): any[] {
    const selectedData = this.selectedData;
    const result: any[] = [];
    
    // Si on a des sélections, construire les données filtrées
    if (this.selections && Object.keys(this.selections).length > 0) {
      const sheetKey = String(this.selectedSheetIndex);
      const sheetSelections = this.selections[sheetKey] || [];
      
      if (sheetSelections.length > 0) {
        // Créer un tableau trié des lignes brutes uniques qui ont des sélections
        const uniqueRows = Array.from(new Set(sheetSelections.map(cell => cell.row))).sort((a, b) => a - b);
        
        // Récupérer seulement les lignes dans la plage demandée
        const rowsInRange = uniqueRows.slice(start, end);
        
        // Pour chaque ligne brute dans la plage, trouver les données dans le cache
        rowsInRange.forEach(rawRowIndex => {
          const page = Math.floor(rawRowIndex / this.PAGE_SIZE);
          const pageData = this.pageCache.get(page);
          
          if (pageData) {
            // Trouver la ligne dans les données filtrées de la page
            const rowInPage = pageData.find(row => {
              if (row.__originalRowIndex !== undefined) {
                return row.__originalRowIndex === rawRowIndex;
              }
              // Si pas de __originalRowIndex, utiliser l'index local
              const localRowIndex = rawRowIndex - (page * this.PAGE_SIZE);
              return localRowIndex >= 0 && localRowIndex < pageData.length;
            });
            
            if (rowInPage) {
              result.push(rowInPage);
            }
          } else if (page === 0 && selectedData.length > 0) {
            // Pour la première page, utiliser selectedData si pas en cache
            const indexInUniqueRows = uniqueRows.indexOf(rawRowIndex);
            if (indexInUniqueRows >= 0 && indexInUniqueRows < selectedData.length) {
              const rowInSelectedData = selectedData[indexInUniqueRows];
              if (rowInSelectedData) {
                result.push(rowInSelectedData);
              }
            }
          } else {
            // Page non chargée : déclencher le chargement
            if (!this.isLoadingPage && !this.loadedPages.has(page)) {
              this.loadPage(page);
            }
          }
        });
      }
    } else {
      // Mode sans filtrage : utiliser les pages en cache directement
      const sortedPages = Array.from(this.loadedPages).sort((a, b) => a - b);
      let currentIndex = 0;
      
      for (const page of sortedPages) {
        const pageData = this.pageCache.get(page);
        if (pageData) {
          const pageStart = currentIndex;
          const pageEnd = currentIndex + pageData.length;
          
          // Vérifier si cette page intersecte avec la plage demandée
          if (pageEnd > start && pageStart < end) {
            const sliceStart = Math.max(0, start - pageStart);
            const sliceEnd = Math.min(pageData.length, end - pageStart);
            result.push(...pageData.slice(sliceStart, sliceEnd));
          }
          
          currentIndex = pageEnd;
        }
      }
      
      // Ajouter les données de selectedData si elles ne sont pas déjà dans le cache
      if (selectedData.length > 0 && !this.loadedPages.has(0)) {
        if (start < selectedData.length) {
          result.unshift(...selectedData.slice(start, Math.min(end, selectedData.length)));
        }
      }
    }
    
    return result;
  }
  
  /**
   * Phase 3: Obtient le nombre total de lignes disponibles (filtrées)
   */
  private getTotalAvailableRows(): number {
    // Si on a des sélections, calculer le nombre de lignes uniques sélectionnées
    if (this.selections && Object.keys(this.selections).length > 0) {
      const sheetKey = String(this.selectedSheetIndex);
      const sheetSelections = this.selections[sheetKey] || [];
      if (sheetSelections.length > 0) {
        // Compter les lignes uniques dans les sélections
        const uniqueRows = new Set<number>();
        sheetSelections.forEach(cell => {
          uniqueRows.add(cell.row);
        });
        return uniqueRows.size;
      }
    }
    
    // Sinon, utiliser le nombre total de lignes brutes du backend
    if (this.totalRowsFromBackend > 0) {
      return this.totalRowsFromBackend;
    }
    if (this.totalRows) {
      return this.totalRows;
    }
    return this.selectedData.length;
  }

  // Propriétés calculées pour le virtual scroll
  get totalHeight(): number {
    // Phase 3: Utiliser le nombre total de lignes disponibles avec pagination
    if (this.excelService && (this.tempFileId || this.shareId)) {
      return this.getTotalAvailableRows() * this.itemHeight;
    }
    return this.selectedData ? this.selectedData.length * this.itemHeight : 0;
  }

  get offsetY(): number {
    return this.startIndex * this.itemHeight;
  }

  // Méthode pour calculer les largeurs des colonnes
  calculateColumnWidths() {
    if (!this.selectedData || this.selectedData.length === 0) {
      this.columnWidths = {};
      return;
    }

    this.columnWidths = {};
    const columnKeys = this.selectedColumns;

    // Calculer la largeur pour chaque colonne
    columnKeys.forEach(columnKey => {
      let maxWidth = this.minColumnWidth;
      
      // Vérifier le label de colonne (s'il existe)
      const columnLabel = this.getColumnLabel(columnKey);
      if (columnLabel) {
        const labelWidth = this.estimateTextWidth(columnLabel) + 40; // +40 pour les boutons
        maxWidth = Math.max(maxWidth, labelWidth);
      }

      // Vérifier le contenu des cellules
      const sampleSize = Math.min(50, this.selectedData.length); // Limiter à 50 lignes pour les performances
      for (let i = 0; i < sampleSize; i++) {
        const cellValue = this.selectedData[i][columnKey];
        if (cellValue !== null && cellValue !== undefined) {
          const cellText = String(cellValue);
          const cellWidth = this.estimateTextWidth(cellText) + 30; // +30 pour le padding et l'icône
          maxWidth = Math.max(maxWidth, cellWidth);
        }
      }

      // Appliquer les limites min/max
      maxWidth = Math.max(this.minColumnWidth, Math.min(this.maxColumnWidth, maxWidth));
      this.columnWidths[columnKey] = maxWidth;
    });
  }

  // Méthode pour estimer la largeur du texte
  private estimateTextWidth(text: string): number {
    if (!text) return 0;
    
    // Estimation basée sur la longueur du texte
    // Environ 8px par caractère pour la plupart des polices
    const baseWidth = text.length * 8;
    
    // Ajustement pour les caractères spéciaux
    const specialChars = (text.match(/[À-ÿ]/g) || []).length;
    const adjustment = specialChars * 2; // Les caractères accentués sont plus larges
    
    return baseWidth + adjustment;
  }

  // Méthode pour obtenir la largeur d'une colonne
  getColumnWidth(columnKey: string): number {
    return this.columnWidths[columnKey] || this.defaultColumnWidth;
  }

  /**
   * Vérifie si une cellule contient une formule (valeur calculée)
   * @param globalRowIndex Index global de la ligne (startIndex + rowIndex dans le template)
   * @param columnKey Clé de la colonne (ex: "column-0")
   */
  isFormulaCell(globalRowIndex: number, columnKey: string): boolean {
    if (this.normalizedFormulaCells.length > 0) {
      return this.normalizedFormulaCells.some(c => c.row === globalRowIndex && c.col === columnKey);
    }
    const cached = this.getFormulaCellsForRow(globalRowIndex);
    if (cached && cached.length > 0) {
      return cached.some(c => c.col === columnKey);
    }
    return false;
  }

  private getFormulaCellsForRow(globalRowIndex: number): { row: number; col: string }[] | null {
    if (this.selections && Object.keys(this.selections).length > 0) {
      const sheetKey = String(this.selectedSheetIndex);
      const sheetSelections = this.selections[sheetKey] || [];
      const uniqueRows = Array.from(new Set(sheetSelections.map(c => c.row))).sort((a, b) => a - b);
      if (globalRowIndex >= uniqueRows.length) return null;
      const rawRowIndex = uniqueRows[globalRowIndex];
      const page = Math.floor(rawRowIndex / this.PAGE_SIZE);
      const rowInPage = rawRowIndex - page * this.PAGE_SIZE;
      const cells = this.formulaCellsCache.get(page);
      if (!cells) return null;
      return cells.filter(c => c.row === rowInPage);
    }
    const page = Math.floor(globalRowIndex / this.PAGE_SIZE);
    const rowInPage = globalRowIndex - page * this.PAGE_SIZE;
    const cells = this.formulaCellsCache.get(page);
    if (!cells) return null;
    return cells.filter(c => c.row === rowInPage);
  }

  /**
   * Vérifie si une cellule à des coordonnées absolues (row, col) contient une formule
   */
  private isFormulaCellByAbsoluteCoords(row: number, col: number): boolean {
    if (this.normalizedFormulaCells.length > 0) {
      const sheetKey = String(this.selectedSheetIndex);
      const sheetSelections = (this.selections as Record<string, { row: number; col: number }[]>)?.[sheetKey] || [];
      const uniqueRows = Array.from(new Set(sheetSelections.map(c => c.row))).sort((a, b) => a - b);
      const sortedCols = Array.from(new Set(sheetSelections.map(c => c.col))).sort((a, b) => a - b);
      const displayRowIndex = uniqueRows.indexOf(row);
      const displayColIndex = sortedCols.indexOf(col);
      if (displayRowIndex >= 0 && displayColIndex >= 0) {
        const colKey = `column-${displayColIndex}`;
        return this.normalizedFormulaCells.some(c => c.row === displayRowIndex && c.col === colKey);
      }
      return false;
    }
    const colKey = `column-${col}`;
    const page = Math.floor(row / this.PAGE_SIZE);
    const rowInPage = row - page * this.PAGE_SIZE;
    const cells = this.formulaCellsCache.get(page);
    if (!cells) return false;
    return cells.some(c => c.row === rowInPage && c.col === colKey);
  }

  /**
   * Émet la nouvelle liste de cellules éditables (confirmation désactivée lors de la sélection)
   */
  private emitEditableCellsIfConfirmed(newCells: { row: number; col: number }[]): void {
    this.editableCellsChange.emit(newCells);
  }

  /**
   * Nombre de cellules formules dans la sélection actuelle (editables)
   */
  get formulaCellsCountInEditableSelection(): number {
    if (!this.editableCells || this.editableCells.length === 0) return 0;
    return this.editableCells.filter(c => this.isFormulaCellByAbsoluteCoords(c.row, c.col)).length;
  }

  // Méthode pour calculer la largeur totale du tableau
  getTotalTableWidth(): number {
    if (!this.selectedData || this.selectedData.length === 0) {
      return 1000; // Largeur par défaut
    }

    let totalWidth = 70; // Largeur de la colonne des numéros de ligne
    
    this.selectedColumns.forEach(columnKey => {
      totalWidth += this.getColumnWidth(columnKey);
    });

    return totalWidth;
  }

  get columns(): string[] {
    const dataToUse = this.displayData;
    if (dataToUse.length === 0) return [];
    
    // Utiliser une approche basée sur les indices pour garantir l'ordre
    const firstRow = dataToUse[0];
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
    
    return columnKeys;
  }

  get selectedData(): any[] {
    const dataToUse = this.displayData;
    
    // Créer des hash simples pour détecter les changements
    const dataHash = JSON.stringify(dataToUse?.slice(0, 5) || []); // Seulement les 5 premières lignes pour les performances
    // Pour le mode backend, utiliser selections au lieu de selection
    const selectionHash = (this.tempFileId || this.shareId) 
      ? JSON.stringify(this.selections || {})
      : JSON.stringify(this.selection || []);
    
    // Si les données n'ont pas changé, retourner le cache
    if (this._lastDataHash === dataHash && this._lastSelectionHash === selectionHash) {
      return this._selectedData;
    }
    
    // Recalculer seulement si nécessaire
    this._lastDataHash = dataHash;
    this._lastSelectionHash = selectionHash;
        this._selectedData = this.calculateSelectedData(dataToUse);
    
    return this._selectedData;
  }
  
  private calculateSelectedData(dataToUse: any[]): any[] {
    // Les données du backend sont déjà filtrées selon les sélections, les utiliser directement
    if (dataToUse && dataToUse.length > 0) {
      // Si c'est le mode backend, les données sont déjà filtrées
      if ((this.tempFileId || this.shareId) && this.recipientEmail) {
        return dataToUse;
      }
      // Si les données contiennent __originalRowIndex, elles sont déjà filtrées
      if (dataToUse[0].hasOwnProperty('__originalRowIndex')) {
        return dataToUse;
      }
    }
    
    // Sinon, utiliser l'ancienne logique pour les données non filtrées (mode legacy)
    if (!this.selection || this.selection.length === 0) return [];
    const cellMap = new Map<number, Set<number>>();
    for (const cell of this.selection) {
      if (!cellMap.has(cell.row)) {
        cellMap.set(cell.row, new Set<number>());
      }
      cellMap.get(cell.row)!.add(cell.col);
    }
    const result: any[] = [];
    for (let rowIndex = 0; rowIndex < dataToUse.length; rowIndex++) {
      if (cellMap.has(rowIndex)) {
        const filteredRow: any = {};
        for (const colIndex of cellMap.get(rowIndex)!) {
          const colKey = this.columns[colIndex];
          if (colKey) {
            filteredRow[colKey] = dataToUse[rowIndex][colKey];
          }
        }
        result.push(filteredRow);
      }
    }
    return result;
  }

  get selectedColumns(): string[] {
    const dataToUse = this.displayData;
    
    // Mode backend : extraire les colonnes directement des données filtrées par le serveur
    if (dataToUse && dataToUse.length > 0) {
      // Si les données ont __columnOrder, l'utiliser (format avec métadonnées)
      if (dataToUse[0].__columnOrder) {
        return dataToUse[0].__columnOrder;
      }
      
      // Sinon, extraire les colonnes directement depuis les clés des lignes
      const columns = new Set<string>();
      dataToUse.forEach(row => {
        Object.keys(row).forEach(key => {
          // Inclure toutes les colonnes (column-0, column-1, etc.) et exclure les métadonnées
          if (key.startsWith('column-') || (!key.startsWith('__') && !key.startsWith('_rowIndex') && !key.startsWith('column_'))) {
            columns.add(key);
          }
        });
      });
      
      // Trier les colonnes par ordre numérique (column-0, column-1, column-2, etc.)
      const sortedColumns = Array.from(columns).sort((a, b) => {
        // Extraire les numéros des colonnes pour le tri
        const aMatch = a.match(/column-(\d+)/);
        const bMatch = b.match(/column-(\d+)/);
        if (aMatch && bMatch) {
          return parseInt(aMatch[1]) - parseInt(bMatch[1]);
        }
        // Si pas de match, garder l'ordre alphabétique
        return a.localeCompare(b);
      });
      
      return sortedColumns;
    }
    
    // Mode legacy : utiliser l'ancienne logique pour les données non filtrées
    if (!this.selection || this.selection.length === 0) {
      return [];
    }
    
    const seen = new Set<string>();
    const colIndexMap = new Map<string, number>();
    
    // Collecter toutes les colonnes sélectionnées avec leur index
    for (const cell of this.selection) {
      const colKey = this.columns[cell.col];
      if (colKey && !seen.has(colKey)) {
        seen.add(colKey);
        colIndexMap.set(colKey, cell.col);
      }
    }
    
    // Trier par index de colonne pour respecter l'ordre du fichier
    return Array.from(colIndexMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(entry => entry[0]);
  }

  getColumnLabel(colKey: string): string {
    // Gérer le format avec sheetIndex
    const sheetLabels = this.getSheetColumnLabels();
    if (sheetLabels[colKey] !== undefined) {
      return sheetLabels[colKey];
    }
    
    // Initialiser le label localement sans émettre d'événements
    let label = colKey; // Valeur par défaut
    
    const dataToUse = this.displayData;
    if (dataToUse && dataToUse.length > 0) {
      const firstRow = dataToUse[0];
      
      // Si les données sont filtrées, utiliser les valeurs d'en-tête transmises
      if (firstRow.hasOwnProperty('__originalRowIndex')) {
        if (firstRow.__headerValues) {
          const columnOrder = firstRow.__columnOrder || [];
          const columnIndex = columnOrder.indexOf(colKey);
          if (columnIndex >= 0 && firstRow.__headerValues[columnIndex]) {
            label = firstRow.__headerValues[columnIndex];
          }
        } else if (firstRow[colKey] !== undefined && firstRow[colKey] !== null && firstRow[colKey] !== '') {
          label = String(firstRow[colKey]);
        }
      } else if (firstRow[colKey] !== undefined && firstRow[colKey] !== null && firstRow[colKey] !== '') {
        label = String(firstRow[colKey]);
      }
    }
    
    // Mettre à jour le cache local sans émettre d'événements
    if (!this.columnLabels) {
      this.columnLabels = {};
    }
    // Garder la compatibilité avec les deux formats
    const sheetKey = String(this.selectedSheetIndex);
    if (this.isColumnLabelsWithSheetIndex()) {
      const typedLabels = this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } };
      if (!typedLabels[sheetKey]) {
        typedLabels[sheetKey] = {};
      }
      typedLabels[sheetKey][colKey] = label;
    } else {
      // Format legacy
      (this.columnLabels as { [colKey: string]: string })[colKey] = label;
    }
    
    return label;
  }

  // Méthodes pour l'édition inline des en-têtes
  startEditingColumn(colKey: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.editingColumnKey = colKey;
    this.editingColumnValue = this.getColumnLabel(colKey);
    // Focus automatique sur l'input après un court délai pour permettre le rendu Angular
    setTimeout(() => {
      // Trouver l'input dans le DOM en utilisant la colonne en édition
      const inputs = document.querySelectorAll('input.form-control-sm.text-center.mb-1');
      inputs.forEach((input: Element) => {
        const htmlInput = input as HTMLInputElement;
        // Vérifier si c'est l'input de la colonne en édition
        if (htmlInput.value === this.editingColumnValue) {
          htmlInput.focus();
          htmlInput.select();
        }
      });
    }, 50);
  }

  stopEditingColumn(save: boolean = true) {
    if (this.editingColumnKey && save) {
      this.onColumnLabelChange(this.editingColumnKey, this.editingColumnValue);
    }
    this.editingColumnKey = null;
    this.editingColumnValue = '';
  }

  onColumnLabelEditKeydown(event: KeyboardEvent, colKey: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.stopEditingColumn(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.stopEditingColumn(false);
    }
  }

  onColumnLabelChange(colKey: string, value: string) {
    // Gérer les deux formats de columnLabels
    const sheetKey = String(this.selectedSheetIndex);
    let sheetLabels: { [colKey: string]: string };
    
    if (this.isColumnLabelsWithSheetIndex()) {
      // Format avec sheetIndex
      const typedLabels = this.columnLabels as { [sheetIndex: string]: { [colKey: string]: string } };
      sheetLabels = {
        ...(typedLabels[sheetKey] || {}),
        [colKey]: value
      };
    } else {
      // Format legacy simple
      const legacyLabels = this.columnLabels as { [colKey: string]: string };
      sheetLabels = {
        ...(legacyLabels || {}),
        [colKey]: value
      };
    }
    
    // Émettre au format attendu par le parent (format simple colKey -> label pour compatibilité)
    this.columnLabelsChange.emit(sheetLabels);
  }
  
  private initializeColumnLabels() {
    const dataToUse = this.displayData;
    if (!dataToUse || dataToUse.length === 0) {
      return;
    }
    
    const firstRow = dataToUse[0];
    const columnKeys = this.selectedColumns;
    
    // Initialiser les labels manquants
    let newLabels: { [colKey: string]: string } = {};
    
    // Gérer le format avec sheetIndex
    const sheetLabels = this.getSheetColumnLabels();
    newLabels = { ...sheetLabels };
    
    let hasChanges = false;
    
    for (const colKey of columnKeys) {
      if (newLabels[colKey] === undefined) {
        let label = colKey; // Valeur par défaut
        
        // Si les données sont filtrées, utiliser les valeurs d'en-tête transmises
        if (firstRow.hasOwnProperty('__originalRowIndex')) {
          if (firstRow.__headerValues) {
            const columnOrder = firstRow.__columnOrder || [];
            const columnIndex = columnOrder.indexOf(colKey);
            if (columnIndex >= 0 && firstRow.__headerValues[columnIndex]) {
              label = firstRow.__headerValues[columnIndex];
            }
          } else if (firstRow[colKey] !== undefined && firstRow[colKey] !== null && firstRow[colKey] !== '') {
            label = String(firstRow[colKey]);
          }
        } else if (firstRow[colKey] !== undefined && firstRow[colKey] !== null && firstRow[colKey] !== '') {
          label = String(firstRow[colKey]);
        }
        
        newLabels[colKey] = label;
        hasChanges = true;
      }
    }
    
    // Émettre les changements seulement s'il y en a
    if (hasChanges) {
      // Emettre au format attendu par le parent (format simple colKey -> label pour compatibilité)
      this.columnLabelsChange.emit(newLabels);
    }
  }

  // Méthodes pour la sélection de cellules éditables
  /**
   * Gère le clic sur le bouton de réinitialisation des en-têtes
   */
  onResetColumnLabels(): void {
    this.logger.log('🔄 Réinitialisation des en-têtes demandée depuis form-configurator');
    this.resetColumnLabels.emit();
  }

  setSelectionMode(mode: 'auto' | 'select-only' | 'deselect-only') {
    this.selectionMode = mode;
  }

  setSelectionType(type: 'cell' | 'row' | 'column') {
    this.selectionType = type;
  }

  getSelectionTypeLabel(): string {
    switch (this.selectionType) {
      case 'cell':
        return 'Par cellule';
      case 'row':
        return 'Par ligne';
      case 'column':
        return 'Par colonne';
      default:
        return 'Par cellule';
    }
  }

  getSelectionModeLabel(): string {
    switch (this.selectionMode) {
      case 'auto':
        return 'Inverser la sélection';
      case 'select-only':
        return 'Sélectionner uniquement';
      case 'deselect-only':
        return 'Désélectionner uniquement';
      default:
        return 'Inverser la sélection';
    }
  }

  // Helper pour obtenir les colonnes déjà sélectionnées
  private getSelectedColumns(): number[] {
    const columns = new Set<number>();
    this.editableCells.forEach(cell => {
      columns.add(cell.col);
    });
    return Array.from(columns).sort((a, b) => a - b);
  }

  // Helper pour obtenir les lignes déjà sélectionnées
  private getSelectedRows(): number[] {
    const rows = new Set<number>();
    this.editableCells.forEach(cell => {
      rows.add(cell.row);
    });
    return Array.from(rows).sort((a, b) => a - b);
  }

  /**
   * Gère le clic sur une cellule de numérotation de ligne
   */
  onRowNumberCellMouseDown(rowIndex: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Passer automatiquement en mode sélection par ligne
    this.selectionType = 'row';
    
    // Sélectionner la ligne correspondante
    this.selectRow(rowIndex);
    
    // Remettre automatiquement le type de sélection sur "par cellule"
    this.selectionType = 'cell';
  }

  /**
   * Gère le clic sur un en-tête de colonne
   */
  onColumnHeaderMouseDown(colIndex: number, event: MouseEvent) {
    const callId = ++this.selectColumnCallCount;
    console.log('=== onColumnHeaderMouseDown START (call #' + callId + ') ===');
    console.log('colIndex (relatif dans form-configurator):', colIndex);
    console.log('event.type:', event.type);
    console.log('event.button:', event.button);
    console.log('event.detail:', event.detail);
    console.log('event.timeStamp:', event.timeStamp);
    console.log('selectedColumns:', this.selectedColumns);
    console.log('selectedColumns.length:', this.selectedColumns.length);
    
    // ALERT 1: Début de la fonction (seulement si problème détecté)
    const columnsBefore = this.getSelectedColumns();
    if (columnsBefore.length > 1) {
      console.log(`⚠️ ALERT 1 - Début onColumnHeaderMouseDown - PROBLÈME: colIndex: ${colIndex}, Colonnes dans editableCells: [${columnsBefore.join(', ')}]`);
    }
    
    // Vérifier la correspondance entre colIndex et selectedColumns
    if (colIndex >= 0 && colIndex < this.selectedColumns.length) {
      const columnKey = this.selectedColumns[colIndex];
      console.log('colIndex', colIndex, '→ columnKey:', columnKey);
      if (columnKey && columnKey.startsWith('column-')) {
        const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
        console.log('→ absoluteColIndex:', absoluteColIndex);
        console.log('VÉRIFICATION: colIndex relatif', colIndex, 'correspond à colonne absolue', absoluteColIndex);
      }
    } else {
      console.log('ERREUR: colIndex', colIndex, 'hors de la plage [0,', this.selectedColumns.length - 1, ']');
    }
    
    // Empêcher le comportement par défaut et la propagation
    event.preventDefault();
    event.stopPropagation();
    
    // Éviter les appels multiples : ignorer si ce n'est pas un clic simple
    // (mousedown peut être suivi d'un click, on ne traite que le click)
    if (event.type === 'mousedown') {
      console.log('IGNORÉ: événement mousedown (on attend le click)');
      console.log('=== onColumnHeaderMouseDown END (ignoré) ===');
      return;
    }
    
    // Passer automatiquement en mode sélection par colonne
    this.selectionType = 'column';
    
    // ALERT 2: Avant l'appel à selectColumn (seulement si problème détecté)
    const columnsBeforeSelect = this.getSelectedColumns();
    if (columnsBeforeSelect.length > 1) {
      console.log(`⚠️ ALERT 2 - Avant selectColumn - PROBLÈME: colIndex: ${colIndex}, Colonnes dans editableCells: [${columnsBeforeSelect.join(', ')}]`);
    }
    
    // Sélectionner la colonne correspondante
    console.log('Appel de selectColumn avec colIndex:', colIndex, '(call #' + callId + ')');
    this.selectColumn(colIndex);
    
    // Remettre automatiquement le type de sélection sur "par cellule"
    this.selectionType = 'cell';
    
    // ALERT 3: Après l'appel à selectColumn (seulement si problème détecté)
    const columnsAfterSelect = this.getSelectedColumns();
    if (columnsAfterSelect.length > 1) {
      console.log(`⚠️ ALERT 3 - Après selectColumn - PROBLÈME: colIndex: ${colIndex}, Colonnes dans editableCells: [${columnsAfterSelect.join(', ')}]`);
    }
    
    // ALERT 11: Vérification après un court délai (pour détecter les changements asynchrones)
    setTimeout(() => {
      const columnsAfterDelay = this.getSelectedColumns();
      if (columnsAfterDelay.length > 1) {
        console.log(`⚠️ ALERT 11 - Après délai (100ms) - PROBLÈME: colIndex: ${colIndex}, Colonnes dans editableCells: [${columnsAfterDelay.join(', ')}]`);
      }
    }, 100);
    
    // ALERT 12: Vérification après un délai plus long
    setTimeout(() => {
      const columnsAfterLongDelay = this.getSelectedColumns();
      if (columnsAfterLongDelay.length > 1) {
        console.log(`⚠️ ALERT 12 - Après délai (500ms) - PROBLÈME: colIndex: ${colIndex}, Colonnes dans editableCells: [${columnsAfterLongDelay.join(', ')}]`);
      }
    }, 500);
    
    console.log('=== onColumnHeaderMouseDown END (call #' + callId + ') ===');
  }

  onCellMouseDown(rowIndex: number, colIndex: number, event: MouseEvent) {
    if (event.button !== 0) return; // Seulement le clic gauche
    
    // IMPORTANT: Convertir les indices relatifs de l'interface en indices Excel absolus
    const absoluteIndices = this.convertInterfaceIndicesToAbsolute(rowIndex, colIndex);
    
    this.isSelecting = true;
    this.startCell = absoluteIndices;
    this.initialEditableCells = [...this.editableCells];
    this.lastDragRange = null;
    
    // Toggle immédiat si pas de drag
    if (this.selectionMode === 'auto') {
      this.toggleEditableCell(absoluteIndices.row, absoluteIndices.col);
    } else {
      this.toggleEditableCell(absoluteIndices.row, absoluteIndices.col);
    }
    event.preventDefault();
  }

  onCellMouseOver(rowIndex: number, colIndex: number, event: MouseEvent) {
    if (!this.isSelecting || !this.startCell) return;
    
    // IMPORTANT: Convertir les indices relatifs de l'interface en indices Excel absolus
    const absoluteIndices = this.convertInterfaceIndicesToAbsolute(rowIndex, colIndex);
    
    // Pour éviter de recalculer inutilement
    if (this.lastDragRange && this.lastDragRange.start.row === this.startCell.row && this.lastDragRange.start.col === this.startCell.col && this.lastDragRange.end.row === absoluteIndices.row && this.lastDragRange.end.col === absoluteIndices.col) {
      return;
    }
    this.lastDragRange = { start: { ...this.startCell }, end: absoluteIndices };
    
    if (this.selectionMode === 'auto') {
      this.toggleEditableRangeAuto(this.startCell, absoluteIndices);
    } else {
      this.selectEditableRange(this.startCell, absoluteIndices);
    }
  }

  onCellMouseUp(rowIndex: number, colIndex: number, event: MouseEvent) {
    this.isSelecting = false;
    this.startCell = null;
    this.initialEditableCells = [];
    this.lastDragRange = null;
  }

  private toggleEditableCell(rowIndex: number, colIndex: number) {
    // IMPORTANT: rowIndex et colIndex sont maintenant des indices Excel absolus
    const currentEditableCells = [...this.editableCells];
    
    let cellsToToggle: { row: number, col: number }[] = [];
    
    // Déterminer les cellules à sélectionner selon le type
    if (this.selectionType === 'cell') {
      // Mode cellule : sélectionner uniquement la cellule cliquée
      cellsToToggle = [{ row: rowIndex, col: colIndex }];
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner toute la ligne
      // Si des colonnes sont déjà sélectionnées, ne sélectionner que ces colonnes
      const selectedColumns = this.getSelectedColumns();
      if (selectedColumns.length > 0) {
        // Sélectionner seulement les colonnes déjà sélectionnées pour cette ligne
        cellsToToggle = selectedColumns.map(col => ({ row: rowIndex, col }));
      } else {
        // Aucune colonne sélectionnée : sélectionner toutes les colonnes de la ligne
        // Utiliser les colonnes sélectionnées dans selectedColumns
        for (let c = 0; c < this.selectedColumns.length; c++) {
          const columnKey = this.selectedColumns[c];
          if (columnKey && columnKey.startsWith('column-')) {
            const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
            cellsToToggle.push({ row: rowIndex, col: absoluteColIndex });
          } else {
            cellsToToggle.push({ row: rowIndex, col: c });
          }
        }
      }
    } else if (this.selectionType === 'column') {
      // Mode colonne : sélectionner toute la colonne
      // Si des lignes sont déjà sélectionnées, ne sélectionner que ces lignes
      const selectedRows = this.getSelectedRows();
      const totalRows = this.getTotalAvailableRows();
      if (selectedRows.length > 0) {
        // Sélectionner seulement les lignes déjà sélectionnées pour cette colonne
        cellsToToggle = selectedRows.map(row => ({ row, col: colIndex }));
      } else {
        // Aucune ligne sélectionnée : sélectionner toutes les lignes de la colonne
        for (let r = 0; r < totalRows; r++) {
          cellsToToggle.push({ row: r, col: colIndex });
        }
      }
    }
    
    // Appliquer le toggle pour chaque cellule
    cellsToToggle.forEach(cell => {
      const cellIndex = currentEditableCells.findIndex(c => c.row === cell.row && c.col === cell.col);
      
      if (cellIndex >= 0) {
        // Cellule déjà sélectionnée
        if (this.selectionMode === 'select-only') return;
        currentEditableCells.splice(cellIndex, 1);
      } else {
        // Cellule non sélectionnée
        if (this.selectionMode === 'deselect-only') return;
        currentEditableCells.push({ row: cell.row, col: cell.col });
      }
    });
    
    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed(currentEditableCells);
  }

  private selectEditableRange(start: { row: number, col: number }, end: { row: number, col: number }) {
    const currentEditableCells = [...this.editableCells];
    let rect: { row: number, col: number }[] = [];
    
    // Déterminer les cellules à sélectionner selon le type
    if (this.selectionType === 'cell') {
      // Mode cellule : sélection rectangulaire classique
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          rect.push({ row, col });
        }
      }
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner des lignes entières
      const selectedColumns = this.getSelectedColumns();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      // Si des colonnes sont déjà sélectionnées, utiliser ces colonnes, sinon toutes les colonnes
      const colsToUse = selectedColumns.length > 0 ? selectedColumns : 
        Array.from({ length: this.selectedColumns.length }, (_, i) => {
          const columnKey = this.selectedColumns[i];
          if (columnKey && columnKey.startsWith('column-')) {
            return parseInt(columnKey.replace('column-', ''));
          }
          return i;
        });
      
      for (let r = minRow; r <= maxRow; r++) {
        colsToUse.forEach(col => {
          rect.push({ row: r, col });
        });
      }
    } else if (this.selectionType === 'column') {
      // Mode colonne : sélectionner des colonnes entières
      const selectedRows = this.getSelectedRows();
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      const totalRows = this.getTotalAvailableRows();
      // Si des lignes sont déjà sélectionnées, utiliser ces lignes, sinon toutes les lignes
      const rowsToUse = selectedRows.length > 0 ? selectedRows : Array.from({ length: totalRows }, (_, i) => i);
      
      for (let c = minCol; c <= maxCol; c++) {
        rowsToUse.forEach(row => {
          rect.push({ row, col: c });
        });
      }
    }
    
    // Appliquer la sélection selon le mode d'action
    if (this.selectionMode === 'deselect-only') {
      // En mode désélection, on retire les cellules de la plage
      rect.forEach(cell => {
        const cellIndex = currentEditableCells.findIndex(c => c.row === cell.row && c.col === cell.col);
        if (cellIndex >= 0) {
          currentEditableCells.splice(cellIndex, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      // En mode sélection, on ajoute les cellules
      rect.forEach(cell => {
        const exists = currentEditableCells.some(c => c.row === cell.row && c.col === cell.col);
        if (!exists) {
          currentEditableCells.push({ row: cell.row, col: cell.col });
        }
      });
    } else {
      // En mode auto, on inverse l'état de chaque cellule dans la plage
      rect.forEach(cell => {
        const cellIndex = currentEditableCells.findIndex(c => c.row === cell.row && c.col === cell.col);
        if (cellIndex >= 0) {
          // Cellule déjà sélectionnée, la retirer
          currentEditableCells.splice(cellIndex, 1);
        } else {
          // Cellule non sélectionnée, l'ajouter
          currentEditableCells.push({ row: cell.row, col: cell.col });
        }
      });
    }
    
    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed(currentEditableCells);
  }

  isCellEditable(rowIndex: number, colIndex: number): boolean {
    // IMPORTANT: rowIndex est l'index absolu, colIndex est l'index relatif dans selectedColumns
    // editableCells contient toujours des indices absolus (row et col sont absolus)
    const dataToUse = this.displayData;
    if (!dataToUse || dataToUse.length === 0) {
      return false;
    }

    // Convertir colIndex relatif en index absolu
    const selectedColumnKeys = this.selectedColumns;
    if (colIndex < 0 || colIndex >= selectedColumnKeys.length) {
      return false;
    }
    
    const columnKey = selectedColumnKeys[colIndex];
    if (!columnKey || !columnKey.startsWith('column-')) {
      // Si la colonne n'a pas le format column-X, essayer un match direct (fallback)
      return this.editableCells.some(cell => cell.row === rowIndex && cell.col === colIndex);
    }
    
    const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
    
    // Vérifier si cette cellule est dans editableCells (toujours avec indices absolus)
    const isEditable = this.editableCells.some(cell => cell.row === rowIndex && cell.col === absoluteColIndex);
    
    // ALERT 16: Détecter si colIndex+2 est aussi marqué comme éditable (PROBLÈME SUSPECT)
    // Désactivé car trop de bruit - le problème est dans selectColumn, pas dans isCellEditable
    // if (colIndex >= 0 && colIndex + 2 < selectedColumnKeys.length) {
    //   const otherColumnKey = selectedColumnKeys[colIndex + 2];
    //   if (otherColumnKey && otherColumnKey.startsWith('column-')) {
    //     const otherAbsoluteColIndex = parseInt(otherColumnKey.replace('column-', ''));
    //     const otherMatch = this.editableCells.some(cell => cell.row === rowIndex && cell.col === otherAbsoluteColIndex);
    //     if (otherMatch && !isEditable) {
    //       // Problème : colIndex+2 est marqué comme éditable mais pas colIndex
    //       console.log(`⚠️ ALERT 16 - PROBLÈME DÉTECTÉ dans isCellEditable - rowIndex: ${rowIndex}, colIndex relatif: ${colIndex} → absolute: ${absoluteColIndex} (match: ${isEditable}), colIndex+2 relatif: ${colIndex + 2} → absolute: ${otherAbsoluteColIndex} (match: ${otherMatch}), La colonne n+2 est marquée comme éditable alors que n ne l'est pas!`);
    //       console.log(`⚠️ ALERT 16 - Détail editableCells:`, this.editableCells.filter(c => c.row === rowIndex).map(c => `row:${c.row},col:${c.col}`));
    //     } else if (otherMatch && isEditable) {
    //       // Les deux colonnes sont marquées comme éditables
    //       console.log(`⚠️ ALERT 16 - PROBLÈME DÉTECTÉ dans isCellEditable - rowIndex: ${rowIndex}, colIndex relatif: ${colIndex} → absolute: ${absoluteColIndex} (match: ${isEditable}), colIndex+2 relatif: ${colIndex + 2} → absolute: ${otherAbsoluteColIndex} (match: ${otherMatch}), Les DEUX colonnes sont dans editableCells!`);
    //       console.log(`⚠️ ALERT 16 - Détail editableCells:`, this.editableCells.filter(c => c.row === rowIndex).map(c => `row:${c.row},col:${c.col}`));
    //     }
    //   }
    // }
    
    return isEditable;
  }

  getColumnLetter(colIndex: number): string {
    let result = '';
    while (colIndex >= 0) {
      result = String.fromCharCode(65 + (colIndex % 26)) + result;
      colIndex = Math.floor(colIndex / 26) - 1;
    }
    return result;
  }


  // Mode auto : toggle sur la plage, basé sur l'état initial
  private toggleEditableRangeAuto(start: { row: number, col: number }, end: { row: number, col: number }) {
    let rect: { row: number, col: number }[] = [];
    
    // Déterminer les cellules à sélectionner selon le type
    if (this.selectionType === 'cell') {
      // Mode cellule : sélection rectangulaire classique
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          rect.push({ row, col });
        }
      }
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner des lignes entières
      const selectedColumns = this.getSelectedColumns();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      // Si des colonnes sont déjà sélectionnées, utiliser ces colonnes, sinon toutes les colonnes
      const colsToUse = selectedColumns.length > 0 ? selectedColumns : 
        Array.from({ length: this.selectedColumns.length }, (_, i) => {
          const columnKey = this.selectedColumns[i];
          if (columnKey && columnKey.startsWith('column-')) {
            return parseInt(columnKey.replace('column-', ''));
          }
          return i;
        });
      
      for (let r = minRow; r <= maxRow; r++) {
        colsToUse.forEach(col => {
          rect.push({ row: r, col });
        });
      }
    } else if (this.selectionType === 'column') {
      // Mode colonne : sélectionner des colonnes entières
      const selectedRows = this.getSelectedRows();
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      const totalRows = this.getTotalAvailableRows();
      // Si des lignes sont déjà sélectionnées, utiliser ces lignes, sinon toutes les lignes
      const rowsToUse = selectedRows.length > 0 ? selectedRows : Array.from({ length: totalRows }, (_, i) => i);
      
      for (let c = minCol; c <= maxCol; c++) {
        rowsToUse.forEach(row => {
          rect.push({ row, col: c });
        });
      }
    }
    
    // On part de l'état initial
    const initialSet = new Set(this.initialEditableCells.map(cell => `${cell.row},${cell.col}`));
    const toggledSet = new Set(initialSet);
    
    // Toggle chaque cellule de la plage déterminée
    rect.forEach(cell => {
      const key = `${cell.row},${cell.col}`;
      if (initialSet.has(key)) {
        toggledSet.delete(key);
      } else {
        toggledSet.add(key);
      }
    });
    
    // Générer le nouveau tableau
    const newEditableCells: { row: number, col: number }[] = Array.from(toggledSet).map(str => {
      const [row, col] = str.split(',').map(Number);
      return { row, col };
    });

    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed(newEditableCells);
  }

  // Méthodes de sélection rapide

  /**
   * Sélectionne toutes les cellules selon le mode actif
   */
  selectAllCells() {
    if (!this.selectedData || this.selectedData.length === 0) {
      return;
    }
    
    const allCells: { row: number, col: number }[] = [];
    // IMPORTANT: Utiliser le nombre total de lignes du tableau original (tableData), pas seulement les données affichées
    // Les indices dans editableCells correspondent aux indices du tableau original
    const totalRows = this.getTotalAvailableRows();
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < this.selectedColumns.length; col++) {
        // IMPORTANT: Convertir l'index relatif en index Excel absolu
        const columnKey = this.selectedColumns[col];
        if (columnKey && columnKey.startsWith('column-')) {
          const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
          allCells.push({ row, col: absoluteColIndex });
        } else {
          // Fallback: utiliser l'index relatif si la conversion échoue
          allCells.push({ row, col });
        }
      }
    }
    
    if (this.selectionMode === 'auto') {
      // Mode auto : toggle toutes les cellules
      allCells.forEach(cell => {
        const idx = this.editableCells.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          this.editableCells.push(cell);
        } else {
          this.editableCells.splice(idx, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      // Mode select-only : ajouter toutes les cellules
      allCells.forEach(cell => {
        if (!this.editableCells.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          this.editableCells.push(cell);
        }
      });
    } else if (this.selectionMode === 'deselect-only') {
      // Mode deselect-only : retirer toutes les cellules
      this.editableCells = this.editableCells.filter(sel => 
        !allCells.some(cell => cell.row === sel.row && cell.col === sel.col)
      );
    }

    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed([...this.editableCells]);
  }

  /**
   * Sélectionne une ligne spécifique selon le mode actif
   */
  selectRow(rowIndex: number) {
    if (!this.selectedData || this.selectedData.length === 0) {
      return;
    }
    
    const rowCells: { row: number, col: number }[] = [];
    // Si des colonnes sont déjà sélectionnées, ne sélectionner que ces colonnes
    const selectedColumns = this.getSelectedColumns();
    if (selectedColumns.length > 0) {
      // Sélectionner seulement les colonnes déjà sélectionnées pour cette ligne
      selectedColumns.forEach(colIndex => {
        rowCells.push({ row: rowIndex, col: colIndex });
      });
    } else {
      // Aucune colonne sélectionnée : sélectionner toutes les colonnes de la ligne
      for (let col = 0; col < this.selectedColumns.length; col++) {
        // IMPORTANT: Convertir l'index relatif en index Excel absolu
        const columnKey = this.selectedColumns[col];
        if (columnKey && columnKey.startsWith('column-')) {
          const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
          rowCells.push({ row: rowIndex, col: absoluteColIndex });
        } else {
          // Fallback: utiliser l'index relatif si la conversion échoue
          rowCells.push({ row: rowIndex, col });
        }
      }
    }
    
    if (this.selectionMode === 'auto') {
      // Mode auto : toggle la ligne
      rowCells.forEach(cell => {
        const idx = this.editableCells.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          this.editableCells.push(cell);
        } else {
          this.editableCells.splice(idx, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      // Mode select-only : ajouter la ligne
      rowCells.forEach(cell => {
        if (!this.editableCells.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          this.editableCells.push(cell);
        }
      });
    } else if (this.selectionMode === 'deselect-only') {
      // Mode deselect-only : retirer la ligne
      this.editableCells = this.editableCells.filter(sel => 
        !rowCells.some(cell => cell.row === sel.row && cell.col === sel.col)
      );
    }

    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed([...this.editableCells]);
  }

  /**
   * Sélectionne une colonne spécifique selon le mode actif
   */
  selectColumn(colIndex: number) {
    const timestamp = Date.now();
    console.log('=== selectColumn START (timestamp: ' + timestamp + ') ===');
    console.log('colIndex (relatif reçu):', colIndex);
    console.log('Stack trace:', new Error().stack);
    console.log('selectedData:', this.selectedData?.length || 0, 'éléments');
    
    if (!this.selectedData || this.selectedData.length === 0) {
      console.log('ERREUR: selectedData est vide, sortie anticipée');
      console.log('=== selectColumn END (vide) ===');
      return;
    }
    
    const colCells: { row: number, col: number }[] = [];
    // IMPORTANT: Convertir l'index relatif en index Excel absolu
    console.log('selectedColumns:', this.selectedColumns);
    console.log('selectedColumns.length:', this.selectedColumns.length);
    console.log('colIndex demandé:', colIndex, '(dans la plage [0,', this.selectedColumns.length - 1, ']?)');
    
    const columnKey = this.selectedColumns[colIndex];
    console.log('columnKey trouvé à l\'index', colIndex, ':', columnKey);
    
    let absoluteColIndex = colIndex;
    if (columnKey && columnKey.startsWith('column-')) {
      absoluteColIndex = parseInt(columnKey.replace('column-', ''));
      console.log('Conversion: columnKey', columnKey, '-> absoluteColIndex:', absoluteColIndex);
    } else {
      console.log('PAS de conversion: columnKey ne commence pas par "column-", utilisation de colIndex comme absoluteColIndex:', absoluteColIndex);
    }
    
    console.log('absoluteColIndex final:', absoluteColIndex);
    
    // Si des lignes sont déjà sélectionnées, ne sélectionner que ces lignes
    const selectedRows = this.getSelectedRows();
    const totalRows = this.getTotalAvailableRows();
    console.log('selectedRows:', selectedRows);
    console.log('selectedRows.length:', selectedRows.length);
    console.log('totalRows:', totalRows);
    
    if (selectedRows.length > 0) {
      console.log('Mode: Sélectionner seulement les lignes déjà sélectionnées');
      // Sélectionner seulement les lignes déjà sélectionnées pour cette colonne
      selectedRows.forEach(rowIndex => {
        colCells.push({ row: rowIndex, col: absoluteColIndex });
      });
    } else {
      console.log('Mode: Sélectionner toutes les lignes de la colonne');
      // Aucune ligne sélectionnée : sélectionner toutes les lignes de la colonne
      // IMPORTANT: Utiliser le nombre total de lignes du tableau original (tableData), pas seulement les données affichées
      // Les indices dans editableCells correspondent aux indices du tableau original
      for (let row = 0; row < totalRows; row++) {
        colCells.push({ row, col: absoluteColIndex });
      }
    }
    
    console.log('colCells générées:', colCells.length, 'cellules');
    console.log('Premières cellules:', colCells.slice(0, 5));
    console.log('Dernières cellules:', colCells.slice(-5));
    
    console.log('selectionMode:', this.selectionMode);
    console.log('editableCells AVANT:', this.editableCells.length, 'cellules');
    const columnsBefore = this.getSelectedColumns();
    console.log('Colonnes uniques dans editableCells AVANT:', columnsBefore);
    console.log('Détail editableCells AVANT:', this.editableCells.map(c => `row:${c.row},col:${c.col}`));
    
    // ALERT 4: Début du toggle (toujours afficher pour contexte)
    console.log(`ALERT 4 - Début toggle - absoluteColIndex: ${absoluteColIndex}, Colonnes AVANT: [${columnsBefore.join(', ')}], colCells à traiter: ${colCells.length} cellules`);
    
    if (this.selectionMode === 'auto') {
      console.log('Mode AUTO: toggle la colonne');
      console.log('⚠️ VÉRIFICATION: colIndex reçu:', colIndex, '→ absoluteColIndex:', absoluteColIndex);
      console.log('⚠️ VÉRIFICATION: selectedColumns[colIndex]:', this.selectedColumns[colIndex]);
      if (colIndex + 2 < this.selectedColumns.length) {
        console.log('⚠️ VÉRIFICATION: selectedColumns[colIndex+2]:', this.selectedColumns[colIndex + 2]);
      }
      
      let added = 0;
      let removed = 0;
      const cellsToAdd: { row: number, col: number }[] = [];
      const cellsToRemove: { row: number, col: number }[] = [];
      
      // Mode auto : toggle la colonne
      colCells.forEach(cell => {
        const idx = this.editableCells.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          console.log('⚠️ Ajout de cellule:', `row:${cell.row},col:${cell.col}`);
          this.editableCells.push(cell);
          cellsToAdd.push(cell);
          added++;
        } else {
          console.log('⚠️ Retrait de cellule (toggle):', `row:${cell.row},col:${cell.col}`);
          cellsToRemove.push(this.editableCells[idx]);
          this.editableCells.splice(idx, 1);
          removed++;
        }
      });
      console.log('Toggle: ajouté', added, 'cellules, retiré', removed, 'cellules');
      console.log('Cellules ajoutées:', cellsToAdd.map(c => `row:${c.row},col:${c.col}`));
      console.log('Cellules retirées:', cellsToRemove.map(c => `row:${c.row},col:${c.col}`));
      
      // ALERT 5: Après le toggle (toujours afficher pour contexte)
      const columnsAfterToggle = this.getSelectedColumns();
      console.log(`ALERT 5 - Après toggle - absoluteColIndex: ${absoluteColIndex}, Ajouté: ${added}, Retiré: ${removed}, Colonnes APRÈS: [${columnsAfterToggle.join(', ')}]`);
      if (columnsAfterToggle.length > 1) {
        console.log(`⚠️ ALERT 5 - PROBLÈME DÉTECTÉ après toggle: Plus d'une colonne sélectionnée!`);
      }
    } else if (this.selectionMode === 'select-only') {
      console.log('Mode SELECT-ONLY: ajouter la colonne');
      let added = 0;
      // Mode select-only : ajouter la colonne
      colCells.forEach(cell => {
        if (!this.editableCells.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          this.editableCells.push(cell);
          added++;
        }
      });
      console.log('Ajouté', added, 'nouvelles cellules');
    } else if (this.selectionMode === 'deselect-only') {
      console.log('Mode DESELECT-ONLY: retirer la colonne');
      const beforeCount = this.editableCells.length;
      // Mode deselect-only : retirer la colonne
      this.editableCells = this.editableCells.filter(sel => 
        !colCells.some(cell => cell.row === sel.row && cell.col === sel.col)
      );
      console.log('Retiré', beforeCount - this.editableCells.length, 'cellules');
    }
    
    console.log('editableCells APRÈS:', this.editableCells.length, 'cellules');
    console.log('Colonnes uniques dans editableCells APRÈS:', this.getSelectedColumns());
    console.log('Vérification: colonne', absoluteColIndex, 'est-elle dans editableCells?', 
                this.editableCells.some(c => c.col === absoluteColIndex));
    
    // Vérification détaillée : quelles colonnes sont dans editableCells ?
    const columnsInEditableCells = this.getSelectedColumns();
    console.log('=== ANALYSE DÉTAILLÉE DES COLONNES ===');
    console.log('Colonne cliquée (colIndex relatif dans form-configurator):', colIndex);
    console.log('Colonne cliquée (columnKey dans selectedColumns):', this.selectedColumns[colIndex]);
    console.log('Colonne cliquée (absoluteColIndex):', absoluteColIndex);
    console.log('Toutes les colonnes dans editableCells:', columnsInEditableCells);
    console.log('Colonnes attendues dans editableCells (seulement la colonne cliquée si toggle):', 
                this.selectionMode === 'auto' ? 'Variable selon toggle' : 
                this.selectionMode === 'select-only' ? [absoluteColIndex] : 
                'Aucune (deselect-only)');
    
    // Vérifier la correspondance : est-ce que colIndex+2 correspond à une autre colonne ?
    if (colIndex + 2 < this.selectedColumns.length) {
      const otherColumnKey = this.selectedColumns[colIndex + 2];
      if (otherColumnKey && otherColumnKey.startsWith('column-')) {
        const otherAbsoluteColIndex = parseInt(otherColumnKey.replace('column-', ''));
        console.log('⚠️ VÉRIFICATION: colIndex+2 =', colIndex + 2, '→ columnKey:', otherColumnKey, '→ absoluteColIndex:', otherAbsoluteColIndex);
        console.log('⚠️ Cette colonne est-elle dans editableCells?', 
                    this.editableCells.some(c => c.col === otherAbsoluteColIndex));
        if (this.editableCells.some(c => c.col === otherAbsoluteColIndex)) {
          console.log('⚠️ PROBLÈME DÉTECTÉ: La colonne n+2 (colIndex', colIndex + 2, ', absolu', otherAbsoluteColIndex, ') est également dans editableCells!');
          const cellsOfOtherColumn = this.editableCells.filter(c => c.col === otherAbsoluteColIndex);
          console.log('⚠️ Cellules de cette colonne:', cellsOfOtherColumn.map(c => `row:${c.row},col:${c.col}`));
        }
      }
    }
    
    // Vérifier s'il y a des colonnes inattendues
    if (this.selectionMode === 'auto') {
      // En mode auto, on toggle, donc la colonne peut être présente ou non
      const shouldBePresent = !this.editableCells.some(c => c.col === absoluteColIndex && 
        colCells.some(cc => cc.row === c.row && cc.col === c.col));
      console.log('En mode auto: la colonne devrait être', shouldBePresent ? 'présente' : 'absente', 
                  'après toggle');
    }
    
    // Vérifier toutes les cellules pour voir s'il y a des colonnes inattendues
    const cellDetails = this.editableCells.map(c => `row:${c.row},col:${c.col}`);
    console.log('Détail de toutes les cellules dans editableCells:', cellDetails);
    
    // Vérifier toutes les colonnes dans selectedColumns et leur correspondance
    console.log('=== CORRESPONDANCE selectedColumns ↔ absoluteColIndex ===');
    this.selectedColumns.forEach((colKey, idx) => {
      if (colKey && colKey.startsWith('column-')) {
        const absIdx = parseInt(colKey.replace('column-', ''));
        const isInEditable = this.editableCells.some(c => c.col === absIdx);
        console.log(`  colIndex ${idx} → ${colKey} → absolute ${absIdx} ${isInEditable ? '✓ dans editableCells' : '✗ pas dans editableCells'}`);
      }
    });
    
    // ALERT 6: Avant l'émission de l'événement (seulement si problème)
    const columnsBeforeEmit = this.getSelectedColumns();
    if (columnsBeforeEmit.length > 1) {
      console.log(`⚠️ ALERT 6 - Avant emit - PROBLÈME: absoluteColIndex: ${absoluteColIndex}, Colonnes: [${columnsBeforeEmit.join(', ')}], Nombre de cellules: ${this.editableCells.length}`);
    }
    
    // IMPORTANT: Les indices sont déjà absolus, pas besoin de conversion
    this.emitEditableCellsIfConfirmed([...this.editableCells]);
    
    // ALERT 7: Après l'émission de l'événement (seulement si problème)
    const columnsAfterEmit = this.getSelectedColumns();
    if (columnsAfterEmit.length > 1) {
      console.log(`⚠️ ALERT 7 - Après emit - PROBLÈME: absoluteColIndex: ${absoluteColIndex}, Colonnes: [${columnsAfterEmit.join(', ')}], Nombre de cellules: ${this.editableCells.length}`);
    }
    
    console.log('=== selectColumn END ===');
  }

  /**
   * Gère l'autre événement quand la souris quitte le tableau
   */
  onTableMouseLeave() {
    this.currentHoveredRow = -1;
    this.currentHoveredCol = -1;
  }

  /**
   * Génère le tooltip pour le bouton "Toutes les cellules" selon le mode actif
   */
  getSelectAllTooltip(): string {
    switch (this.selectionMode) {
      case 'auto':
        return 'Basculer toutes les cellules (sélectionner/désélectionner)';
      case 'select-only':
        return 'Sélectionner toutes les cellules';
      case 'deselect-only':
        return 'Désélectionner toutes les cellules';
      default:
        return 'Sélectionner toutes les cellules';
    }
  }

  /**
   * Génère le tooltip pour le bouton de ligne selon le mode actif
   */
  getSelectRowTooltip(rowIndex: number): string {
    const rowNumber = rowIndex + 1;
    switch (this.selectionMode) {
      case 'auto':
        return `Basculer la ligne ${rowNumber} (sélectionner/désélectionner)`;
      case 'select-only':
        return `Sélectionner la ligne ${rowNumber}`;
      case 'deselect-only':
        return `Désélectionner la ligne ${rowNumber}`;
      default:
        return `Sélectionner la ligne ${rowNumber}`;
    }
  }

  /**
   * Génère le tooltip pour le bouton de colonne selon le mode actif
   */
  getSelectColumnTooltip(colIndex: number): string {
    const columnLetter = this.getColumnLetter(colIndex);
    switch (this.selectionMode) {
      case 'auto':
        return `Basculer la colonne ${columnLetter} (sélectionner/désélectionner)`;
      case 'select-only':
        return `Sélectionner la colonne ${columnLetter}`;
      case 'deselect-only':
        return `Désélectionner la colonne ${columnLetter}`;
      default:
        return `Sélectionner la colonne ${columnLetter}`;
    }
  }

  /**
   * Convertit les indices relatifs (basés sur les colonnes visibles) en indices Excel absolus
   * @param relativeEditableCells Cellules éditables avec indices relatifs
   * @returns Cellules éditables avec indices Excel absolus
   */
  private convertToAbsoluteIndices(relativeEditableCells: { row: number, col: number }[]): { row: number, col: number }[] {
    const dataToUse = this.displayData;
    if (!dataToUse || dataToUse.length === 0) {
      return relativeEditableCells;
    }

    const columnKeys = this.columns; // Utilise la méthode getter qui trie les colonnes
    
    return relativeEditableCells.map(cell => {
      // Trouver la clé de colonne correspondant à l'index relatif
      const columnKey = columnKeys[cell.col];
      if (columnKey && columnKey.startsWith('column-')) {
        // Extraire l'index Excel absolu de la clé
        const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
        return { row: cell.row, col: absoluteColIndex };
      }
      // Si pas de correspondance, retourner l'index relatif (fallback)
      return cell;
    });
  }

  /**
   * Convertit les indices relatifs de l'interface en indices Excel absolus
   * @param rowIndex Index de ligne relatif de l'interface
   * @param colIndex Index de colonne relatif de l'interface
   * @returns Indices Excel absolus { row: number, col: number }
   */
  private convertInterfaceIndicesToAbsolute(rowIndex: number, colIndex: number): { row: number, col: number } {
    const dataToUse = this.displayData;
    if (!dataToUse || dataToUse.length === 0) {
      return { row: rowIndex, col: colIndex };
    }

    // L'index de ligne est déjà absolu (basé sur le fichier Excel)
    const absoluteRowIndex = rowIndex;

    // IMPORTANT: Utiliser selectedColumns au lieu de columns pour la conversion
    // car colIndex est relatif aux colonnes sélectionnées affichées
    const selectedColumnKeys = this.selectedColumns;
    if (colIndex >= 0 && colIndex < selectedColumnKeys.length) {
      const columnKey = selectedColumnKeys[colIndex];
      if (columnKey && columnKey.startsWith('column-')) {
        const absoluteColIndex = parseInt(columnKey.replace('column-', ''));
        return { row: absoluteRowIndex, col: absoluteColIndex };
      }
    }

    // Fallback: retourner les indices relatifs si la conversion échoue
    return { row: rowIndex, col: colIndex };
  }

  /**
   * Retourne le nombre de cellules éditables sélectionnées
   */
  getEditableCellsCount(): number {
    return this.editableCells ? this.editableCells.length : 0;
  }
} 