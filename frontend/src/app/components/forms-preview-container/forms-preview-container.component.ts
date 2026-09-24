import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormPreviewComponent } from '../form-preview/form-preview.component';

@Component({
  selector: 'app-forms-preview-container',
  standalone: true,
  imports: [CommonModule, FormPreviewComponent],
  templateUrl: './forms-preview-container.component.html',
  styleUrl: './forms-preview-container.component.scss'
})
export class FormsPreviewContainerComponent {
  @Input() recipients: any[] = [];
  @Input() tableData: any[] = [];

  @Input() sheets: any[] = [];
  @Input() selectedSheetIndex: number = 0;
  @Input() headers: string[] = [];
  @Input() columnLabels: { [recipientIndex: number]: { [sheetIndex: number]: { [colKey: string]: string } } } = {};
  @Input() pageTitles: { [recipientIndex: number]: { [sheetIndex: number]: string } } = {};
  @Input() pageDescriptions: { [recipientIndex: number]: { [sheetIndex: number]: string } } = {};
  @Input() editableCells: { [recipientIndex: number]: { [sheetIndex: number]: { row: number, col: number }[] } } = {};
  @Output() pageTitlesChange = new EventEmitter<{ [recipientIndex: number]: { [sheetIndex: number]: string } }>();
  @Output() pageDescriptionsChange = new EventEmitter<{ [recipientIndex: number]: { [sheetIndex: number]: string } }>();

  activeRecipientIndex = 0;

  get activeRecipient() {
    return this.recipients[this.activeRecipientIndex];
  }

  get activeSelection() {
    return this.activeRecipient?.selection?.[this.selectedSheetIndex] || [];
  }

  get activeSelectionsForFormPreview() {
    const result: { [sheetIndex: string]: { row: number, col: number }[] } = {};
    const sheetKey = this.selectedSheetIndex.toString();
    result[sheetKey] = this.activeSelection;
    return result;
  }

  get activeColumnLabels() {
    return this.columnLabels[this.activeRecipientIndex]?.[this.selectedSheetIndex] || {};
  }

  get activeColumnLabelsForFormPreview() {
    const result: { [sheetIndex: string]: { [colKey: string]: string } } = {};
    const sheetKey = this.selectedSheetIndex.toString();
    result[sheetKey] = this.activeColumnLabels;
    return result;
  }

  get activePageTitle() {
    return this.pageTitles[this.activeRecipientIndex]?.[this.selectedSheetIndex] || 'Formulaire de saisie';
  }

  get activePageDescription() {
    return this.pageDescriptions[this.activeRecipientIndex]?.[this.selectedSheetIndex] || 'Veuillez remplir les informations ci-dessous.';
  }

  get activeEditableCells() {
    return this.editableCells[this.activeRecipientIndex]?.[this.selectedSheetIndex] || [];
  }

  get activeEditableCellsForFormPreview() {
    const result: { [sheetIndex: string]: { row: number, col: number }[] } = {};
    const sheetKey = this.selectedSheetIndex.toString();
    result[sheetKey] = this.activeEditableCells;
    return result;
  }

  get filteredTableData() {
    if (!this.tableData || !this.activeSelection || this.activeSelection.length === 0) {
      return this.tableData; // Retourner toutes les données si pas de sélection
    }

    // Créer un ensemble des lignes sélectionnées pour un accès rapide
    const selectedRows = new Set(this.activeSelection.map((cell: { row: number; col: number }) => cell.row));
    
    // Filtrer les données pour ne garder que les lignes sélectionnées
    const filteredData = this.tableData.filter((_, rowIndex) => selectedRows.has(rowIndex));
    
    return filteredData;
  }

  onPageTitleChange(title: string) {
    const newTitles = { ...this.pageTitles };
    if (!newTitles[this.activeRecipientIndex]) {
      newTitles[this.activeRecipientIndex] = {};
    }
    newTitles[this.activeRecipientIndex][this.selectedSheetIndex] = title;
    this.pageTitlesChange.emit(newTitles);
  }

  onPageDescriptionChange(description: string) {
    const newDescriptions = { ...this.pageDescriptions };
    if (!newDescriptions[this.activeRecipientIndex]) {
      newDescriptions[this.activeRecipientIndex] = {};
    }
    newDescriptions[this.activeRecipientIndex][this.selectedSheetIndex] = description;
    this.pageDescriptionsChange.emit(newDescriptions);
  }

  setActiveRecipient(index: number) {
    this.activeRecipientIndex = index;
  }

  canGoPrevious(): boolean {
    return this.activeRecipientIndex > 0;
  }

  canGoNext(): boolean {
    return this.activeRecipientIndex < this.recipients.length - 1;
  }

  previousRecipient() {
    if (this.canGoPrevious()) {
      this.activeRecipientIndex--;
    }
  }

  nextRecipient() {
    if (this.canGoNext()) {
      this.activeRecipientIndex++;
    }
  }

  getRecipientDisplayName(recipient: any, index: number): string {
    if (recipient.name) {
      return `${recipient.name} (${recipient.email})`;
    }
    return recipient.email || `Destinataire ${index + 1}`;
  }
} 