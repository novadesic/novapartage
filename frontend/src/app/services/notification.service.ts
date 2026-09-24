import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // en millisecondes, 0 = pas d'auto-fermeture
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new Subject<Notification>();
  public notifications$ = this.notificationsSubject.asObservable();

  constructor() {}

  /**
   * Affiche une notification de succès
   */
  success(message: string, title?: string, duration: number = 5000): void {
    this.show({
      id: this.generateId(),
      type: 'success',
      title: title || 'Succès',
      message,
      duration,
      dismissible: true
    });
  }

  /**
   * Affiche une notification d'erreur
   */
  error(message: string, title?: string, duration: number = 8000): void {
    this.show({
      id: this.generateId(),
      type: 'error',
      title: title || 'Erreur',
      message,
      duration,
      dismissible: true
    });
  }

  /**
   * Affiche une notification d'avertissement
   */
  warning(message: string, title?: string, duration: number = 6000): void {
    this.show({
      id: this.generateId(),
      type: 'warning',
      title: title || 'Attention',
      message,
      duration,
      dismissible: true
    });
  }

  /**
   * Affiche une notification d'information
   */
  info(message: string, title?: string, duration: number = 4000): void {
    this.show({
      id: this.generateId(),
      type: 'info',
      title: title || 'Information',
      message,
      duration,
      dismissible: true
    });
  }

  /**
   * Affiche une notification personnalisée
   */
  show(notification: Notification): void {
    this.notificationsSubject.next(notification);
  }

  /**
   * Génère un ID unique pour chaque notification
   */
  private generateId(): string {
    return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
} 