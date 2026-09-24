import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { ShareTabdataService } from './share-tabdata.service';

/**
 * Interface pour un contact avec email et nom d'affichage
 */
export interface ContactInfo {
  email: string;
  displayName: string;
  formattedContact: string;
}

export interface ShareRequest {
  fileName: string;
  fileId?: string; // ID temporaire du fichier uploadé (optionnel pour les partages existants)
  
  // Configuration des données partagées
  selectedSheet: string;
  selectedSheetIndex: number; // Index de la feuille sélectionnée
  headerRow: number;
  dataStartRow: number;
  columnRange: string;
  includeFormulas: boolean;
  preserveFormatting: boolean;
  detectedFields: string[];
  
  // Destinataires avec leurs configurations
  recipients: Recipient[];
  
  // Permissions globales
  selectedPermission: string; // 'read', 'edit-own', 'full'
  allowComments: boolean;
  allowDownload: boolean;
  
  // Données Excel pour validation
  headers: string[];
  totalRows: number;
  totalColumns: number;
}

export interface Recipient {
  email: string;
  displayName?: string;
  
  // Feuille sélectionnée pour ce destinataire
  selectedSheetIndex?: number;
  
  // Sélections par feuille (sheetIndex as string -> list of CellSelection)
  selections?: { [sheetIndex: string]: CellSelection[] };
  
  // Cellules éditables par feuille
  editableCells?: { [sheetIndex: string]: CellSelection[] };
  
  // Labels personnalisés pour les colonnes par feuille
  columnLabels?: { [sheetIndex: string]: { [colKey: string]: string } };
  
  // Titre et description personnalisés
  pageTitle?: string;
  pageDescription?: string;
  
  // Permissions spécifiques
  permission?: string;
  allowComments?: boolean;
  allowDownload?: boolean;
  
  // Métadonnées
  hasAccessed?: boolean;
  lastAccessed?: string;
}

export interface CellSelection {
  row: number;
  col: number;
}

export interface ShareResponse {
  id: string;
  fileName: string;
  originalFileName: string;
  fileExtension: string;
  fileSize: number;
  
  // Propriétaire
  ownerUsername: string;
  ownerEmail: string;
  
  // Configuration des données
  selectedSheet: string;
  headerRow: number;
  dataStartRow: number;
  columnRange: string;
  includeFormulas: boolean;
  preserveFormatting: boolean;
  detectedFields: string[];
  
  // Destinataires
  recipients: Recipient[];
  
  // Permissions
  selectedPermission: string;
  allowComments: boolean;
  allowDownload: boolean;
  
  // Métadonnées
  createdAt: string;
  updatedAt: string;
  status: string;
  
  // Données Excel
  headers: string[];
  totalRows: number;
  totalColumns: number;
  
  // Données Excel complètes (pour les partages en statut NEW)
  excelData?: any;
}

export interface FormDataResponse {
  // Informations du partage
  shareId: string;
  fileName: string;
  originalFileName: string;
  ownerUsername: string;
  ownerEmail: string;
  createdAt: string;
  expiresAt: string;
  recipientEmail: string;
  
  // Configuration du formulaire
  selectedSheet: string;
  headerRow: number;
  dataStartRow: number;
  columnRange: string;
  includeFormulas: boolean;
  preserveFormatting: boolean;
  detectedFields: string[];
  
  // Données Excel
  excelData: any;
  headers: string[];
  totalRows: number;
  totalColumns: number;
  
  // Configuration du destinataire
  recipientConfig: Recipient;
}

export interface ShareListResponse {
  shares: ShareResponse[];
  total: number;
}

export interface ShareStatsResponse {
  totalCreated: number;
  totalReceived: number;
  recentShares: ShareResponse[];
}

export interface FormAccessData {
  // Informations du partage
  shareId: string;
  fileName: string;
  originalFileName: string;
  ownerUsername: string;
  ownerEmail: string;
  createdAt: string;
  expiresAt: string;
  recipientEmail: string;
  
