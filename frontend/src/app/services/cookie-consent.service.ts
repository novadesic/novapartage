import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from './logger.service';

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class CookieConsentService {
  private readonly CONSENT_KEY = 'ddsshare-cookie-consent';
  private readonly CONSENT_VERSION = '1.0';
  
  private consentSubject = new BehaviorSubject<CookieConsent | null>(null);
  public consent$: Observable<CookieConsent | null> = this.consentSubject.asObservable();

  constructor(private logger: LoggerService) {
    this.loadConsent();
  }

  /**
   * Vérifie si l'utilisateur a déjà donné son consentement
   */
  hasConsent(): boolean {
    const consent = this.getStoredConsent();
    return consent !== null;
  }

  /**
   * Obtient le consentement actuel
   */
  getConsent(): CookieConsent | null {
    return this.consentSubject.value;
  }

  /**
   * Enregistre le consentement de l'utilisateur
   */
  setConsent(consent: Partial<CookieConsent>): void {
    const fullConsent: CookieConsent = {
      necessary: true, // Toujours true car nécessaire au fonctionnement
      analytics: consent.analytics || false,
      marketing: consent.marketing || false,
      preferences: consent.preferences || false,
      timestamp: Date.now()
    };

    this.logger.log('Enregistrement du consentement aux cookies:', fullConsent);
    
    // Sauvegarder dans localStorage
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify({
      ...fullConsent,
      version: this.CONSENT_VERSION
    }));

    // Mettre à jour le BehaviorSubject
    this.consentSubject.next(fullConsent);
  }

  /**
   * Supprime le consentement (pour les tests ou reset)
   */
  clearConsent(): void {
    this.logger.log('Suppression du consentement aux cookies');
    localStorage.removeItem(this.CONSENT_KEY);
    this.consentSubject.next(null);
  }


  /**
   * Vérifie si un type de cookie spécifique est autorisé
   */
  isCookieTypeAllowed(type: keyof Omit<CookieConsent, 'timestamp'>): boolean {
    const consent = this.getConsent();
    if (!consent) return false;
    
    // Les cookies nécessaires sont toujours autorisés
    if (type === 'necessary') return true;
    
    return consent[type] || false;
  }

  /**
   * Obtient le consentement stocké depuis localStorage
   */
  private getStoredConsent(): CookieConsent | null {
    try {
      const stored = localStorage.getItem(this.CONSENT_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      
      // Vérifier la version pour compatibilité future
      if (parsed.version !== this.CONSENT_VERSION) {
        this.logger.log('Version de consentement différente, reset nécessaire');
        this.clearConsent();
        return null;
      }

      return {
        necessary: parsed.necessary,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        preferences: parsed.preferences,
        timestamp: parsed.timestamp
      };
    } catch (error) {
      this.logger.error('Erreur lors de la lecture du consentement:', error);
      return null;
    }
  }

  /**
   * Charge le consentement depuis localStorage
   */
  private loadConsent(): void {
    const consent = this.getStoredConsent();
    if (consent) {
      this.consentSubject.next(consent);
      this.logger.log('Consentement aux cookies chargé:', consent);
    } else {
      this.consentSubject.next(null);
      this.logger.log('Aucun consentement aux cookies trouvé');
    }
  }

  /**
   * Obtient les statistiques de consentement (pour analytics)
   */
  getConsentStats(): { total: number; byType: Record<string, number> } {
    const consent = this.getConsent();
    if (!consent) {
      return { total: 0, byType: {} };
    }

    const byType = {
      necessary: consent.necessary ? 1 : 0,
      analytics: consent.analytics ? 1 : 0,
      marketing: consent.marketing ? 1 : 0,
      preferences: consent.preferences ? 1 : 0
    };

    const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

    return { total, byType };
  }
}







