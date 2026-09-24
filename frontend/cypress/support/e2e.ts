// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import cypress-file-upload plugin
import 'cypress-file-upload';

// Import commands.js using ES2015 syntax:
import './commands'

// Import integration commands (auth-service / magic link)
import './integration-commands'

// Import slow mode support (si activé)
if (Cypress.env('SLOW_MODE')) {
  import('./slow-mode')
}

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Configuration globale pour les tests
beforeEach(() => {
  // Intercepter les erreurs non gérées
  cy.on('uncaught:exception', (err, runnable) => {
    // Retourner false pour empêcher Cypress de faire échouer le test
    // sur les erreurs non gérées (utile pour les erreurs de console)
    if (err.message.includes('ResizeObserver loop limit exceeded')) {
      return false
    }
    if (err.message.includes('Script error')) {
      return false
    }
    return true
  })
})

// Configuration pour les tests d'intégration
Cypress.on('test:before:run', (attributes) => {
  // Log des informations de test (console.log au lieu de cy.log)
  console.log(`Starting test: ${attributes.title}`)
})

Cypress.on('test:after:run', (attributes) => {
  // Log des résultats de test (console.log au lieu de cy.log)
  if (attributes.state === 'passed') {
    console.log(`✅ Test passed: ${attributes.title}`)
  } else if (attributes.state === 'failed') {
    console.log(`❌ Test failed: ${attributes.title}`)
  }
})

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-cy attribute.
       * @example cy.dataCy('greeting')
       */
      dataCy(value: string): Chainable<JQuery<HTMLElement>>
    }
  }
} 