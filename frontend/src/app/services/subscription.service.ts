import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

const SUBSCRIPTION_ACTIVE_URL = '/backend/api/user/subscription/active';

export type RestrictionReason = 'no_subscription' | 'temporary' | null;

export interface SubscriptionStatus {
  active: boolean;
  restricted: boolean;
  reason: RestrictionReason;
  /** Période testeur (invitation démo) */
  demoMode?: boolean;
  demoExpiresAt?: string | null;
}

/**
 * Statut d'accès utilisateur (self-host : accès complet pour tout utilisateur connecté).
 * Le bandeau « mode consultation » ne s'applique qu'en cas d'erreur API temporaire.
 */
@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {

  /** Clé localStorage pour forcer l'abonnement en test (optionnel). */
  private static readonly TEST_SUBSCRIPTION_KEY = 'novapartage_test_has_subscription';

  private readonly statusSubject = new BehaviorSubject<SubscriptionStatus>({
    active: true,
    restricted: false,
    reason: null,
    demoMode: false,
    demoExpiresAt: null
  });
  readonly subscriptionStatus$ = this.statusSubject.asObservable();

  constructor(private http: HttpClient) {}

  get currentStatus(): SubscriptionStatus {
    return this.statusSubject.value;
  }

  get isRestricted(): boolean {
    return this.statusSubject.value.restricted;
  }

  get restrictionReason(): RestrictionReason {
    return this.statusSubject.value.reason;
  }

  /**
   * Récupère le statut abonnement et met à jour le state (bandeau, actions).
   */
  getSubscriptionStatus(): Observable<SubscriptionStatus> {
    const testValue = this.getTestSubscriptionFlag();
    if (testValue !== null) {
      const status: SubscriptionStatus = testValue
        ? { active: true, restricted: false, reason: null, demoMode: false, demoExpiresAt: null }
        : { active: false, restricted: true, reason: 'no_subscription', demoMode: false, demoExpiresAt: null };
      this.statusSubject.next(status);
      return of(status);
    }
    return this.http.get<{
      active?: boolean;
      restricted?: boolean;
      reason?: string;
      demoMode?: boolean;
      demoExpiresAt?: string | null;
    }>(SUBSCRIPTION_ACTIVE_URL).pipe(
      map(res => ({
        active: res?.active !== false,
        restricted: res?.restricted === true,
        reason: (res?.reason === 'no_subscription' || res?.reason === 'temporary' ? res.reason : null) as RestrictionReason,
        demoMode: res?.demoMode === true,
        demoExpiresAt: res?.demoExpiresAt ?? null
      })),
      tap(s => this.statusSubject.next(s)),
      catchError(() => {
        const fallback: SubscriptionStatus = {
          active: false,
          restricted: true,
          reason: 'temporary',
          demoMode: false,
          demoExpiresAt: null
        };
        this.statusSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  /**
   * Indique si l'utilisateur connecté a un abonnement actif.
   */
  hasActiveSubscription(): Observable<boolean> {
    const testValue = this.getTestSubscriptionFlag();
    if (testValue !== null) return of(testValue);
    return this.getSubscriptionStatus().pipe(map(s => s.active));
  }

  /**
   * Pour les tests : forcer l'état d'abonnement (localStorage).
   * À appeler depuis la console ou un bouton de debug si besoin.
   */
  setTestSubscriptionFlag(hasSubscription: boolean): void {
    try {
      if (hasSubscription) {
        localStorage.setItem(SubscriptionService.TEST_SUBSCRIPTION_KEY, 'true');
      } else {
        localStorage.removeItem(SubscriptionService.TEST_SUBSCRIPTION_KEY);
      }
    } catch {
      // ignore
    }
  }

  private getTestSubscriptionFlag(): boolean | null {
    try {
      const v = localStorage.getItem(SubscriptionService.TEST_SUBSCRIPTION_KEY);
      if (v === 'true') return true;
      if (v === 'false') return false;
    } catch {
      // ignore
    }
    return null;
  }
}
