import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SharedFileData {
  tempFileId: string;
  fileName: string;
  rowsData: any[];
  sheetsData: any[];
  totalRows: number;
  totalColumns: number;
}

@Injectable({
  providedIn: 'root'
})
export class FileDataSharingService {
  private fileDataSubject = new BehaviorSubject<SharedFileData | null>(null);
  public fileData$ = this.fileDataSubject.asObservable();

  constructor() { }

  /**
   * Stocke les données de fichier pour les partager entre composants
   */
  setFileData(fileData: SharedFileData): void {
    this.fileDataSubject.next(fileData);
  }

  /**
   * Récupère les données de fichier stockées
   */
  getFileData(): SharedFileData | null {
    return this.fileDataSubject.value;
  }

  /**
   * Efface les données de fichier stockées
   */
  clearFileData(): void {
    this.fileDataSubject.next(null);
  }

  /**
   * Vérifie si des données de fichier sont disponibles
   */
  hasFileData(): boolean {
    return this.fileDataSubject.value !== null;
  }
}
