import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit, HostListener, ElementRef, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimpleHtmlEditorComponent } from "../simple-html-editor/simple-html-editor.component";
import { PagerComponent } from "../pager/pager.component";
import { ShareTabdataService, SimulateTabdataRequest } from '../../services/share-tabdata.service';
import { ShareService } from '../../services/share.service';

@Component({
  selector: 'app-form-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleHtmlEditorComponent, PagerComponent],
  templateUrl: './form-preview.component.html',
  styleUrl: './form-preview.component.scss'
})
export class FormPreviewComponent implements OnInit, OnChanges, AfterViewInit {
  // 🔒 SÉCURITÉ : Interface sécurisée pour la simulation
  @Input() tempFileId: string = '';
  @Input() shareId: string = ''; // Pour les partages existants
  @Input() token: string = ''; // Token d'accès pour share-access (sans shareId)
  @Input() recipientEmail: string = '';
  @Input() selectedSheetIndex: number = 0;
  @Input() selections: { [sheetIndex: string]: { row: number, col: number }[] } = {};
  @Input() editableCells: { [sheetIndex: string]: { row: number, col: number }[] } = {};
  @Input() columnLabels: { [sheetIndex: string]: { [colKey: string]: string } } = {};
  
  // 🔒 SÉCURITÉ : Interface legacy (dépréciée) pour compatibilité
  @Input() data: any[] = []; // ⚠️ DÉPRÉCIÉ : Utiliser tempFileId/shareId/token + simulation à la place
  @Input() selection: { row: number, col: number }[] = []; // ⚠️ DÉPRÉCIÉ : Utiliser selections à la place
  
  // Données simulées (privées) - cache par page
  private simulatedDataCache: { [page: number]: any[] } = {};
  private totalRows: number = 0; // Nombre total de lignes (depuis le serveur)
  public isSimulating = false; // Public pour l'affichage du spinner
  private lastSimulationParams: string = ''; // Pour éviter les simulations inutiles
  private loadingPages: Set<number> = new Set(); // Pages en cours de chargement
  
  // Inputs pour l'affichage
  @Input() sheets: any[] = [];
  @Input() headers: string[] = [];
  private headersInitialized: boolean = false; // Flag pour savoir si headers a été initialisé depuis le backend
  public columnHeadersMap: { [colKey: string]: string } = {}; // Map des labels de colonnes pour le template

  @Input() pageTitle: string = '';
  @Input() pageDescription: string = '';
  private normalizedEditableCells: { row: number, col: string }[] = []; // Cellules normalisées avec col en string (depuis tableDataEditableCells)
  @Input() allowTitleEdit: boolean = true;
  @Input() isPreviewMode: boolean = false; // Mode prévisualisation (lecture seule pour les champs éditables)
  @Input() readOnly: boolean = false; // Mode lecture seule (pour les tokens validés)
  @Input() originalValues: { [key: string]: any } = {}; // Valeurs originales pour détecter les modifications
  @Input() totalRecipients: number = 1; // Nombre total de destinataires pour déterminer si on doit cacher certains boutons
  @Output() pageTitleChange = new EventEmitter<string>();
  @Output() pageDescriptionChange = new EventEmitter<string>();
  @Output() pageTitleChangeToAll = new EventEmitter<string>();
  @Output() pageDescriptionChangeToAll = new EventEmitter<string>();
  @Output() pageTitleChangeAndNext = new EventEmitter<string>();
  @Output() pageDescriptionChangeAndNext = new EventEmitter<string>();
  @Output() formValuesChange = new EventEmitter<{ [key: string]: any }>();
  @Output() cellModifiedChange = new EventEmitter<{ cellKey: string, isModified: boolean }>();

  @ViewChild('tableContainer', { static: false }) tableContainer!: ElementRef;
  @ViewChild('canvas', { static: false }) canvas!: ElementRef;
  @ViewChild('table', { static: false }) table!: ElementRef;
  @ViewChild('titleInput', { static: false }) titleInput?: ElementRef<HTMLInputElement>;

  showEditModal = false;
  editingField: 'title' | 'description' = 'title';
  tempTitle = '';
  tempDescription = '';
  forceEditorUpdate = false; // Pour forcer la mise à jour de l'éditeur
  
  // Propriétés pour l'édition inline des cellules
  editingCellKey: string | null = null;
  private isNavigating = false; // Flag pour indiquer qu'on est en train de naviguer entre cellules
  editingCellValue: string = '';
  
  // Stockage des valeurs des champs éditables
  formValues: { [key: string]: any } = {};

  // Propriétés pour l'adaptation responsive
  tableScale = 1;
  isTableWide = false;
  containerWidth = 0;
  tableWidth = 0;
  tableHeight = 0; // Hauteur du tableau
  minColumnWidth = 80; // Largeur minimale des colonnes
  maxColumnWidth = 200; // Largeur maximale des colonnes
  fontSize = 14; // Taille de police de base
  isZoomEnabled = false; // Contrôle si le zoom automatique est activé
  originalTableScale = 1; // Sauvegarde du scale original calculé

  // Propriétés pour la pagination
  pageSize = 20; // Nombre de lignes par page
  currentPage = 1; // Page actuelle
  totalPages = 1; // Nombre total de pages
  showPagination = false; // Afficher la pagination ou non

  constructor(
    private shareTabdataService: ShareTabdataService,
    private shareService: ShareService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Déclencher la simulation au démarrage
    this.simulateTabdata();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Si les paramètres de simulation changent, relancer la simulation
    if (changes['tempFileId'] || changes['shareId'] || changes['token'] || changes['recipientEmail'] || changes['selectedSheetIndex'] || 
        changes['selections'] || changes['editableCells'] || changes['columnLabels']) {
      // 🔧 CORRECTION : Réinitialiser normalizedEditableCells seulement quand on change de destinataire
      // (pas pour editableCells car elles seront chargées depuis le backend)
      if (changes['recipientEmail'] && changes['recipientEmail'].previousValue !== changes['recipientEmail'].currentValue) {
        this.normalizedEditableCells = [];
        console.log('[FormPreview] normalizedEditableCells réinitialisé car recipientEmail a changé');
      }
      this.simulateTabdata();
    }
    
    // Si les données changent, ajuster la hauteur des textarea et recalculer l'adaptation
    if (changes['data'] && changes['data'].currentValue) {
      this.recalculateTableAdaptation();
      // 🔧 CORRECTION : Plus besoin de normaliser editableCells car on utilise directement tableDataEditableCells de l'API
      // Recalculer la pagination quand les données changent
      this.calculatePagination();
    }
    
    // 🔧 CORRECTION : Plus besoin de normaliser editableCells car on utilise directement tableDataEditableCells de l'API
    // if (changes['editableCells'] && changes['editableCells'].currentValue) {
    //   this.normalizeEditableCells();
    // }
    
    if (changes['readOnly'] && changes['readOnly'].currentValue !== undefined) {
      // readOnly changed
    }
    
    // Si pageTitle ou pageDescription changent et que la modal est ouverte, mettre à jour les valeurs temporaires
    if (this.showEditModal && (changes['pageTitle'] || changes['pageDescription'])) {
      setTimeout(() => {
        this.tempTitle = this.pageTitle !== undefined ? this.pageTitle : '';
        this.tempDescription = this.pageDescription !== undefined ? this.pageDescription : '';
        this.forceEditorUpdate = !this.forceEditorUpdate;
      }, 50);
    }
    
    // Recalculer la hauteur si les données changent
    if (changes['data'] || changes['selectedData']) {
      setTimeout(() => {
        this.calculateTableHeight();
        this.updateContainerStyles();
      }, 100);
    }
  }

  ngAfterViewInit() {
    // 🔧 CORRECTION : Plus besoin de normaliser editableCells car on utilise directement tableDataEditableCells de l'API
    // Les editableCells seront mis à jour depuis tableDataEditableCells dans loadPageIfNeeded() ou loadPageWithToken()
    
    // Ajuster la hauteur des textarea après l'initialisation de la vue
    this.adjustAllTextareaHeights();
    // Calculer l'adaptation du tableau
    this.calculateTableAdaptation();
    
    // Recalculer la pagination
    this.calculatePagination();
    
    // Recalculer la hauteur après que le tableau soit rendu
    setTimeout(() => {
      this.calculateTableHeight();
      this.updateContainerStyles();
    }, 200);
  }

  /**
   * Normalise les cellules éditables pour gérer les deux formats :
   * - Ancien format : { row: number, col: number } (indices originaux du fichier Excel)
   * - Nouveau format : { row: number, col: string } (noms de colonnes filtrées)
   * 
   * 🔧 CORRECTION : Convertit les index originaux en index filtrés (0, 1, 2, ...)
   * en utilisant la même logique que getEditableCellsForSimulation()
   */
  private normalizeEditableCells() {
    this.normalizedEditableCells = [];
    
    // Si pas de cellules éditables, ne rien faire
    if (!this.editableCells || Object.keys(this.editableCells).length === 0) {
      console.log('[FormPreview] normalizeEditableCells: editableCells vide ou null');
      return;
    }
    
    // Récupérer les cellules éditables pour la feuille actuelle
    const sheetKey = this.selectedSheetIndex.toString();
    const originalEditableCells = this.editableCells[sheetKey] || [];
    
    if (originalEditableCells.length === 0) {
      console.log(`[FormPreview] normalizeEditableCells: aucune cellule pour sheetKey=${sheetKey}`);
      return;
    }
    
    console.log(`[FormPreview] normalizeEditableCells: ${originalEditableCells.length} cellules originales pour sheetKey=${sheetKey}`, originalEditableCells);
    
    // 🔧 CORRECTION : Extraire les colonnes uniques sélectionnées depuis selections pour créer le mapping
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
    
    // Convertir les cellules éditables en utilisant le mapping
    for (const cell of originalEditableCells) {
      let columnKey: string;
      
      if (typeof cell.col === 'number') {
        // 🔧 CORRECTION : col est l'index original, le convertir en index filtré
        if (columnMapping.hasOwnProperty(cell.col)) {
          const filteredColIndex = columnMapping[cell.col];
          columnKey = `column-${filteredColIndex}`;
        } else {
          // Si la colonne n'est pas dans les colonnes sélectionnées, l'ignorer
          console.warn(`[FormPreview] normalizeEditableCells: colonne ${cell.col} ignorée car non sélectionnée`);
          continue;
        }
      } else {
        // Nouveau format : utiliser directement le nom de colonne (déjà filtré)
        columnKey = cell.col;
      }
      
      this.normalizedEditableCells.push({
        row: cell.row,
        col: columnKey
      });
    }
    
    console.log(`[FormPreview] normalizeEditableCells: ${this.normalizedEditableCells.length} cellules normalisées`, this.normalizedEditableCells);
  }

