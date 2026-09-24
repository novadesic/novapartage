import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-html-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="html-editor-container">
      <!-- Barre d'outils -->
      <div class="toolbar">
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('bold')" title="Gras">
          <i class="bi bi-type-bold"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('italic')" title="Italique">
          <i class="bi bi-type-italic"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('underline')" title="Souligné">
          <i class="bi bi-type-underline"></i>
        </button>
        <div class="separator"></div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('insertUnorderedList')" title="Liste à puces">
          <i class="bi bi-list-ul"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('insertOrderedList')" title="Liste numérotée">
          <i class="bi bi-list-ol"></i>
        </button>
        <div class="separator"></div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('justifyLeft')" title="Aligner à gauche">
          <i class="bi bi-text-left"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('justifyCenter')" title="Centrer">
          <i class="bi bi-text-center"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('justifyRight')" title="Aligner à droite">
          <i class="bi bi-text-right"></i>
        </button>
        <div class="separator"></div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="insertLink()" title="Insérer un lien">
          <i class="bi bi-link-45deg"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="insertImage()" title="Insérer une image">
          <i class="bi bi-image"></i>
        </button>
        <div class="separator"></div>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggleView()" title="Basculer entre HTML et aperçu">
          <i class="bi" [class.bi-code-slash]="!isHtmlView" [class.bi-eye]="isHtmlView"></i>
        </button>
      </div>
      
      <!-- Zone d'édition -->
      <div class="editor-area">
        <div 
          #editorContent
          class="editor-content" 
          contenteditable="true"
          [class.html-view]="isHtmlView"
          [innerHTML]="htmlContent"
          (input)="onContentChange()"
          (blur)="onBlur()"
          (focus)="onFocus()">
        </div>
      </div>
      
      <!-- Modal pour les liens -->
      <div class="modal fade" [class.show]="showLinkModal" [style.display]="showLinkModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Insérer un lien</h5>
              <button type="button" class="btn-close" (click)="cancelLink()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">URL</label>
                <input type="url" class="form-control" [(ngModel)]="linkUrl" placeholder="ex: https://exemple.com">
              </div>
              <div class="mb-3">
                <label class="form-label">Texte du lien</label>
                <input type="text" class="form-control" [(ngModel)]="linkText" placeholder="ex: Cliquez ici">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="cancelLink()">Annuler</button>
              <button type="button" class="btn btn-primary" (click)="insertLinkConfirm()">Insérer</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Modal pour les images -->
      <div class="modal fade" [class.show]="showImageModal" [style.display]="showImageModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Insérer une image</h5>
              <button type="button" class="btn-close" (click)="cancelImage()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">URL de l'image</label>
                <input type="url" class="form-control" [(ngModel)]="imageUrl" placeholder="ex: https://exemple.com/image.jpg">
              </div>
              <div class="mb-3">
                <label class="form-label">Texte alternatif</label>
                <input type="text" class="form-control" [(ngModel)]="imageAlt" placeholder="ex: Logo de l'entreprise">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="cancelImage()">Annuler</button>
              <button type="button" class="btn btn-primary" (click)="insertImageConfirm()">Insérer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./html-editor.component.scss']
})
export class HtmlEditorComponent implements OnInit, OnDestroy {
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();
  
  @ViewChild('editorContent') editorContent!: ElementRef<HTMLDivElement>;
  
  htmlContent: string = '';
  isHtmlView: boolean = false;
  showLinkModal: boolean = false;
  showImageModal: boolean = false;
  linkUrl: string = '';
  linkText: string = '';
  imageUrl: string = '';
  imageAlt: string = '';
  
  // Variables pour gérer la position du curseur
  private savedSelection: { start: number; end: number } | null = null;
  private isUpdating: boolean = false;
  private lastContent: string = '';
  private updateTimeout: any = null;
  
  ngOnInit() {
    this.htmlContent = this.value || '';
  }
  
