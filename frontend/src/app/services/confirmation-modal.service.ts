import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ConfirmationModalOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  // Pour les modals avec deux actions personnalisées
  primaryActionText?: string;
  secondaryActionText?: string;
  showSecondaryAction?: boolean;
}

export interface ConfirmationModalResult {
  confirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationModalService {
  private modalSubject = new Subject<{ options: ConfirmationModalOptions, resultCallback: (result: ConfirmationModalResult) => void }>();
  public modal$ = this.modalSubject.asObservable();

  /**
   * Affiche une modal d'alerte (pas de bouton annuler)
   */
  alert(message: string, title: string = 'Information', type: 'info' | 'warning' | 'error' | 'success' = 'info'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.show({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'OK'
      }, () => {
        resolve();
      });
    });
  }

  /**
   * Affiche une modal de confirmation (avec bouton annuler)
   */
  confirm(message: string, title: string = 'Confirmation', type: 'info' | 'warning' | 'error' = 'warning'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.show({
        title,
        message,
        type,
        showCancel: true,
        confirmText: 'Confirmer',
        cancelText: 'Annuler'
      }, (result) => {
        resolve(result.confirmed);
      });
    });
  }

  /**
   * Affiche une modal personnalisée
   */
  show(options: ConfirmationModalOptions, callback: (result: ConfirmationModalResult) => void): void {
    this.modalSubject.next({ options, resultCallback: callback });
  }

  /**
   * Affiche une alerte d'erreur
   */
  alertError(message: string, title: string = 'Erreur'): Promise<void> {
    return this.alert(message, title, 'error');
  }

  /**
   * Affiche une alerte d'avertissement
   */
  alertWarning(message: string, title: string = 'Attention'): Promise<void> {
    return this.alert(message, title, 'warning');
  }

  /**
   * Affiche une alerte de succès
   */
  alertSuccess(message: string, title: string = 'Succès'): Promise<void> {
    return this.alert(message, title, 'success');
  }

  /**
   * Affiche une confirmation de suppression
   */
  confirmDelete(message: string = 'Êtes-vous sûr de vouloir supprimer cet élément ?', title: string = 'Confirmer la suppression'): Promise<boolean> {
    return this.confirm(message, title, 'warning');
  }
}

