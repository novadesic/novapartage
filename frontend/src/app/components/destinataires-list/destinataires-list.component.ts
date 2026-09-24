import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-destinataires-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './destinataires-list.component.html',
  styleUrl: './destinataires-list.component.scss'
})
export class DestinatairesListComponent {
  @Input() destinataires: any[] = [];
  @Input() activeIndex: number = 0;
  @Input() layout: 'vertical' | 'horizontal' = 'vertical';
  @Output() activeChange = new EventEmitter<number>();
  @Output() add = new EventEmitter<string>();
  @Output() remove = new EventEmitter<number>();
  @Output() openContactsModal = new EventEmitter<void>();

  constructor(private logger: LoggerService) {}

  /**
   * Retourne les destinataires triés par ordre alphabétique
   */
  get sortedDestinataires(): any[] {
    return [...this.destinataires].sort((a, b) => {
      const nameA = (a.displayName || a.email || '').toLowerCase();
      const nameB = (b.displayName || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  setActive(index: number) {
    this.activeChange.emit(index);
  }

  addDestinataire(email: string) {
    if (email) {
      this.add.emit(email);
    }
  }

  removeDestinataire(index: number) {
    this.remove.emit(index);
  }

  openContactsModalHandler() {
    this.openContactsModal.emit();
  }
}
