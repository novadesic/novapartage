import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShareService, ShareRequest } from '../../services/share.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { NotificationService } from '../../services/notification.service';
import { UnifiedUser } from '../../services/auth-interfaces';

@Component({
  selector: 'app-share-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './share-form.component.html',
  styleUrls: ['./share-form.component.scss']
})
export class ShareFormComponent implements OnInit {
  userProfile: UnifiedUser | null = null;
  isSubmitting = false;
  selectedFile: File | null = null;

  shareData = {
    title: '',
    description: '',
    access: 'public',
    password: '',
    expiry: ''
  };
  showShareFormPassword = false;

  constructor(
    private authService: UnifiedAuthService,
    private logger: LoggerService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    // Vérifier que l'utilisateur est connecté
    const isLoggedIn = await this.authService.isLoggedIn();
    if (!isLoggedIn) {
      this.authService.login();
      return;
    }

    // Charger le profil utilisateur
    this.authService.getLoggedUser().subscribe(
      profile => {
        this.userProfile = profile;
      },
      error => {
        this.logger.error('Erreur lors du chargement du profil:', error);
      }
    );
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedFile) {
      this.notificationService.warning('Veuillez sélectionner un fichier');
      return;
    }

    this.isSubmitting = true;

    try {
      // Simulation de création de partage
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.notificationService.success('Partage créé avec succès !');
      // Redirection vers la liste des partages ou le tableau de bord
      
    } catch (error) {
      this.logger.error('Erreur lors de la création du partage:', error);
      this.notificationService.error('Erreur lors de la création du partage');
    } finally {
      this.isSubmitting = false;
    }
  }
} 