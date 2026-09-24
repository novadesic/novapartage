import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { FooterComponent } from '../footer/footer.component';
import { ModalService } from '../../services/modal.service';
import { UnifiedAuthState } from '../../services/unified-auth.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';
import { ExcelService } from '../../services/excel.service';
import { FileDataSharingService } from '../../services/file-data-sharing.service';
import { EnvironmentService } from '../../services/environment.service';

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FooterComponent]
})
export class IndexComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  showLoginModal = false;
  email = '';
  emailSent = false;
  isLoading = false;
  acceptTerms = false;
  loginMethod: 'password' | 'code' | null = null;
  userPassword = '';
  isLoggingInWithPassword = false;
  loginPasswordError = '';
  showIndexPassword = false;
  isManagingShares = false;
  isExpiredLink = false;
  isSessionExpired = false;
  uploadError: string | null = null;
  isUploading = false;
  isDragOver = false;
  fileUploadError: string | null = null;
  selectedFileName: string | null = null;
  maxFileSizeLabel = '';

  private modalSubscription?: Subscription;
  private authStateSubscription?: Subscription;

  constructor(
    private authService: UnifiedAuthService,
    private router: Router,
    private logger: LoggerService,
    private modalService: ModalService,
    private confirmationModalService: ConfirmationModalService,
    private excelService: ExcelService,
    private fileDataSharingService: FileDataSharingService,
    private environmentService: EnvironmentService
  ) {}

  ngOnInit(): void {
    this.maxFileSizeLabel = this.environmentService.getMaxFileSize();

    this.authStateSubscription = this.authService.getAuthState$().subscribe(
      (authState: UnifiedAuthState) => {
        this.isLoggedIn = authState.isAuthenticated && authState.isEmailValidated;

        if (this.isLoggedIn) {
          this.router.navigate(['/home'], { replaceUrl: true });
        }
      }
    );

    this.modalSubscription = this.modalService.openLoginModal$.subscribe(() => {
      this.seConnecter();
    });

    this.checkUrlParameters();
  }

  ngOnDestroy(): void {
    this.modalSubscription?.unsubscribe();
    this.authStateSubscription?.unsubscribe();
  }

  private checkUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const emailParam = urlParams.get('email');

    if (authStatus === 'success' && emailParam) {
      this.authService.handleAuthCallback().subscribe({
        next: (success) => {
          if (success) {
            this.cleanUrl();
          }
        },
        error: () => this.cleanUrl()
      });
    }

    const showLogin = urlParams.get('showLogin');
    const expired = urlParams.get('expired');
    const reason = urlParams.get('reason');

    if (showLogin === 'true') {
      this.showLoginModal = true;
      this.isExpiredLink = expired === 'true';
      this.isSessionExpired = reason === 'session_expired';

      if (emailParam) {
        this.email = decodeURIComponent(emailParam);
        this.logger.log('Email pré-rempli depuis l\'URL:', this.email);
      }

      this.cleanUrl();
    }
  }

  private cleanUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('showLogin');
    url.searchParams.delete('email');
    url.searchParams.delete('expired');
    url.searchParams.delete('reason');
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.toString());
  }

  seConnecter(): void {
    this.isManagingShares = false;
    this.showLoginModal = true;
    this.email = '';
    this.emailSent = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.loginPasswordError = '';
    this.uploadError = null;
  }

  gererMesPartages(): void {
    this.isManagingShares = true;
    this.showLoginModal = true;
    this.email = '';
    this.emailSent = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.loginPasswordError = '';
    this.uploadError = null;
  }

  sInscrire(): void {
    this.isManagingShares = false;
    this.showLoginModal = true;
    this.email = '';
    this.emailSent = false;
  }

  closeLoginModal(): void {
    this.showLoginModal = false;
    this.email = '';
    this.emailSent = false;
    this.isLoading = false;
    this.isManagingShares = false;
    this.isExpiredLink = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.showIndexPassword = false;
    this.loginPasswordError = '';
    this.uploadError = null;
  }

  choosePasswordLogin(): void {
    this.loginMethod = 'password';
    this.loginPasswordError = '';
  }

  backToLoginChoice(): void {
    this.loginMethod = null;
    this.userPassword = '';
    this.loginPasswordError = '';
  }

  onEmailStepSubmit(event: Event): void {
    event.preventDefault();
  }

  async loginWithPassword(): Promise<void> {
    if (!this.email || !this.userPassword) return;

    this.isLoggingInWithPassword = true;
    this.loginPasswordError = '';

    try {
      await this.authService.loginWithPassword(this.email, this.userPassword);
      this.closeLoginModal();
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: any) {
      this.loginPasswordError = error?.error?.message || 'Email ou mot de passe incorrect';
    } finally {
      this.isLoggingInWithPassword = false;
    }
  }

  async loginWithEmail(): Promise<void> {
    if (!this.email || !this.email.includes('@')) {
      this.confirmationModalService.alertWarning('Veuillez saisir une adresse email valide');
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.loginWithEmail(this.email);
      this.emailSent = true;
      this.logger.log('Lien de connexion envoyé à:', this.email);
    } catch (error: any) {
      this.logger.error('Erreur lors de l\'envoi de l\'email:', error);

      if (error?.status === 429) {
        this.uploadError = 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
      } else {
        this.uploadError = 'Erreur lors de l\'envoi de l\'email de connexion. Veuillez réessayer.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (this.isUploading) return;

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  private handleFile(file: File): void {
    const validExtensions = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      this.fileUploadError = 'Format non supporté. Seuls les fichiers .xlsx et .xls sont acceptés.';
      return;
    }

    const maxFileSizeBytes = this.environmentService.getMaxFileSizeBytes();
    if (file.size > maxFileSizeBytes) {
      this.fileUploadError = `La taille du fichier dépasse la limite autorisée (${this.maxFileSizeLabel}).`;
      return;
    }

    this.fileUploadError = null;
    this.selectedFileName = file.name;
    this.isUploading = true;

    this.excelService.uploadExcelFile(file, true).subscribe({
      next: (response: any) => {
        this.fileDataSharingService.setFileData({
          tempFileId: response.tempFileId,
          fileName: response.fileName || file.name,
          rowsData: response.rows || [],
          sheetsData: response.sheets || [],
          totalRows: response.totalRows || 0,
          totalColumns: response.totalColumns || 0
        });

        this.router.navigate(['/share/new'], {
          queryParams: {
            tempFileId: response.tempFileId,
            fileName: response.fileName || file.name,
            step: 1
          }
        });
      },
      error: (error: Error) => {
        this.logger.error('Erreur upload depuis l\'index:', error);
        this.fileUploadError = error.message || 'Erreur lors de l\'import du fichier. Veuillez réessayer.';
        this.selectedFileName = null;
        this.isUploading = false;
      }
    });
  }
}
