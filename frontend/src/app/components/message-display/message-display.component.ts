import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { MessageService, MessageState } from '../../services/message.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-message-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-4" *ngIf="messageState$ | async as message">
      <div class="alert" [ngClass]="getAlertClass(message.type)">
        <i class="bi" [ngClass]="getIconClass(message.type)"></i>
        
        <!-- Message avec liens cliquables pour les destinataires sans sélection -->
        <span *ngIf="message.type === 'warning' && message.recipientsWithoutSelection && message.recipientsWithoutSelection.length > 0">
         Veuillez faire une sélection de cellules pour les destinataires suivants : 
          <span *ngFor="let index of message.recipientsWithoutSelection; let last = last">
            <a href="#" 
               class="text-decoration-none fw-bold" 
               (click)="activateRecipient(index); $event.preventDefault()"
               style="color: inherit; text-decoration: underline; cursor: pointer;">
              {{ getRecipientDisplayName(index) }}
            </a>{{ !last ? ', ' : '' }}
          </span>
        </span>
        
        <!-- Message avec liens cliquables pour les erreurs de destinataires sans sélection -->
        <span *ngIf="message.type === 'error' && message.errorType === 'selection'">
          Impossible de continuer. Veuillez d'abord faire une sélection de cellules pour les destinataires suivants : 
          <span *ngFor="let index of message.recipientsWithoutSelection; let last = last">
            <a href="#" 
               class="text-decoration-none fw-bold" 
               (click)="activateRecipient(index); $event.preventDefault()"
               style="color: inherit; text-decoration: underline; cursor: pointer;">
              {{ getRecipientDisplayName(index) }}
            </a>{{ !last ? ', ' : '' }}
          </span>
        </span>
        
        <!-- Message avec liens cliquables pour les erreurs de destinataires sans titre de formulaire -->
        <span *ngIf="message.type === 'error' && message.errorType === 'pageTitle'">
          Veuillez d'abord saissir un titre de formulaire pour les destinataires suivants : 
          <span *ngFor="let index of message.recipientsWithoutPageTitle; let last = last">
            <a href="#" 
               class="text-decoration-none fw-bold" 
               (click)="activateRecipient(index); $event.preventDefault()"
               style="color: inherit; text-decoration: underline; cursor: pointer;">
              {{ getRecipientDisplayName(index) }}
            </a>{{ !last ? ', ' : '' }}
          </span>
        </span>
        
        <!-- Messages normaux pour les autres types -->
        <span *ngIf="message.type && !(message.type === 'warning' && message.recipientsWithoutSelection && message.recipientsWithoutSelection.length > 0) && 
                     !(message.type === 'error' && (message.errorType === 'selection' || message.errorType === 'pageTitle'))">
          {{ message.text }}
        </span>
      </div>
    </div>
  `,
  styles: []
})
export class MessageDisplayComponent {
  @Input() recipients: any[] = [];
  @Output() recipientActivated = new EventEmitter<number>();

  messageState$: Observable<MessageState | null>;

  constructor(
    private messageService: MessageService,
    private logger: LoggerService
  ) {
    this.messageState$ = this.messageService.message$;
    
    // Log temporaire pour diagnostiquer
    this.messageState$.subscribe(message => {
      this.logger.log('MessageDisplayComponent: Message reçu', message);
    });
  }

  getAlertClass(type: string | undefined): string {
    switch (type) {
      case 'info': return 'alert-info';
      case 'warning': return 'alert-warning';
      case 'error': return 'alert-warning';
      case 'success': return 'alert-success';
      default: return '';
    }
  }

  getIconClass(type: string | undefined): string {
    switch (type) {
      case 'info': return 'bi-info-circle';
      case 'warning': return 'bi-exclamation-triangle';
      case 'error': return 'bi-x-circle';
      case 'success': return 'bi-check-circle';
      default: return '';
    }
  }

  getRecipientDisplayName(index: number): string {
    if (this.recipients && this.recipients[index]) {
      return this.recipients[index].displayName || this.recipients[index].email;
    }
    return `Destinataire ${index + 1}`;
  }

  activateRecipient(index: number): void {
    this.recipientActivated.emit(index);
  }
}
