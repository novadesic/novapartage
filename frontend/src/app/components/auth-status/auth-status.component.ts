import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { UnifiedAuthState } from '../../services/unified-auth.service';

@Component({
  selector: 'app-auth-status',
  template: `
    <div class="auth-status" *ngIf="authState.isEmailValidated || authState.isAuthenticated">
      <div class="d-flex align-items-center">
        <i class="bi bi-person-check-fill text-success me-2"></i>
        <div>
          <div class="fw-bold text-success">
            {{ authState.userInfo?.email || 'Utilisateur connecté' }}
          </div>
          <small class="text-muted">
            {{ authState.isEmailValidated ? 'Email validé' : 'Authentifié' }}
          </small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-status {
      padding: 0.5rem;
      background-color: rgba(25, 135, 84, 0.1);
      border-radius: 0.375rem;
      border: 1px solid rgba(25, 135, 84, 0.2);
    }
  `]
})
export class AuthStatusComponent implements OnInit, OnDestroy {
  authState: UnifiedAuthState = {
    isAuthenticated: false,
    isEmailValidated: false
  };
  
  private authStateSubscription?: Subscription;

  constructor(private authService: UnifiedAuthService) {}

  ngOnInit() {
    // S'abonner aux changements d'état d'authentification
    this.authStateSubscription = this.authService.getAuthState$().subscribe(
      (state: UnifiedAuthState) => {
        this.authState = state;
      }
    );
  }

  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
  }
}