  /**
   * Calcule les informations de pagination
   */
  private calculatePagination() {
    const totalRows = this.getTotalDataRows();
    this.totalPages = Math.ceil(totalRows / this.pageSize);
    this.showPagination = totalRows > this.pageSize;
    
    // S'assurer que la page actuelle est valide
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = Math.max(1, this.totalPages);
    }
  }

  /**
   * Obtient le nombre total de lignes de données
   */
  private getTotalDataRows(): number {
    // Si totalRows est défini (depuis le serveur), l'utiliser
    if (this.totalRows > 0) {
      return this.totalRows;
    }
    
    // Fallback : compter les données en cache
    let totalCached = 0;
    for (const page in this.simulatedDataCache) {
      totalCached += this.simulatedDataCache[page].length;
    }
    
    // Si on a des données en cache, utiliser la somme
    if (totalCached > 0) {
      return totalCached;
    }
    
    // Si les données sont déjà filtrées (contiennent __originalRowIndex), les utiliser directement
    if (this.displayData && this.displayData.length > 0 && this.displayData[0].hasOwnProperty('__originalRowIndex')) {
      return this.displayData.length;
    }
    
    // Si pas de sélection, utiliser toutes les données
    const sheetKey = this.selectedSheetIndex.toString();
    const selection = this.selections[sheetKey] || [];
    if (!selection || selection.length === 0) {
      return this.displayData.length;
    }
    
    // Compter les lignes sélectionnées
    const cellMap = new Map<number, Set<number>>();
    for (const cell of selection) {
      if (!cellMap.has(cell.row)) {
        cellMap.set(cell.row, new Set<number>());
      }
      cellMap.get(cell.row)!.add(cell.col);
    }
    
    return cellMap.size;
  }

  /**
   * Navigation vers la page suivante
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.recalculateTableAdaptation();
    }
  }

  /**
   * Navigation vers la page précédente
   */
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.recalculateTableAdaptation();
    }
  }

  /**
   * Navigation vers une page spécifique
   */
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.recalculateTableAdaptation();
    }
  }

  /**
   * Obtient les informations de pagination pour l'affichage
   */
  getPaginationInfo(): string {
    if (!this.showPagination) {
      return '';
    }
    
    const startRow = (this.currentPage - 1) * this.pageSize + 1;
    const endRow = Math.min(this.currentPage * this.pageSize, this.getTotalDataRows());
    const totalRows = this.getTotalDataRows();
    
    return `Lignes ${startRow}-${endRow} sur ${totalRows}`;
  }

  /**
   * Obtient la liste des numéros de pages à afficher
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      // Afficher toutes les pages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Afficher un sous-ensemble de pages autour de la page actuelle
      const start = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(this.totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  /**
   * Gère les changements de page depuis le composant pager
   */
  onPageChange(page: number) {
    this.currentPage = page;
    // Charger la page si elle n'est pas en cache
    this.loadPageIfNeeded(page);
    this.recalculateTableAdaptation();
  }

  @HostListener('window:resize')
  onResize() {
    this.calculateTableAdaptation();
    
    // Recalculer la hauteur après le redimensionnement
    setTimeout(() => {
      this.calculateTableHeight();
      this.updateContainerStyles();
    }, 100);
  }

  // Méthode pour calculer l'adaptation du tableau à la largeur de l'écran
  calculateTableAdaptation() {
    if (!this.tableContainer || !this.canvas) return;

    // Utiliser setTimeout pour éviter l'erreur ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      const container = this.tableContainer.nativeElement;
      const canvas = this.canvas.nativeElement;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Obtenir la largeur du conteneur
      this.containerWidth = container.offsetWidth;
      
      // Configurer le canvas pour mesurer le texte
      ctx.font = `${this.fontSize}px Arial, sans-serif`;
      
      // Calculer la largeur nécessaire pour chaque colonne
      const columnWidths: number[] = [];
      const columns = this.selectedColumns;
      
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        let maxWidth = this.minColumnWidth;
        
        // Mesurer la largeur de l'en-tête
        const headerText = this.getColumnLabel(column);
        const headerWidth = ctx.measureText(headerText).width + 20; // +20 pour le padding
        maxWidth = Math.max(maxWidth, headerWidth);
        
        // Mesurer la largeur du contenu de chaque cellule
        for (const row of this.selectedData) {
          const cellText = String(row[column] || '');
          const cellWidth = ctx.measureText(cellText).width + 20; // +20 pour le padding
          maxWidth = Math.max(maxWidth, cellWidth);
        }
        
        // Limiter la largeur maximale
        maxWidth = Math.min(maxWidth, this.maxColumnWidth);
        columnWidths.push(maxWidth);
      }
      
      // Calculer la largeur totale du tableau
      this.tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      
      // Calculer la hauteur approximative du tableau
      this.calculateTableHeight();
      
      // Déterminer si le tableau est trop large
      this.isTableWide = this.tableWidth > (this.containerWidth-100);
      
      if (this.isTableWide) {
        // Calculer le facteur d'échelle
        this.originalTableScale = this.containerWidth / (this.tableWidth + 100);
        
        // Appliquer le zoom seulement si activé
        this.tableScale = this.isZoomEnabled ? this.originalTableScale : 1;
        
        // Ajuster la taille de police si nécessaire (éviter la récursion infinie)
        const newFontSize = Math.max(10, 14 * this.tableScale);
        if (Math.abs(newFontSize - this.fontSize) > 0.5) {
          this.fontSize = newFontSize;
          // Recalculer une seule fois avec la nouvelle taille de police
          setTimeout(() => this.calculateTableAdaptation(), 50);
        }
      } else {
        this.tableScale = 1;
        this.originalTableScale = 1;
        this.fontSize = 14; // Taille de police par défaut
      }
    }, 0);
  }

  // Méthode pour calculer la hauteur approximative du tableau
  calculateTableHeight() {
    // Essayer d'obtenir la hauteur réelle du tableau si disponible
    if (this.table && this.table.nativeElement) {
      const tableElement = this.table.nativeElement;
      const originalHeight = tableElement.offsetHeight;
      
      // Calculer la hauteur ajustée selon le zoom
      if (this.isZoomEnabled && this.tableScale < 1) {
        // Si le zoom est actif, la hauteur réelle est réduite par le facteur de zoom
        this.tableHeight = originalHeight * this.tableScale;
      } else {
        // Si pas de zoom, utiliser la hauteur originale
        this.tableHeight = originalHeight;
      }
    } else {
      // Calcul approximatif si le tableau n'est pas encore rendu
      const baseRowHeight = 60; // Hauteur de base d'une ligne
      const headerHeight = 50; // Hauteur de l'en-tête
      const numRows = this.selectedData.length;
      
      // Ajuster la hauteur selon le zoom
      const adjustedRowHeight = this.isZoomEnabled && this.tableScale < 1 
        ? baseRowHeight * this.tableScale 
        : baseRowHeight;
      
      this.tableHeight = headerHeight + (numRows * adjustedRowHeight);
    }
    
    // Ajouter un peu d'espace pour les marges et paddings
    this.tableHeight += 20;
    
    // Appeler le debug pour afficher les informations détaillées
    this.debugTableHeight();
    
    // Forcer l'application des styles immédiatement
    setTimeout(() => {
      this.forceContainerHeight();
    }, 0);
  }

  // Méthode pour obtenir la hauteur calculée du tableau
  getCalculatedTableHeight(): number {
    return this.tableHeight || 0;
  }

  // Méthode de debug pour afficher les informations de hauteur
  debugTableHeight(): void {
    if (this.table && this.table.nativeElement) {
      const tableElement = this.table.nativeElement;
      const originalHeight = tableElement.offsetHeight;
      const calculatedHeight = this.getCalculatedTableHeight();
    }
  }

  // Méthode pour obtenir les styles CSS dynamiques du tableau
  getTableStyles(): any {
    if (!this.isTableWide || !this.isZoomEnabled) {
      return {};
    }
    
    return {
      transform: `scale(${this.tableScale})`,
      transformOrigin: 'top left',
      width: `${100 / this.tableScale}%`,
      fontSize: `${this.fontSize}px`,
      marginBottom: '0',
      borderCollapse: 'collapse'
    };
  }

  // Méthode pour obtenir les styles CSS du conteneur
  getContainerStyles(): any {
    if (!this.isTableWide) {
      return {};
    }
    
    if (this.isZoomEnabled && this.tableScale < 1) {
      // Si le zoom est actif, utiliser la hauteur calculée du tableau
      const calculatedHeight = this.getCalculatedTableHeight();
      return {
        'overflow': 'visible !important',
        'height': calculatedHeight > 0 ? `${calculatedHeight}px !important` : 'auto !important',
        'max-height': 'none !important',
        'min-height': 'auto !important'
      };
    } else {
      // Mode normal ou zoom désactivé - comportement normal avec scroll horizontal
      return {
        'overflow-x': 'auto !important',
        'overflow-y': 'auto !important',
        'max-height': '60vh !important',
        'height': 'auto !important',
        'min-height': '200px !important'
      };
    }
  }

  // Méthode pour basculer le zoom
  toggleZoom() {
    // Utiliser setTimeout pour éviter l'erreur ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.isZoomEnabled = !this.isZoomEnabled;
      
      if (this.isZoomEnabled) {
        // Réactiver le zoom avec le scale original
        this.tableScale = this.originalTableScale;
      } else {
        // Désactiver le zoom
        this.tableScale = 1;
        this.fontSize = 14; // Taille de police par défaut
      }
      
      // Recalculer l'adaptation et la hauteur
      this.calculateTableAdaptation();
      
      // Recalculer la hauteur du tableau après le changement de zoom
      setTimeout(() => {
        this.calculateTableHeight();
        this.forceContainerHeight();
        
        // Si le zoom est désactivé, forcer les scrollbars
        if (!this.isZoomEnabled) {
          setTimeout(() => {
            this.forceScrollbars();
          }, 100);
        }
        
        // Log pour debug
      }, 100);
    }, 0);
  }

  // Méthode pour désactiver le zoom au clic sur le tableau (uniquement si actif)
  onTableClick(event: MouseEvent) {
    // Ne rien faire si le zoom n'est pas activé
    if (!this.isZoomEnabled) {
      return;
    }
    
    // Vérifier si le clic est sur un élément interactif (textarea, bouton, etc.)
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || 
        target.tagName === 'BUTTON' || 
        target.closest('textarea') || 
        target.closest('button') ||
        target.closest('.input-group')) {
      return; // Ne pas désactiver le zoom si on clique sur un élément interactif
    }
    
    // Désactiver le zoom uniquement si il est actif
    if (this.isZoomEnabled) {
      this.toggleZoom();
    }
  }

  // Méthode pour forcer l'apparition des scrollbars
  forceScrollbars() {
    if (this.tableContainer && !this.isZoomEnabled) {
      const container = this.tableContainer.nativeElement;
      
      // Forcer le recalcul de l'overflow
      container.style.setProperty('overflow-x', 'auto', 'important');
      container.style.setProperty('overflow-y', 'auto', 'important');
      
      // Forcer un reflow pour déclencher les scrollbars
      container.scrollLeft = 0;
      container.scrollTop = 0;
    }
  }

  // Méthode pour nettoyer les styles et permettre le comportement normal
  resetContainerToNormal() {
    if (this.tableContainer) {
      const container = this.tableContainer.nativeElement;
      
      // Supprimer toutes les propriétés forcées
      container.style.removeProperty('height');
      container.style.removeProperty('overflow');
      container.style.removeProperty('max-height');
      container.style.removeProperty('min-height');
      
      // Appliquer explicitement les styles pour le scroll horizontal
      container.style.setProperty('overflow-x', 'auto', 'important');
      container.style.setProperty('overflow-y', 'auto', 'important');
      container.style.setProperty('max-height', '60vh', 'important');
      container.style.setProperty('height', 'auto', 'important');
      container.style.setProperty('min-height', '200px', 'important');
      
      // Forcer l'apparition des scrollbars
      setTimeout(() => {
        this.forceScrollbars();
      }, 50);
      
      // Laisser les styles CSS normaux s'appliquer
    }
  }

  // Méthode pour forcer l'application des styles directement sur le conteneur
  forceContainerHeight() {
    if (this.tableContainer) {
      const container = this.tableContainer.nativeElement;
      const calculatedHeight = this.getCalculatedTableHeight()+20;
      
      if (this.isZoomEnabled && this.tableScale < 1 && calculatedHeight > 0) {
        // Mode zoom actif - forcer la hauteur calculée
        container.style.setProperty('height', `${calculatedHeight}px`, 'important');
        container.style.setProperty('overflow', 'visible', 'important');
        container.style.setProperty('max-height', 'none', 'important');
        container.style.setProperty('min-height', 'auto', 'important');
      } else {
        // Mode zoom désactivé - comportement normal avec scroll
        this.resetContainerToNormal();
      }
    }
  }

  // Méthode pour forcer la mise à jour des styles du conteneur
  updateContainerStyles() {
    if (this.tableContainer) {
      const container = this.tableContainer.nativeElement;
      const styles = this.getContainerStyles();
      
      // Appliquer les styles directement sur l'élément DOM
      Object.keys(styles).forEach(key => {
        const value = styles[key];
        if (value) {
          container.style.setProperty(key, value, 'important');
        }
      });
      
      // Forcer un reflow pour s'assurer que les styles sont appliqués
      container.offsetHeight;
    }
  }

  // Méthode pour obtenir le texte du bouton de zoom
  getZoomButtonText(): string {
    if (!this.isTableWide) {
      return 'Zoom non disponible';
    }
    return this.isZoomEnabled ? 'Désactiver le zoom' : 'Activer le zoom';
  }

  // Méthode pour obtenir l'icône du bouton de zoom
  getZoomButtonIcon(): string {
    if (!this.isTableWide) {
      return 'bi-zoom-in';
    }
    return this.isZoomEnabled ? 'bi-zoom-out' : 'bi-zoom-in';
  }

  // Méthode pour obtenir la classe CSS du bouton selon l'état
  getZoomButtonClass(): string {
    if (!this.isTableWide) {
      return 'btn-outline-secondary';
    }
    return this.isZoomEnabled ? 'btn-outline-warning' : 'btn-outline-success';
  }

  get columns(): string[] {
    if (this.displayData.length === 0) return [];
    
    // Si on a une sélection, utiliser la logique de sélection
    const sheetKey = this.selectedSheetIndex.toString();
    const selection = this.selections[sheetKey] || [];
    if (selection && selection.length > 0) {
      // Logique existante pour la sélection
      const firstRow = this.displayData[0];
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
    
    // Si pas de sélection (données déjà filtrées par le backend), 
    // retourner directement les colonnes disponibles dans l'ordre
    const firstRow = this.displayData[0];
    if (!firstRow) return [];
    
    // Extraire toutes les clés de colonnes et les trier par index
    const columnKeys = Object.keys(firstRow)
      .filter(key => key.startsWith('column-'))
      .sort((a, b) => {
        const aIndex = parseInt(a.replace('column-', ''));
        const bIndex = parseInt(b.replace('column-', ''));
        return aIndex - bIndex;
      });
    
    return columnKeys;
  }

  get selectedData(): any[] {
    // 🔧 SIMPLIFICATION : Le serveur filtre maintenant les données
    // Plus besoin de filtrage côté client - afficher directement les données reçues
    let allData = this.displayData || [];
    
    // Les données sont déjà paginées par le serveur et stockées dans le cache par page
    // Pas besoin de re-paginer côté client
    return allData;
  }

  get selectedColumns(): string[] {
    // 🔧 SIMPLIFICATION : Le serveur filtre maintenant les données
    // Extraire les colonnes directement des données filtrées par le serveur
    if (this.displayData && this.displayData.length > 0) {
      const columns = new Set<string>();
      this.displayData.forEach(row => {
        Object.keys(row).forEach(key => {
          // 🔧 CORRECTION : Inclure UNIQUEMENT les colonnes qui commencent par 'column-'
          // Exclure toutes les métadonnées (__*, _rowIndex, etc.)
          if (key.startsWith('column-')) {
            columns.add(key);
          }
        });
      });
      
      // Trier les colonnes par ordre numérique (column-0, column-1, column-2, etc.)
      const sortedColumns = Array.from(columns).sort((a, b) => {
        if (a.startsWith('column-') && b.startsWith('column-')) {
          const aNum = parseInt(a.substring(7));
          const bNum = parseInt(b.substring(7));
          return aNum - bNum;
        }
        return a.localeCompare(b);
      });
      
      return sortedColumns;
    }
    
    return [];
  }
    
  getColumnLabel(colKey: string): string {
    // Ne pas afficher de label pour _rowIndex
    if (colKey === '_rowIndex') {
      return '';
    }

    // 🔧 CORRECTION : Utiliser columnHeadersMap si disponible (plus fiable pour le template)
    if (this.columnHeadersMap && this.columnHeadersMap[colKey] !== undefined) {
      return this.columnHeadersMap[colKey];
    }

    // 🔧 CORRECTION : Utiliser directement this.headers du backend si disponible
    // En mode token, this.headers est directement fourni par le backend
    if (this.headersInitialized && this.headers && this.headers.length > 0) {
      // Extraire l'index de la colonne depuis colKey (ex: "column-0" -> 0)
      if (colKey.startsWith('column-')) {
        const columnIndex = parseInt(colKey.replace('column-', ''));
        if (!isNaN(columnIndex) && columnIndex >= 0 && columnIndex < this.headers.length) {
          const label = this.headers[columnIndex] || '';
          // Log de débogage pour les 3 premières colonnes
          if (columnIndex < 3) {
            console.log(`[FormPreview] getColumnLabel: colKey=${colKey}, columnIndex=${columnIndex}, label="${label}", headers=`, this.headers);
          }
          return label;
        } else {
          console.warn(`[FormPreview] getColumnLabel: columnIndex ${columnIndex} hors limites (headers.length=${this.headers.length})`);
        }
      }
      return '';
    }

    // 🔧 FALLBACK : Si headers n'est pas initialisé, utiliser getHeadersFromColumnLabels()
    // (pour compatibilité avec le mode simulation)
    const headers = this.getHeadersFromColumnLabels();
    
    // Extraire l'index de la colonne depuis colKey (ex: "column-0" -> 0)
    if (colKey.startsWith('column-')) {
      const columnIndex = parseInt(colKey.replace('column-', ''));
      if (!isNaN(columnIndex) && columnIndex >= 0 && columnIndex < headers.length) {
        return headers[columnIndex] || '';
      }
    }
    
    return '';
  }

  /**
   * Extrait les headers depuis this.columnLabels en utilisant EXACTEMENT la même logique
   * que getColumnLabelsForSimulation() - c'est ce qui est envoyé au backend
   */
  private getHeadersFromColumnLabels(): string[] {
    if (!this.columnLabels || typeof this.columnLabels !== 'object') {
      return [];
    }

    const sheetKey = String(this.selectedSheetIndex);
    const originalLabels = this.columnLabels[sheetKey] || {};

    if (Object.keys(originalLabels).length === 0) {
      // Si columnLabels est vide, retourner un tableau vide avec la bonne taille
      const sheetSelections = this.selections[sheetKey] || [];
      const selectedColumns = new Set<number>();
      sheetSelections.forEach(cell => {
        selectedColumns.add(cell.col);
      });
      const numColumns = selectedColumns.size;
      return new Array(numColumns).fill('');
    }

    // 🔧 MÊME LOGIQUE que getColumnLabelsForSimulation() : Extraire les colonnes uniques sélectionnées
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

    // Extraire les headers dans l'ordre des nouveaux index (0, 1, 2, ...)
    const headers: string[] = [];
    sortedSelectedColumns.forEach((originalCol, newIndex) => {
      const originalColKey = `column-${originalCol}`;
      const header = originalLabels[originalColKey] || '';
      headers[newIndex] = header;
    });

    return headers;
  }

  private getColumnIndex(colKey: string): number {
    if (!colKey.startsWith('column-')) {
      return -1;
    }
    const columnIndex = parseInt(colKey.replace('column-', ''));
    return columnIndex;
  }

  isCellEditable(rowIndex: number, columnKey: string): boolean {
    // Ne pas permettre l'édition de la colonne _rowIndex
    if (columnKey === '_rowIndex') {
      return false;
    }
    
    // En mode prévisualisation ou lecture seule, les cellules éditables sont affichées mais non éditables
    if (this.isPreviewMode || this.readOnly) {
      return false;
    }
    
    // Utiliser les cellules normalisées pour vérifier si elle est éditable
    const isEditable = this.normalizedEditableCells.some(cell => cell.row === rowIndex && cell.col === columnKey);
    
    // Log de débogage pour la cellule spécifique
    if (rowIndex === 0 && columnKey === 'column-3') {
      // Debug info for specific cell
    }
    
    // Log général pour toutes les cellules éditables
    if (isEditable) {
      // Cell is editable
    }
    
    return isEditable;
  }

  openEditModal(field: 'title' | 'description') {
    this.editingField = field;
    
    // Initialiser les valeurs temporaires en préservant les valeurs exactes
    this.tempTitle = this.pageTitle !== undefined ? this.pageTitle : '';
    this.tempDescription = this.pageDescription !== undefined ? this.pageDescription : '';
    
    // Ouvrir la modal
    this.showEditModal = true;
    
    // Délai pour s'assurer que les valeurs sont bien initialisées avant l'ouverture de l'éditeur
    setTimeout(() => {
      // Forcer la mise à jour des valeurs temporaires en préservant les valeurs exactes
      this.tempTitle = this.pageTitle !== undefined ? this.pageTitle : '';
      this.tempDescription = this.pageDescription !== undefined ? this.pageDescription : '';
      
      // Forcer la détection des changements
      this.forceEditorUpdate = !this.forceEditorUpdate;

      // Focus automatique sur le champ de saisie du titre
      if (this.editingField === 'title' && this.titleInput && this.titleInput.nativeElement) {
        try { this.titleInput.nativeElement.focus(); } catch {}
      }
    }, 100);
  }

  saveChanges() {
    if (this.editingField === 'title') {
      this.pageTitle = this.tempTitle;
      this.pageTitleChange.emit(this.pageTitle);
    } else {
      this.pageDescription = this.tempDescription;
      this.pageDescriptionChange.emit(this.pageDescription);
    }
    this.showEditModal = false;
  }

  saveChangesToAll() {
    if (this.editingField === 'title') {
      this.pageTitle = this.tempTitle;
      this.pageTitleChangeToAll.emit(this.pageTitle);
    } else {
      this.pageDescription = this.tempDescription;
      this.pageDescriptionChangeToAll.emit(this.pageDescription);
    }
    this.showEditModal = false;
  }

  saveChangesAndNext() {
    if (this.editingField === 'title') {
      this.pageTitle = this.tempTitle;
      this.pageTitleChangeAndNext.emit(this.pageTitle);
    } else {
      this.pageDescription = this.tempDescription;
      this.pageDescriptionChangeAndNext.emit(this.pageDescription);
    }
    this.showEditModal = false;
  }

  // Méthode helper pour convertir l'index de selectedData (paginé) en index réel dans displayData
  private getRealRowIndex(rowIndex: number): number {
    if (this.showPagination) {
      return (this.currentPage - 1) * this.pageSize + rowIndex;
    }
    return rowIndex;
  }

  onFormValueChange(rowIndex: number, colIndex: number, value: any) {
    // Utiliser la clé de colonne réelle au lieu de l'index
    const columnKey = this.selectedColumns[colIndex];
    const realRowIndex = this.getRealRowIndex(rowIndex);
    const key = `${realRowIndex}-${columnKey}`;
    this.formValues[key] = value;
    this.formValuesChange.emit(this.formValues);
    
    // Vérifier si la valeur a changé par rapport à l'original
    const originalValue = this.originalValues[key];
    
    // Normaliser les valeurs pour la comparaison
    const normalizeValue = (value: any): string => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      return String(value).trim();
    };
    
    const normalizedNewValue = normalizeValue(value);
    const normalizedOriginal = normalizeValue(originalValue);
    const isModified = normalizedNewValue !== normalizedOriginal;
    
    // Émettre l'événement de modification
    this.cellModifiedChange.emit({ cellKey: key, isModified });
  }

  // Méthode pour obtenir la valeur d'une cellule en tenant compte des modifications
  getCellValue(rowIndex: number, colIndex: number): any {
    const columnKey = this.selectedColumns[colIndex];
    const realRowIndex = this.getRealRowIndex(rowIndex);
    const cellKey = `${realRowIndex}-${columnKey}`;
    
    // Si la cellule a été modifiée dans formValues, utiliser cette valeur
    if (this.formValues[cellKey] !== undefined) {
      return this.formValues[cellKey];
    }
    
    // Sinon, utiliser la valeur des données de la page actuelle (rowIndex est relatif à la page)
    return this.displayData[rowIndex]?.[columnKey] || '';
  }

  onInputChange(event: Event, rowIndex: number, colIndex: number) {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      const newValue = target.value;
      this.onFormValueChange(rowIndex, colIndex, newValue);
      
      // Ajuster automatiquement la hauteur du textarea
      this.adjustTextareaHeight(target);
    }
  }

  onKeyDown(event: KeyboardEvent, rowIndex: number, colIndex: number) {
    const target = event.target as HTMLTextAreaElement;
    
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter sans Shift : ajouter une nouvelle ligne
      event.preventDefault();
      
      const cursorPosition = target.selectionStart;
      const value = target.value;
      const newValue = value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition);
      
      // Mettre à jour la valeur
      target.value = newValue;
      
      // Déplacer le curseur après la nouvelle ligne
      target.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
      
      // Déclencher l'événement input pour mettre à jour les données
      this.onFormValueChange(rowIndex, colIndex, newValue);
      
      // Ajuster automatiquement la hauteur du textarea
      this.adjustTextareaHeight(target);
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enter : soumettre le formulaire (comportement par défaut)
      // Ne rien faire, laisser le comportement par défaut
    }
  }

  adjustTextareaHeight(textarea: HTMLTextAreaElement) {
    // Réinitialiser la hauteur pour calculer la hauteur correcte
    textarea.style.height = 'auto';
    
    // Calculer la hauteur nécessaire basée sur le contenu
    const scrollHeight = textarea.scrollHeight;
    
    // Ajuster les hauteurs selon le zoom
    let minHeight, maxHeight;
    if (this.isZoomEnabled && this.tableScale < 1) {
      // Mode zoom actif - réduire les hauteurs
      minHeight = Math.max(25, 32 * this.tableScale);
      maxHeight = Math.max(80, 120 * this.tableScale);
    } else {
      // Mode normal
      minHeight = 38;
      maxHeight = 150;
    }
    
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  cancelEdit() {
    this.showEditModal = false;
  }

  // Méthode pour vérifier si une cellule a été modifiée
  isCellModified(rowIndex: number, columnKey: string): boolean {
    const realRowIndex = this.getRealRowIndex(rowIndex);
    const cellKey = `${realRowIndex}-${columnKey}`;
    const originalValue = this.originalValues[cellKey];
    
    // Normaliser les valeurs pour la comparaison (traiter undefined, null, "" comme équivalents)
    const normalizeValue = (value: any): string => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      return String(value).trim();
    };
    
    const normalizedOriginal = normalizeValue(originalValue);
    
    // Si la cellule est dans formValues, comparer avec la valeur originale
    if (this.formValues[cellKey] !== undefined) {
      const currentValue = this.formValues[cellKey];
      const normalizedCurrent = normalizeValue(currentValue);
      return normalizedCurrent !== normalizedOriginal;
    }
    
    // Si la cellule n'est pas dans formValues, vérifier si elle diffère de l'original
    // Utiliser rowIndex (relatif à la page) car displayData ne contient que la page actuelle
    const displayedValue = this.displayData[rowIndex]?.[columnKey];
    const normalizedDisplayed = normalizeValue(displayedValue);
    
    return normalizedDisplayed !== normalizedOriginal;
  }

  // Méthode pour réinitialiser une cellule à sa valeur d'origine
  resetToOriginal(rowIndex: number, colIndex: number) {
    const columnKey = this.selectedColumns[colIndex];
    const realRowIndex = this.getRealRowIndex(rowIndex);
    const cellKey = `${realRowIndex}-${columnKey}`;
    const originalValue = this.originalValues[cellKey];
    
    // Normaliser les valeurs pour la comparaison (traiter undefined, null, "" comme équivalents)
    const normalizeValue = (value: any): string => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      return String(value).trim();
    };
    
    // Vérifier si la valeur actuelle est différente de l'originale
    // Utiliser rowIndex (relatif à la page) car displayData ne contient que la page actuelle
    const currentValue = this.formValues[cellKey] !== undefined ? this.formValues[cellKey] : this.displayData[rowIndex]?.[columnKey];
    const normalizedCurrent = normalizeValue(currentValue);
    const normalizedOriginal = normalizeValue(originalValue);
    const wasModified = normalizedCurrent !== normalizedOriginal;
    
    // Mettre à jour la valeur dans les données de la page actuelle
    if (this.displayData[rowIndex]) {
      this.displayData[rowIndex][columnKey] = originalValue;
    }
    
    // Mettre à jour la valeur dans formValues
    this.formValues[cellKey] = originalValue;
    
    // Si la cellule est en cours d'édition, mettre à jour la valeur d'édition
    if (this.editingCellKey === cellKey) {
      this.editingCellValue = originalValue || '';
    }
    
    // Émettre les changements
    this.formValuesChange.emit(this.formValues);
    
    // Émettre l'événement de modification seulement si la valeur était réellement différente
    // Une réinitialisation n'est considérée comme une modification que si elle change quelque chose
    this.cellModifiedChange.emit({ cellKey, isModified: wasModified });
  }

  // Méthode pour obtenir la clé unique d'une cellule
  getCellKey(rowIndex: number, colIndex: number): string {
    const columnKey = this.selectedColumns[colIndex];
    const realRowIndex = this.getRealRowIndex(rowIndex);
    return `${realRowIndex}-${columnKey}`;
  }

  // Méthode pour démarrer l'édition d'une cellule
  startEditingCell(rowIndex: number, colIndex: number, event: MouseEvent) {
    if (this.isPreviewMode || this.readOnly) {
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const cellKey = this.getCellKey(rowIndex, colIndex);
    this.editingCellKey = cellKey;
    this.editingCellValue = this.getCellValue(rowIndex, colIndex) || '';
    
    // Focus automatique sur le textarea après un court délai
    setTimeout(() => {
      const textarea = document.querySelector(`textarea.cell-edit-input`) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.select();
        // Ajuster la hauteur du textarea
        this.adjustTextareaHeight(textarea);
      }
    }, 50);
  }

  // Méthode pour arrêter l'édition d'une cellule
  stopEditingCell(save: boolean = true, force: boolean = false) {
    if (!this.editingCellKey) {
      return;
    }
    
    // Si on est en train de naviguer, ne pas fermer l'édition (elle sera fermée par la navigation)
    // Sauf si force est true (pour les boutons cancel/valider)
    if (this.isNavigating && !force) {
      return;
    }
    
    // Si on force, désactiver le flag de navigation
    if (force) {
      this.isNavigating = false;
    }
    
    if (save) {
      // Extraire les indices depuis la clé (format: "rowIndex-columnKey")
      const parts = this.editingCellKey.split('-');
      if (parts.length >= 2) {
        const realRowIndex = parseInt(parts[0]);
        const columnKey = parts.slice(1).join('-'); // Rejoindre au cas où columnKey contient des tirets
        
        // Trouver le colIndex correspondant
        const colIndex = this.selectedColumns.findIndex(col => col === columnKey);
        if (colIndex !== -1) {
          // Trouver le rowIndex relatif à la page
          const rowIndex = realRowIndex - ((this.currentPage - 1) * this.pageSize);
          
          if (rowIndex >= 0 && rowIndex < this.selectedData.length) {
            this.onFormValueChange(rowIndex, colIndex, this.editingCellValue);
          }
        }
      }
    }
    
    this.editingCellKey = null;
    this.editingCellValue = '';
  }

  // Méthode pour gérer les événements clavier lors de l'édition
  onCellEditKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number) {
    const target = event.target as HTMLTextAreaElement;
    
    if (event.key === 'Escape') {
      // Escape : annuler l'édition
      this.stopEditingCell(false);
      event.preventDefault();
    } else if (event.key === 'Tab') {
      // Tab : naviguer vers la cellule suivante
      // Shift+Tab : naviguer vers la cellule précédente
      event.preventDefault();
      if (event.shiftKey) {
        this.navigateToPreviousCell();
      } else {
        this.navigateToNextCell();
      }
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      // Ctrl+Enter ou Cmd+Enter : sauvegarder et arrêter l'édition
      event.preventDefault();
      this.stopEditingCell(true);
    } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Enter seul : nouvelle ligne (comportement par défaut du textarea)
      // Ajuster la hauteur du textarea après l'ajout de la ligne
      setTimeout(() => {
        if (target) {
          this.adjustTextareaHeight(target);
        }
      }, 0);
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enter : nouvelle ligne également (comportement par défaut)
      // Ajuster la hauteur du textarea
      setTimeout(() => {
        if (target) {
          this.adjustTextareaHeight(target);
        }
      }, 0);
    }
  }

  // Méthode pour gérer les changements dans le textarea d'édition
  onCellEditInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      this.editingCellValue = target.value;
      // Ajuster automatiquement la hauteur du textarea
      this.adjustTextareaHeight(target);
    }
  }

  // Méthode pour gérer le blur du textarea
  onCellBlur(event: FocusEvent) {
    // Ne pas fermer l'édition si on est en train de naviguer
    if (this.isNavigating) {
      return;
    }
    
    // Vérifier si le focus passe vers un bouton de navigation
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.cell-nav-btn')) {
      // Le focus passe vers un bouton de navigation, ne pas fermer l'édition
      return;
    }
    
    // Si le focus passe vers cancel ou valider, laisser le click gérer la fermeture
    // Sinon, sauvegarder et fermer l'édition
    this.stopEditingCell(true);
  }

  // Méthode pour empêcher le blur lors du clic sur un bouton
  preventBlur(event: MouseEvent) {
    event.preventDefault();
    // Empêcher le blur en gardant le focus sur le textarea
    const textarea = document.querySelector('textarea.cell-edit-input') as HTMLTextAreaElement;
    if (textarea) {
      // Activer le flag de navigation
      this.isNavigating = true;
      // Forcer le focus à rester sur le textarea momentanément
      setTimeout(() => {
        if (textarea && document.activeElement !== textarea) {
          textarea.focus();
        }
      }, 0);
    }
  }

  // Méthode pour obtenir toutes les cellules éditables triées (par ligne puis par colonne)
  private getSortedEditableCells(): { row: number, col: string, rowIndex: number, colIndex: number }[] {
    const sortedCells: { row: number, col: string, rowIndex: number, colIndex: number }[] = [];
    
    // Parcourir toutes les cellules éditables normalisées
    for (const cell of this.normalizedEditableCells) {
      // Trouver l'index de la colonne dans selectedColumns
      const colIndex = this.selectedColumns.findIndex(col => col === cell.col);
      if (colIndex !== -1) {
        sortedCells.push({
          row: cell.row,
          col: cell.col,
          rowIndex: cell.row,
          colIndex: colIndex
        });
      }
    }
    
    // Trier par ligne puis par colonne
    sortedCells.sort((a, b) => {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      return a.colIndex - b.colIndex;
    });
    
    return sortedCells;
  }

  // Méthode pour naviguer vers la cellule précédente
  navigateToPreviousCell() {
    if (!this.editingCellKey) {
      return;
    }
    
    // Activer le flag de navigation pour éviter que le blur ferme l'édition
    this.isNavigating = true;
    
    // Sauvegarder la clé de la cellule actuelle avant de l'arrêter
    const currentCellKey = this.editingCellKey;
    
    // Sauvegarder la valeur actuelle depuis le textarea
    const textarea = document.querySelector('textarea.cell-edit-input') as HTMLTextAreaElement;
    const currentValue = textarea ? textarea.value : this.editingCellValue;
    
    // Sauvegarder la cellule actuelle
    const parts = currentCellKey.split('-');
    if (parts.length >= 2) {
      const realRowIndex = parseInt(parts[0]);
      const columnKey = parts.slice(1).join('-');
      const colIndex = this.selectedColumns.findIndex(col => col === columnKey);
      if (colIndex !== -1) {
        const rowIndex = realRowIndex - ((this.currentPage - 1) * this.pageSize);
        if (rowIndex >= 0 && rowIndex < this.selectedData.length) {
          this.onFormValueChange(rowIndex, colIndex, currentValue);
        }
      }
    }
    
    // Extraire les indices de la cellule actuelle
    const currentRow = parseInt(parts[0]);
    const currentCol = parts.slice(1).join('-');
    
    // Obtenir toutes les cellules éditables triées
    const sortedCells = this.getSortedEditableCells();
    
    // Trouver l'index de la cellule actuelle
    const currentIndex = sortedCells.findIndex(cell => 
      cell.row === currentRow && cell.col === currentCol
    );
    
    if (currentIndex === -1 || currentIndex === 0) {
      // Première cellule ou cellule non trouvée, ne rien faire
      this.isNavigating = false;
      return;
    }
    
    // Fermer l'édition actuelle avant de naviguer
    this.editingCellKey = null;
    this.editingCellValue = '';
    
    // Aller à la cellule précédente
    const previousCell = sortedCells[currentIndex - 1];
    // Utiliser setTimeout pour s'assurer que l'édition précédente est bien fermée
    setTimeout(() => {
      this.navigateToCell(previousCell.row, previousCell.col);
    }, 10);
  }

  // Méthode pour naviguer vers la cellule suivante
  navigateToNextCell() {
    if (!this.editingCellKey) {
      return;
    }
    
    // Activer le flag de navigation pour éviter que le blur ferme l'édition
    this.isNavigating = true;
    
    // Sauvegarder la clé de la cellule actuelle avant de l'arrêter
    const currentCellKey = this.editingCellKey;
    
    // Sauvegarder la valeur actuelle depuis le textarea
    const textarea = document.querySelector('textarea.cell-edit-input') as HTMLTextAreaElement;
    const currentValue = textarea ? textarea.value : this.editingCellValue;
    
    // Sauvegarder la cellule actuelle
    const parts = currentCellKey.split('-');
    if (parts.length >= 2) {
      const realRowIndex = parseInt(parts[0]);
      const columnKey = parts.slice(1).join('-');
      const colIndex = this.selectedColumns.findIndex(col => col === columnKey);
      if (colIndex !== -1) {
        const rowIndex = realRowIndex - ((this.currentPage - 1) * this.pageSize);
        if (rowIndex >= 0 && rowIndex < this.selectedData.length) {
          this.onFormValueChange(rowIndex, colIndex, currentValue);
        }
      }
    }
    
    // Extraire les indices de la cellule actuelle
    const currentRow = parseInt(parts[0]);
    const currentCol = parts.slice(1).join('-');
    
    // Obtenir toutes les cellules éditables triées
    const sortedCells = this.getSortedEditableCells();
    
    // Trouver l'index de la cellule actuelle
    const currentIndex = sortedCells.findIndex(cell => 
      cell.row === currentRow && cell.col === currentCol
    );
    
    if (currentIndex === -1 || currentIndex === sortedCells.length - 1) {
      // Dernière cellule ou cellule non trouvée, ne rien faire
      this.isNavigating = false;
      return;
    }
    
    // Fermer l'édition actuelle avant de naviguer
    this.editingCellKey = null;
    this.editingCellValue = '';
    
    // Aller à la cellule suivante
    const nextCell = sortedCells[currentIndex + 1];
    // Utiliser setTimeout pour s'assurer que l'édition précédente est bien fermée
    setTimeout(() => {
      this.navigateToCell(nextCell.row, nextCell.col);
    }, 10);
  }

  // Méthode pour naviguer vers une cellule spécifique
  private navigateToCell(row: number, col: string) {
    // Trouver l'index de la colonne dans selectedColumns
    const colIndex = this.selectedColumns.findIndex(c => c === col);
    if (colIndex === -1) {
      this.isNavigating = false;
      return;
    }
    
    // Calculer l'index de ligne relatif à la page
    let rowIndex: number;
    if (this.showPagination) {
      // Vérifier si la cellule est sur la page actuelle
      const startRow = (this.currentPage - 1) * this.pageSize;
      const endRow = startRow + this.pageSize;
      
      if (row < startRow || row >= endRow) {
        // La cellule est sur une autre page, changer de page
        const targetPage = Math.floor(row / this.pageSize) + 1;
        this.currentPage = targetPage;
        this.calculatePagination();
        
        // Attendre que la page soit chargée avant de naviguer
        setTimeout(() => {
          const newStartRow = (this.currentPage - 1) * this.pageSize;
          rowIndex = row - newStartRow;
          this.startEditingCellByIndices(rowIndex, colIndex);
        }, 100);
        return;
      }
      
      rowIndex = row - startRow;
    } else {
      rowIndex = row;
    }
    
    // Démarrer l'édition de la cellule
    this.startEditingCellByIndices(rowIndex, colIndex);
  }

  // Méthode pour démarrer l'édition d'une cellule par ses indices
  private startEditingCellByIndices(rowIndex: number, colIndex: number) {
    // Créer un événement simulé pour startEditingCell
    const mockEvent = {
      preventDefault: () => {},
      stopPropagation: () => {}
    } as MouseEvent;
    
    this.startEditingCell(rowIndex, colIndex, mockEvent);
    
    // Désactiver le flag de navigation après avoir démarré l'édition
    setTimeout(() => {
      this.isNavigating = false;
    }, 100);
  }

  // Méthode pour vérifier si une cellule est éditable en mode prévisualisation
  isPreviewEditableCell(rowIndex: number, colIndex: number): boolean {
    // Ne pas vérifier pour la colonne _rowIndex
    const column = this.selectedColumns[colIndex];
    if (column === '_rowIndex') {
      return false;
    }
    
    // Utiliser les cellules normalisées pour vérifier si elle est éditable
    const isEditable = this.normalizedEditableCells.some(cell => cell.row === rowIndex && cell.col === column);
    
    // Log de débogage pour la cellule spécifique
    if (rowIndex === 0 && column === 'column-3') {
      // Debug info for specific cell
    }
    
    return isEditable;
  }

  // Méthode pour vérifier si une cellule devrait être affichée comme input (éditable ou désactivé en prévisualisation)
  shouldShowEditableInput(rowIndex: number, columnKey: string): boolean {
    // Ne pas permettre l'édition de la colonne _rowIndex
    if (columnKey === '_rowIndex') {
      return false;
    }
    
    // 🔧 CORRECTION : rowIndex est relatif à la page (0, 1, 2, ... pour chaque page)
    // Mais normalizedEditableCells contient les rows absolus (0, 1, 2, ..., 23)
    // Il faut convertir rowIndex (relatif) en row absolu pour la comparaison
    const absoluteRow = this.getAbsoluteRowIndex(rowIndex);
    
    // Utiliser les cellules normalisées pour vérifier si elle est éditable
    return this.normalizedEditableCells.some(cell => cell.row === absoluteRow && cell.col === columnKey);
  }
  
  /**
   * Convertit un rowIndex relatif à la page en row absolu (index dans toutes les données)
   */
  private getAbsoluteRowIndex(rowIndex: number): number {
    // rowIndex est l'index dans selectedData (qui est paginé)
    // Pour obtenir l'index absolu, on ajoute l'offset de la page actuelle
    const pageOffset = (this.currentPage - 1) * this.pageSize;
    return pageOffset + rowIndex;
  }
  
  // Méthode pour vérifier si une cellule était éditable (pour l'affichage en mode lecture seule)
  wasCellEditable(rowIndex: number, colIndex: number): boolean {
    // Ne pas vérifier pour la colonne _rowIndex
    const column = this.selectedColumns[colIndex];
    if (column === '_rowIndex') {
      return false;
    }
    
    // Utiliser les cellules normalisées pour vérifier si elle était éditable
    return this.normalizedEditableCells.some(cell => cell.row === rowIndex && cell.col === column);
  }

  // Méthode pour ajuster la hauteur de tous les textarea après le chargement des données
  adjustAllTextareaHeights() {
    // Attendre que le DOM soit mis à jour
    setTimeout(() => {
      const textareas = document.querySelectorAll('.form-preview textarea.form-control');
      textareas.forEach((textarea) => {
        this.adjustTextareaHeight(textarea as HTMLTextAreaElement);
      });
    }, 100);
  }

  // Méthode pour recalculer l'adaptation du tableau après les changements de données
  recalculateTableAdaptation() {
    setTimeout(() => {
      this.calculateTableAdaptation();
      this.adjustAllTextareaHeights();
      
      // Recalculer la hauteur du tableau
      this.calculateTableHeight();
      
      // Forcer la mise à jour des styles du conteneur
      this.updateContainerStyles();
    }, 200);
  }

  /**
   * 🔒 SÉCURITÉ : Simule les tabdata pour garantir la cohérence
   * Cette méthode est appelée automatiquement et ne peut pas être contournée
   */
  private simulateTabdata(): void {
    // Réinitialiser le flag headersInitialized quand on change de partage/fichier
    this.headersInitialized = false;
    this.headers = [];
    
    // 🔧 CORRECTION : Réinitialiser normalizedEditableCells quand on change de destinataire
    // pour éviter que les cellules du premier destinataire soient affichées pour tous les destinataires
    // (déjà fait dans ngOnChanges, mais on le fait aussi ici pour être sûr)
    
    // Mode token : utiliser getFormDataWithToken
    if (this.token) {
      this.simulateTabdataSecure();
      return;
    }
    
    // Mode sécurisé : utiliser la simulation backend
    if ((this.tempFileId || this.shareId) && this.recipientEmail) {
      this.simulateTabdataSecure();
      return;
    }
    
    // Aucune donnée disponible
    this.simulatedDataCache = {};
    this.totalRows = 0;
  }

  /**
   * Mode sécurisé : Simulation backend ou chargement via token
   * Charge la page actuelle si les paramètres ont changé
   */
  private simulateTabdataSecure(): void {
    // Mode token : utiliser getFormDataWithToken
    if (this.token) {
      // Créer une signature des paramètres pour éviter les chargements inutiles
      const currentParams = JSON.stringify({
        token: this.token,
        currentPage: this.currentPage
      });

      // Si les paramètres ont changé, réinitialiser le cache
      if (this.lastSimulationParams !== currentParams) {
        this.simulatedDataCache = {};
        this.totalRows = 0;
        this.lastSimulationParams = currentParams;
      }

      // Charger la page actuelle
      this.loadPageIfNeeded(this.currentPage);
      return;
    }

    // Mode simulation : vérifier que tous les paramètres requis sont présents
    if ((!this.tempFileId && !this.shareId) || !this.recipientEmail) {
      this.simulatedDataCache = {};
      this.totalRows = 0;
      return;
    }

    // Créer une signature des paramètres pour éviter les simulations inutiles
    const currentParams = JSON.stringify({
      tempFileId: this.tempFileId,
      shareId: this.shareId,
      recipientEmail: this.recipientEmail,
      selectedSheetIndex: this.selectedSheetIndex,
      selections: this.selections,
      editableCells: this.getEditableCellsForSimulation(),
      columnLabels: this.getColumnLabelsForSimulation()
    });

    // Si les paramètres ont changé, réinitialiser le cache
    if (this.lastSimulationParams !== currentParams) {
      this.simulatedDataCache = {};
      this.totalRows = 0;
      // 🔧 CORRECTION : Réinitialiser normalizedEditableCells quand les paramètres changent
      // pour éviter que les cellules du premier destinataire soient affichées pour tous les destinataires
      this.normalizedEditableCells = [];
      console.log('[FormPreview] Cache et normalizedEditableCells réinitialisés car les paramètres de simulation ont changé');
      this.lastSimulationParams = currentParams;
    }

    // Charger la page actuelle
    this.loadPageIfNeeded(this.currentPage);
  }

  /**
   * Charge une page si elle n'est pas déjà en cache
   * Décharge les autres pages du cache pour ne garder que la page actuelle
   */
  private loadPageIfNeeded(page: number): void {
    // Vérifier si la page est déjà en cache
    if (this.simulatedDataCache[page]) {
      // Décharger les autres pages du cache
      this.unloadOtherPages(page);
      return;
    }

    // Vérifier si la page est déjà en cours de chargement
    if (this.loadingPages.has(page)) {
      return;
    }

    // Mode token : utiliser getFormDataWithToken
    if (this.token) {
      this.loadPageWithToken(page);
      return;
    }

    // Vérifier que tous les paramètres requis sont présents pour le mode simulation
    if ((!this.tempFileId && !this.shareId) || !this.recipientEmail) {
      return;
    }

    // Décharger les autres pages du cache avant de charger la nouvelle
    this.unloadOtherPages(page);

    this.loadingPages.add(page);
    this.isSimulating = true;

    // Construire la requête de simulation avec pagination
    const request: SimulateTabdataRequest = {
      tempFileId: this.tempFileId || '',
      shareId: this.shareId || '',
      recipientEmail: this.recipientEmail,
      selectedSheetIndex: this.selectedSheetIndex,
      selections: this.selections,
      editableCells: this.getEditableCellsForSimulation(),
      columnLabels: this.getColumnLabelsForSimulation(),
      page: page,
      limit: this.pageSize
    };

    // Appeler le service de simulation
    this.shareTabdataService.simulateTabdata(request).subscribe({
      next: (response) => {
        // Extraire les données du tableau depuis la réponse
        let tableData: any[] = [];
        
        // Le backend peut retourner soit { rows: [...], total: ... } soit ExcelData
        if (response && response.rows) {
          // Format paginé : { rows: [...], total: ... }
          tableData = Array.isArray(response.rows) ? response.rows : [];
        } else if (response && (response as any).getRows) {
          // Format ExcelData avec méthode getRows()
          tableData = (response as any).getRows() || [];
        } else if (Array.isArray(response)) {
          // Format tableau direct
          tableData = response;
        } else if (response && typeof response === 'object') {
          // Essayer d'extraire les lignes d'un objet ExcelData
          const excelData = response as any;
          if (excelData.rows && Array.isArray(excelData.rows)) {
            tableData = excelData.rows;
          }
        }
        
        console.log(`[FormPreview] Page ${page} chargée:`, {
          responseType: typeof response,
          hasRows: !!response?.rows,
          tableDataLength: tableData.length,
          firstRow: tableData[0],
          total: response?.total
        });
        
        // Mettre en cache la page chargée
        this.simulatedDataCache[page] = tableData;
        
        // Décharger les autres pages du cache (ne garder que la page actuelle)
        this.unloadOtherPages(page);
        
        // Mettre à jour le totalRows si fourni par le serveur
        if (response && response.total !== undefined) {
          this.totalRows = response.total;
        } else if (response && response.totalRows !== undefined) {
          this.totalRows = response.totalRows;
        } else if (response && (response as any).getTotalRows) {
          this.totalRows = (response as any).getTotalRows();
        }
        
        // 🔧 CORRECTION : Toujours utiliser les headers du backend, même s'ils sont vides (pas de fallback)
        // Les headers doivent être les mêmes pour toutes les pages, donc on les met à jour à chaque fois
        // IMPORTANT : Si headers n'est pas présent dans la réponse, on considère qu'il est vide []
        if (response && response.headers !== undefined) {
          this.headers = Array.isArray(response.headers) ? response.headers : [];
          this.headersInitialized = true; // Marquer comme initialisé depuis le backend
          console.log(`[FormPreview] Headers mis à jour depuis le backend (page ${page}):`, this.headers, 'length:', this.headers.length, 'initialized:', this.headersInitialized);
        } else if (response && (response as any).getHeaders) {
          this.headers = (response as any).getHeaders() || [];
          this.headersInitialized = true; // Marquer comme initialisé depuis le backend
          console.log(`[FormPreview] Headers mis à jour depuis ExcelData (page ${page}):`, this.headers, 'length:', this.headers.length, 'initialized:', this.headersInitialized);
        } else {
          // 🔧 CORRECTION : Si headers n'est pas dans la réponse, considérer qu'il est vide []
          // Cela garantit que toutes les colonnes afficheront un en-tête vide
          this.headers = [];
          this.headersInitialized = true; // Marquer comme initialisé (même si vide)
          console.log(`[FormPreview] Headers initialisés à vide pour la page ${page} (headers absent de la réponse)`);
        }
        
        // 🔧 CORRECTION : Utiliser directement tableDataEditableCells de la réponse (déjà au bon format)
        // Les editableCells doivent être les mêmes pour toutes les pages, donc on les met à jour à chaque fois
        const responseAny = response as any;
        if (responseAny && responseAny.tableDataEditableCells) {
          // 🔧 CORRECTION : tableDataEditableCells a des index relatifs à la page (0-19 pour chaque page)
          // Il faut les convertir en index absolus et les fusionner avec les cellules existantes
          const pageOffset = (page - 1) * this.pageSize;
          const newCells = responseAny.tableDataEditableCells.map((cell: any) => ({
            row: pageOffset + cell.row, // Convertir l'index relatif en index absolu
            col: cell.col  // Déjà au format "column-0", "column-1", etc.
          }));
          
          // 🔧 CORRECTION : Ne pas réinitialiser à chaque page 1, seulement quand les paramètres changent
          // (la réinitialisation est déjà faite dans simulateTabdataSecure() quand les paramètres changent)
          
          // Fusionner avec les cellules existantes (éviter les doublons)
          const existingCellsMap = new Map<string, boolean>();
          this.normalizedEditableCells.forEach(cell => {
            existingCellsMap.set(`${cell.row}-${cell.col}`, true);
          });
          
          newCells.forEach((cell: { row: number, col: string }) => {
            const cellKey = `${cell.row}-${cell.col}`;
            if (!existingCellsMap.has(cellKey)) {
              this.normalizedEditableCells.push(cell);
              existingCellsMap.set(cellKey, true);
            }
          });
          
          console.log(`[FormPreview] NormalizedEditableCells fusionnés depuis tableDataEditableCells (page ${page}, offset ${pageOffset}):`, 
                     this.normalizedEditableCells.length, 'cellules totales',
                     newCells.length, 'nouvelles cellules',
                     'exemple:', newCells.slice(0, 3));
        } else {
          // 🔧 CORRECTION : Si tableDataEditableCells n'est pas dans la réponse, utiliser les editableCells passés en input
          // (fallback pour les cas où le backend ne fournit pas tableDataEditableCells)
          if (page === 1 && this.normalizedEditableCells.length === 0) {
            this.normalizeEditableCells();
            console.log('[FormPreview] NormalizedEditableCells initialisé depuis editableCells input (fallback)');
          }
        }
        
        this.loadingPages.delete(page);
        this.isSimulating = this.loadingPages.size > 0; // Reste true si d'autres pages sont en chargement
        
        // Forcer la détection de changement pour mettre à jour l'affichage
        setTimeout(() => {
          // Recalculer l'adaptation et la pagination
          this.recalculateTableAdaptation();
          this.calculatePagination();
          // Forcer la détection de changement pour mettre à jour le template
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        this.loadingPages.delete(page);
        this.isSimulating = this.loadingPages.size > 0;
        // En cas d'erreur, mettre un tableau vide pour cette page
        this.simulatedDataCache[page] = [];
      }
    });
  }

  /**
   * Charge une page avec un token (mode share-access)
   */
  private loadPageWithToken(page: number): void {
    // Décharger les autres pages du cache avant de charger la nouvelle
    this.unloadOtherPages(page);

    this.loadingPages.add(page);
    this.isSimulating = true;

    // Appeler le service pour charger les données avec le token
    this.shareService.getFormDataWithToken(this.token, page, this.pageSize).subscribe({
      next: (response) => {
        // Extraire les données du tableau depuis la réponse
        const tableData = response.tableData || [];
        
        console.log(`[FormPreview] Page ${page} chargée via token:`, {
          tableDataLength: tableData.length,
          totalRows: response.totalRows,
          firstRow: tableData[0]
        });
        
        // Mettre en cache la page chargée
        this.simulatedDataCache[page] = tableData;
        
        // 🔧 CORRECTION : En mode readOnly, initialiser formValues avec les valeurs soumises depuis tableData
        // tableData contient les données fusionnées (originales + soumises) du backend
        if (this.readOnly && this.originalValues && Object.keys(this.originalValues).length > 0) {
          const pageOffset = (page - 1) * this.pageSize;
          for (let i = 0; i < tableData.length; i++) {
            const row = tableData[i];
            if (row && typeof row === 'object') {
              const absoluteRowIndex = pageOffset + i;
              for (const columnKey in row) {
                if (columnKey.startsWith('column-')) {
                  const cellKey = `${absoluteRowIndex}-${columnKey}`;
                  // Initialiser formValues avec la valeur de tableData (qui contient les valeurs soumises fusionnées)
                  const submittedValue = row[columnKey];
                  if (submittedValue !== undefined && submittedValue !== null) {
                    this.formValues[cellKey] = submittedValue;
                  }
                }
              }
            }
          }
          console.log(`[FormPreview] formValues initialisés pour la page ${page} en mode readOnly:`, 
                      Object.keys(this.formValues).length, 'cellules');
        }
        
        // Décharger les autres pages du cache (ne garder que la page actuelle)
        this.unloadOtherPages(page);
        
        // Mettre à jour le totalRows (pour toutes les pages, pas seulement la première)
        // 🔧 CORRECTION : Mettre à jour totalRows à chaque page pour s'assurer qu'il est correct
        if (response.totalRows !== undefined && response.totalRows > 0) {
          this.totalRows = response.totalRows;
          console.log(`[FormPreview] totalRows mis à jour depuis la page ${page}: ${this.totalRows}`);
        }
        
        // Mettre à jour les métadonnées si c'est la première page
        if (page === 1) {
          if (response.pageTitle !== undefined) {
            this.pageTitle = response.pageTitle;
          }
          if (response.pageDescription !== undefined) {
            this.pageDescription = response.pageDescription;
          }
        }
        
        // 🔧 CORRECTION : Mettre à jour les headers pour toutes les pages (comme dans loadPageIfNeeded)
        // Les headers doivent être les mêmes pour toutes les pages, donc on les met à jour à chaque fois
        const responseAny = response as any;
        if (responseAny.headers !== undefined) {
          this.headers = Array.isArray(responseAny.headers) ? responseAny.headers : [];
          this.headersInitialized = true; // Marquer comme initialisé depuis le backend
          console.log(`[FormPreview] Headers mis à jour depuis le backend (page ${page}):`, this.headers, 'length:', this.headers.length, 'initialized:', this.headersInitialized);
          console.log(`[FormPreview] Headers détaillés:`, this.headers.map((h, i) => `[${i}]="${h}"`));
          
          // 🔧 CORRECTION : Mettre à jour columnHeadersMap pour le template
          // Créer une map des labels de colonnes basée sur les headers
          this.columnHeadersMap = {};
          // Utiliser tableData directement depuis la réponse (plus fiable que displayData qui peut ne pas être encore disponible)
          const tableData = response.tableData || [];
          if (tableData.length > 0) {
            const firstRow = tableData[0];
            const columnKeys = Object.keys(firstRow).filter(key => key.startsWith('column-')).sort((a, b) => {
              const aNum = parseInt(a.replace('column-', ''));
              const bNum = parseInt(b.replace('column-', ''));
              return aNum - bNum;
            });
            
            columnKeys.forEach((colKey, index) => {
              if (index < this.headers.length) {
                this.columnHeadersMap[colKey] = this.headers[index] || '';
              }
            });
          }
          console.log(`[FormPreview] columnHeadersMap mis à jour:`, this.columnHeadersMap);
        } else {
          // Si pas de headers dans la réponse, initialiser à vide et marquer comme initialisé
          this.headers = [];
          this.headersInitialized = true;
          this.columnHeadersMap = {};
          console.log(`[FormPreview] Headers initialisés à vide pour la page ${page} (pas de réponse du backend)`);
        }
        
        // 🔧 CORRECTION : Mettre à jour columnLabels pour toutes les pages (comme dans loadPageIfNeeded)
        if (response.columnLabels) {
          // Convertir le format { [colKey: string]: string } vers { [sheetIndex: string]: { [colKey: string]: string } }
          const sheetKey = this.selectedSheetIndex.toString();
          this.columnLabels = { [sheetKey]: response.columnLabels };
        }
        
        // 🔧 CORRECTION : Mettre à jour normalizedEditableCells pour toutes les pages (comme dans loadPageIfNeeded)
        // Les editableCells doivent être les mêmes pour toutes les pages, donc on les met à jour à chaque fois
        if (response.tableDataEditableCells) {
          // 🔧 CORRECTION : tableDataEditableCells a des index relatifs à la page (0-19 pour chaque page)
          // Il faut les convertir en index absolus et les fusionner avec les cellules existantes
          const pageOffset = (page - 1) * this.pageSize;
          const newCells = response.tableDataEditableCells.map((cell: any) => ({
            row: pageOffset + cell.row, // Convertir l'index relatif en index absolu
            col: cell.col  // Déjà au format "column-0", "column-1", etc.
          }));
          
          // 🔧 CORRECTION : Ne pas réinitialiser à chaque page 1, seulement quand les paramètres changent
          // (la réinitialisation est déjà faite dans simulateTabdataSecure() quand les paramètres changent)
          
          // Fusionner avec les cellules existantes (éviter les doublons)
          const existingCellsMap = new Map<string, boolean>();
          this.normalizedEditableCells.forEach(cell => {
            existingCellsMap.set(`${cell.row}-${cell.col}`, true);
          });
          
          newCells.forEach((cell: { row: number, col: string }) => {
            const cellKey = `${cell.row}-${cell.col}`;
            if (!existingCellsMap.has(cellKey)) {
              this.normalizedEditableCells.push(cell);
              existingCellsMap.set(cellKey, true);
            }
          });
          
          console.log(`[FormPreview] NormalizedEditableCells fusionnés depuis tableDataEditableCells (token, page ${page}, offset ${pageOffset}):`, 
                     this.normalizedEditableCells.length, 'cellules totales', 
                     newCells.length, 'nouvelles cellules',
                     'exemple:', newCells.slice(0, 3));
        } else {
          // 🔧 CORRECTION : Si tableDataEditableCells n'est pas dans la réponse, utiliser les editableCells passés en input
          // (fallback pour les cas où le backend ne fournit pas tableDataEditableCells)
          if (page === 1 && this.normalizedEditableCells.length === 0) {
            this.normalizeEditableCells();
            console.log('[FormPreview] NormalizedEditableCells initialisé depuis editableCells input (fallback, token mode)');
          }
        }
        
        this.loadingPages.delete(page);
        this.isSimulating = this.loadingPages.size > 0;
        
        // 🔧 CORRECTION : Forcer la détection de changement immédiatement après la mise à jour des headers
        // pour s'assurer que le template est mis à jour
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        // Forcer la détection de changement pour mettre à jour l'affichage
        setTimeout(() => {
          // Recalculer l'adaptation et la pagination
          this.recalculateTableAdaptation();
          this.calculatePagination();
          // Forcer la détection de changement pour mettre à jour le template
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }, 0);
        
        // 🔧 CORRECTION : Forcer une deuxième détection de changement après un court délai
        // pour s'assurer que le template est bien mis à jour avec les headers
        setTimeout(() => {
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          console.log(`[FormPreview] Deuxième détection de changement forcée (page ${page}), headers:`, this.headers);
        }, 100);
      },
      error: (error) => {
        console.error(`[FormPreview] Erreur lors du chargement de la page ${page} via token:`, error);
        this.loadingPages.delete(page);
        this.isSimulating = this.loadingPages.size > 0;
        // En cas d'erreur, mettre un tableau vide pour cette page
        this.simulatedDataCache[page] = [];
      }
    });
  }

  /**
   * Décharge les pages du cache sauf la page spécifiée
   */
  private unloadOtherPages(currentPage: number): void {
    // Supprimer toutes les pages du cache sauf la page actuelle
    for (const page in this.simulatedDataCache) {
      const pageNum = parseInt(page);
      if (pageNum !== currentPage) {
        delete this.simulatedDataCache[pageNum];
      }
    }
  }

  /**
   * Getter pour les données (utilise la simulation ou les données legacy)
   */
  get displayData(): any[] {
    // Mode token : utiliser les données chargées via token depuis le cache
    if (this.token) {
      const pageData = this.simulatedDataCache[this.currentPage] || [];
      if (this.currentPage > 1 && pageData.length === 0) {
        console.warn(`[FormPreview] displayData: Page ${this.currentPage} vide dans le cache (token mode)`, {
          cacheKeys: Object.keys(this.simulatedDataCache),
          currentPage: this.currentPage,
          isSimulating: this.isSimulating
        });
      }
      return pageData;
    }
    
    // Mode sécurisé : utiliser les données simulées depuis le cache
    if ((this.tempFileId || this.shareId) && this.recipientEmail) {
      // Retourner les données de la page actuelle depuis le cache
      const pageData = this.simulatedDataCache[this.currentPage] || [];
      // Log pour débogage
      if (this.currentPage > 1 && pageData.length === 0) {
        console.warn(`[FormPreview] displayData: Page ${this.currentPage} vide dans le cache`, {
          cacheKeys: Object.keys(this.simulatedDataCache),
          currentPage: this.currentPage,
          isSimulating: this.isSimulating
        });
      }
      return pageData;
    }
    
    // Mode legacy : utiliser les données passées directement (DÉPRÉCIÉ)
    return this.data || [];
  }

  /**
   * Getter pour les cellules éditables normalisées
   */
  get normalizedEditableCellsForDisplay(): { row: number, col: string }[] {
    const sheetKey = this.selectedSheetIndex.toString();
    const cells = this.editableCells[sheetKey] || [];
    return cells.map(cell => ({
      row: cell.row,
      col: typeof cell.col === 'string' ? cell.col : `column-${cell.col}`
    }));
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
    const originalLabels = this.columnLabels[sheetKey] || {};

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
        }
      }
    });

    return { [sheetKey]: convertedLabels };
  }

  /**
   * Convertit les index de colonnes dans editableCells des index originaux vers les index filtrés
   * Utilise la même logique que getColumnLabelsForSimulation()
   */
  private getEditableCellsForSimulation(): { [sheetIndex: string]: { row: number, col: number }[] } {
    if (!this.editableCells || typeof this.editableCells !== 'object') {
      return {};
    }

    const sheetKey = String(this.selectedSheetIndex);
    const originalEditableCells = this.editableCells[sheetKey] || [];

    if (originalEditableCells.length === 0) {
      return { [sheetKey]: [] };
    }

    // 🔧 MÊME LOGIQUE que getColumnLabelsForSimulation() : Extraire les colonnes uniques sélectionnées
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

    // Convertir les editableCells en utilisant le mapping
    const convertedEditableCells = originalEditableCells
      .map(cell => {
        // Si la colonne n'est pas dans les colonnes sélectionnées, l'exclure
        if (!columnMapping.hasOwnProperty(cell.col)) {
          return null;
        }
        return {
          row: cell.row,
          col: columnMapping[cell.col] // Convertir l'index original vers le nouvel index
        };
      })
      .filter(cell => cell !== null) as { row: number, col: number }[];

    return { [sheetKey]: convertedEditableCells };
  }
}