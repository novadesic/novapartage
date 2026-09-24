import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LoggerService } from './logger.service';

export interface Theme {
  name: string;
  displayName: string;
  cssPath: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'ddsshare-theme';
  private readonly DEFAULT_THEME = 'default';

  
  private availableThemes: Theme[] = [
    {
      name: 'default',
      displayName: 'Thème par défaut',
      cssPath: ''
    },
    {
      name: 'slate',
      displayName: 'Slate',
      cssPath: 'assets/themes/slate/bootstrap.min.css'
    },
    {
      name: 'sketchy',
      displayName: 'Sketchy',
      cssPath: 'assets/themes/sketchy/bootstrap.min.css'
    },
    {
      name: 'morph',
      displayName: 'Morph',
      cssPath: 'assets/themes/morph/bootstrap.min.css'
    },
    {
      name: 'spacelab',
      displayName: 'Spacelab',
      cssPath: 'assets/themes/spacelab/bootstrap.min.css'
    }
  ];

  private currentThemeSubject = new BehaviorSubject<string>(this.DEFAULT_THEME);
  public currentTheme$ = this.currentThemeSubject.asObservable();

  constructor(private logger: LoggerService) {
    // Charger le thème après un court délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      this.initializeTheme();
    }, 100);
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const themeToUse = savedTheme || this.DEFAULT_THEME;
    this.setTheme(themeToUse);
  }

  public getAvailableThemes(): Theme[] {
    return this.availableThemes;
  }

  public getCurrentTheme(): string {
    return this.currentThemeSubject.value;
  }

  public setTheme(themeName: string): void {
    const theme = this.availableThemes.find(t => t.name === themeName);
    if (!theme) {
      this.logger.warn(`Thème '${themeName}' non trouvé, utilisation du thème par défaut`);
      themeName = this.DEFAULT_THEME;
    }

    // Sauvegarder dans localStorage
    localStorage.setItem(this.THEME_KEY, themeName);

    // Mettre à jour le sujet
    this.currentThemeSubject.next(themeName);

    // Charger le CSS du thème
    this.loadThemeCSS(themeName);
  }

  private loadThemeCSS(themeName: string): void {
    const theme = this.availableThemes.find(t => t.name === themeName);
    if (!theme) return;

    // Supprimer l'ancien lien CSS de thème s'il existe
    const existingLink = document.getElementById('theme-css');
    if (existingLink) {
      existingLink.remove();
    }

    // Si c'est le thème par défaut, ne pas charger de CSS supplémentaire
    if (themeName === 'default') {
      this.logger.log('Thème par défaut activé - aucun CSS supplémentaire chargé');
      return;
    }

    // Créer et ajouter le nouveau lien CSS
    const link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = theme.cssPath;
    link.onload = () => {
      this.logger.log(`Thème ${themeName} chargé avec succès`);
    };
    link.onerror = () => {
      this.logger.error(`Erreur lors du chargement du thème ${themeName}`);
    };

    document.head.appendChild(link);
  }
} 