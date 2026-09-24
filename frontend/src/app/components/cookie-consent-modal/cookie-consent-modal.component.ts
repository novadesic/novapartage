import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CookieConsentService, CookieConsent } from '../../services/cookie-consent.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-cookie-consent-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cookie-consent-modal.component.html',
  styleUrls: ['./cookie-consent-modal.component.scss']
})
export class CookieConsentModalComponent implements OnInit, OnDestroy {
  showModal = false;
  showDetails = false;
  private subscription: Subscription = new Subscription();

  // État des préférences de cookies
  cookiePreferences: Partial<CookieConsent> = {
    necessary: true, // Toujours true
    analytics: false,
    marketing: false,
    preferences: false
  };

  constructor(
    public cookieService: CookieConsentService,
    private logger: LoggerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Vérifier si l'utilisateur a déjà donné son consentement
    this.subscription.add(
      this.cookieService.consent$.subscribe(consent => {
        if (consent) {
          this.showModal = false;
          this.logger.log('Modal de cookies masquée - consentement déjà donné');
        } else {
          this.showModal = true;
          this.logger.log('Affichage de la modal de consentement aux cookies');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Accepte tous les cookies
   */
  acceptAll(): void {
    this.logger.log('Utilisateur accepte tous les cookies');
    this.cookieService.setConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true
    });
    this.showModal = false;
  }

  /**
   * Refuse tous les cookies non nécessaires
   */
  rejectAll(): void {
    this.logger.log('Utilisateur refuse tous les cookies non nécessaires');
    this.cookieService.setConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false
    });
    this.showModal = false;
  }

  /**
   * Sauvegarde les préférences personnalisées
   */
  savePreferences(): void {
    this.logger.log('Utilisateur sauvegarde ses préférences de cookies:', this.cookiePreferences);
    this.cookieService.setConsent(this.cookiePreferences);
    this.showModal = false;
  }

  /**
   * Affiche/masque les détails des cookies
   */
  toggleDetails(): void {
    this.showDetails = !this.showDetails;
    this.logger.log('Affichage des détails des cookies:', this.showDetails);
  }

  /**
   * Navigue vers la page de politique des cookies
   */
  goToCookiePolicy(): void {
    this.router.navigate(['/politique-cookies']);
  }

  /**
   * Ferme la modal (seulement si l'utilisateur a déjà donné son consentement)
   */
  closeModal(): void {
    if (this.cookieService.hasConsent()) {
      this.showModal = false;
    }
  }

  /**
   * Vérifie si au moins une préférence est sélectionnée
   */
  hasSelectedPreferences(): boolean {
    return (this.cookiePreferences.analytics || false) || 
           (this.cookiePreferences.marketing || false) || 
           (this.cookiePreferences.preferences || false);
  }

}
