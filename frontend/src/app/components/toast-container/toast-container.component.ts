import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1055;">
      <div *ngFor="let notification of notifications" 
           class="toast show" 
           role="alert" 
           aria-live="assertive" 
           aria-atomic="true">
        <div class="toast-header" [ngClass]="getToastHeaderClass(notification.type)">
          <strong class="me-auto">{{ notification.title }}</strong>
          <small *ngIf="notification.duration && notification.duration > 0">{{ getTimeRemaining(notification) }}</small>
          <button *ngIf="notification.dismissible" 
                  type="button" 
                  class="btn-close" 
                  (click)="removeNotification(notification.id)"
                  aria-label="Close"></button>
        </div>
        <div class="toast-body">
          {{ notification.message }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      max-width: 400px;
    }
    
    .toast {
      margin-bottom: 0.5rem;
      border: none;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }
    
    .toast-header.success {
      background-color: #d1e7dd;
      color: #0f5132;
      border-bottom: 1px solid #badbcc;
    }
    
    .toast-header.error {
      background-color: #f8d7da;
      color: #721c24;
      border-bottom: 1px solid #f5c6cb;
    }
    
    .toast-header.warning {
      background-color: #fff3cd;
      color: #856404;
      border-bottom: 1px solid #ffeaa7;
    }
    
    .toast-header.info {
      background-color: #d1ecf1;
      color: #0c5460;
      border-bottom: 1px solid #bee5eb;
    }
    
    .toast-body {
      background-color: white;
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription = new Subscription();
  private timers: Map<string, any> = new Map();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      (notification: Notification) => {
        this.addNotification(notification);
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.clearAllTimers();
  }

  addNotification(notification: Notification): void {
    this.notifications.push(notification);
    
    // Auto-fermeture si une durée est définie
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
      
      this.timers.set(notification.id, timer);
    }
  }

  removeNotification(id: string): void {
    // Supprimer le timer associé
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    
    // Supprimer la notification
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  getToastHeaderClass(type: string): string {
    return type;
  }

  getTimeRemaining(notification: Notification): string {
    // Pour l'instant, on affiche juste "À l'instant"
    // On pourrait implémenter un compte à rebours si nécessaire
    return 'À l\'instant';
  }

  private clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
} 