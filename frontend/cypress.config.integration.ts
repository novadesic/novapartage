import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/integration/**/*.cy.{js,ts}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    slowTestThreshold: 10000,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
        FRONTEND_URL: 'http://localhost',
        AUTH_URL: 'http://localhost/auth',
        BACKEND_URL: 'http://localhost/backend',
        MAILPIT_URL: 'http://localhost:8025',
        CYPRESS_TEST_EMAIL: 'cypress@example.com'
      }
      return config
    },
  },

  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.ts'
  },
})
