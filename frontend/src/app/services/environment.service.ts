import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

export interface Environment {
  production: boolean;
  customAuth: {
    endpoint: string;
    appId: string;
    appSecret: string;
  };
  backend: {
    url: string;
    apiPath: string;
  };
  app: {
    name: string;
    version: string;
  };
  limits: {
    maxRecipientsPerShare: number;
    maxFileSize: string;
    maxSelectedColumns: number;
    maxActiveShares: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private environment: Environment | null = null;

  constructor(private logger: LoggerService) {
    this.loadEnvironment();
  }

  private loadEnvironment(): void {
    // Attendre que window.__env soit disponible
    const checkEnv = () => {
      const env = (window as any).__env;
      
      if (env && env.CUSTOM_AUTH_ENDPOINT && env.CUSTOM_AUTH_ENDPOINT !== '%%CUSTOM_AUTH_ENDPOINT%%') {
        // Les variables d'environnement sont disponibles et remplacées
        const maxFileSize = env.MAX_FILE_SIZE || '50MB';
        this.environment = {
          production: env.PRODUCTION !== undefined ? (env.PRODUCTION === 'true' || env.PRODUCTION === true) : false,
          customAuth: {
            endpoint: env.CUSTOM_AUTH_ENDPOINT || 'http://localhost/auth',
            appId: env.CUSTOM_AUTH_APP_ID || 'ddsshare-app',
            appSecret: env.CUSTOM_AUTH_APP_SECRET || 'ddsshare-secret-key-change-in-production'
          },
          backend: {
            url: env.BACKEND_URL || 'http://localhost/backend',
            apiPath: env.BACKEND_API_PATH || '/api'
          },
          app: {
            name: env.APP_NAME || 'DDS Share',
            version: env.APP_VERSION || '1.0.0'
          },
          limits: {
            maxRecipientsPerShare: parseInt(env.MAX_RECIPIENTS_PER_SHARE || '50', 10),
            maxFileSize: maxFileSize,
            maxSelectedColumns: parseInt(env.MAX_SELECTED_COLUMNS || '20', 10),
            maxActiveShares: parseInt(env.MAX_ACTIVE_SHARES || '5', 10)
          }
        };
        this.logger.log('Environment loaded:', this.environment);
        
        // Mettre à jour le LoggerService avec l'information de production
        // Note: Cette mise à jour sera faite par l'AppComponent après initialisation
      } else {
        // Les variables ne sont pas encore disponibles, réessayer dans 100ms
        setTimeout(checkEnv, 100);
      }
    };

    checkEnv();
  }

  getEnvironment(): Environment {
    if (!this.environment) {
      // Fallback si l'environnement n'est pas encore chargé
      const maxFileSize = '1MB';
      return {
        production: false,
        customAuth: {
          endpoint: 'http://localhost/auth',
          appId: 'ddsshare-app',
          appSecret: 'ddsshare-secret-key-change-in-production'
        },
        backend: {
          url: 'http://localhost/backend',
          apiPath: '/api'
        },
        app: {
          name: 'DDS Share',
          version: '1.0.0'
        },
        limits: {
          maxRecipientsPerShare: 5,
          maxFileSize: maxFileSize,
          maxSelectedColumns: 20,
          maxActiveShares: 5
        }
      };
    }
    return this.environment;
  }

  getCustomAuthConfig() {
    return this.getEnvironment().customAuth;
  }

  getBackendConfig() {
    return this.getEnvironment().backend;
  }

  getAppConfig() {
    return this.getEnvironment().app;
  }

  isProduction(): boolean {
    return this.getEnvironment().production;
  }

  getBackendUrl(): string {
    const config = this.getEnvironment().backend;
    return config.url + config.apiPath;
  }

  isEnvironmentLoaded(): boolean {
    return this.environment !== null;
  }

  getConfigValue(key: string, defaultValue: string = ''): string {
    const env = (window as any).__env;
    if (env && env[key]) {
      return env[key];
    }
    return defaultValue;
  }

  getMaxRecipientsPerShare(): number {
    const env = (window as any).__env;
    if (env && env.MAX_RECIPIENTS_PER_SHARE) {
      return parseInt(env.MAX_RECIPIENTS_PER_SHARE, 10);
    }
    return 50; // Valeur par défaut
  }

  getMaxFileSize(): string {
    return this.getEnvironment().limits.maxFileSize;
  }

  /**
   * Retourne la taille maximale formatée en français (ex: "1MB" -> "1 Mo")
   */
  getMaxFileSizeFormatted(): string {
    const maxFileSize = this.getEnvironment().limits.maxFileSize;
    return this.formatFileSizeToFrench(maxFileSize);
  }

  getMaxFileSizeBytes(): number {
    return this.parseFileSize(this.getEnvironment().limits.maxFileSize);
  }

  getMaxSelectedColumns(): number {
    return this.getEnvironment().limits.maxSelectedColumns;
  }

  /** Nombre maximum de partages actifs (exclut les partages supprimés) */
  getMaxActiveShares(): number {
    return this.getEnvironment().limits.maxActiveShares;
  }

  /**
   * Convertit une taille de fichier en format string (ex: "50MB") en bytes
   */
  private parseFileSize(sizeString: string): number {
    if (!sizeString || sizeString.trim().length === 0) {
      return 50 * 1024 * 1024; // 50MB par défaut
    }

    sizeString = sizeString.trim().toUpperCase();
    let multiplier = 1;

    if (sizeString.endsWith('KB')) {
      multiplier = 1024;
      sizeString = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('MB')) {
      multiplier = 1024 * 1024;
      sizeString = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('GB')) {
      multiplier = 1024 * 1024 * 1024;
      sizeString = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('B')) {
      multiplier = 1;
      sizeString = sizeString.substring(0, sizeString.length - 1).trim();
    }

    const value = parseFloat(sizeString);
    if (isNaN(value)) {
      this.logger.warn(`Impossible de parser la taille de fichier: ${sizeString}, utilisation de la valeur par défaut 50MB`);
      return 50 * 1024 * 1024;
    }

    return Math.floor(value * multiplier);
  }

  /**
   * Formate une taille en bytes en format lisible (ex: "50 MB")
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  }

  /**
   * Convertit une taille de fichier en format string anglais vers français
   * (ex: "1MB" -> "1 Mo", "50KB" -> "50 Ko")
   */
  formatFileSizeToFrench(sizeString: string): string {
    if (!sizeString || sizeString.trim().length === 0) {
      return '50 Mo';
    }

    sizeString = sizeString.trim().toUpperCase();
    
    // Extraire la valeur numérique et l'unité
    let unit = '';
    let value = '';
    
    if (sizeString.endsWith('KB')) {
      unit = 'Ko';
      value = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('MB')) {
      unit = 'Mo';
      value = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('GB')) {
      unit = 'Go';
      value = sizeString.substring(0, sizeString.length - 2).trim();
    } else if (sizeString.endsWith('B')) {
      unit = 'o';
      value = sizeString.substring(0, sizeString.length - 1).trim();
    } else {
      // Si pas d'unité, essayer de parser comme nombre et assumer des bytes
      const numValue = parseFloat(sizeString);
      if (!isNaN(numValue)) {
        if (numValue < 1024) {
          return numValue + ' o';
        } else if (numValue < 1024 * 1024) {
          return (numValue / 1024).toFixed(2) + ' Ko';
        } else if (numValue < 1024 * 1024 * 1024) {
          return (numValue / (1024 * 1024)).toFixed(2) + ' Mo';
        } else {
          return (numValue / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
        }
      }
      return sizeString; // Retourner tel quel si non parseable
    }

    // Formater la valeur (supprimer les zéros inutiles)
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return sizeString;
    }

    // Pour les valeurs entières, ne pas afficher de décimales
    if (numValue === Math.floor(numValue)) {
      return Math.floor(numValue) + ' ' + unit;
    }

    return numValue.toFixed(2) + ' ' + unit;
  }
} 