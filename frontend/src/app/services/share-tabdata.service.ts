import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { UnifiedAuthService } from './unified-auth.service';

export interface TabdataResponse {
  data: any;
  isConsistent: boolean;
  lastUpdated: string;
  fileFingerprint: string;
}

export interface RebuildResponse {
  message: string;
  shareId: string;
  timestamp: number;
}

export interface SimulateTabdataRequest {
  tempFileId: string;
  shareId?: string; // Pour les partages existants
  recipientEmail: string;
  selectedSheetIndex: number;
  selections: { [sheetIndex: string]: CellSelection[] };
  editableCells: { [sheetIndex: string]: CellSelection[] };
  columnLabels?: { [sheetIndex: string]: { [colKey: string]: string } };
  page?: number; // Numéro de page pour la pagination
  limit?: number; // Nombre de lignes par page
}

export interface CellSelection {
  row: number;
  col: number;
}

@Injectable({
  providedIn: 'root'
})
export class ShareTabdataService {
  
  private readonly API_BASE_URL = '/backend/api/shares';
  
  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private authService: UnifiedAuthService
  ) { }
  
  /**
   * Récupère le tabdata depuis la base (remplace la reconstruction)
   */
  getRecipientTabdata(shareId: string, recipientEmail: string): Observable<any> {
    this.logger.log('📊 Récupération tabdata depuis base pour:', { shareId, recipientEmail });
    
    return this.http.get(`${this.API_BASE_URL}/${shareId}/recipients/${recipientEmail}/tabdata`).pipe(
      map((response: any) => {
        this.logger.log('✅ Tabdata récupéré avec succès');
        return response;
      }),
      catchError(this.handleError.bind(this))
    );
  }
  
  /**
   * Recalcule le tabdata (propriétaire uniquement)
   */
  rebuildTabdata(shareId: string): Observable<RebuildResponse> {
    this.logger.log('🔄 Recalcul tabdata pour shareId:', shareId);
    
    return this.http.post<RebuildResponse>(`${this.API_BASE_URL}/${shareId}/rebuild-tabdata`, {}).pipe(
      map((response: RebuildResponse) => {
        this.logger.log('✅ Tabdata recalculé avec succès:', response);
        return response;
      }),
      catchError(this.handleError.bind(this))
    );
  }
  
  /**
   * Vérifie la cohérence du tabdata
   */
  checkTabdataConsistency(shareId: string, recipientEmail: string): Observable<boolean> {
    this.logger.log('🔍 Vérification cohérence tabdata pour:', { shareId, recipientEmail });
    
    return this.getRecipientTabdata(shareId, recipientEmail).pipe(
      map(() => true), // Si pas d'erreur, c'est cohérent
      catchError((error: HttpErrorResponse) => {
        if (error.status === 409) {
          this.logger.warn('⚠️ Tabdata obsolète détecté');
          return throwError(() => new Error('Tabdata obsolète'));
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Récupère le tabdata avec gestion des erreurs de cohérence
   */
  getTabdataWithConsistencyCheck(shareId: string, recipientEmail: string): Observable<any> {
    return this.getRecipientTabdata(shareId, recipientEmail).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 409) {
          this.logger.warn('⚠️ Tabdata obsolète - recalcul nécessaire');
          return throwError(() => new Error('TABDATA_OBSOLETE'));
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Gestion centralisée des erreurs
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    this.logger.error('❌ Erreur ShareTabdataService:', error);
    
    let errorMessage = 'Une erreur est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 401:
          errorMessage = 'Authentification requise';
          break;
        case 403:
          errorMessage = 'Accès non autorisé';
          break;
        case 404:
          errorMessage = 'Partage ou destinataire non trouvé';
          break;
        case 409:
          errorMessage = 'Tabdata obsolète - recalcul nécessaire';
          break;
        case 500:
          errorMessage = 'Erreur interne du serveur';
          break;
        default:
          errorMessage = `Erreur ${error.status}: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
  
  /**
   * Vérifie si une erreur est due à un tabdata obsolète
   */
  isTabdataObsoleteError(error: any): boolean {
    return error?.message === 'TABDATA_OBSOLETE' || 
           error?.status === 409 ||
           error?.message?.includes('obsolète');
  }
  
  /**
   * Extrait le message d'erreur utilisateur
   */
  getErrorMessage(error: any): string {
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error?.error) {
      return error.error.error;
    }
    
    return 'Une erreur inattendue est survenue';
  }
  
  /**
   * Simule les tabdata pour le form-preview
   * Détecte automatiquement si l'utilisateur est connecté ou non
   */
  simulateTabdata(request: SimulateTabdataRequest): Observable<any> {
    this.logger.log('🎭 Simulation tabdata pour form-preview', request);
    
    // Construire l'URL avec les paramètres de pagination si présents
    const baseUrl = this.authService.isLoggedIn() 
      ? '/backend/api/excel/simulate-tabdata'
      : '/backend/api/public/excel/simulate-tabdata';
    let url = baseUrl;
    
    // Ajouter les paramètres de pagination en query params si présents
    if (request.page !== undefined || request.limit !== undefined) {
      const params = new URLSearchParams();
      if (request.page !== undefined) params.append('page', request.page.toString());
      if (request.limit !== undefined) params.append('limit', request.limit.toString());
      url += '?' + params.toString();
    }
    
    // Créer une copie de la requête sans les paramètres de pagination pour le body
    const { page, limit, ...requestBody } = request;
    
    // Détecter si l'utilisateur est connecté
    if (this.authService.isLoggedIn()) {
      this.logger.log('👤 Utilisateur connecté - utilisation endpoint privé', { url, page, limit });
      // Utiliser l'endpoint privé avec authentification
      return this.http.post<any>(url, requestBody, {
        headers: this.getAuthHeaders()
      }).pipe(
        catchError(this.handleError.bind(this))
      );
    } else {
      this.logger.log('👤 Utilisateur non connecté - utilisation endpoint public', { url, page, limit });
      // Utiliser l'endpoint public sans authentification
      return this.http.post<any>(url, requestBody).pipe(
        catchError(this.handleError.bind(this))
      );
    }
  }
  
  /**
   * Récupère les headers d'authentification
   */
  private getAuthHeaders(): { [key: string]: string } {
    const token = this.authService.getToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'Content-Type': 'application/json'
    };
  }
}