  // Configuration du formulaire
  pageTitle: string;
  pageDescription: string;
  
  // Données du tableau
  tableData: TableRow[]; // Données fusionnées (originales + soumises)
  originalTableData?: TableRow[]; // Données originales d'Excel (pour détecter les modifications)
  columnLabels: { [columnKey: string]: string };
  
  // Configuration des cellules
  tableDataEditableCells: CellPosition[];
  tableDataFormulaCells?: CellPosition[]; // Cellules contenant des formules (valeur calculée)
  
  // Métadonnées
  totalRows: number;
  totalColumns: number;
  
  // Statut du token
  tokenStatus?: string;
  validatedAt?: string;
  validatedBy?: string; // Email de la personne qui a validé
}

export interface TableRow {
  [columnKey: string]: any;
  _rowIndex?: number; // Index de la ligne dans le tableau original
}

export interface CellPosition {
  row: number;
  col: string; // Changé de number à string pour contenir le nom de la colonne
}

@Injectable({
  providedIn: 'root'
})
export class ShareService {
  // Utiliser le reverse proxy Nginx pour éviter les problèmes CORS
  private readonly API_BASE_URL = '/backend/api/shares';
  private readonly PUBLIC_API_BASE_URL = '/backend/public-access';

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private shareTabdataService: ShareTabdataService
  ) { }

  /**
   * Crée un nouveau partage (finalisé - statut ACTIVE)
   */
  createShare(shareRequest: ShareRequest): Observable<ShareResponse> {
    this.logger.log('🚀🚀🚀 SERVICE - Création d\'un partage:', shareRequest);
    this.logger.log('🌐 SERVICE - URL complète:', `${this.API_BASE_URL}`);
    this.logger.log('🔗 SERVICE - HTTP Client:', this.http);
    
    this.logger.log('📤 SERVICE - LANCEMENT POST REQUEST...');
    const postRequest = this.http.post<ShareResponse>(`${this.API_BASE_URL}`, shareRequest);
    this.logger.log('📋 SERVICE - Post request créée:', postRequest);
    
    return postRequest.pipe(
        tap(response => {
          this.logger.log('✅✅✅ SERVICE - Partage créé avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌❌❌ SERVICE - Erreur dans createShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Sauvegarde un partage en cours de création (statut NEW)
   */
  saveShare(shareRequest: ShareRequest): Observable<ShareResponse> {
    this.logger.log('💾 SERVICE - Sauvegarde d\'un partage en cours de création:', shareRequest);
    
    return this.http.post<ShareResponse>(`${this.API_BASE_URL}/save`, shareRequest).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Partage sauvegardé avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans saveShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Sauvegarde un partage en mode invité (statut NEW)
   */
  saveGuestShare(shareRequest: ShareRequest): Observable<ShareResponse> {
    this.logger.log('💾 SERVICE - Sauvegarde d\'un partage invité en cours de création:', shareRequest);
    
    return this.http.post<ShareResponse>(`/backend/api/guest/shares/save`, shareRequest).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Partage invité sauvegardé avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans saveGuestShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Finalise un partage en cours de création (NEW -> ACTIVE)
   */
  finalizeShare(shareId: string): Observable<ShareResponse> {
    this.logger.log('🎯 SERVICE - Finalisation du partage:', shareId);
    
    return this.http.post<ShareResponse>(`${this.API_BASE_URL}/${shareId}/finalize`, {}).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Partage finalisé avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans finalizeShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Finalise un partage invité après authentification
   */
  finalizeGuestShare(shareId: string): Observable<ShareResponse> {
    this.logger.log('🎯 SERVICE - Finalisation du partage invité:', shareId);
    
    return this.http.post<ShareResponse>(`/backend/api/guest/shares/${shareId}/finalize`, {}).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Partage invité finalisé avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans finalizeGuestShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Récupère les métadonnées d'un partage invité
   */
  getGuestShareMetadata(shareId: string): Observable<ShareResponse> {
    this.logger.log('📋 SERVICE - Récupération des métadonnées du partage invité:', shareId);
    
    return this.http.get<ShareResponse>(`/backend/api/guest/shares/${shareId}`).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Métadonnées du partage invité récupérées:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans getGuestShareMetadata:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Met à jour un partage en cours de création (statut NEW)
   */
  updateNewShare(shareId: string, shareRequest: ShareRequest): Observable<ShareResponse> {
    this.logger.log('📝 SERVICE - Mise à jour du partage en cours de création:', shareId, shareRequest);
    
    return this.http.put<ShareResponse>(`${this.API_BASE_URL}/${shareId}/update`, shareRequest).pipe(
        tap(response => {
          this.logger.log('✅ SERVICE - Partage mis à jour avec succès:', response);
        }),
        catchError((error) => {
          this.logger.error('❌ SERVICE - Erreur dans updateNewShare:', error);
          return this.handleError(error);
        })
      );
  }

  /**
   * Récupère un partage par ID (avec toutes les données Excel)
   */
  getShare(shareId: string): Observable<ShareResponse> {
    this.logger.log('📡 Appel backend complet (avec données Excel) pour', shareId);
    
    return this.http.get<ShareResponse>(`${this.API_BASE_URL}/${shareId}`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Partage complet récupéré pour', shareId);
          this.logger.log('📊 Réponse:', {
            id: response.id,
            status: response.status,
            fileName: response.fileName,
            hasExcelData: !!response.excelData,
            recipientsCount: response.recipients?.length || 0
          });
        }),
        catchError(this.handleError)
      );
  }


  /**
   * Récupère seulement les métadonnées d'un partage (sans les données Excel)
   * Utilise le paramètre backend metadata-only=true pour une optimisation réelle
   */
  getShareMetadata(shareId: string): Observable<ShareResponse> {
    this.logger.log('⚡ OPTIMISATION: Appel backend avec metadata-only=true pour', shareId);
    
    return this.http.get<ShareResponse>(`${this.API_BASE_URL}/${shareId}?metadata-only=true`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Métadonnées récupérées (sans données Excel) pour', shareId);
          this.logger.log('📊 Réponse:', {
            id: response.id,
            status: response.status,
            fileName: response.fileName,
            hasExcelData: !!response.excelData,
            recipientsCount: response.recipients?.length || 0
          });
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère tous les partages de l'utilisateur connecté
   */
  getUserShares(): Observable<ShareListResponse> {
    return this.http.get<ShareListResponse>(`${this.API_BASE_URL}`)
      .pipe(
        tap(response => {
          this.logger.log('Partages utilisateur récupérés:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère les partages partagés avec l'utilisateur connecté
   */
  getSharedWithMe(): Observable<ShareListResponse> {
    return this.http.get<ShareListResponse>(`${this.API_BASE_URL}/shared-with-me`)
      .pipe(
        tap(response => {
          this.logger.log('Partages reçus récupérés:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Met à jour un partage
   */
  updateShare(shareId: string, shareRequest: ShareRequest): Observable<ShareResponse> {
    this.logger.log('Mise à jour du partage:', shareId, shareRequest);
    
    return this.http.put<ShareResponse>(`${this.API_BASE_URL}/${shareId}`, shareRequest)
      .pipe(
        tap(response => {
          this.logger.log('Partage mis à jour:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Supprime un partage
   */
  deleteShare(shareId: string): Observable<any> {
    return this.http.delete(`${this.API_BASE_URL}/${shareId}`)
      .pipe(
        tap(response => {
          this.logger.log('Partage supprimé:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère les données d'un partage pour consultation
   * NOUVELLE VERSION SÉCURISÉE : Utilise les données pré-calculées
   */
  getShareData(shareId: string): Observable<any> {
    this.logger.log('📊 Récupération des données sécurisées pour shareId:', shareId);
    
    return this.http.get(`${this.API_BASE_URL}/${shareId}/data`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Données du partage récupérées depuis la base:', response);
        }),
        catchError(this.handleError)
      );
  }
  
  /**
   * Récupère le tabdata pour un destinataire spécifique (nouveau système sécurisé)
   */
  getRecipientTabdata(shareId: string, recipientEmail: string): Observable<any> {
    this.logger.log('📊 Récupération tabdata pour destinataire:', { shareId, recipientEmail });
    
    return this.shareTabdataService.getRecipientTabdata(shareId, recipientEmail).pipe(
      tap(response => {
        this.logger.log('✅ Tabdata récupéré avec succès');
      }),
      catchError(this.handleError)
    );
  }
  
  /**
   * Recalcule le tabdata pour tous les destinataires (propriétaire uniquement)
   */
  rebuildTabdata(shareId: string): Observable<any> {
    this.logger.log('🔄 Recalcul tabdata pour shareId:', shareId);
    
    return this.shareTabdataService.rebuildTabdata(shareId).pipe(
      tap(response => {
        this.logger.log('✅ Tabdata recalculé avec succès:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Marque un partage comme consulté
   */
  markAsAccessed(shareId: string): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}/${shareId}/access`, {})
      .pipe(
        tap(response => {
          this.logger.log('Partage marqué comme consulté:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère les statistiques de partage
   */
  getShareStats(): Observable<ShareStatsResponse> {
    return this.http.get<ShareStatsResponse>(`${this.API_BASE_URL}/stats`)
      .pipe(
        tap(response => {
          this.logger.log('Statistiques de partage récupérées:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Génère un lien d'accès pour un destinataire
   */
  generateRecipientLink(shareId: string, recipientEmail: string, validityDays: number = 7): Observable<any> {
    return this.http.post<any>(`${this.API_BASE_URL}/${shareId}/recipient-link`, {
      email: recipientEmail,
      validityDays: validityDays
    })
      .pipe(
        tap(response => {
          this.logger.log('Lien d\'accès généré:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Renvoie l'email d'accès à un destinataire avec le dernier token actif
   */
  resendAccessEmail(shareId: string, recipientEmail: string): Observable<any> {
    return this.http.post<any>(`${this.API_BASE_URL}/${shareId}/resend-email`, {
      email: recipientEmail
    })
      .pipe(
        tap(response => {
          this.logger.log('Email d\'accès renvoyé:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Accède aux données d'un partage via un token
   */
  accessShareWithToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.API_BASE_URL}/access/${token}`)
      .pipe(
        tap(response => {
          this.logger.log('Accès au partage via token réussi:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Marque un token comme utilisé (appelé une seule fois à l'ouverture de la page)
   * @param token Token d'accès
   */
  markTokenAsUsed(token: string): Observable<any> {
    return this.http.post<any>(`${this.PUBLIC_API_BASE_URL}/token/${token}/mark-used`, {})
      .pipe(
        tap(response => {
          this.logger.log('Token marqué comme utilisé:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère les données du formulaire avec les configurations du destinataire via un token
   * @param token Token d'accès
   * @param page Numéro de page (commence à 1), optionnel
   * @param limit Nombre de lignes par page, optionnel
   */
  getFormDataWithToken(token: string, page?: number, limit?: number): Observable<FormAccessData> {
    let url = `${this.PUBLIC_API_BASE_URL}/form/${token}`;
    
    // Ajouter les paramètres de pagination si fournis
    if (page !== undefined && limit !== undefined) {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      url += '?' + params.toString();
    }
    
    return this.http.get<FormAccessData>(url)
      .pipe(
        tap(response => {
          this.logger.log('Données du formulaire récupérées:', { page, limit, totalRows: response.totalRows });
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Sauvegarde les données du formulaire via un token
   */
  saveFormData(token: string, formData: any): Observable<any> {
    return this.http.post<any>(`${this.PUBLIC_API_BASE_URL}/form/${token}/save`, formData)
      .pipe(
        tap(response => {
          this.logger.log('Données du formulaire sauvegardées:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Valide un token d'accès (clôture l'accès et marque comme validé)
   */
  validateAccessToken(token: string, validatedBy?: string): Observable<any> {
    const body = validatedBy ? { validatedBy } : {};
    return this.http.post<any>(`${this.PUBLIC_API_BASE_URL}/form/${token}/validate`, body)
      .pipe(
        tap(response => {
          this.logger.log('Token d\'accès validé:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Télécharge le fichier HTML du formulaire via un token
   */
  downloadFormAsHtml(token: string): Observable<Blob> {
    return this.http.get(`${this.PUBLIC_API_BASE_URL}/form/${token}/html`, {
      responseType: 'blob'
    }).pipe(
      tap(response => {
        this.logger.log('HTML du formulaire téléchargé:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Télécharge le fichier CSV du formulaire via un token
   */
  downloadFormAsCsv(token: string): Observable<Blob> {
    return this.http.get(`${this.PUBLIC_API_BASE_URL}/form/${token}/csv`, {
      responseType: 'blob'
    }).pipe(
      tap(response => {
        this.logger.log('CSV du formulaire téléchargé:', response);
      }),
      catchError(this.handleError)
    );
  }

  downloadShareFile(shareId: string): Observable<Blob> {
    return this.http.get(`${this.API_BASE_URL}/${shareId}/file`, { 
      responseType: 'blob' 
    }).pipe(
      tap(response => {
        this.logger.log('Fichier téléchargé:', response);
      }),
      catchError(this.handleError)
    );
  }

  downloadShareFileWithValidatedData(shareId: string): Observable<Blob> {
    return this.http.get(`${this.API_BASE_URL}/${shareId}/file-with-validated-data`, { 
      responseType: 'blob' 
    }).pipe(
      tap(response => {
        this.logger.log('Fichier avec données validées téléchargé:', response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Récupère tous les tokens d'accès pour un partage
   */
  getAccessTokens(shareId: string): Observable<any> {
    return this.http.get<any>(`${this.API_BASE_URL}/${shareId}/access-tokens`)
      .pipe(
        tap(response => {
          this.logger.log('Tokens d\'accès récupérés:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère tous les tokens d'accès de l'utilisateur connecté
   */
  getUserAccessTokens(): Observable<any> {
    return this.http.get<any>(`${this.API_BASE_URL}/my-access-tokens`)
      .pipe(
        tap(response => {
          this.logger.log('Mes tokens d\'accès récupérés:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Révoque un token d'accès
   */
  revokeAccessToken(tokenId: string): Observable<any> {
    return this.http.delete<any>(`${this.API_BASE_URL}/access-tokens/${tokenId}`)
      .pipe(
        tap(response => {
          this.logger.log('Token révoqué:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupère tous les contacts utilisés par l'utilisateur connecté
   */
  getUserContacts(): Observable<{ contacts: ContactInfo[], total: number }> {
    this.logger.log('📧 Récupération des contacts de l\'utilisateur');
    
    return this.http.get<{ contacts: ContactInfo[], total: number }>(`${this.API_BASE_URL}/my-contacts`)
      .pipe(
        tap(response => {
          this.logger.log('✅ Contacts récupérés:', response);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Parse un contact au format "Nom Prénom <email@example.com>" ou "email@example.com"
   */
  parseContact(contactString: string): { email: string, displayName?: string } {
    const trimmed = contactString.trim();
    
    // Format "Nom Prénom <email@example.com>"
    const emailMatch = trimmed.match(/^(.+?)\s*<(.+?)>$/);
    if (emailMatch) {
      const displayName = emailMatch[1].trim();
      const email = emailMatch[2].trim();
      return { email, displayName };
    }
    
    // Format simple "email@example.com"
    return { email: trimmed };
  }

  /**
   * Valide si une chaîne est un contact valide
   */
  isValidContact(contactString: string): boolean {
    const trimmed = contactString.trim();
    if (!trimmed) return false;
    
    // Format "Nom Prénom <email@example.com>"
    const emailMatch = trimmed.match(/^(.+?)\s*<(.+?)>$/);
    if (emailMatch) {
      const email = emailMatch[2].trim();
      return this.isValidEmail(email);
    }
    
    // Format simple "email@example.com"
    return this.isValidEmail(trimmed);
  }

  /**
   * Convertit les données frontend vers le format ShareRequest
   */
  convertToShareRequest(frontendData: any): ShareRequest {
    return {
      fileName: frontendData.selectedFile?.name || '',
      fileId: frontendData.tempFileId || '',
      
      selectedSheet: frontendData.selectedSheet || 'Feuille 1',
      selectedSheetIndex: frontendData.selectedSheetIndex || 0,
      headerRow: frontendData.headerRow || 1,
      dataStartRow: frontendData.dataStartRow || 2,
      columnRange: frontendData.columnRange || 'A:F',
      includeFormulas: frontendData.includeFormulas || false,
      preserveFormatting: frontendData.preserveFormatting || true,
      detectedFields: frontendData.detectedFields || [],
      
      recipients: this.convertRecipients(frontendData.recipients || []),
      
      selectedPermission: frontendData.selectedPermission || 'read',
      allowComments: frontendData.allowComments || false,
      allowDownload: frontendData.allowDownload || false,
      
      headers: frontendData.headers || [],
      totalRows: frontendData.totalRows || 0,
      totalColumns: frontendData.totalColumns || 0
    };
  }

  /**
   * Convertit les destinataires frontend vers le format backend
   */
  private convertRecipients(frontendRecipients: any[]): Recipient[] {
    return frontendRecipients.map(recipient => ({
      email: recipient.email,
      displayName: recipient.displayName,
      selectedSheetIndex: recipient.selectedSheetIndex || 0,
      selections: recipient.selections || {},
      editableCells: recipient.editableCells || {},
      columnLabels: recipient.columnLabels || {},
      pageTitle: recipient.pageTitle,
      pageDescription: recipient.pageDescription,
      permission: recipient.permission,
      allowComments: recipient.allowComments,
      allowDownload: recipient.allowDownload
    }));
  }

  /**
   * Validation côté client d'une requête de partage
   */
  validateShareRequest(request: ShareRequest): string | null {
    if (!request.fileName || request.fileName.trim() === '') {
      return 'Le nom du fichier est requis';
    }
    
    if (!request.fileId || request.fileId.trim() === '') {
      return 'L\'ID du fichier temporaire est requis';
    }
    
    if (!request.recipients || request.recipients.length === 0) {
      return 'Au moins un destinataire est requis';
    }
    
    if (!request.selectedPermission) {
      return 'Les permissions sont requises';
    }
    
    if (!request.headers || request.headers.length === 0) {
      return 'Les en-têtes du fichier sont requises';
    }
    
    // Valider les emails des destinataires
    for (const recipient of request.recipients) {
      if (!recipient.email || recipient.email.trim() === '') {
        return 'Tous les destinataires doivent avoir un email';
      }
      
      if (!this.isValidEmail(recipient.email)) {
        return `Email invalide: ${recipient.email}`;
      }
    }
    
    return null; // Aucune erreur
  }

  /**
   * Validation simple d'email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Gestion centralisée des erreurs HTTP
   */
  private handleError = (error: HttpErrorResponse) => {
    this.logger.error('Erreur HTTP ShareService:', error);
    
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
      } else if (error.status === 403) {
        errorMessage = 'Accès non autorisé';
      } else if (error.status === 404) {
        errorMessage = 'Ressource non trouvée';
      } else if (error.status === 500) {
        errorMessage = error.error?.error || 'Erreur interne du serveur';
      } else {
        errorMessage = `Erreur ${error.status}: ${error.error?.error || error.message}`;
      }
    }
    
    this.logger.error('Message d\'erreur ShareService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
} 