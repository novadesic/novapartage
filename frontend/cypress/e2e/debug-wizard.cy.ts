/** Specs UI anciennes — à réactiver après alignement NovaPartage. */
describe.skip('Debug Wizard Navigation (legacy)', () => {
  it('should debug wizard step navigation', () => {
    cy.visit('/share/new')
    
    // Debug: Vérifier l'état initial
    cy.get('.step-indicator').should('have.length', 5)
    cy.get('[data-cy="step-content"], .step-content').should('exist')
    
    // Debug: Vérifier quelle étape est active
    cy.get('.step-indicator.active').should('contain', '1. Sélectionner un fichier')
    
    // Debug: Vérifier les boutons de navigation
    cy.get('button').contains('Suivant').should('exist')
    cy.get('button').contains('Précédent').should('exist')
    cy.get('button').contains('Précédent').should('be.disabled')
    
    // Sélectionner un fichier
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('test content'),
      fileName: 'debug-test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    // Attendre et vérifier que le fichier est sélectionné
    cy.get('.alert-success').should('contain', 'debug-test.xlsx')
    
    // Debug: Vérifier l'état du bouton Suivant
    cy.get('button').contains('Suivant').should('not.be.disabled')
    
    // Cliquer sur Suivant
    cy.get('button').contains('Suivant').click()
    
    // Debug: Vérifier quelle étape est maintenant active
    cy.wait(500) // Attendre la transition
    cy.get('.step-indicator.active').should('contain', '2. Données partageable')
    
    // Vérifier que nous sommes maintenant sur l'étape 2
    cy.contains('2. Données partageable').should('be.visible')
  })
}) 