  ngOnDestroy() {
    // Nettoyer les modales si elles sont ouvertes
    this.showLinkModal = false;
    this.showImageModal = false;
    
    // Nettoyer le timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }
  
  onContentChange() {
    if (this.editorContent && !this.isUpdating) {
      const content = this.editorContent.nativeElement.innerHTML;
      
      // Éviter les mises à jour inutiles
      if (content === this.lastContent) {
        return;
      }
      
      // Sauvegarder la position du curseur avant la mise à jour
      this.saveSelection();
      
      this.isUpdating = true;
      this.htmlContent = content;
      this.lastContent = content;
      
      // Utiliser requestAnimationFrame pour une meilleure synchronisation
      requestAnimationFrame(() => {
        this.valueChange.emit(content);
        
        // Restaurer la position du curseur après la mise à jour
        requestAnimationFrame(() => {
          this.restoreSelection();
          this.isUpdating = false;
        });
      });
    }
  }
  
  onBlur() {
    this.onContentChange();
  }
  
  onFocus() {
    // Restaurer la sélection si nécessaire
    this.restoreSelection();
  }
  
  /**
   * Sauvegarde la position actuelle du curseur
   */
  private saveSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(this.editorContent.nativeElement);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      this.savedSelection = {
        start: preCaretRange.toString().length,
        end: preCaretRange.toString().length
      };
    }
  }
  
  /**
   * Restaure la position du curseur
   */
  private restoreSelection() {
    if (this.savedSelection && this.editorContent) {
      const selection = window.getSelection();
      const range = document.createRange();
      
      let charIndex = 0;
      let foundStart = false;
      let foundEnd = false;
      
      const traverseNodes = (node: Node) => {
        if (foundEnd) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharIndex = charIndex + node.textContent!.length;
          if (!foundStart && this.savedSelection!.start >= charIndex && this.savedSelection!.start <= nextCharIndex) {
            range.setStart(node, this.savedSelection!.start - charIndex);
            foundStart = true;
          }
          if (!foundEnd && this.savedSelection!.end >= charIndex && this.savedSelection!.end <= nextCharIndex) {
            range.setEnd(node, this.savedSelection!.end - charIndex);
            foundEnd = true;
          }
          charIndex = nextCharIndex;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverseNodes(node.childNodes[i]);
          }
        }
      };
      
      traverseNodes(this.editorContent.nativeElement);
      
      if (foundStart && foundEnd) {
        selection!.removeAllRanges();
        selection!.addRange(range);
      }
    }
  }
  
  execCommand(command: string, value: string = '') {
    // Sauvegarder la position du curseur avant l'exécution de la commande
    this.saveSelection();
    
    document.execCommand(command, false, value);
    this.editorContent?.nativeElement.focus();
    
    // Restaurer la position du curseur après l'exécution
    requestAnimationFrame(() => {
      this.restoreSelection();
    });
    
    // Mettre à jour le contenu sans déclencher onContentChange
    if (this.editorContent) {
      const content = this.editorContent.nativeElement.innerHTML;
      this.htmlContent = content;
      this.lastContent = content;
      this.valueChange.emit(content);
    }
  }
  
  toggleView() {
    // Sauvegarder la position du curseur avant le changement de vue
    this.saveSelection();
    
    this.isHtmlView = !this.isHtmlView;
    if (this.isHtmlView) {
      // Afficher le HTML brut
      this.editorContent.nativeElement.textContent = this.htmlContent;
    } else {
      // Afficher le HTML formaté
      this.editorContent.nativeElement.innerHTML = this.htmlContent;
    }
    
    // Restaurer la position du curseur après le changement de vue
    requestAnimationFrame(() => {
      this.restoreSelection();
    });
  }
  
  insertLink() {
    this.showLinkModal = true;
    this.linkUrl = '';
    this.linkText = '';
  }
  
  insertLinkConfirm() {
    if (this.linkUrl) {
      const linkHtml = `<a href="${this.linkUrl}" target="_blank">${this.linkText || this.linkUrl}</a>`;
      this.execCommand('insertHTML', linkHtml);
    }
    this.cancelLink();
  }
  
  cancelLink() {
    this.showLinkModal = false;
    this.linkUrl = '';
    this.linkText = '';
  }
  
  insertImage() {
    this.showImageModal = true;
    this.imageUrl = '';
    this.imageAlt = '';
  }
  
  insertImageConfirm() {
    if (this.imageUrl) {
      const imgHtml = `<img src="${this.imageUrl}" alt="${this.imageAlt}" style="max-width: 100%; height: auto;">`;
      this.execCommand('insertHTML', imgHtml);
    }
    this.cancelImage();
  }
  
  cancelImage() {
    this.showImageModal = false;
    this.imageUrl = '';
    this.imageAlt = '';
  }
} 