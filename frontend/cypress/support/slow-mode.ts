// Support pour le mode lent - ralentit l'exécution des tests
// Utile pour observer le comportement en mode UI

// Délai par défaut entre les commandes (en millisecondes)
const DEFAULT_DELAY = 2000

// Délai entre les étapes de test (en millisecondes)
const STEP_DELAY = 5000

// Fonction pour ajouter un délai
function addDelay(ms: number = DEFAULT_DELAY) {
  if (Cypress.env('SLOW_MODE')) {
    cy.wait(ms)
  }
}

// Fonction pour ajouter un délai entre les étapes
function addStepDelay(ms: number = STEP_DELAY) {
  if (Cypress.env('SLOW_MODE')) {
    cy.wait(ms)
  }
}

// Override des commandes Cypress pour ajouter des délais automatiques
const originalVisit = cy.visit
cy.visit = function(url: string, options?: any) {
  const result = originalVisit.call(this, url, options)
  addDelay()
  return result
}

const originalClick = cy.click
cy.click = function(options?: any) {
  const result = originalClick.call(this, options)
  addDelay()
  return result
}

const originalType = cy.type
cy.type = function(text: string, options?: any) {
  const result = originalType.call(this, text, options)
  addDelay()
  return result
}

const originalGet = cy.get
cy.get = function(selector: string, options?: any) {
  const result = originalGet.call(this, selector, options)
  addDelay()
  return result
}

const originalRequest = cy.request
cy.request = function(options: any) {
  const result = originalRequest.call(this, options)
  addDelay()
  return result
}

// Ajouter des délais avant et après chaque test
beforeEach(() => {
  if (Cypress.env('SLOW_MODE')) {
    cy.log('⏱️ Mode lent activé - délai de 5 secondes avant le test')
    cy.wait(STEP_DELAY)
  }
})

afterEach(() => {
  if (Cypress.env('SLOW_MODE')) {
    cy.log('⏱️ Mode lent activé - délai de 5 secondes après le test')
    cy.wait(STEP_DELAY)
  }
})

// Exporter les fonctions pour utilisation manuelle
export { addDelay, addStepDelay }









