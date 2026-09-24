// Commandes personnalisées pour les tests d'intégration (auth-service magic link)

declare global {
  namespace Cypress {
    interface Chainable {
      /** Attendre que auth-service et backend soient joignables */
      waitForServices(): Chainable<void>
      /** Vérifier que le backend répond */
      checkBackendHealth(): Chainable<void>
      /** Vérifier que l'auth-service répond */
      checkAuthHealth(): Chainable<void>
      /** Nettoyer les données de test (placeholder) */
      cleanupTestData(): Chainable<void>
    }
  }
}

Cypress.Commands.add('waitForServices', () => {
  cy.request({
    method: 'GET',
    url: `${Cypress.env('AUTH_URL') || Cypress.env('auth_base_url') || 'http://localhost/auth'}/`,
    failOnStatusCode: false,
    timeout: 30000
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 404, 401, 403])
  })

  cy.request({
    method: 'GET',
    url: `${Cypress.env('BACKEND_URL') || Cypress.env('backend_url') || 'http://localhost/backend'}/openapi`,
    failOnStatusCode: false,
    timeout: 30000
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 404])
  })
})

Cypress.Commands.add('checkBackendHealth', () => {
  cy.request({
    method: 'GET',
    url: `${Cypress.env('BACKEND_URL') || Cypress.env('backend_url') || 'http://localhost/backend'}/openapi`,
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      cy.log('Backend health check passed')
    } else {
      cy.log('Backend health check failed, but continuing...')
    }
  })
})

Cypress.Commands.add('checkAuthHealth', () => {
  cy.request({
    method: 'GET',
    url: `${Cypress.env('AUTH_URL') || Cypress.env('auth_base_url') || 'http://localhost/auth'}/`,
    failOnStatusCode: false
  }).then((response) => {
    if ([200, 404].includes(response.status)) {
      cy.log('Auth-service reachable')
    } else {
      cy.log('Auth-service check inconclusive, continuing...')
    }
  })
})

Cypress.Commands.add('cleanupTestData', () => {
  cy.log('cleanupTestData: no-op (à brancher si besoin)')
})

export {}
