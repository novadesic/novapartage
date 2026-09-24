import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';

export interface FormulaCellPosition {
  row: number;
  col: string;
}

export interface ExcelData {
  fileName: string;
  rows: any[];
  totalRows: number;
  totalColumns: number;
  formulaCells?: FormulaCellPosition[];
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  // Utiliser le reverse proxy Nginx pour éviter les problèmes CORS
  private readonly API_BASE_URL = '/backend/api/excel';

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) { }

  /**
   * Upload un fichier Excel et retourne les données extraites
   */
  uploadExcelFile(file: File, isPublic: boolean = false): Observable<ExcelData> {
    this.logger.log('🚀🚀🚀 DÉBUT UPLOAD FICHIER 🚀🚀🚀');
    this.logger.log('📁 Fichier sélectionné:', file.name);
    this.logger.log('📊 Taille du fichier:', file.size, 'bytes');
    this.logger.log('📋 Type MIME:', file.type);
    this.logger.log('⏰ Dernière modification:', new Date(file.lastModified));
    this.logger.log('🌐 Mode public:', isPublic);
    
    // Vérification critique du fichier
    if (!file) {
      this.logger.error('❌ ERREUR: Aucun fichier fourni!');
      return throwError(() => new Error('Aucun fichier fourni'));
    }
    
    if (file.size === 0) {
      this.logger.error('❌ ERREUR: Le fichier est vide (0 bytes)!');
      return throwError(() => new Error('Le fichier fourni est vide'));
    }
    
    const formData = new FormData();
    
    // Debug avant ajout au FormData
    this.logger.log('📝 Création du FormData...');
    this.logger.log('📝 Ajout file avec nom:', file.name);
    this.logger.log('📝 Ajout fileName avec valeur:', file.name);
    
    formData.append('file', file);
    formData.append('fileName', file.name);

    // Débogage complet du FormData
    this.logger.log('🔍 FORMDATA CRÉÉ AVEC:');
    this.logger.log('📁 Fichier ajouté:', file.name, '(', file.size, 'bytes)');
    this.logger.log('📝 FileName ajouté:', file.name);
    
    // Tester la lecture du fichier localement
    this.logger.log('🧪 TEST DE LECTURE DU FICHIER...');
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (content) {
        this.logger.log('✅ Lecture réussie! Taille du contenu:', 
                   typeof content === 'string' ? content.length : content.byteLength);
      } else {
        this.logger.error('❌ Échec de la lecture du fichier!');
      }
    };
    reader.onerror = (e) => {
      this.logger.error('❌ Erreur de lecture du fichier:', e);
    };
    reader.readAsArrayBuffer(file);
    
    // Choisir l'endpoint selon le mode
    const endpoint = isPublic ? '/backend/api/public/excel/upload' : `${this.API_BASE_URL}/upload`;
    this.logger.log('🌐 Envoi de la requête POST vers:', endpoint);
    
    return this.http.post<ExcelData>(endpoint, formData)
      .pipe(
        tap(response => {
          this.logger.log('✅✅✅ RÉPONSE BACKEND REÇUE ✅✅✅');
          this.logger.log('📊 Réponse complète:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupérer la liste des feuilles d'un fichier Excel temporaire
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
   * Récupérer la liste des feuilles d'un partage existant
   */
  getShareSheets(shareId: string): Observable<any> {
    this.logger.log('📋 Récupération des feuilles pour le partage:', shareId);
    
    return this.http.get(`${this.API_BASE_URL}/share/${shareId}/sheets`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Feuilles du partage récupérées:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Traiter une feuille spécifique d'un partage existant
   * @param shareId ID du partage
   * @param sheetIndex Index de la feuille
   * @param page Numéro de page (optionnel, pour pagination)
   * @param limit Nombre de lignes par page (optionnel, pour pagination)
   * @param isPublic Si true, utilise l'endpoint public (pour utilisateurs non connectés)
   */
  processShareWithSheet(shareId: string, sheetIndex: number, page?: number, limit?: number, isPublic: boolean = false): Observable<ExcelData> {
    this.logger.log('📊 Traitement de la feuille du partage:', shareId, 'feuille:', sheetIndex, 'page:', page, 'limit:', limit, 'public:', isPublic);
    
    // Pour les partages, on ne peut pas utiliser d'endpoint public car il faut vérifier les permissions
    // On utilise toujours l'endpoint privé, mais on gère l'erreur 401 dans le composant
    let url = `${this.API_BASE_URL}/share/${shareId}/process/${sheetIndex}`;
    if (page !== undefined || limit !== undefined) {
      const params = new URLSearchParams();
      if (page !== undefined) params.append('page', page.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      url += '?' + params.toString();
    }
    
    return this.http.post<ExcelData>(url, {})
      .pipe(
        tap(response => {
          this.logger.log('✅ Données de feuille du partage chargées:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Traiter un fichier Excel avec un index de feuille spécifique
   * @param tempFileId ID du fichier temporaire
   * @param sheetIndex Index de la feuille
   * @param page Numéro de page (optionnel, pour pagination)
   * @param limit Nombre de lignes par page (optionnel, pour pagination)
   * @param isPublic Si true, utilise l'endpoint public (pour utilisateurs non connectés)
   */
  processExcelWithSheet(tempFileId: string, sheetIndex: number, page?: number, limit?: number, isPublic: boolean = false): Observable<ExcelData> {
    this.logger.log('📊 Traitement de la feuille', sheetIndex, 'pour le fichier:', tempFileId, 'page:', page, 'limit:', limit, 'public:', isPublic);
    
    // Utiliser l'endpoint public si demandé (pour utilisateurs non connectés)
    const baseUrl = isPublic ? '/backend/api/public/excel' : this.API_BASE_URL;
    let url = `${baseUrl}/process/${tempFileId}/${sheetIndex}`;
    if (page !== undefined || limit !== undefined) {
      const params = new URLSearchParams();
      if (page !== undefined) params.append('page', page.toString());
      if (limit !== undefined) params.append('limit', limit.toString());
      url += '?' + params.toString();
    }
    
    return this.http.post<ExcelData>(url, {})
      .pipe(
        tap(response => {
          this.logger.log('✅ Feuille traitée:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Vérifier l'état du service backend
   */
  checkHealth(): Observable<any> {
    return this.http.get(`${this.API_BASE_URL}/health`)
      .pipe(
        tap(response => {
          this.logger.log('Health check response:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Convertir les données Excel en format compatible avec l'application
   */
  convertExcelDataToSheets(excelData: ExcelData): any[] {
    if (!excelData.rows) {
      this.logger.warn('Données Excel invalides:', excelData);
      return [];
    }

    this.logger.log('Conversion des données Excel:', {
      rowsCount: excelData.rows.length,
      totalRows: excelData.totalRows,
      totalColumns: excelData.totalColumns
    });

    // Nettoyer les données : supprimer les lignes vides à la fin
    const cleanedRows = this.removeEmptyRowsAtEnd(excelData.rows);

    this.logger.log('Données nettoyées:', {
      originalRows: excelData.rows.length,
      cleanedRows: cleanedRows.length
    });

    // Créer les objets pour les lignes de données (sans ligne d'en-têtes artificielle)
    const convertedData = cleanedRows.map(row => {
      const convertedRow: any = {};
      Object.keys(row).forEach(columnKey => {
        convertedRow[columnKey] = row[columnKey] || '';
      });
      return convertedRow;
    });

    // Utiliser directement les données sans ligne d'en-têtes artificielle
    const allData = convertedData;

    this.logger.log('Données converties:', {
      dataRows: convertedData.length,
      totalRows: allData.length
    });

    // Retourner un tableau avec une seule feuille pour l'instant
    return [{
      name: 'Feuille 1',
      data: allData
    }];
  }

  /**
   * Convertir les données de feuilles multiples en format compatible
   */
  convertMultipleSheetsToFormat(sheetsData: any[]): any[] {
    this.logger.log('Conversion de plusieurs feuilles:', sheetsData);
    
    return sheetsData.map((sheet, index) => ({
      name: sheet.name || `Feuille ${index + 1}`,
      data: sheet.data || [],
      index: sheet.index || index,
      lastRowNum: sheet.lastRowNum || 0,
      lastColNum: sheet.lastColNum || 0
    }));
  }



  /**
   * Supprimer les lignes vides à la fin des données
   */
  private removeEmptyRowsAtEnd(rows: any[]): any[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    // Trouver le dernier index de ligne non vide
    let lastNonEmptyIndex = rows.length - 1;
    while (lastNonEmptyIndex >= 0) {
      const row = rows[lastNonEmptyIndex];
      // Vérifier si la ligne est vide (toutes les valeurs sont vides ou null)
      const hasNonEmptyValue = Object.values(row).some(value => 
        value !== null && value !== undefined && value.toString().trim() !== ''
      );
      
      if (hasNonEmptyValue) {
        break; // Trouvé une ligne non vide
      }
      lastNonEmptyIndex--;
    }

    // Retourner les lignes jusqu'au dernier non vide
    return rows.slice(0, lastNonEmptyIndex + 1);
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