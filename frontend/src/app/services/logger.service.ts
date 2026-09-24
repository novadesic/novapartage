import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private isDevelopment: boolean = false;
  private isLocalhost: boolean = false;
  private initialized: boolean = false;

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    // Vérifier si on est sur localhost
    this.isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.startsWith('192.168.') ||
                      window.location.hostname.startsWith('10.') ||
                      window.location.hostname.startsWith('172.');
    
    // Pour l'environnement, on va utiliser une approche différente
    // On va vérifier si on est en mode développement en regardant l'URL ou d'autres indicateurs
    this.isDevelopment = this.detectDevelopmentMode();
    
    this.initialized = true;
  }

  private detectDevelopmentMode(): boolean {
    // Vérifier plusieurs indicateurs de mode développement
    const isDevMode = 
      // Angular en mode développement
      (window as any).ng?.devMode === true ||
      // URL contient des indicateurs de développement
      window.location.hostname.includes('dev') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1') ||
      // Port de développement typique
      window.location.port === '4200' ||
      window.location.port === '3000' ||
      window.location.port === '8080' ||
      // Vérifier si on est sur localhost (déjà vérifié plus haut)
      this.isLocalhost;
    
    return isDevMode;
  }

  /**
   * Affiche un log seulement en mode développement ou sur localhost
   */
  log(...args: any[]): void {
    if (this.shouldLog()) {
      console.log(...args);
    }
  }

  /**
   * Affiche un log d'erreur seulement en mode développement ou sur localhost
   */
  error(...args: any[]): void {
    if (this.shouldLog()) {
      console.error(...args);
    }
  }

  /**
   * Affiche un log d'avertissement seulement en mode développement ou sur localhost
   */
  warn(...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(...args);
    }
  }

  /**
   * Affiche un log d'information seulement en mode développement ou sur localhost
   */
  info(...args: any[]): void {
    if (this.shouldLog()) {
      console.info(...args);
    }
  }

  /**
   * Affiche un log de debug seulement en mode développement ou sur localhost
   */
  debug(...args: any[]): void {
    if (this.shouldLog()) {
      console.debug(...args);
    }
  }

  /**
   * Détermine si les logs doivent être affichés
   */
  private shouldLog(): boolean {
    return this.isDevelopment || this.isLocalhost;
  }

  /**
   * Met à jour le mode développement basé sur l'environnement
   * Peut être appelé par EnvironmentService après son initialisation
   */
  public updateDevelopmentMode(isProduction: boolean): void {
    this.isDevelopment = !isProduction;
  }

  /**
   * Vérifie si l'application est en mode production
   */
  public isProduction(): boolean {
    return !this.isDevelopment && !this.isLocalhost;
  }

  /**
   * Force l'affichage d'un log même en production (pour les erreurs critiques)
   */
  forceLog(...args: any[]): void {
    console.log(...args);
  }

  /**
   * Force l'affichage d'une erreur même en production
   */
  forceError(...args: any[]): void {
    console.error(...args);
  }
}
