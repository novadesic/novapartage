import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from './logger.service';
import { EnvironmentService } from './environment.service';

export interface ExcelFileData {
  tempFileId: string;
  fileName: string;
  fileSize: number;
  rows: any[];
  totalRows: number;
  totalColumns: number;
  sheets: SheetData[];
}

export interface SheetData {
  name: string;
  index: number;
  rows: any[];
  totalRows: number;
  totalColumns: number;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly API_BASE_URL = '/backend/api/excel';

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private environmentService: EnvironmentService
  ) {}

  /**
   * Upload un fichier Excel et retourne toutes les données nécessaires
   */
  uploadExcelFile(file: File, isPublic: boolean = false): Observable<ExcelFileData> {
    this.logger.log('🚀 Upload de fichier Excel:', file.name);
    
    // Validation du fichier
    if (!file) {
      this.logger.error('❌ Aucun fichier fourni');
      return throwError(() => new Error('Aucun fichier fourni'));
    }
    
    if (file.size === 0) {
      this.logger.error('❌ Le fichier est vide');
      return throwError(() => new Error('Le fichier fourni est vide'));
    }

    // Validation de l'extension
    const validExtensions = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      this.logger.error('❌ Format de fichier non supporté:', ext);
      return throwError(() => new Error('Format de fichier non supporté. Seuls les fichiers .xlsx et .xls sont acceptés.'));
    }

    // Vérifier la taille du fichier
    const maxFileSizeBytes = this.environmentService.getMaxFileSizeBytes();
    if (file.size > maxFileSizeBytes) {
      const maxFileSizeFormatted = this.environmentService.getMaxFileSize();
      const fileSizeFormatted = this.environmentService.formatFileSize(file.size);
      const errorMessage = `La taille du fichier (${fileSizeFormatted}) dépasse la limite autorisée (${maxFileSizeFormatted})`;
      this.logger.error('❌ Taille de fichier non autorisée:', errorMessage);
      return throwError(() => new Error(errorMessage));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    // Choisir l'endpoint selon le mode
    const endpoint = isPublic ? '/backend/api/public/excel/upload' : `${this.API_BASE_URL}/upload`;
    this.logger.log('🌐 Envoi vers:', endpoint);

    return this.http.post<ExcelFileData>(endpoint, formData)
      .pipe(
        tap(response => {
          this.logger.log('✅ Fichier uploadé avec succès:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Convertit les données des feuilles au format attendu par tableau-selection
   */
  convertSheetsToTableauFormat(sheets: SheetData[]): any[] {
    if (!sheets || sheets.length === 0) {
      this.logger.warn('Aucune feuille à convertir');
      return [];
    }

    this.logger.log('Conversion des feuilles au format tableau:', sheets);

    return sheets.map((sheet, index) => ({
      name: sheet.name || `Feuille ${index + 1}`,
      index: index,
      data: this.convertRowsToTableauFormat(sheet.rows || []),
      totalRows: sheet.totalRows || 0,
      totalColumns: sheet.totalColumns || 0
    }));
  }

  /**
   * Retourne les données de la première feuille au format tableau-selection
   */
  getFirstSheetTableauData(sheets: SheetData[]): any[] {
    if (!sheets || sheets.length === 0) {
      this.logger.warn('Aucune feuille disponible');
      return [];
    }

    const firstSheet = sheets[0];
    this.logger.log('Données de la première feuille:', firstSheet);
    
    return this.convertRowsToTableauFormat(firstSheet.rows || []);
  }

  /**
   * Convertit les lignes de données au format attendu par tableau-selection
   * Format: { 'column-0': value1, 'column-1': value2, ... }
   */
  private convertRowsToTableauFormat(rows: any[]): any[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map(row => {
      const convertedRow: any = {};
      
      // Si les données sont déjà dans le bon format, les utiliser directement
      if (row['column-0'] !== undefined) {
        return row;
      }

      // Sinon, convertir les données au format column-X
      const values = Object.values(row);
      values.forEach((value, index) => {
        convertedRow[`column-${index}`] = value || '';
      });

      return convertedRow;
    });
  }

  /**
   * Récupère les données d'un fichier temporaire (fallback)
   */
  getExcelSheets(tempFileId: string): Observable<any> {
    this.logger.log('📋 Récupération des feuilles pour le fichier temporaire:', tempFileId);
    
    return this.http.get(`${this.API_BASE_URL}/sheets/${tempFileId}`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Feuilles récupérées:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Gestion centralisée des erreurs HTTP
   */
  private handleError = (error: HttpErrorResponse) => {
    this.logger.error('Erreur HTTP:', error);
    
    let errorMessage = 'Une erreur inattendue s\'est produite';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur client: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      if (error.status === 0) {
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le backend est démarré.';
      } else if (error.status === 400) {
        errorMessage = error.error?.error || 'Requête invalide';
      } else if (error.status === 401) {
        errorMessage = 'Authentification requise';
      } else if (error.status === 404) {
        errorMessage = 'Endpoint non trouvé';
      } else if (error.status === 500) {
        errorMessage = error.error?.error || 'Erreur interne du serveur';
      } else {
        errorMessage = `Erreur ${error.status}: ${error.error?.error || error.message}`;
      }
    }
    
    this.logger.error('Message d\'erreur:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
