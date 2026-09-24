import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmationModalService, ConfirmationModalOptions, ConfirmationModalResult } from '../../services/confirmation-modal.service';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal fade" 
         [class.show]="showModal" 
         [style.display]="showModal ? 'block' : 'none'" 
         [style.background]="showModal ? 'rgba(0,0,0,0.4)' : 'none'"
         tabindex="-1" 
         role="dialog"
         aria-labelledby="confirmationModalLabel"
         aria-hidden="true"
         style="z-index: 1050; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header" [ngClass]="getHeaderClass()">
            <h5 class="modal-title" id="confirmationModalLabel">
              <i class="bi" [ngClass]="getIconClass()"></i>
              {{ options?.title || 'Confirmation' }}
            </h5>
            <button type="button" 
                    class="btn-close" 
                    (click)="close(false)"
                    aria-label="Fermer"
                    *ngIf="options?.showCancel">
            </button>
          </div>
          <div class="modal-body">
            <p [innerHTML]="options?.message || ''"></p>
          </div>
          <div class="modal-footer">
            <button type="button" 
                    class="btn btn-secondary" 
                    (click)="close(false)"
                    *ngIf="options?.showCancel">
              {{ options?.cancelText || 'Annuler' }}
            </button>
            <button type="button" 
                    class="btn" 
                    [ngClass]="getConfirmButtonClass()"
                    (click)="close(true)">
              {{ options?.confirmText || 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal {
      backdrop-filter: blur(2px);
    }
    .modal-header.bg-danger {
      background-color: #dc3545;
      color: white;
    }
    .modal-header.bg-warning {
      background-color: #ffc107;
      color: #000;
    }
    .modal-header.bg-success {
      background-color: #28a745;
      color: white;
    }
    .modal-header.bg-info {
      background-color: #17a2b8;
      color: white;
    }
  `]
})
export class ConfirmationModalComponent implements OnInit, OnDestroy {
  showModal = false;
  options: ConfirmationModalOptions | null = null;
  private resultCallback: ((result: ConfirmationModalResult) => void) | null = null;
  private subscription?: Subscription;

  constructor(private confirmationModalService: ConfirmationModalService) {}

  ngOnInit(): void {
    this.subscription = this.confirmationModalService.modal$.subscribe(({ options, resultCallback }) => {
      this.options = options;
      this.resultCallback = resultCallback;
      this.showModal = true;
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  close(confirmed: boolean): void {
    this.showModal = false;
    if (this.resultCallback) {
      this.resultCallback({ confirmed });
    }
    // Réinitialiser après un court délai pour permettre l'animation de fermeture
    setTimeout(() => {
      this.options = null;
      this.resultCallback = null;
    }, 300);
  }

  getHeaderClass(): string {
    if (!this.options?.type) return '';
    switch (this.options.type) {
      case 'error': return 'bg-danger text-white';
      case 'warning': return 'bg-warning text-dark';
      case 'success': return 'bg-success text-white';
      case 'info': return 'bg-info text-white';
      default: return '';
    }
  }

  getIconClass(): string {
    if (!this.options?.type) return 'bi-info-circle me-2';
    switch (this.options.type) {
      case 'error': return 'bi-exclamation-triangle-fill me-2';
      case 'warning': return 'bi-exclamation-triangle me-2';
      case 'success': return 'bi-check-circle-fill me-2';
      case 'info': return 'bi-info-circle-fill me-2';
      default: return 'bi-info-circle me-2';
    }
  }

  getConfirmButtonClass(): string {
    if (!this.options?.type) return 'btn-primary';
    switch (this.options.type) {
      case 'error': return 'btn-danger';
      case 'warning': return 'btn-warning';
      case 'success': return 'btn-success';
      case 'info': return 'btn-primary';
      default: return 'btn-primary';
    }
  }
}




