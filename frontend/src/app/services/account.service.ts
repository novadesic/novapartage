import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const ACCOUNT_URL = '/backend/api/user/account';

export interface AccountSubscription {
  active: boolean;
  restricted: boolean;
  reason: string | null;
  demoMode?: boolean;
  demoExpiresAt?: string | null;
}

export interface AccountGroup {
  name: string;
  created: number;
}

export interface AccountData {
  subscription: AccountSubscription;
  member: Record<string, unknown>;
  groups: AccountGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private readonly dataSubject = new BehaviorSubject<AccountData | null>(null);

  readonly accountData$ = this.dataSubject.asObservable();

  constructor(private http: HttpClient) {}

  get current(): AccountData | null {
    return this.dataSubject.value;
  }

  /**
   * Charge les données compte (droits, profil, groupes) une fois par session.
   * Si des données sont déjà en cache, ne refait pas l'appel.
   */
  loadAccount(): Observable<AccountData | null> {
    const cached = this.dataSubject.value;
    if (cached) {
      return of(cached);
    }
    return this.http.get<AccountData>(ACCOUNT_URL).pipe(
      tap(data => this.dataSubject.next(data ?? null)),
      catchError(() => {
        this.dataSubject.next(null);
        return of(null);
      })
    );
  }

  /**
   * Récupère les données compte (depuis le cache ou en chargeant).
   */
  getAccount(): Observable<AccountData | null> {
    const cached = this.dataSubject.value;
    if (cached) {
      return of(cached);
    }
    return this.loadAccount();
  }

  /**
   * Invalide le cache (après déconnexion).
   */
  clear(): void {
    this.dataSubject.next(null);
  }
}
