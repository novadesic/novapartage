export class NewSharePage {
  // Sélecteurs des éléments de la page
  private selectors = {
    // Navigation du wizard
    stepIndicator: '[data-testid="step-indicator"]',
    step1: '[data-testid="step-1"]',
    step2: '[data-testid="step-2"]',
    step3: '[data-testid="step-3"]',
    step4: '[data-testid="step-4"]',
    progressBar: '[data-testid="progress-bar"]',
    btnNext: '[data-testid="btn-next"]',
    btnPrevious: '[data-testid="btn-previous"]',
    
    // Upload de fichiers
    fileDropZone: '[data-testid="file-drop-zone"]',
    fileInput: '[data-testid="file-input"]',
    fileName: '[data-testid="file-name"]',
    uploadSuccess: '[data-testid="upload-success"]',
    uploadProgress: '[data-testid="upload-progress"]',
    uploadError: '[data-testid="upload-error"]',
    
    // Gestion des destinataires
    addRecipientBtn: '[data-testid="add-recipient-btn"]',
    recipientEmailInput: '[data-testid="recipient-email-input"]',
    recipientNameInput: '[data-testid="recipient-name-input"]',
    saveRecipientBtn: '[data-testid="save-recipient-btn"]',
    recipientsList: '[data-testid="recipients-list"]',
    removeRecipientBtn: '[data-testid="remove-recipient-btn"]',
    emailError: '[data-testid="email-error"]',
    
    // Sélection des cellules
    dataTable: '[data-testid="data-table"]',
    selectedCellsCount: '[data-testid="selected-cells-count"]',
    warningMessage: '[data-testid="warning-message"]',
    
    // Configuration des droits
    editableCellToggle: '[data-testid="editable-cell-toggle"]',
    editableCellsIndicator: '[data-testid="editable-cells-indicator"]',
    
    // Prévisualisation
    formPreview: '[data-testid="form-preview"]',
    formTitleInput: '[data-testid="form-title-input"]',
    formDescriptionInput: '[data-testid="form-description-input"]',
    formPreviewTitle: '[data-testid="form-preview-title"]',
    
    // Boutons d'action
    btnSave: '[data-testid="btn-save"]',
    btnFinalize: '[data-testid="btn-finalize"]',
    
    // Messages
    saveSuccess: '[data-testid="save-success"]',
    finalizeSuccess: '[data-testid="finalize-success"]',
    errorMessage: '[data-testid="error-message"]',
    networkError: '[data-testid="network-error"]',
    retryBtn: '[data-testid="retry-btn"]',
    
    // Indicateurs
    excelDataLoaded: '[data-testid="excel-data-loaded"]',
    shareCreated: '[data-testid="share-created"]'
  };

  /**
   * Upload d'un fichier Excel
   */
  uploadFile(filePath: string): void {
    cy.get(this.selectors.fileInput).attachFile(filePath);
    
    // Attendre que l'upload soit terminé
    cy.get(this.selectors.uploadSuccess, { timeout: 10000 }).should('be.visible');
  }

  /**
   * Ajout d'un destinataire
   */
  addRecipient(email: string, name: string): void {
    cy.get(this.selectors.addRecipientBtn).click();
    cy.get(this.selectors.recipientEmailInput).type(email);
    cy.get(this.selectors.recipientNameInput).type(name);
    cy.get(this.selectors.saveRecipientBtn).click();
    
    // Vérifier que le destinataire est ajouté
    cy.get(this.selectors.recipientsList).should('contain', email);
  }

  /**
   * Sélection de cellules spécifiques
   */
  selectCells(cellReferences: string[]): void {
    // Pour simplifier, on sélectionne les premières cellules du tableau
    cy.get(this.selectors.dataTable).within(() => {
      cellReferences.forEach((_, index) => {
        cy.get('td').eq(index).click({ ctrlKey: index > 0 });
      });
    });
    
    // Vérifier que les cellules sont sélectionnées
    cy.get(this.selectors.selectedCellsCount).should('contain', cellReferences.length.toString());
  }

  /**
   * Configuration complète d'un partage pour les tests
   */
  setupCompleteShare(): void {
    // Étape 1: Upload du fichier
    this.uploadFile('test-data/simple-excel.xlsx');
    
    // Étape 2: Ajout du destinataire et sélection des cellules
    cy.get(this.selectors.btnNext).click();
    this.addRecipient('test@exemple.com', 'Test User');
    this.selectCells(['A1', 'B1']);
    
    // Étape 3: Configuration des droits
    cy.get(this.selectors.btnNext).click();
    cy.get(this.selectors.editableCellToggle).first().click();
    
    // Étape 4: Prévisualisation
    cy.get(this.selectors.btnNext).click();
    
    // Vérifier qu'on est à l'étape 4
    cy.get(this.selectors.step4).should('have.class', 'active');
  }

  /**
   * Navigation vers une étape spécifique
   */
  goToStep(stepNumber: number): void {
    cy.get(`[data-testid="step-${stepNumber}"]`).click();
    cy.get(`[data-testid="step-${stepNumber}"]`).should('have.class', 'active');
  }

  /**
   * Vérification de l'état d'une étape
   */
  verifyStepState(stepNumber: number, expectedState: 'active' | 'disabled' | 'completed'): void {
    const stepSelector = `[data-testid="step-${stepNumber}"]`;
    
    switch (expectedState) {
      case 'active':
        cy.get(stepSelector).should('have.class', 'active');
        break;
      case 'disabled':
        cy.get(stepSelector).should('have.class', 'disabled');
        break;
      case 'completed':
        cy.get(stepSelector).should('have.class', 'completed');
        break;
    }
  }

  /**
   * Vérification de la progression du wizard
   */
  verifyProgress(expectedPercentage: number): void {
    cy.get(this.selectors.progressBar).should('have.css', 'width', `${expectedPercentage}%`);
  }

  /**
   * Vérification de l'état des boutons de navigation
   */
  verifyNavigationButtons(nextEnabled: boolean, previousEnabled: boolean): void {
    if (nextEnabled) {
      cy.get(this.selectors.btnNext).should('be.enabled');
    } else {
      cy.get(this.selectors.btnNext).should('be.disabled');
    }
    
    if (previousEnabled) {
      cy.get(this.selectors.btnPrevious).should('be.enabled');
    } else {
      cy.get(this.selectors.btnPrevious).should('be.disabled');
    }
  }

  /**
   * Attente que l'upload soit terminé
   */
  waitForUpload(): void {
    cy.get(this.selectors.uploadSuccess, { timeout: 15000 }).should('be.visible');
  }

  /**
   * Vérification de la présence d'un message d'erreur
   */
  verifyErrorMessage(expectedMessage: string): void {
    cy.get(this.selectors.errorMessage).should('be.visible');
    cy.get(this.selectors.errorMessage).should('contain', expectedMessage);
  }

  /**
   * Vérification de la présence d'un message de succès
   */
  verifySuccessMessage(expectedMessage: string): void {
    cy.get(this.selectors.uploadSuccess).should('be.visible');
    cy.get(this.selectors.uploadSuccess).should('contain', expectedMessage);
  }

  /**
   * Vérification de la validation des emails
   */
  verifyEmailValidation(invalidEmail: string, shouldShowError: boolean): void {
    cy.get(this.selectors.addRecipientBtn).click();
    cy.get(this.selectors.recipientEmailInput).type(invalidEmail);
    cy.get(this.selectors.saveRecipientBtn).click();
    
    if (shouldShowError) {
      cy.get(this.selectors.emailError).should('be.visible');
    } else {
      cy.get(this.selectors.emailError).should('not.exist');
    }
  }

  /**
   * Test de la responsivité
   */
  testResponsiveness(): void {
    // Test mobile
    cy.viewport(375, 667);
    cy.get(this.selectors.stepIndicator).should('be.visible');
    cy.get(this.selectors.btnNext).should('be.visible');
    
    // Test tablet
    cy.viewport(768, 1024);
    cy.get(this.selectors.stepIndicator).should('be.visible');
    
    // Test desktop
    cy.viewport(1280, 720);
    cy.get(this.selectors.stepIndicator).should('be.visible');
  }
}


