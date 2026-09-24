import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-destinataires-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './destinataires-tabs.component.html',
  styleUrl: './destinataires-tabs.component.scss'
})
export class DestinatairesTabsComponent {
  @Input() destinataires: any[] = [];
  @Input() activeIndex: number = 0;
  @Output() activeChange = new EventEmitter<number>();
  @Output() add = new EventEmitter<string>();
  @Output() remove = new EventEmitter<number>();

  setActive(index: number) {
    this.activeChange.emit(index);
  }

  addDestinataire(emailInput: HTMLInputElement) {
    if (emailInput.value) {
      this.add.emit(emailInput.value);
      emailInput.value = '';
    }
  }

  removeDestinataire(index: number) {
    this.remove.emit(index);
  }
}
