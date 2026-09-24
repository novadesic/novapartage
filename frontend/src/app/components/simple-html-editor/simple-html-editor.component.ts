import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-simple-html-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="simple-editor-container">
      <!-- Barre d'outils simplifiée -->
      <div class="toolbar">
        <!-- Alignement -->
        <div class="btn-group me-2" role="group">
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="setAlignment('left')" title="Aligner à gauche">
            <i class="bi bi-text-left"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="setAlignment('center')" title="Centrer">
            <i class="bi bi-text-center"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="setAlignment('right')" title="Aligner à droite">
            <i class="bi bi-text-right"></i>
          </button>
        </div>
        
        <div class="separator"></div>
        
        <!-- Formatage -->
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('bold')" title="Gras">
          <strong>B</strong>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('italic')" title="Italique">
          <em>I</em>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="execCommand('underline')" title="Souligné">
          <u>U</u>
        </button>
      </div>
      
      <!-- Zone d'édition -->
      <div 
        #editorContent
        class="editor-content"
        contentEditable="true"
        (input)="onInput()"
        (blur)="onBlur()"
        (focus)="onFocus()"
        (keydown)="onKeyDown($event)"
        style="direction: ltr; text-align: left; unicode-bidi: normal;">
      </div>
    </div>
  `,
  styles: [`
    .simple-editor-container {
      border: 1px solid #ccc;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .toolbar {
      background-color: #f8f9fa;
      padding: 8px;
      border-bottom: 1px solid #ccc;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .separator {
      width: 1px;
      height: 20px;
      background-color: #ccc;
      margin: 0 4px;
    }
    
    .editor-content {
      min-height: 120px;
      padding: 12px;
      outline: none;
      font-family: inherit;
      font-size: inherit;
      line-height: 1.5;
    }
    
    .editor-content:focus {
      background-color: #fff;
    }
    
    .btn-group .btn {
      border-radius: 0;
    }
    
    .btn-group .btn:first-child {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }
    
    .btn-group .btn:last-child {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
    }
  `]
})
export class SimpleHtmlEditorComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();
  @Input() forceUpdate: boolean = false; // Nouvelle propriété pour forcer la mise à jour

  constructor(private logger: LoggerService) {}

  @ViewChild('editorContent') editorContent!: ElementRef<HTMLDivElement>;

  private lastContent: string = '';
  private isUpdating: boolean = false;
  private isComposing: boolean = false;

  ngOnInit() {

    this.lastContent = this.value !== undefined ? this.value : '';

  }

  ngAfterViewInit() {

    // Attendre un peu que le DOM soit complètement rendu
    setTimeout(() => {
      this.updateEditorContent();
    }, 0);
  }

  ngOnDestroy() {
    // Cleanup si nécessaire
  }

  ngOnChanges(changes: SimpleChanges) {

    if (changes['value']) {


      if (!changes['value'].firstChange) {
        this.updateEditorContent();
      }
    }
    
    // Réagir aux changements de forceUpdate
    if (changes['forceUpdate']) {

      if (changes['forceUpdate'].currentValue) {
        // Forcer la mise à jour et le focus
        setTimeout(() => {
          this.forceUpdateContent();
          this.focusEditor();
        }, 50);
      }
    }
  }

  onInput() {
    if (this.isUpdating) return;
    
    const content = this.editorContent.nativeElement.innerHTML;
    if (content !== this.lastContent) {
      this.lastContent = content;
      this.valueChange.emit(content);
    }
  }

  onBlur() {
    this.onInput();
  }

  onFocus() {
    // Focus géré automatiquement
  }

  onKeyDown(event: KeyboardEvent) {
    // Détecter les compositions (IME pour les langues asiatiques)
    if (event.isComposing) {
      this.isComposing = true;
      return;
    }
    this.isComposing = false;
    
    // Laisser le navigateur gérer naturellement la touche Entrée
    if (event.key === 'Enter') {
      // Pas de prévention du comportement par défaut
      // Le navigateur gère automatiquement les sauts de ligne
      setTimeout(() => {
        this.onInput();
      }, 0);
    }
  }

  execCommand(command: string, value: string = '') {
    document.execCommand(command, false, value);
    this.editorContent?.nativeElement.focus();
    this.onInput();
  }

  setAlignment(alignment: 'left' | 'center' | 'right') {
    document.execCommand('justifyLeft', false);
    document.execCommand('justifyCenter', false);
    document.execCommand('justifyRight', false);
    
    switch (alignment) {
      case 'left':
        document.execCommand('justifyLeft', false);
        break;
      case 'center':
        document.execCommand('justifyCenter', false);
        break;
      case 'right':
        document.execCommand('justifyRight', false);
        break;
    }
    
    this.editorContent?.nativeElement.focus();
    this.onInput();
  }

  private updateEditorContent() {



    
    if (this.editorContent && this.value !== this.lastContent) {

      this.isUpdating = true;
      this.editorContent.nativeElement.innerHTML = this.value !== undefined ? this.value : '';
      this.lastContent = this.value !== undefined ? this.value : '';
      this.isUpdating = false;

    } else {

    }
  }

  private forceUpdateContent() {

    if (this.editorContent) {
      this.isUpdating = true;
      this.editorContent.nativeElement.innerHTML = this.value !== undefined ? this.value : '';
      this.lastContent = this.value !== undefined ? this.value : '';
      this.isUpdating = false;

    }
  }

  private focusEditor() {

    if (this.editorContent) {
      this.editorContent.nativeElement.focus();

    }
  }
} 