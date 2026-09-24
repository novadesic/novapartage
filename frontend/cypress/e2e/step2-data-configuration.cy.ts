/** Specs UI anciennes — à réactiver après alignement NovaPartage. */
describe.skip('Step 2 - Data Configuration Interface (legacy)', () => {
  beforeEach(() => {
    cy.visit('/share/new')
    
    // Compléter l'étape 1 rapidement
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test content'),
      fileName: 'test-data.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    cy.get('button').contains('Suivant').click()
    
    // Vérifier que nous sommes sur l'étape 2
    cy.contains('2. Données partageable').should('be.visible')
  })

  it('should display data preview table', () => {
    // Vérifier la sélection de feuille
    cy.contains('Feuille sélectionnée').should('be.visible')
    cy.get('select').contains('Feuille 1').should('be.visible')
    
    // Vérifier les curseurs déplaçables
    cy.get('.cursor-indicator').should('have.length', 2)
    cy.get('.cursor-header').should('be.visible')
    cy.get('.cursor-data').should('be.visible')
    
    // Vérifier les en-têtes de colonnes
    cy.get('table thead').within(() => {
      cy.contains('A').should('be.visible')
      cy.contains('B').should('be.visible')
      cy.contains('C').should('be.visible')
      cy.contains('D').should('be.visible')
      cy.contains('E').should('be.visible')
      cy.contains('F').should('be.visible')
    })
    
    // Vérifier les en-têtes de données
    cy.get('table tbody tr:first').within(() => {
      cy.contains('Catégorie').should('be.visible')
      cy.contains('Référence').should('be.visible')
      cy.contains('Nom du produit').should('be.visible')
      cy.contains('Tarif client A').should('be.visible')
      cy.contains('Tarif client B').should('be.visible')
      cy.contains('Tarif client C').should('be.visible')
    })
    
    // Vérifier quelques lignes de données
    cy.contains('Electronique').should('be.visible')
    cy.contains('Téléviseur 42"').should('be.visible')
    cy.contains('Maison').should('be.visible')
    cy.contains('Cafetière').should('be.visible')
  })

  it('should display detected fields panel', () => {
    // Vérifier le panneau "Tableau de données"
    cy.get('.card-header').contains('Tableau de données').should('be.visible')
    
    // Vérifier les champs détectés
    cy.contains('Champs détectés').should('be.visible')
    cy.contains('CATÉGORIE').should('be.visible')
    cy.contains('RÉFÉRENCE').should('be.visible')
    cy.contains('NOM DU PRODUIT').should('be.visible')
  })

  it('should allow field selection/deselection', () => {
    // Décocher le champ "TARIF CLIENT C"
    cy.contains('TARIF CLIENT C').parent().find('input[type="checkbox"]').uncheck()
    cy.contains('TARIF CLIENT C').parent().find('input[type="checkbox"]').should('not.be.checked')
    
    // Recocher le champ
    cy.contains('TARIF CLIENT C').parent().find('input[type="checkbox"]').check()
    cy.contains('TARIF CLIENT C').parent().find('input[type="checkbox"]').should('be.checked')
  })

  it('should allow data zone configuration', () => {
    // Vérifier les contrôles de curseurs
    cy.contains('Curseurs de sélection').should('be.visible')
    
    // Vérifier les curseurs numériques
    cy.get('label').contains('Ligne d\'en-têtes').parent().find('input[type="number"]').should('have.value', '1')
    cy.get('label').contains('Début des données').parent().find('input[type="number"]').should('have.value', '2')
    
    // Tester la modification des curseurs
    cy.get('label').contains('Début des données').parent().find('input[type="number"]').clear().type('3')
    cy.get('label').contains('Début des données').parent().find('input[type="number"]').should('have.value', '3')
    
    // Vérifier que les champs se mettent à jour automatiquement
    cy.contains('Champs détectés').should('be.visible')
  })

  it('should allow sheet selection', () => {
    // Vérifier la sélection de feuille
    cy.contains('Feuille sélectionnée').should('be.visible')
    cy.get('select').first().should('have.value', 'Feuille 1')
    
    // Changer de feuille
    cy.get('select').first().select('Feuille 2')
    cy.get('select').first().should('have.value', 'Feuille 2')
  })

  it('should configure options', () => {
    // Vérifier les options
    cy.contains('Options').should('be.visible')
    
    // Tester les checkboxes
    cy.get('#includeFormulas').should('not.be.checked')
    cy.get('#includeFormulas').check().should('be.checked')
    
    cy.get('#preserveFormatting').should('be.checked')
    cy.get('#preserveFormatting').uncheck().should('not.be.checked')
  })

  it('should validate configuration and proceed', () => {
    // Valider la configuration
    cy.get('button').contains('Valider la configuration').click()
    
    // Vérifier que le bouton "Suivant" est maintenant activé
    cy.get('button').contains('Suivant').should('not.be.disabled')
    
    // Aller à l'étape suivante
    cy.get('button').contains('Suivant').click()
    cy.contains('3. Destinataires').should('be.visible')
  })

  it('should show proper visual feedback', () => {
    // Vérifier les curseurs visuels
    cy.get('.cursor-indicator').should('have.length', 2)
    cy.get('.cursor-header').should('contain', 'Entêtes')
    cy.get('.cursor-data').should('contain', 'Données')
    
    // Vérifier la configuration
    cy.get('.card.border-success').should('exist') // Configuration
    
    // Vérifier les lignes avec style dynamique
    cy.get('table tbody tr').first().should('have.attr', 'style')
    
    // Vérifier la responsivité du tableau
    cy.get('.table-responsive').should('exist')
    cy.get('table.table-bordered').should('exist')
  })
}) 