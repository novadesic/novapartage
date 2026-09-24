import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy, ViewChild, ElementRef, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelService, ExcelData } from '../../services/excel.service';
import { LoggerService } from '../../services/logger.service';
import { EnvironmentService } from '../../services/environment.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';

@Component({
  selector: 'app-tableau-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tableau-selection.component.html',
  styleUrl: './tableau-selection.component.scss'
})
export class TableauSelectionComponent implements OnInit, OnChanges, OnDestroy {
  // Phase 3: Cache des pages chargées
  private pageCache: Map<number, any[]> = new Map();
  private formulaCellsCache: Map<number, { row: number; col: string }[]> = new Map();
  private loadedPages: Set<number> = new Set();
  private readonly PAGE_SIZE: number = 20;
  private isLoadingPage: boolean = false;
  private totalRowsFromBackend: number = 0;
  private hasMoreFromBackend: boolean = false;
  
  private excelService = inject(ExcelService);
  private logger = inject(LoggerService);
  private environmentService = inject(EnvironmentService);
  private authService = inject(UnifiedAuthService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  @Input() data: any[] = [];
  @Input() selection: { row: number, col: number }[] = [];
  @Output() selectionChange = new EventEmitter<any>();
  @Output() selectedSheetIndexChange = new EventEmitter<number>();
  @Output() validationChange = new EventEmitter<boolean>();
  @Output() headersOnFirstRowChange = new EventEmitter<boolean>();

  @Input() sheets: any[] = [];
  @Input() formulaCells: { row: number; col: string }[] = [];
  @Input() selectedSheetIndex: number = 0;
  @Input() recipientIndex: number = -1; // Index du destinataire pour la sélection de feuille
  @Input() recipientSelectedSheets: { [recipientIndex: number]: number | undefined } = {}; // Feuilles sélectionnées par destinataire
  
  // Phase 3: Propriétés pour le chargement paginé depuis le backend
  @Input() tempFileId?: string;
  @Input() shareId?: string;
  @Input() totalRows?: number; // Nombre total de lignes disponibles
  @Input() hasMore?: boolean; // Indique s'il y a plus de données à charger

  selectionMode: 'auto' | 'select-only' | 'deselect-only' = 'auto';
  // Type de sélection : cellule, ligne ou colonne
  selectionType: 'cell' | 'row' | 'column' = 'cell';
  private isSelecting = false;
  private selectionStart: { row: number, col: number } | null = null;
  private dragRect: { start: { row: number, col: number }, end: { row: number, col: number } } | null = null;
  tempSelection: { row: number, col: number }[] = [];
  
  // Propriétés pour suivre la position de la souris
  private currentHoveredRow: number = -1;
  private currentHoveredCol: number = -1;

  // Propriétés pour l'auto-scroll pendant le drag
  @ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef<HTMLElement>;
  private autoScrollInterval: any = null;
  private globalMouseMoveListener?: (e: MouseEvent) => void;
  private globalMouseUpListener?: (e: MouseEvent) => void;
  private readonly AUTO_SCROLL_THRESHOLD = 50; // Distance en pixels depuis le bord pour déclencher l'auto-scroll
  private readonly AUTO_SCROLL_SPEED = 10; // Vitesse de scroll en pixels par intervalle
  private readonly AUTO_SCROLL_INTERVAL = 16; // Intervalle en ms (environ 60fps)

  // Propriétés pour le virtual scroll
  public itemHeight: number = 32; // Hauteur d'une ligne en pixels
  public containerHeight: number = 500; // Hauteur du conteneur visible
  public visibleItems: number = 0; // Nombre d'éléments visibles
  public scrollTop: number = 0; // Position de scroll
  public startIndex: number = 0; // Index de début des éléments visibles
  public endIndex: number = 0; // Index de fin des éléments visibles
  public virtualData: any[] = []; // Données virtuelles affichées
  
  // Propriétés pour les largeurs de colonnes
  public columnWidths: { [key: string]: number } = {};
  public minColumnWidth: number = 80; // Largeur minimale d'une colonne
  public maxColumnWidth: number = 300; // Largeur maximale d'une colonne
  public defaultColumnWidth: number = 120; // Largeur par défaut

  // Limite de sélection de colonnes
  public maxSelectedColumns: number = 20; // Limite maximale de colonnes sélectionnées
  
  // État d'erreur pour la validation
  hasColumnLimitError = false;
  
  // Cache pour getSelectedColumnsCount
  private cachedSelectedColumnsCount: number = 0;
  private selectionHash: string = '';
  
  // État de chargement pour l'initialisation
  isInitializing = false;
  
  // Propriété pour protéger la première ligne (entêtes)
  headersOnFirstRow: boolean = true; // Cochée par défaut
  
  // Référence à Math pour le template
  public Math = Math;

  ngOnInit() {
    // Activer le loader pendant l'initialisation
    this.isInitializing = true;
    
    // Initialiser la limite de colonnes depuis l'environnement
    this.maxSelectedColumns = this.environmentService.getMaxSelectedColumns();
    
    // Réinitialiser l'état de sélection pour éviter les styles pointillés au chargement
    this.isSelecting = false;
    this.selectionStart = null;
    this.dragRect = null;
    this.tempSelection = [];
    
    // Utiliser setTimeout pour permettre au DOM de se mettre à jour et afficher le loader
    setTimeout(() => {
      this.calculateVisibleItems();
      this.updateVirtualData();
      this.calculateColumnWidths();
      this.validateSelection(); // Valider la sélection initiale
      
      // Désactiver le loader après l'initialisation
      this.isInitializing = false;
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      // Activer le loader si les données changent (nouvelle feuille ou nouvelles données)
      if (changes['data'].firstChange === false || (changes['data'].currentValue && changes['data'].currentValue.length > 0)) {
        this.isInitializing = true;
      }
      
      // Réinitialiser le virtual scroll quand les données changent
      this.scrollTop = 0;
      // Phase 3: Réinitialiser le cache des pages si on change de feuille
      if (changes['selectedSheetIndex']) {
        this.pageCache.clear();
        this.formulaCellsCache.clear();
        this.loadedPages.clear();
        this.totalRowsFromBackend = 0;
        this.hasMoreFromBackend = false;
      }
      
      // Utiliser setTimeout pour permettre au DOM de se mettre à jour
      setTimeout(() => {
        this.updateVirtualData();
        this.calculateColumnWidths();
        this.isInitializing = false;
      }, 0);
    }
    
    if (changes['selection']) {
      // Ne pas initialiser tempSelection avec la sélection complète
      // tempSelection est uniquement utilisé pendant une sélection active (drag)
      // Réinitialiser l'état de sélection si on n'est pas en train de sélectionner
      if (!this.isSelecting) {
        this.tempSelection = [];
        this.dragRect = null;
        this.selectionStart = null;
      }
      
      // Invalider le cache car la sélection a changé
      this.selectionHash = '';
      
      // Valider la sélection
      this.validateSelection();
    }
    
    // Gérer le changement de feuille sélectionnée
    if (changes['selectedSheetIndex'] && !changes['data']) {
      // Si seule la feuille change (sans changement de données), activer le loader
      this.isInitializing = true;
      setTimeout(() => {
        this.updateVirtualData();
        this.calculateColumnWidths();
        this.isInitializing = false;
      }, 0);
    }
    
    // Phase 3: Mettre à jour les métadonnées depuis les Inputs
    if (changes['totalRows']) {
      this.totalRowsFromBackend = this.totalRows || 0;
    }
    if (changes['hasMore']) {
      this.hasMoreFromBackend = this.hasMore || false;
    }
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
      if (!this.data || this.data.length === 0) {
        this.virtualData = [];
        this.startIndex = 0;
        this.endIndex = 0;
        return;
      }

      // Calculer les lignes visibles sans buffer
      const visibleRows = Math.ceil(this.containerHeight / this.itemHeight);
      
      // Calculer l'index de début avec un buffer minimal
      this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - 1);
      
      // Calculer l'index de fin avec seulement 2 lignes de buffer
      this.endIndex = Math.min(this.startIndex + visibleRows + 2, this.data.length);
      
      // Ajuster l'index de début si on dépasse la fin
      if (this.endIndex - this.startIndex < visibleRows + 2 && this.startIndex > 0) {
        this.startIndex = Math.max(0, this.endIndex - visibleRows - 2);
      }
      
      this.virtualData = this.data.slice(this.startIndex, this.endIndex);
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
    const currentPage = Math.floor(this.endIndex / this.PAGE_SIZE);
    const nextPage = currentPage + 1;
    
    // Si on est à 80% du scroll et qu'il y a plus de données, charger la page suivante
    if (scrollPercentage > 0.8 && !this.loadedPages.has(nextPage) && (this.hasMoreFromBackend || this.hasMore)) {
      this.loadPage(nextPage);
    }
    
    // Phase 4: Prefetching - charger la page suivante si on est à 50% du scroll
    if (scrollPercentage > 0.5 && !this.loadedPages.has(nextPage + 1) && (this.hasMoreFromBackend || this.hasMore)) {
      setTimeout(() => this.loadPage(nextPage + 1), 100); // Délai pour éviter de charger trop tôt
    }
  }
  
  /**
   * Phase 3: Charge une page spécifique depuis le backend
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
        this.pageCache.set(page, pageData);
        const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
        this.formulaCellsCache.set(page, cells);
        this.loadedPages.add(page);
        this.totalRowsFromBackend = response.totalRows || 0;
        this.hasMoreFromBackend = response.hasMore || false;
        
        // Fusionner les données dans this.data si nécessaire
        // Pour l'instant, on garde seulement les données de la première page dans data
        // Les autres pages sont en cache et seront utilisées via updateVirtualData
        
        this.isLoadingPage = false;
        this.updateVirtualData();
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
        this.pageCache.set(page, pageData);
        const cells = Array.isArray(response.formulaCells) ? response.formulaCells : [];
        this.formulaCellsCache.set(page, cells);
        this.loadedPages.add(page);
        this.totalRowsFromBackend = response.totalRows || 0;
        this.hasMoreFromBackend = response.hasMore || false;
        
        this.isLoadingPage = false;
        this.updateVirtualData();
      },
      error: (error: any) => {
        this.logger.error(`Erreur lors du chargement de la page ${page} (endpoint public):`, error);
        this.isLoadingPage = false;
      }
    });
  }
  
  /**
   * Phase 3: Met à jour les données virtuelles en incluant les pages chargées
   */
  private updateVirtualDataWithPages(): void {
    if (!this.data || this.data.length === 0) {
      this.virtualData = [];
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
    this.virtualData = this.buildVirtualDataFromPages(this.startIndex, this.endIndex);
  }
  
  /**
   * Phase 3: Construit les données virtuelles à partir des pages en cache
   */
  private buildVirtualDataFromPages(start: number, end: number): any[] {
    const result: any[] = [];
    
    // Commencer par les données de la première page (déjà dans this.data)
    if (start < this.data.length) {
      result.push(...this.data.slice(start, Math.min(end, this.data.length)));
    }
    
    // Ajouter les données des pages suivantes en cache
    if (end > this.data.length) {
      const startPage = Math.floor(this.data.length / this.PAGE_SIZE);
      const endPage = Math.floor((end - 1) / this.PAGE_SIZE);
      
      for (let page = startPage + 1; page <= endPage; page++) {
        const pageData = this.pageCache.get(page);
        if (pageData) {
          const pageStart = page * this.PAGE_SIZE;
          const pageEnd = Math.min((page + 1) * this.PAGE_SIZE, end);
          const pageStartLocal = Math.max(0, start - pageStart);
          const pageEndLocal = Math.min(pageData.length, end - pageStart);
          
          if (pageEndLocal > pageStartLocal) {
            result.push(...pageData.slice(pageStartLocal, pageEndLocal));
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Phase 3: Obtient le nombre total de lignes disponibles
   * PRIORITÉ: Utiliser totalRows (Input) qui est fiable, puis totalRowsFromBackend, puis data.length
   */
  private getTotalAvailableRows(): number {
    // PRIORITÉ 1: Utiliser totalRows (Input) qui représente le nombre réel de lignes avec des données
    if (this.totalRows && this.totalRows > 0) {
      return this.totalRows;
    }
    // PRIORITÉ 2: Utiliser totalRowsFromBackend si disponible
    if (this.totalRowsFromBackend > 0) {
      return this.totalRowsFromBackend;
    }
    // PRIORITÉ 3: Fallback sur data.length
    return this.data.length;
  }

  // Propriétés calculées pour le virtual scroll
  get totalHeight(): number {
    return this.data ? this.data.length * this.itemHeight : 0;
  }

  get offsetY(): number {
    return this.startIndex * this.itemHeight;
  }
  
  // Méthode pour obtenir l'index de ligne global
  getGlobalRowIndex(localIndex: number): number {
    return this.startIndex + localIndex;
  }

  /**
   * Vérifie si une cellule contient une formule (valeur calculée)
   * @param globalRowIndex Index global de la ligne
   * @param columnKey Clé de la colonne (ex: "column-0")
   */
  isFormulaCell(globalRowIndex: number, columnKey: string): boolean {
    const page = Math.floor(globalRowIndex / this.PAGE_SIZE);
    const rowInPage = globalRowIndex - page * this.PAGE_SIZE;
    const cachedCells = this.formulaCellsCache.get(page);
    if (cachedCells && Array.isArray(cachedCells)) {
      return cachedCells.some(c => c.row === rowInPage && c.col === columnKey);
    }
    return this.formulaCells.some(c => c.row === globalRowIndex && c.col === columnKey);
  }

  // Méthode pour calculer les largeurs des colonnes
  calculateColumnWidths() {
    if (!this.data || this.data.length === 0) {
      this.columnWidths = {};
      return;
    }

    this.columnWidths = {};
    const columnKeys = this.getColumnKeys();

    // Calculer la largeur pour chaque colonne
    columnKeys.forEach(columnKey => {
      let maxWidth = this.minColumnWidth;
      
      // Vérifier l'en-tête de colonne
      const columnIndex = this.getColumnIndex(columnKey);
      const headerText = this.getColumnLetter(columnIndex);
      const headerWidth = this.estimateTextWidth(headerText) + 40; // +40 pour les boutons
      maxWidth = Math.max(maxWidth, headerWidth);

      // Vérifier le contenu des cellules (échantillon pour les performances)
      const sampleSize = Math.min(100, this.data.length); // Limiter à 100 lignes pour les performances
      for (let i = 0; i < sampleSize; i++) {
        const cellValue = this.data[i][columnKey];
        if (cellValue !== null && cellValue !== undefined) {
          const cellText = String(cellValue);
          const cellWidth = this.estimateTextWidth(cellText) + 20; // +20 pour le padding
          maxWidth = Math.max(maxWidth, cellWidth);
        }
      }

      // Appliquer les limites min/max
      maxWidth = Math.max(this.minColumnWidth, Math.min(this.maxColumnWidth, maxWidth));
      this.columnWidths[columnKey] = maxWidth;
    });


  }

  // Méthode pour obtenir les clés des colonnes
  private getColumnKeys(): string[] {
    if (!this.data || this.data.length === 0) return [];
    
    const firstRow = this.data[0];
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

  // Méthode pour obtenir l'index d'une colonne à partir de sa clé
  private getColumnIndex(columnKey: string): number {
    return parseInt(columnKey.replace('column-', ''));
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

  // Méthodes pour gérer la limite de sélection de colonnes
  getSelectedColumnsCount(): number {
    // OPTIMISATION: Mettre en cache le résultat pour éviter de recalculer à chaque cycle
    const currentHash = this.selection.length.toString();
    if (currentHash === this.selectionHash && this.cachedSelectedColumnsCount !== undefined) {
      return this.cachedSelectedColumnsCount;
    }
    
    if (!this.selection || this.selection.length === 0) {
      this.cachedSelectedColumnsCount = 0;
      this.selectionHash = currentHash;
      return 0;
    }
    
    const uniqueColumns = new Set<number>();
    this.selection.forEach(cell => {
      uniqueColumns.add(cell.col);
    });
    
    this.cachedSelectedColumnsCount = uniqueColumns.size;
    this.selectionHash = currentHash;
    return this.cachedSelectedColumnsCount;
  }

  canSelectMoreColumns(): boolean {
    return this.getSelectedColumnsCount() < this.maxSelectedColumns;
  }

  isColumnSelectionLimitReached(): boolean {
    return this.getSelectedColumnsCount() >= this.maxSelectedColumns;
  }

  getColumnSelectionInfo(): string {
    const selectedCount = this.getSelectedColumnsCount();
    const remaining = this.maxSelectedColumns - selectedCount;
    
    if (selectedCount === 0) {
      return `Aucune colonne sélectionnée (limite: ${this.maxSelectedColumns})`;
    } else if (remaining > 0) {
      return `${selectedCount} colonnes sélectionnées (${remaining} restantes)`;
    } else {
      return `${selectedCount} colonnes sélectionnées (limite atteinte)`;
    }
  }

  // Méthodes pour vérifier si les boutons doivent être désactivés
  isSelectAllButtonDisabled(): boolean {
    // Le bouton "Toutes les cellules" reste toujours actif
    // La logique de limitation est gérée dans selectAllCells()
    return false;
  }

  isSelectColumnButtonDisabled(colIndex: number): boolean {
    const isColumnAlreadySelected = this.selection.some(sel => sel.col === colIndex);
    return (this.selectionMode === 'auto' || this.selectionMode === 'select-only') && 
           !isColumnAlreadySelected && 
           this.isColumnSelectionLimitReached();
  }

  isSelectRowButtonDisabled(rowIndex: number): boolean {
    // Les boutons de ligne restent toujours actifs
    // La logique de limitation est gérée dans selectRow()
    return false;
  }

  // Méthodes de validation pour empêcher le changement d'étape
  validateSelection(): boolean {
    // Invalider le cache pour forcer le recalcul
    this.selectionHash = '';
    const selectedCount = this.getSelectedColumnsCount();
    this.hasColumnLimitError = selectedCount > this.maxSelectedColumns;
    const isValid = !this.hasColumnLimitError;
    this.validationChange.emit(isValid);
    return isValid;
  }

  canProceedToNextStep(): boolean {
    return this.validateSelection();
  }

  getColumnLimitErrorMessage(): string {
    const selectedCount = this.getSelectedColumnsCount();
    const excess = selectedCount - this.maxSelectedColumns;
    return `⚠️ Limite dépassée : ${selectedCount} colonnes sélectionnées (limite: ${this.maxSelectedColumns}). Veuillez désélectionner ${excess} colonne(s) pour continuer.`;
  }

  // Méthode pour calculer la largeur totale du tableau
  getTotalTableWidth(): number {
    if (!this.data || this.data.length === 0) {
      return 1000; // Largeur par défaut
    }

    let totalWidth = 70; // Largeur de la colonne des numéros de ligne
    
    const columnKeys = this.getColumnKeys();
    columnKeys.forEach(columnKey => {
      totalWidth += this.getColumnWidth(columnKey);
    });

    return totalWidth;
  }

  get columns(): string[] {
    if (!this.data || this.data.length === 0) {
      return [];
    }
    
    // Utiliser une approche basée sur les indices pour garantir l'ordre
    const firstRow = this.data[0];
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
    
    // Convertir les clés en en-têtes lisibles
    return columnKeys.map(key => {
      if (key.startsWith('column-')) {
        const columnIndex = key.replace('column-', '');
        return `Colonne ${parseInt(columnIndex) + 1}`;
      }
      return key;
    });
  }

  setSelectionMode(mode: 'auto' | 'select-only' | 'deselect-only') {
    this.selectionMode = mode;
  }

  setSelectionType(type: 'cell' | 'row' | 'column') {
    this.selectionType = type;
  }

  /**
   * Retourne le label du type de sélection actuel
   */
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

  /**
   * Retourne le label du mode de sélection actuel
   */
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

  /**
   * Gère le clic sur une cellule de numérotation (colonne des numéros de ligne)
   */
  onRowNumberCellMouseDown(row: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Protéger la première ligne si headersOnFirstRow est activé
    if (this.isRowProtected(row)) {
      return;
    }
    
    // Passer automatiquement en mode sélection par ligne
    this.selectionType = 'row';
    
    // Sélectionner la ligne correspondante
    this.selectRow(row);
    
    // Remettre automatiquement le type de sélection sur "par cellule"
    this.selectionType = 'cell';
  }

  /**
   * Gère le clic sur un en-tête de colonne (A, B, C...)
   */
  onColumnHeaderMouseDown(colIndex: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Passer automatiquement en mode sélection par colonne
    this.selectionType = 'column';
    
    // Sélectionner la colonne correspondante
    this.selectColumn(colIndex);
    
    // Remettre automatiquement le type de sélection sur "par cellule"
    this.selectionType = 'cell';
  }

  // Début de sélection
  onCellMouseDown(row: number, col: number, event: MouseEvent) {
    // Protéger la première ligne si headersOnFirstRow est activé
    if (this.isRowProtected(row)) {
      event.preventDefault();
      return;
    }
    
    event.preventDefault();
    this.isSelecting = true;
    this.selectionStart = { row, col };
    if (this.selectionMode === 'auto') {
      this.dragRect = { start: { row, col }, end: { row, col } };
      this.tempSelection = this.getRectCells(this.selectionStart, this.selectionStart);
    }
    if (!event.shiftKey && this.selectionMode !== 'auto') {
      this.handleCellSelection(row, col);
    }
    
    // Ajouter les listeners globaux pour le drag avec auto-scroll
    this.addGlobalListeners();
  }

  // Sélection en glissant
  onCellMouseOver(row: number, col: number, event: MouseEvent) {
    // Mettre à jour la position survolée
    this.currentHoveredRow = row;
    this.currentHoveredCol = col;
    
    if (this.isSelecting && this.selectionStart) {
      if (this.selectionMode === 'auto') {
        this.dragRect = { start: this.selectionStart, end: { row, col } };
        this.tempSelection = this.getRectCells(this.selectionStart, { row, col });
      } else {
        this.handleRectSelection(this.selectionStart, { row, col });
      }
    }
  }

  // Fin de sélection
  onCellMouseUp(row: number, col: number, event: MouseEvent) {
    // La gestion du mouseup est maintenant faite dans handleGlobalMouseUp
    // Cette méthode est conservée pour compatibilité mais peut être appelée directement depuis le template
    if (this.isSelecting) {
      this.handleGlobalMouseUp(event);
    }
  }

  // Sélectionne/désélectionne selon le type et le mode
  handleCellSelection(row: number, col: number) {
    // Protéger la première ligne si headersOnFirstRow est activé
    if (this.isRowProtected(row)) {
      return;
    }
    
    let cellsToToggle: { row: number, col: number }[] = [];
    
    // Déterminer les cellules à sélectionner selon le type
    if (this.selectionType === 'cell') {
      // Mode cellule : sélectionner uniquement la cellule cliquée
      cellsToToggle = [{ row, col }];
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner toute la ligne
      // Si des colonnes sont déjà sélectionnées, ne sélectionner que ces colonnes
      const selectedColumns = this.getSelectedColumns();
      if (selectedColumns.length > 0) {
        // Sélectionner seulement les colonnes déjà sélectionnées pour cette ligne
        cellsToToggle = selectedColumns.map(colIndex => ({ row, col: colIndex }));
      } else {
        // Aucune colonne sélectionnée : sélectionner toutes les colonnes de la ligne
        const totalCols = this.columns.length;
        for (let c = 0; c < totalCols; c++) {
          cellsToToggle.push({ row, col: c });
        }
      }
    } else if (this.selectionType === 'column') {
      // Mode colonne : sélectionner toute la colonne
      // Si des lignes sont déjà sélectionnées, ne sélectionner que ces lignes
      const selectedRows = this.getSelectedRows();
      const totalRows = this.getTotalAvailableRows();
      if (selectedRows.length > 0) {
        // Sélectionner seulement les lignes déjà sélectionnées pour cette colonne
        cellsToToggle = selectedRows.map(rowIndex => ({ row: rowIndex, col }));
      } else {
        // Aucune ligne sélectionnée : sélectionner toutes les lignes de la colonne
        for (let r = 0; r < totalRows; r++) {
          cellsToToggle.push({ row: r, col });
        }
      }
    }
    
    // Appliquer la sélection selon le mode d'action
    cellsToToggle.forEach(cell => {
      // Protéger la première ligne si headersOnFirstRow est activé
      if (this.isRowProtected(cell.row)) {
        return;
      }
      
      const idx = this.selection.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
    
      // Vérifier si la colonne est déjà sélectionnée (pour la limite)
      const isColumnAlreadySelected = this.selection.some(sel => sel.col === cell.col);
    
    if (this.selectionMode === 'auto') {
        // Mode auto : toggle
      if (idx === -1) {
        // Vérifier la limite de colonnes avant d'ajouter
        if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
          return;
        }
          this.selection.push(cell);
      } else {
        this.selection.splice(idx, 1);
      }
    } else if (this.selectionMode === 'select-only') {
        // Mode select-only : ajouter
      if (idx === -1) {
        // Vérifier la limite de colonnes avant d'ajouter
        if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
          return;
        }
          this.selection.push(cell);
      }
    } else if (this.selectionMode === 'deselect-only') {
        // Mode deselect-only : retirer
      if (idx !== -1) {
        this.selection.splice(idx, 1);
      }
    }
    });
    
    this.selectionChange.emit(this.selection);
    this.validateSelection(); // Mettre à jour l'état d'erreur
  }

  // Helper pour obtenir les colonnes déjà sélectionnées
  private getSelectedColumns(): number[] {
    const columns = new Set<number>();
    this.selection.forEach(cell => {
      columns.add(cell.col);
    });
    return Array.from(columns).sort((a, b) => a - b);
  }

  // Helper pour obtenir les lignes déjà sélectionnées
  private getSelectedRows(): number[] {
    const rows = new Set<number>();
    this.selection.forEach(cell => {
      rows.add(cell.row);
    });
    return Array.from(rows).sort((a, b) => a - b);
  }

  // Sélection rectangulaire selon le type
  handleRectSelection(start: { row: number, col: number }, end: { row: number, col: number }) {
    let rect: { row: number, col: number }[] = [];
    
    if (this.selectionType === 'cell') {
      // Mode cellule : sélection rectangulaire classique
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
      for (let c = minCol; c <= maxCol; c++) {
        rect.push({ row: r, col: c });
      }
    }
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner des lignes entières
      const selectedColumns = this.getSelectedColumns();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const colsToUse = selectedColumns.length > 0 ? selectedColumns : Array.from({ length: this.columns.length }, (_, i) => i);
      
      for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
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
      const rowsToUse = selectedRows.length > 0 ? selectedRows : Array.from({ length: totalRows }, (_, i) => i);
      
      for (let c = minCol; c <= maxCol; c++) {
        rowsToUse.forEach(row => {
          // Protéger la première ligne si headersOnFirstRow est activé
          if (!this.isRowProtected(row)) {
            rect.push({ row, col: c });
          }
        });
      }
    }
    
    // Appliquer la sélection selon le mode d'action
    if (this.selectionMode === 'auto') {
      rect.forEach(cell => {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(cell.row)) {
          return;
        }
        const idx = this.selection.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          const isColumnAlreadySelected = this.selection.some(sel => sel.col === cell.col);
          if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
            return;
          }
          this.selection.push(cell);
        } else {
          this.selection.splice(idx, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      rect.forEach(cell => {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(cell.row)) {
          return;
        }
        if (!this.selection.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          const isColumnAlreadySelected = this.selection.some(sel => sel.col === cell.col);
          if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
            return;
          }
          this.selection.push(cell);
        }
      });
    } else if (this.selectionMode === 'deselect-only') {
      this.selection = this.selection.filter(sel => !rect.some(cell => cell.row === sel.row && cell.col === sel.col));
    }
    
    this.selectionChange.emit(this.selection);
    this.validateSelection(); // Mettre à jour l'état d'erreur
  }

  // Toggle toutes les cellules d'une zone rectangulaire (pour le mode auto) selon le type
  handleRectToggle(start: { row: number, col: number }, end: { row: number, col: number }) {
    let rect: { row: number, col: number }[] = [];
    
    if (this.selectionType === 'cell') {
      // Mode cellule : sélection rectangulaire classique
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
      for (let c = minCol; c <= maxCol; c++) {
        rect.push({ row: r, col: c });
      }
    }
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner des lignes entières
      const selectedColumns = this.getSelectedColumns();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const colsToUse = selectedColumns.length > 0 ? selectedColumns : Array.from({ length: this.columns.length }, (_, i) => i);
      
      for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
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
      const rowsToUse = selectedRows.length > 0 ? selectedRows : Array.from({ length: totalRows }, (_, i) => i);
      
      for (let c = minCol; c <= maxCol; c++) {
        rowsToUse.forEach(row => {
          // Protéger la première ligne si headersOnFirstRow est activé
          if (!this.isRowProtected(row)) {
            rect.push({ row, col: c });
          }
        });
      }
    }
    
    rect.forEach(cell => {
      // Protéger la première ligne si headersOnFirstRow est activé
      if (this.isRowProtected(cell.row)) {
        return;
      }
      const idx = this.selection.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
      if (idx === -1) {
        this.selection.push(cell);
      } else {
        this.selection.splice(idx, 1);
      }
    });
  }

  // Retourne toutes les cellules d'un rectangle selon le type de sélection
  getRectCells(start: { row: number, col: number }, end: { row: number, col: number }): { row: number, col: number }[] {
    let rect: { row: number, col: number }[] = [];
    
    if (this.selectionType === 'cell') {
      // Mode cellule : sélection rectangulaire classique
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
      for (let c = minCol; c <= maxCol; c++) {
        rect.push({ row: r, col: c });
      }
    }
    } else if (this.selectionType === 'row') {
      // Mode ligne : sélectionner des lignes entières
      const selectedColumns = this.getSelectedColumns();
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const colsToUse = selectedColumns.length > 0 ? selectedColumns : Array.from({ length: this.columns.length }, (_, i) => i);
      
      for (let r = minRow; r <= maxRow; r++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (this.isRowProtected(r)) {
          continue;
        }
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
      const rowsToUse = selectedRows.length > 0 ? selectedRows : Array.from({ length: totalRows }, (_, i) => i);
      
      for (let c = minCol; c <= maxCol; c++) {
        rowsToUse.forEach(row => {
          // Protéger la première ligne si headersOnFirstRow est activé
          if (!this.isRowProtected(row)) {
            rect.push({ row, col: c });
          }
        });
      }
    }
    
    return rect;
  }

  // Applique la classe CSS si la cellule est sélectionnée
  getCellClass(row: number, col: number): string {
    // tempSelection ne doit être utilisé que pendant une sélection active
    if (this.isSelecting && this.tempSelection.some(sel => sel.row === row && sel.col === col)) {
      return 'temp-selected-cell';
    }
    return this.selection.some(sel => sel.row === row && sel.col === col) ? 'selected-cell' : '';
  }

  getColumnLetter(index: number): string {
    let letter = '';
    let n = index;
    do {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letter;
  }

  onSheetChange(index: number) {
    // Mettre à jour la valeur locale
    this.selectedSheetIndex = index;
    
    // Émettre l'événement vers le composant parent
    this.selectedSheetIndexChange.emit(index);
  }

  /**
   * Obtient la feuille sélectionnée pour le destinataire actuel
   */
  getRecipientSelectedSheet(): number {
    if (this.recipientIndex >= 0 && this.recipientSelectedSheets[this.recipientIndex] !== undefined) {
      return this.recipientSelectedSheets[this.recipientIndex]!;
    }
    return this.selectedSheetIndex;
  }

  // Méthodes de sélection rapide

  /**
   * Sélectionne toutes les cellules du tableau selon le mode actif
   */
  selectAllCells() {
    const startTime = performance.now();
    this.logger.log('🚀 [selectAllCells] Début de la sélection de toutes les cellules');
    
    if (!this.data || this.data.length === 0) {
      this.logger.warn('⚠️ [selectAllCells] Pas de données disponibles');
      return;
    }
    
    const timeBeforeZone = performance.now();
    this.logger.log(`⏱️ [selectAllCells] Temps avant runOutsideAngular: ${(timeBeforeZone - startTime).toFixed(2)}ms`);
    
    // OPTIMISATION: Exécuter l'opération en dehors de la zone Angular pour éviter les cycles de détection
    this.ngZone.runOutsideAngular(() => {
      const timeInZone = performance.now();
      this.logger.log(`⏱️ [selectAllCells] Entrée dans runOutsideAngular: ${(timeInZone - timeBeforeZone).toFixed(2)}ms`);
      
      // IMPORTANT: Utiliser DIRECTEMENT this.totalRows (Input) qui vient de sheets[sheetIndex].totalRows
      // Cette valeur est mise à jour depuis la réponse API (response.totalRows)
      // Ne pas utiliser getTotalAvailableRows() car il peut retourner totalRowsFromBackend qui est incorrect
      // totalRows représente le nombre réel de lignes avec des données, pas la limite Excel
      
      // Log des valeurs pour debug
      this.logger.log(`🔍 [selectAllCells] DEBUG - this.totalRows (Input): ${this.totalRows}`);
      this.logger.log(`🔍 [selectAllCells] DEBUG - this.totalRowsFromBackend: ${this.totalRowsFromBackend}`);
      this.logger.log(`🔍 [selectAllCells] DEBUG - this.data.length: ${this.data ? this.data.length : 0}`);
      this.logger.log(`🔍 [selectAllCells] DEBUG - sheets[${this.selectedSheetIndex}]?.totalRows: ${this.sheets && this.sheets[this.selectedSheetIndex] ? this.sheets[this.selectedSheetIndex].totalRows : 'N/A'}`);
      
      // Utiliser this.totalRows (Input) qui vient de sheets[sheetIndex].totalRows depuis l'API
      // Si non disponible, utiliser data.length comme fallback
      let totalRows = this.totalRows && this.totalRows > 0 ? this.totalRows : (this.data ? this.data.length : 0);
      
      // SÉCURITÉ: Si totalRows est supérieur à 100000, c'est probablement la limite Excel incorrecte
      // Dans ce cas, utiliser data.length
      const MAX_REASONABLE_ROWS = 100000;
      if (totalRows >= MAX_REASONABLE_ROWS) {
        this.logger.warn(`⚠️ [selectAllCells] totalRows (${totalRows}) semble incorrect (limite Excel?), utilisation de data.length (${this.data ? this.data.length : 0})`);
        totalRows = this.data ? this.data.length : 0;
      }
      
      const totalCols = this.columns.length;
      
      this.logger.log(`📊 [selectAllCells] Dimensions FINALES: ${totalRows} lignes × ${totalCols} colonnes = ${totalRows * totalCols} cellules`);
      this.logger.log(`📊 [selectAllCells] Sélection actuelle: ${this.selection.length} cellules`);
      this.logger.log(`📊 [selectAllCells] Mode: ${this.selectionMode}`);
      
      // Calculer le nombre de cellules à traiter (en excluant la première ligne si protégée)
      const startRow = this.isRowProtected(0) ? 1 : 0;
      this.logger.log(`📊 [selectAllCells] Ligne de départ: ${startRow} (première ligne protégée: ${this.isRowProtected(0)})`);
      
      const timeBeforeSets = performance.now();
      
      // OPTIMISATION: Créer un Set pour les vérifications O(1) au lieu de O(n)
      const selectionSet = new Set<string>();
      const selectedColumnsSet = new Set<number>();
      
      // Pré-calculer les colonnes déjà sélectionnées une seule fois
      this.selection.forEach(cell => {
        const key = `${cell.row},${cell.col}`;
        selectionSet.add(key);
        selectedColumnsSet.add(cell.col);
      });
      
      const timeAfterSets = performance.now();
      this.logger.log(`⏱️ [selectAllCells] Création des Sets: ${(timeAfterSets - timeBeforeSets).toFixed(2)}ms (${this.selection.length} cellules)`);
      
      const isLimitReached = selectedColumnsSet.size >= this.maxSelectedColumns;
      this.logger.log(`📊 [selectAllCells] Colonnes sélectionnées: ${selectedColumnsSet.size}/${this.maxSelectedColumns}, Limite atteinte: ${isLimitReached}`);
      
      let newSelection: { row: number, col: number }[] = [];
      const timeBeforeLoop = performance.now();
      
      if (this.selectionMode === 'auto') {
        this.logger.log('🔄 [selectAllCells] Mode AUTO: toggle toutes les cellules');
        // Mode auto : toggle toutes les cellules
        const cellsToAdd: { row: number, col: number }[] = [];
        
        const loopStartTime = performance.now();
        let iterations = 0;
        
        for (let row = startRow; row < totalRows; row++) {
          for (let col = 0; col < totalCols; col++) {
            iterations++;
            const key = `${row},${col}`;
            const isSelected = selectionSet.has(key);
            const isColumnAlreadySelected = selectedColumnsSet.has(col);
            
            if (isSelected) {
              // Cellule déjà sélectionnée : on la retire (toggle)
              // Ne pas l'ajouter
            } else {
              // Cellule non sélectionnée : vérifier la limite avant d'ajouter
              if (!isColumnAlreadySelected && isLimitReached) {
                continue;
              }
              cellsToAdd.push({ row, col });
            }
          }
          
          // Log tous les 100 lignes pour suivre la progression
          if ((row - startRow) % 100 === 0 && row > startRow) {
            const elapsed = performance.now() - loopStartTime;
            this.logger.log(`⏳ [selectAllCells] Progression: ${row - startRow}/${totalRows - startRow} lignes traitées, ${cellsToAdd.length} cellules à ajouter, ${elapsed.toFixed(2)}ms écoulées`);
          }
        }
        
        const loopEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Boucle principale terminée: ${(loopEndTime - loopStartTime).toFixed(2)}ms (${iterations} itérations, ${cellsToAdd.length} cellules à ajouter)`);
        
        const filterStartTime = performance.now();
        // Construire la nouvelle sélection : garder celles qui ne sont pas dans la plage allCells
        const filteredSelection: { row: number, col: number }[] = [];
        for (let i = 0; i < this.selection.length; i++) {
          const sel = this.selection[i];
          // Garder les cellules qui sont en dehors de la plage allCells
          if (sel.row < startRow || sel.row >= totalRows || sel.col < 0 || sel.col >= totalCols) {
            filteredSelection.push(sel);
          }
        }
        const filterEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Filtrage de la sélection: ${(filterEndTime - filterStartTime).toFixed(2)}ms (${filteredSelection.length} cellules conservées)`);
        
        const mergeStartTime = performance.now();
        // OPTIMISATION: Utiliser une boucle au lieu de spread operator pour les grands tableaux
        newSelection = filteredSelection;
        for (let i = 0; i < cellsToAdd.length; i++) {
          newSelection.push(cellsToAdd[i]);
        }
        const mergeEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Fusion des tableaux: ${(mergeEndTime - mergeStartTime).toFixed(2)}ms (${newSelection.length} cellules totales)`);
        
      } else if (this.selectionMode === 'select-only') {
        this.logger.log('➕ [selectAllCells] Mode SELECT-ONLY: ajouter toutes les cellules');
        // Mode select-only : ajouter toutes les cellules
        const cellsToAdd: { row: number, col: number }[] = [];
        
        const loopStartTime = performance.now();
        for (let row = startRow; row < totalRows; row++) {
          for (let col = 0; col < totalCols; col++) {
            const key = `${row},${col}`;
            if (!selectionSet.has(key)) {
              // Vérifier la limite de colonnes avant d'ajouter
              const isColumnAlreadySelected = selectedColumnsSet.has(col);
              if (!isColumnAlreadySelected && isLimitReached) {
                continue;
              }
              cellsToAdd.push({ row, col });
            }
          }
          
          // Log tous les 100 lignes
          if ((row - startRow) % 100 === 0 && row > startRow) {
            const elapsed = performance.now() - loopStartTime;
            this.logger.log(`⏳ [selectAllCells] Progression: ${row - startRow}/${totalRows - startRow} lignes traitées, ${cellsToAdd.length} cellules à ajouter, ${elapsed.toFixed(2)}ms écoulées`);
          }
        }
        const loopEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Boucle principale terminée: ${(loopEndTime - loopStartTime).toFixed(2)}ms (${cellsToAdd.length} cellules à ajouter)`);
        
        const mergeStartTime = performance.now();
        // OPTIMISATION: Utiliser une boucle au lieu de spread operator
        newSelection = [...this.selection];
        for (let i = 0; i < cellsToAdd.length; i++) {
          newSelection.push(cellsToAdd[i]);
        }
        const mergeEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Fusion des tableaux: ${(mergeEndTime - mergeStartTime).toFixed(2)}ms (${newSelection.length} cellules totales)`);
        
      } else if (this.selectionMode === 'deselect-only') {
        this.logger.log('➖ [selectAllCells] Mode DESELECT-ONLY: retirer toutes les cellules');
        // Mode deselect-only : retirer toutes les cellules
        // OPTIMISATION: Utiliser un Set pour allCells pour une recherche O(1)
        const allCellsSetStartTime = performance.now();
        const allCellsSet = new Set<string>();
        for (let row = startRow; row < totalRows; row++) {
          for (let col = 0; col < totalCols; col++) {
            allCellsSet.add(`${row},${col}`);
          }
        }
        const allCellsSetEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Création du Set allCells: ${(allCellsSetEndTime - allCellsSetStartTime).toFixed(2)}ms`);
        
        const filterStartTime = performance.now();
        // Filtrer en une seule passe
        newSelection = [];
        for (let i = 0; i < this.selection.length; i++) {
          const sel = this.selection[i];
          const key = `${sel.row},${sel.col}`;
          if (!allCellsSet.has(key)) {
            newSelection.push(sel);
          }
        }
        const filterEndTime = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Filtrage: ${(filterEndTime - filterStartTime).toFixed(2)}ms (${newSelection.length} cellules conservées)`);
      }
      
      const timeAfterLoop = performance.now();
      this.logger.log(`⏱️ [selectAllCells] Traitement principal terminé: ${(timeAfterLoop - timeBeforeLoop).toFixed(2)}ms`);
      this.logger.log(`📊 [selectAllCells] Nouvelle sélection: ${newSelection.length} cellules`);
      
      const timeBeforeUpdate = performance.now();
      // OPTIMISATION: Mettre à jour la sélection et invalider le cache
      this.selection = newSelection;
      this.selectionHash = ''; // Invalider le cache
      const timeAfterUpdate = performance.now();
      this.logger.log(`⏱️ [selectAllCells] Mise à jour de la sélection: ${(timeAfterUpdate - timeBeforeUpdate).toFixed(2)}ms`);
      
      const timeBeforeRAF = performance.now();
      // OPTIMISATION: Différer l'émission et la validation dans la zone Angular avec requestAnimationFrame
      requestAnimationFrame(() => {
        const timeInRAF = performance.now();
        this.logger.log(`⏱️ [selectAllCells] Entrée dans requestAnimationFrame: ${(timeInRAF - timeBeforeRAF).toFixed(2)}ms après la fin du traitement`);
        
        const timeBeforeEmit = performance.now();
        this.ngZone.run(() => {
          const timeInRun = performance.now();
          this.logger.log(`⏱️ [selectAllCells] Entrée dans ngZone.run: ${(timeInRun - timeBeforeEmit).toFixed(2)}ms`);
          
          const emitStartTime = performance.now();
          this.selectionChange.emit(this.selection);
          const emitEndTime = performance.now();
          this.logger.log(`⏱️ [selectAllCells] Émission selectionChange: ${(emitEndTime - emitStartTime).toFixed(2)}ms`);
          
          const validateStartTime = performance.now();
          this.validateSelection();
          const validateEndTime = performance.now();
          this.logger.log(`⏱️ [selectAllCells] Validation: ${(validateEndTime - validateStartTime).toFixed(2)}ms`);
          
          const markStartTime = performance.now();
          this.cdr.markForCheck(); // Forcer la détection de changement
          const markEndTime = performance.now();
          this.logger.log(`⏱️ [selectAllCells] markForCheck: ${(markEndTime - markStartTime).toFixed(2)}ms`);
          
          const totalTime = performance.now() - startTime;
          this.logger.log(`✅ [selectAllCells] TERMINÉ - Temps total: ${totalTime.toFixed(2)}ms`);
        });
      });
    });
  }

  /**
   * Sélectionne une ligne spécifique selon le mode actif
   */
  selectRow(rowIndex: number) {
    if (!this.data || this.data.length === 0) {
      return;
    }
    
    // Protéger la première ligne si headersOnFirstRow est activé
    if (this.isRowProtected(rowIndex)) {
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
    for (let col = 0; col < this.columns.length; col++) {
      rowCells.push({ row: rowIndex, col });
      }
    }
    
    if (this.selectionMode === 'auto') {
      // Mode auto : toggle la ligne
      rowCells.forEach(cell => {
        const idx = this.selection.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          // Vérifier la limite de colonnes avant d'ajouter
          const isColumnAlreadySelected = this.selection.some(sel => sel.col === cell.col);
          if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
            return;
          }
          this.selection.push(cell);
        } else {
          this.selection.splice(idx, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      // Mode select-only : ajouter la ligne (seulement les colonnes déjà sélectionnées)
      rowCells.forEach(cell => {
        if (!this.selection.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          // Vérifier la limite de colonnes avant d'ajouter
          const isColumnAlreadySelected = this.selection.some(sel => sel.col === cell.col);
          if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
            return;
          }
          this.selection.push(cell);
        }
      });
    } else if (this.selectionMode === 'deselect-only') {
      // Mode deselect-only : retirer la ligne
      this.selection = this.selection.filter(sel => 
        !rowCells.some(cell => cell.row === sel.row && cell.col === sel.col)
      );
    }
    
    this.selectionChange.emit(this.selection);
    this.validateSelection(); // Mettre à jour l'état d'erreur
  }

  /**
   * Sélectionne une colonne spécifique selon le mode actif
   */
  selectColumn(colIndex: number) {
    if (!this.data || this.data.length === 0) {
      return;
    }
    
    // Vérifier si la colonne est déjà sélectionnée
    const isColumnAlreadySelected = this.selection.some(sel => sel.col === colIndex);
    
    // Vérifier la limite de colonnes pour les modes qui ajoutent des colonnes
    if ((this.selectionMode === 'auto' && !isColumnAlreadySelected) || 
        this.selectionMode === 'select-only') {
      if (!isColumnAlreadySelected && this.isColumnSelectionLimitReached()) {
        return;
      }
    }
    
    const colCells: { row: number, col: number }[] = [];
    // Si des lignes sont déjà sélectionnées, ne sélectionner que ces lignes
    const selectedRows = this.getSelectedRows();
    const totalRows = this.getTotalAvailableRows();
    if (selectedRows.length > 0) {
      // Sélectionner seulement les lignes déjà sélectionnées pour cette colonne
      selectedRows.forEach(rowIndex => {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (!this.isRowProtected(rowIndex)) {
          colCells.push({ row: rowIndex, col: colIndex });
        }
      });
    } else {
      // Aucune ligne sélectionnée : sélectionner toutes les lignes de la colonne
      for (let row = 0; row < totalRows; row++) {
        // Protéger la première ligne si headersOnFirstRow est activé
        if (!this.isRowProtected(row)) {
      colCells.push({ row, col: colIndex });
        }
      }
    }
    
    if (this.selectionMode === 'auto') {
      // Mode auto : toggle la colonne
      colCells.forEach(cell => {
        const idx = this.selection.findIndex(sel => sel.row === cell.row && sel.col === cell.col);
        if (idx === -1) {
          this.selection.push(cell);
        } else {
          this.selection.splice(idx, 1);
        }
      });
    } else if (this.selectionMode === 'select-only') {
      // Mode select-only : ajouter la colonne
      colCells.forEach(cell => {
        if (!this.selection.some(sel => sel.row === cell.row && sel.col === cell.col)) {
          this.selection.push(cell);
        }
      });
    } else if (this.selectionMode === 'deselect-only') {
      // Mode deselect-only : retirer la colonne
      this.selection = this.selection.filter(sel => 
        !colCells.some(cell => cell.row === sel.row && cell.col === sel.col)
      );
    }
    
    this.selectionChange.emit(this.selection);
    this.validateSelection(); // Mettre à jour l'état d'erreur
  }

  /**
   * Efface toute la sélection
   */
  clearSelection() {
    this.selection = [];
    this.selectionChange.emit(this.selection);
    this.validateSelection(); // Mettre à jour l'état d'erreur
  }

  /**
   * Gère l'événement quand la souris quitte le tableau
   */
  onTableMouseLeave() {
    this.currentHoveredRow = -1;
    this.currentHoveredCol = -1;
  }

  /**
   * Génère le tooltip pour le bouton "Toutes les cellules" selon le mode actif
   */
  getSelectAllTooltip(): string {
    const isLimitReached = this.isColumnSelectionLimitReached();
    
    switch (this.selectionMode) {
      case 'auto':
        if (isLimitReached) {
          return 'Basculer toutes les cellules (seulement les colonnes déjà sélectionnées)';
        }
        return 'Basculer toutes les cellules (sélectionner/désélectionner)';
      case 'select-only':
        if (isLimitReached) {
          return 'Sélectionner toutes les cellules (seulement les colonnes déjà sélectionnées)';
        }
        return 'Sélectionner toutes les cellules';
      case 'deselect-only':
        return 'Désélectionner toutes les cellules';
      default:
        if (isLimitReached) {
          return 'Sélectionner toutes les cellules (seulement les colonnes déjà sélectionnées)';
        }
        return 'Sélectionner toutes les cellules';
    }
  }

  /**
   * Génère le tooltip pour le bouton de ligne selon le mode actif
   */
  getSelectRowTooltip(rowIndex: number): string {
    const rowNumber = rowIndex + 1;
    const isLimitReached = this.isColumnSelectionLimitReached();
    
    switch (this.selectionMode) {
      case 'auto':
        if (isLimitReached) {
          return `Basculer la ligne ${rowNumber} (seulement les colonnes déjà sélectionnées)`;
        }
        return `Basculer la ligne ${rowNumber} (sélectionner/désélectionner)`;
      case 'select-only':
        if (isLimitReached) {
          return `Sélectionner la ligne ${rowNumber} (seulement les colonnes déjà sélectionnées)`;
        }
        return `Sélectionner la ligne ${rowNumber}`;
      case 'deselect-only':
        return `Désélectionner la ligne ${rowNumber}`;
      default:
        if (isLimitReached) {
          return `Sélectionner la ligne ${rowNumber} (seulement les colonnes déjà sélectionnées)`;
        }
        return `Sélectionner la ligne ${rowNumber}`;
    }
  }

  /**
   * Génère le tooltip pour le bouton de colonne selon le mode actif
   */
  getSelectColumnTooltip(colIndex: number): string {
    if (this.isSelectColumnButtonDisabled(colIndex)) {
      return `Limite de ${this.maxSelectedColumns} colonnes atteinte - impossible d'ajouter plus de colonnes`;
    }
    
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
   * Retourne le nombre de cellules sélectionnées
   */
  getSelectedCellsCount(): number {
    return this.selection.length;
  }

  /**
   * Vérifie si une ligne est protégée (première ligne quand headersOnFirstRow est activé)
   */
  isRowProtected(rowIndex: number): boolean {
    return this.headersOnFirstRow && rowIndex === 0;
  }

  /**
   * Gère le changement de la checkbox "Entêtes sur la première ligne"
   */
  onHeadersOnFirstRowChange(value: boolean) {
    this.headersOnFirstRow = value;
    this.headersOnFirstRowChange.emit(value);
    
    // Si on désactive la protection, ne rien faire
    // Si on active la protection, retirer toutes les cellules de la première ligne de la sélection
    if (value) {
      this.selection = this.selection.filter(sel => sel.row !== 0);
      this.selectionChange.emit(this.selection);
      this.validateSelection();
    }
  }

  /**
   * Nettoie les ressources lors de la destruction du composant
   */
  ngOnDestroy() {
    this.stopAutoScroll();
    this.removeGlobalListeners();
  }

  /**
   * Convertit les coordonnées de la souris en coordonnées de cellule
   * Utilise elementFromPoint pour une précision maximale
   */
  private getCellFromMousePosition(event: MouseEvent): { row: number, col: number } | null {
    if (!this.scrollContainer?.nativeElement) {
      return null;
    }

    const container = this.scrollContainer.nativeElement;
    
    // Essayer d'abord de trouver directement l'élément TD sous la souris
    const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
    if (elementUnderMouse) {
      // Chercher la cellule TD la plus proche
      const td = elementUnderMouse.closest('td');
      if (td) {
        // Vérifier si c'est une cellule de données (pas la colonne des numéros)
        const tr = td.closest('tr');
        if (tr && tr.parentElement?.tagName === 'TBODY') {
          // Trouver l'index de la colonne dans le TR
          const cells = Array.from(tr.querySelectorAll('td'));
          const colIndex = cells.indexOf(td);
          
          // Si colIndex est 0, c'est la colonne des numéros, utiliser la première colonne de données
          if (colIndex === 0) {
            // Trouver l'index de la ligne dans le tbody
            const tbody = tr.parentElement;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const rowIndex = rows.indexOf(tr);
            
            if (rowIndex >= 0) {
              // Utiliser getGlobalRowIndex pour obtenir l'index réel
              const globalRow = this.getGlobalRowIndex(rowIndex);
              return { row: globalRow, col: 0 };
            }
          } else if (colIndex > 0) {
            // C'est une colonne de données
            const tbody = tr.parentElement;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const rowIndex = rows.indexOf(tr);
            
            if (rowIndex >= 0) {
              const globalRow = this.getGlobalRowIndex(rowIndex);
              const col = colIndex - 1; // Soustraire 1 car la première colonne est celle des numéros
              return { row: globalRow, col };
            }
          }
        }
      }
    }

    // Fallback : calcul mathématique si elementFromPoint ne fonctionne pas
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    const ROW_NUMBER_COLUMN_WIDTH = 70;
    
    // Calculer la colonne
    let col = -1;
    const columnKeys = this.getColumnKeys();
    
    if (x >= 0 && x < ROW_NUMBER_COLUMN_WIDTH) {
      col = 0;
    } else {
      const absoluteX = x - ROW_NUMBER_COLUMN_WIDTH + scrollLeft;
      let currentX = 0;
      for (let i = 0; i < columnKeys.length; i++) {
        const colWidth = this.getColumnWidth(columnKeys[i]);
        if (absoluteX >= currentX && absoluteX < currentX + colWidth) {
          col = i;
          break;
        }
        currentX += colWidth;
      }
    }

    // Obtenir la hauteur de l'en-tête sticky
    const stickyHeader = container.querySelector('.sticky-header-container') as HTMLElement;
    let headerHeight = 0;
    if (stickyHeader) {
      const headerRect = stickyHeader.getBoundingClientRect();
      headerHeight = headerRect.height;
    }

    if (y < headerHeight) {
      return null;
    }

    const dataY = y - headerHeight;
    // Utiliser Math.floor avec un ajustement pour plus de précision
    // On ajoute la moitié de itemHeight pour que le clic au centre de la cellule soit plus précis
    const row = Math.floor((dataY + scrollTop + this.itemHeight / 2) / this.itemHeight);

    if (col >= 0 && row >= 0 && row < this.getTotalAvailableRows()) {
      return { row, col };
    }

    return null;
  }

  /**
   * Gère le mouvement de la souris au niveau global pendant le drag
   */
  private handleGlobalMouseMove = (event: MouseEvent) => {
    if (!this.isSelecting || !this.selectionStart) {
      return;
    }

    // Vérifier l'auto-scroll (même si la souris est en dehors du conteneur)
    this.checkAutoScroll(event);

    // Convertir la position de la souris en coordonnées de cellule
    const cellPos = this.getCellFromMousePosition(event);
    if (cellPos) {
      const { row, col } = cellPos;
      this.currentHoveredRow = row;
      this.currentHoveredCol = col;

      // Mettre à jour la sélection
      if (this.selectionMode === 'auto') {
        this.dragRect = { start: this.selectionStart, end: { row, col } };
        this.tempSelection = this.getRectCells(this.selectionStart, { row, col });
      } else {
        this.handleRectSelection(this.selectionStart, { row, col });
      }
    } else if (this.scrollContainer?.nativeElement) {
      // Si la souris est en dehors du conteneur, calculer une position approximative basée sur le scroll
      const container = this.scrollContainer.nativeElement;
      const rect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      
      // Obtenir la hauteur de l'en-tête sticky
      const stickyHeader = container.querySelector('.sticky-header-container') as HTMLElement;
      const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 0;
      
      // Calculer la ligne approximative basée sur la position Y
      let row = -1;
      if (event.clientY < rect.top) {
        // Au-dessus du conteneur : calculer en fonction de la distance au-dessus
        const distanceAbove = rect.top - event.clientY;
        // La ligne correspond à : scrollTop - distanceAbove (convertie en nombre de lignes)
        const rowOffset = Math.floor(distanceAbove / this.itemHeight);
        row = Math.max(0, Math.floor(scrollTop / this.itemHeight) - rowOffset);
      } else if (event.clientY > rect.bottom) {
        // En-dessous du conteneur : calculer en fonction de la distance en-dessous
        const distanceBelow = event.clientY - rect.bottom;
        // La ligne correspond à : dernière ligne visible + distanceBelow (convertie en nombre de lignes)
        const visibleDataHeight = container.clientHeight - headerHeight;
        const visibleRows = Math.ceil(visibleDataHeight / this.itemHeight);
        const rowOffset = Math.floor(distanceBelow / this.itemHeight);
        row = Math.floor((scrollTop + visibleDataHeight) / this.itemHeight) + rowOffset;
      }
      
      // Si on a une ligne valide, utiliser la dernière colonne connue ou la première
      if (row >= 0 && this.currentHoveredCol >= 0) {
        const col = this.currentHoveredCol;
        if (this.selectionMode === 'auto') {
          this.dragRect = { start: this.selectionStart, end: { row, col } };
          this.tempSelection = this.getRectCells(this.selectionStart, { row, col });
        } else {
          this.handleRectSelection(this.selectionStart, { row, col });
        }
      }
    }
  };

  /**
   * Gère le relâchement de la souris au niveau global
   */
  private handleGlobalMouseUp = (event: MouseEvent) => {
    if (!this.isSelecting) {
      return;
    }

    // Convertir la position finale en coordonnées de cellule
    const cellPos = this.getCellFromMousePosition(event);
    if (cellPos && this.selectionStart) {
      const { row, col } = cellPos;
      
      if (this.selectionMode === 'auto' && this.dragRect) {
        this.handleRectToggle(this.dragRect.start, { row, col });
        this.dragRect = null;
        this.tempSelection = [];
      }
    }

    // Nettoyer
    this.isSelecting = false;
    this.selectionStart = null;
    this.stopAutoScroll();
    this.removeGlobalListeners();
    
    this.selectionChange.emit(this.selection);
    this.validateSelection();
  };

  /**
   * Vérifie si l'auto-scroll doit être activé et le démarre si nécessaire
   */
  private checkAutoScroll(event: MouseEvent) {
    if (!this.scrollContainer?.nativeElement) {
      return;
    }

    const container = this.scrollContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    
    // Coordonnées de la souris relatives au viewport
    const mouseY = event.clientY;
    const mouseX = event.clientX;

    // Vérifier les bords verticaux
    const distanceFromTop = mouseY - rect.top;
    const distanceFromBottom = rect.bottom - mouseY;
    const distanceFromLeft = mouseX - rect.left;
    const distanceFromRight = rect.right - mouseX;

    let scrollY = 0;
    let scrollX = 0;

    // Auto-scroll vertical
    if (distanceFromTop < this.AUTO_SCROLL_THRESHOLD && container.scrollTop > 0) {
      // Scroll vers le haut
      scrollY = -this.AUTO_SCROLL_SPEED;
    } else if (distanceFromBottom < this.AUTO_SCROLL_THRESHOLD) {
      // Scroll vers le bas
      scrollY = this.AUTO_SCROLL_SPEED;
    }

    // Auto-scroll horizontal (si nécessaire)
    if (distanceFromLeft < this.AUTO_SCROLL_THRESHOLD && container.scrollLeft > 0) {
      scrollX = -this.AUTO_SCROLL_SPEED;
    } else if (distanceFromRight < this.AUTO_SCROLL_THRESHOLD) {
      scrollX = this.AUTO_SCROLL_SPEED;
    }

    // Démarrer ou arrêter l'auto-scroll
    if (scrollY !== 0 || scrollX !== 0) {
      this.startAutoScroll(scrollX, scrollY);
    } else {
      this.stopAutoScroll();
    }
  }

  /**
   * Démarre l'auto-scroll dans la direction spécifiée
   */
  private startAutoScroll(scrollX: number, scrollY: number) {
    if (this.autoScrollInterval) {
      return; // Déjà en cours
    }

    if (!this.scrollContainer?.nativeElement) {
      return;
    }

    this.autoScrollInterval = setInterval(() => {
      if (!this.scrollContainer?.nativeElement) {
        this.stopAutoScroll();
        return;
      }

      const container = this.scrollContainer.nativeElement;
      
      // Vérifier les limites avant de scroller
      if (scrollY < 0 && container.scrollTop <= 0) {
        this.stopAutoScroll();
        return;
      }
      if (scrollY > 0 && container.scrollTop >= container.scrollHeight - container.clientHeight) {
        this.stopAutoScroll();
        return;
      }
      if (scrollX < 0 && container.scrollLeft <= 0) {
        this.stopAutoScroll();
        return;
      }
      if (scrollX > 0 && container.scrollLeft >= container.scrollWidth - container.clientWidth) {
        this.stopAutoScroll();
        return;
      }

      // Faire défiler
      container.scrollTop += scrollY;
      container.scrollLeft += scrollX;

      // Mettre à jour le scrollTop pour le virtual scroll
      this.scrollTop = container.scrollTop;
      this.updateVirtualData();
    }, this.AUTO_SCROLL_INTERVAL);
  }

  /**
   * Arrête l'auto-scroll
   */
  private stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  /**
   * Ajoute les listeners globaux pour le drag
   */
  private addGlobalListeners() {
    if (this.globalMouseMoveListener || this.globalMouseUpListener) {
      return; // Déjà ajoutés
    }

    this.globalMouseMoveListener = this.handleGlobalMouseMove;
    this.globalMouseUpListener = this.handleGlobalMouseUp;

    document.addEventListener('mousemove', this.globalMouseMoveListener);
    document.addEventListener('mouseup', this.globalMouseUpListener);
  }

  /**
   * Supprime les listeners globaux
   */
  private removeGlobalListeners() {
    if (this.globalMouseMoveListener) {
      document.removeEventListener('mousemove', this.globalMouseMoveListener);
      this.globalMouseMoveListener = undefined;
    }
    if (this.globalMouseUpListener) {
      document.removeEventListener('mouseup', this.globalMouseUpListener);
      this.globalMouseUpListener = undefined;
    }
  }
}
