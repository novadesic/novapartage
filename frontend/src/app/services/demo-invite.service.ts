import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { UnifiedAuthService } from './unified-auth.service';
import { AccountService } from './account.service';
import { SubscriptionService } from './subscription.service';

const STORAGE_KEY = 'novapartage_demo_invite_token';

const PUBLIC_VALIDATE = '/backend/api/public/demo-invites/validate';
const PUBLIC_RESERVE = '/backend/api/public/demo-invites/reserve';
const ACTIVATE = '/backend/api/demo-invites/activate';
const ADMIN_CREATE = '/backend/api/admin/demo-invites';

export interface DemoInviteValidateResponse {
  valid: boolean;
  reason?: string | null;
  inviteExpiresAt?: string;
  entitlementDays?: number;
}

export interface AdminCreateDemoInviteResponse {
  token: string;
  inviteExpiresAt: string;
  inviteValidityDays: number;
  entitlementDays: number;
  relativePath: string;
}

@Injectable({ providedIn: 'root' })
export class DemoInviteService {
  constructor(
    private http: HttpClient,
    private authService: UnifiedAuthService,
    private accountService: AccountService,
    private subscriptionService: SubscriptionService
  ) {}

  validateToken(token: string): Observable<DemoInviteValidateResponse> {
    const params = { token: token.trim() };
    return this.http.get<DemoInviteValidateResponse>(PUBLIC_VALIDATE, { params });
  }

  reserve(token: string, email: string): Observable<{ ok: boolean; message?: string; code?: string }> {
    return this.http.post<{ ok: boolean; message?: string; code?: string }>(PUBLIC_RESERVE, {
      token: token.trim(),
      email: email.trim()
    });
  }

  /** Stocke le jeton pour activation après connexion par e-mail */
  persistTokenForLaterActivation(token: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, token.trim());
    } catch {
      // ignore
    }
  }

  getStoredToken(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  clearStoredToken(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Active la période testeur si l'utilisateur est connecté et un jeton est en attente.
   */
  tryActivatePendingInvite(): Observable<boolean> {
    const token = this.getStoredToken();
    if (!token || !this.authService.isLoggedIn()) {
      return of(false);
    }
    return this.http.post<{ ok?: boolean; demoValidUntil?: string }>(ACTIVATE, { token }).pipe(
      tap(res => {
        if (res?.ok) {
          this.clearStoredToken();
          this.accountService.clear();
          this.subscriptionService.getSubscriptionStatus().subscribe();
        }
      }),
      map(res => res?.ok === true),
      catchError(() => of(false))
    );
  }

  /** Superadmin : crée une invitation et retourne le lien relatif + métadonnées */
  createInvite(): Observable<AdminCreateDemoInviteResponse> {
    return this.http.post<AdminCreateDemoInviteResponse>(ADMIN_CREATE, {});
  }
}
