import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { LoggerService } from '../../services/logger.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';

@Component({
  selector: 'app-politique-cookies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './politique-cookies.component.html',
  styleUrls: ['./politique-cookies.component.scss']
})
export class PolitiqueCookiesComponent implements OnInit {
  currentConsent: any = null;

  constructor(
    private cookieService: CookieConsentService,
    private logger: LoggerService,
    private router: Router,
    private confirmationModalService: ConfirmationModalService
  ) {}

  ngOnInit(): void {
    this.currentConsent = this.cookieService.getConsent();
    this.logger.log('Page politique des cookies chargée, consentement actuel:', this.currentConsent);
  }

  /**
   * Retourne à la page précédente
   */
  goBack(): void {
    this.router.navigate(['/']);
  }

  /**
   * Ouvre la modal de consentement pour modifier les préférences
   */
  modifyPreferences(): void {
    this.cookieService.clearConsent();
    this.router.navigate(['/']);
  }

  /**
   * Vérifie si un type de cookie est autorisé
   */
  isCookieTypeAllowed(type: string): boolean {
    return this.cookieService.isCookieTypeAllowed(type as any);
  }

  /**
   * Obtient la date de dernière modification du consentement
   */
  getConsentDate(): string {
    if (!this.currentConsent || !this.currentConsent.timestamp) {
      return 'Jamais';
    }
    
    const date = new Date(this.currentConsent.timestamp);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Affiche une alerte (pour les boutons d'information)
   */
  alert(message: string): void {
    this.confirmationModalService.alert(message);
  }

  /**
   * Obtient la date actuelle formatée
   */
  getCurrentDate(): string {
    return new Date().toLocaleDateString('fr-FR');
  }
}
