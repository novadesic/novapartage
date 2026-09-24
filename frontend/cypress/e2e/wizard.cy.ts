/** Specs UI anciennes (libellés DDS Share) — à aligner sur NovaPartage + auth magic link. */
describe.skip('DDS Share Wizard (legacy UI)', () => {
  beforeEach(() => {
    // Visiter la page d'accueil
    cy.visit('/')
    
    // Attendre que la page soit chargée
    cy.get('h1').should('contain', 'Bienvenue sur DDS Share')
  })

  it('should navigate from home to wizard', () => {
    // Vérifier que le bouton "Nouveau partage" existe
    cy.get('button').contains('Nouveau partage').should('be.visible')
    
    // Cliquer sur le bouton
    cy.get('button').contains('Nouveau partage').click()
    
    // Vérifier la navigation vers la page wizard
    cy.url().should('include', '/share/new')
    cy.get('h2').should('contain', 'Nouveau partage')
  })

  it('should display wizard with 5 steps', () => {
    // Naviguer vers le wizard
    cy.visit('/share/new')
    
    // Vérifier que ng-wizard est présent
    cy.get('.step-indicator').should('have.length', 5)
    
    // Vérifier les titres des étapes
    cy.contains('1. Sélectionner un fichier').should('be.visible')
    cy.contains('2. Données partageable').should('be.visible')
    cy.contains('3. Destinataires').should('be.visible')
    cy.contains('4. Droits de modification').should('be.visible')
    cy.contains('5. Validation').should('be.visible')
  })

  it('should complete step 1 - file selection', () => {
    cy.visit('/share/new')
    
    // Vérifier que nous sommes sur l'étape 1
    cy.contains('1. Sélectionner un fichier').should('be.visible')
    
    // Créer un fichier test
    const fileName = 'test-file.xlsx'
    const fileContent = 'test content'
    
    // Simuler la sélection d'un fichier
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    // Vérifier que le fichier est sélectionné
    cy.get('.alert-success').should('contain', fileName)
    
    // Vérifier que le bouton "Suivant" est activé
    cy.get('button').contains('Suivant').should('not.be.disabled')
  })

  it('should complete step 2 - data configuration', () => {
    cy.visit('/share/new')
    
    // Compléter l'étape 1
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    // Aller à l'étape 2
    cy.get('button').contains('Suivant').click()
    
    // Vérifier que nous sommes sur l'étape 2
    cy.contains('2. Données partageable').should('be.visible')
    
    // Cliquer sur "Valider la configuration"
    cy.get('button').contains('Valider la configuration').click()
    
    // Vérifier que le bouton "Suivant" est activé
    cy.get('button').contains('Suivant').should('not.be.disabled')
  })

  it('should complete step 3 - recipients configuration', () => {
    cy.visit('/share/new')
    
    // Compléter les étapes précédentes
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    cy.get('button').contains('Suivant').click()
    cy.get('button').contains('Valider la configuration').click()
    cy.get('button').contains('Suivant').click()
    
    // Vérifier que nous sommes sur l'étape 3
    cy.contains('3. Destinataires').should('be.visible')
    
    // Ajouter un destinataire
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[placeholder="ex: A1:D10"]').type('A1:C10')
    cy.get('button').contains('Ajouter').click()
    
    // Vérifier que le destinataire est ajouté
    cy.contains('test@example.com').should('be.visible')
    cy.contains('A1:C10').should('be.visible')
    cy.contains('1 destinataire(s)').should('be.visible')
    
    // Vérifier que le bouton "Suivant" est activé
    cy.get('button').contains('Suivant').should('not.be.disabled')
  })

  it('should complete step 4 - permissions configuration', () => {
    cy.visit('/share/new')
    
    // Compléter les étapes précédentes rapidement
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    cy.get('button').contains('Suivant').click()
    cy.get('button').contains('Valider la configuration').click()
    cy.get('button').contains('Suivant').click()
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[placeholder="ex: A1:D10"]').type('A1:C10')
    cy.get('button').contains('Ajouter').click()
    cy.get('button').contains('Suivant').click()
    
    // Vérifier que nous sommes sur l'étape 4
    cy.contains('4. Droits de modification').should('be.visible')
    
    // Sélectionner une permission
    cy.get('input[value="edit-own"]').check()
    
    // Activer des options
    cy.get('#allowComments').check()
    cy.get('#allowDownload').check()
    
    // Valider les permissions
    cy.get('button').contains('Valider les permissions').click()
    
    // Vérifier que le bouton "Suivant" est activé
    cy.get('button').contains('Suivant').should('not.be.disabled')
  })

  it('should complete wizard workflow', () => {
    cy.visit('/share/new')
    
    // Étape 1: Sélection fichier
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test content'),
      fileName: 'complete-test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    cy.get('button').contains('Suivant').click()
    
    // Étape 2: Configuration données
    cy.get('button').contains('Valider la configuration').click()
    cy.get('button').contains('Suivant').click()
    
    // Étape 3: Destinataires
    cy.get('input[type="email"]').type('user1@example.com')
    cy.get('input[placeholder="ex: A1:D10"]').type('A1:C10')
    cy.get('button').contains('Ajouter').click()
    cy.get('button').contains('Suivant').click()
    
    // Étape 4: Permissions
    cy.get('input[value="edit-own"]').check()
    cy.get('button').contains('Valider les permissions').click()
    cy.get('button').contains('Suivant').click()
    
    // Étape 5: Validation finale
    cy.contains('5. Validation').should('be.visible')
    cy.contains('complete-test.xlsx').should('be.visible')
    cy.contains('1 destinataire(s)').should('be.visible')
    cy.contains('user1@example.com').should('be.visible')
    
    // Finaliser le partage
    cy.get('button').contains('Créer le partage').should('not.be.disabled')
    cy.get('button').contains('Créer le partage').click()
  })

  it('should handle navigation between steps', () => {
    cy.visit('/share/new')
    
    // Compléter rapidement jusqu'à l'étape 3
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test'),
      fileName: 'nav-test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    cy.get('button').contains('Suivant').click()
    cy.get('button').contains('Valider la configuration').click()
    cy.get('button').contains('Suivant').click()
    cy.get('input[type="email"]').type('nav@example.com')
    cy.get('input[placeholder="ex: A1:D10"]').type('A1:C10')
    cy.get('button').contains('Ajouter').click()
    
    // Tester la navigation "Précédent"
    cy.get('button').contains('Précédent').click()
    cy.contains('2. Données partageable').should('be.visible')
    
    // Revenir en avant
    cy.get('button').contains('Suivant').click()
    cy.contains('3. Destinataires').should('be.visible')
    
    // Continuer
    cy.get('button').contains('Suivant').click()
    cy.contains('4. Droits de modification').should('be.visible')
  })

  it('should handle back navigation to home', () => {
    cy.visit('/share/new')
    
    // Vérifier le bouton retour
    cy.get('button').contains('Retour').should('be.visible')
    cy.get('button').contains('Retour').click()
    
    // Vérifier le retour à l'accueil
    cy.url().should('not.include', '/share/new')
    cy.get('h1').should('contain', 'Bienvenue sur DDS Share')
  })
}) 